/**
 * A small piano roll, drawn as one SVG.
 *
 * - Double-click an empty spot to add a note.
 * - Drag a note to move it (left/right = time, up/down = pitch).
 * - Drag a note's right edge to make it longer or shorter.
 * - Double-click a note to delete it.
 *
 * Everything snaps to a 16th-note grid. While you drag, the roll shows a local
 * copy of the notes; onChange is called once, when you let go.
 *
 * Without onChange the roll is read-only: it only shows the notes and the
 * playhead. The clip page uses it that way.
 */
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { sortNotes, type Note } from '@/lib/abc-notes'
import { cn } from '@/lib/utils'

const STEP_W = 14 // pixels per 16th note
const ROW_H = 12 // pixels per semitone
const KEYS_W = 36 // keyboard labels on the left
const LOWEST = 36 // C2
const HIGHEST = 95 // B6
const EDGE = 6 // grab zone for resizing, at a note's right end
const BLACK_KEYS = [1, 3, 6, 8, 10]

type Drag = {
  index: number
  mode: 'move' | 'resize'
  /** Where the pointer went down. */
  x: number
  y: number
  original: Note
  /** The note as it is now, while dragging. */
  changed: Note
}

type Props = {
  notes: Note[]
  /** Length of one bar in 16ths (16 for 4/4, 12 for 3/4 or 6/8). */
  barSteps: number
  /** Called with the new notes after an edit. Leave it out for a read-only roll. */
  onChange?: (notes: Note[]) => void
  /** Playhead position in 16ths (see usePlayback). */
  playhead: number
  /** While playing, sounding notes light up and the view follows the playhead. */
  playing: boolean
  /** Extra classes for the scrolling box, e.g. its height. */
  className?: string
}

export function PianoRoll({ notes, barSteps, onChange, playhead, playing, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // The drag lives in a ref, not state: pointer events can arrive faster than
  // React re-renders, and each handler must see the latest drag right away.
  const drag = useRef<Drag | null>(null)
  const [dragged, setDragged] = useState<{ index: number; note: Note } | null>(null) // what to draw
  const [newLength, setNewLength] = useState(2) // new notes copy the last length you used
  const editable = onChange !== undefined

  const shown = dragged ? notes.map((n, i) => (i === dragged.index ? dragged.note : n)) : notes
  const lastEnd = Math.max(0, ...shown.map((n) => n.start + n.length))
  // When editing: at least 4 bars, and always one empty bar to grow into.
  const bars = editable ? Math.max(4, Math.ceil(lastEnd / barSteps) + 1) : Math.max(1, Math.ceil(lastEnd / barSteps))
  const steps = bars * barSteps
  const rows = HIGHEST - LOWEST + 1
  const width = KEYS_W + steps * STEP_W
  const height = rows * ROW_H

  // On first render, scroll so the notes (or middle C) are in view.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const pitches = notes.map((n) => n.pitch)
    const center = pitches.length ? (Math.min(...pitches) + Math.max(...pitches)) / 2 : 60
    el.scrollTop = rowY(center) - el.clientHeight / 2
    // Only on mount: later edits shouldn't jump the view.
  }, [])

  // While playing, scroll sideways to keep the playhead in view.
  const playheadX = KEYS_W + playhead * STEP_W
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !playing) return
    const visibleRight = el.scrollLeft + el.clientWidth
    if (playheadX > visibleRight - 40 || playheadX < el.scrollLeft + KEYS_W) {
      el.scrollLeft = playheadX - KEYS_W - 40
    }
  }, [playheadX, playing])

  function pointInGrid(e: { clientX: number; clientY: number }) {
    const box = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - box.left - KEYS_W, y: e.clientY - box.top }
  }

  function addNote(e: MouseEvent) {
    const { x, y } = pointInGrid(e)
    if (x < 0) return
    const note = { pitch: pitchAt(y), start: Math.floor(x / STEP_W), length: newLength }
    onChange?.(sortNotes([...notes, note]))
  }

  function deleteNote(index: number) {
    onChange?.(notes.filter((_, i) => i !== index))
  }

  function startDrag(e: PointerEvent, index: number) {
    if (e.button !== 0) return
    const note = notes[index]
    const { x, y } = pointInGrid(e)
    const noteRight = (note.start + note.length) * STEP_W
    // Capture on the note, so the drag keeps getting events when the pointer
    // leaves it. Not on the SVG: the browser sends click and double-click to
    // the capturing element, and the note's double-click (delete) would never fire.
    e.currentTarget.setPointerCapture(e.pointerId)
    const mode = noteRight - x <= EDGE ? 'resize' : 'move'
    drag.current = { index, mode, x, y, original: note, changed: note }
    setDragged({ index, note })
  }

  function moveDrag(e: PointerEvent) {
    const d = drag.current
    if (!d) return
    const { x, y } = pointInGrid(e)
    const dSteps = Math.round((x - d.x) / STEP_W)
    const dRows = Math.round((y - d.y) / ROW_H)
    const o = d.original
    d.changed =
      d.mode === 'move'
        ? {
            ...o,
            start: Math.max(0, o.start + dSteps),
            pitch: clamp(o.pitch - dRows, LOWEST, HIGHEST), // screen y grows downward
          }
        : { ...o, length: Math.max(1, o.length + dSteps) }
    setDragged({ index: d.index, note: d.changed })
  }

  function endDrag(e: PointerEvent) {
    moveDrag(e) // count the final position even if no move event came before it
    const d = drag.current
    if (d) {
      if (d.mode === 'resize') setNewLength(d.changed.length)
      if (JSON.stringify(d.changed) !== JSON.stringify(d.original)) {
        onChange?.(sortNotes(notes.map((n, i) => (i === d.index ? d.changed : n))))
      }
    }
    cancelDrag()
  }

  function cancelDrag() {
    drag.current = null
    setDragged(null)
  }

  return (
    <div ref={scrollRef} className={cn('h-80 overflow-auto bg-roll', className)} data-testid="piano-roll">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
        className="select-none"
      >
        {/* Rows: one per pitch. Black-key rows are darker. */}
        {Array.from({ length: rows }, (_, r) => {
          const pitch = HIGHEST - r
          const black = BLACK_KEYS.includes(pitch % 12)
          return (
            <g key={pitch}>
              <rect x={0} y={r * ROW_H} width={width} height={ROW_H} className={black ? 'fill-roll-dark' : 'fill-transparent'} />
              {/* The keyboard, in real piano colors. */}
              <rect
                x={0}
                y={r * ROW_H}
                width={KEYS_W}
                height={ROW_H}
                className={black ? 'fill-key-black' : 'fill-key-white stroke-roll-bar'}
              />
              {pitch % 12 === 0 && (
                <text x={4} y={r * ROW_H + ROW_H - 2} className="fill-key-black font-mono text-[9px]">
                  C{pitch / 12 - 1}
                </text>
              )}
            </g>
          )
        })}

        {/* Vertical lines: bars strong, beats (quarter notes) light. */}
        {Array.from({ length: steps / 4 + 1 }, (_, i) => {
          const step = i * 4
          return (
            <line
              key={step}
              x1={KEYS_W + step * STEP_W}
              x2={KEYS_W + step * STEP_W}
              y1={0}
              y2={height}
              className={step % barSteps === 0 ? 'stroke-roll-bar' : 'stroke-roll-line'}
            />
          )
        })}

        {/* Double-click target for adding notes (behind the notes). */}
        {editable && (
          <rect x={KEYS_W} y={0} width={steps * STEP_W} height={height} fill="transparent" onDoubleClick={addNote} />
        )}

        {shown.map((n, i) => {
          const sounding = playing && n.start <= playhead && playhead < n.start + n.length
          return (
          <rect
            key={i}
            data-testid="roll-note"
            data-sounding={sounding || undefined}
            x={KEYS_W + n.start * STEP_W + 1}
            y={rowY(n.pitch) + 1}
            width={n.length * STEP_W - 2}
            height={ROW_H - 2}
            rx={2}
            // A resting note is pale; it turns amber while it sounds.
            className={sounding ? 'fill-primary' : dragged?.index === i ? 'fill-note/70' : 'fill-note'}
            style={{ cursor: editable ? 'grab' : 'default' }}
            onPointerDown={editable ? (e) => startDrag(e, i) : undefined}
            onDoubleClick={
              editable
                ? (e) => {
                    e.stopPropagation()
                    deleteNote(i)
                  }
                : undefined
            }
          >
            <title>
              {editable
                ? `${noteName(n.pitch)} · drag to move, drag the right edge to resize, double-click to delete`
                : noteName(n.pitch)}
            </title>
          </rect>
          )
        })}

        {/* The playhead. pointer-events-none so it never blocks clicks on notes. */}
        <line
          data-testid="playhead"
          x1={playheadX}
          x2={playheadX}
          y1={0}
          y2={height}
          className="pointer-events-none stroke-primary"
          strokeWidth={2}
        />
      </svg>
    </div>
  )
}

function rowY(pitch: number) {
  return (HIGHEST - pitch) * ROW_H
}

function pitchAt(y: number) {
  return clamp(HIGHEST - Math.floor(y / ROW_H), LOWEST, HIGHEST)
}

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value))
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
function noteName(pitch: number) {
  return `${NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`
}
