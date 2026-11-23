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
 */
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { sortNotes, type Note } from '@/lib/abc-notes'

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
  x: number
  y: number
  original: Note
}

type Props = {
  notes: Note[]
  /** Length of one bar in 16ths (16 for 4/4, 12 for 3/4 or 6/8). */
  barSteps: number
  onChange: (notes: Note[]) => void
}

export function PianoRoll({ notes, barSteps, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [draft, setDraft] = useState<Note[] | null>(null) // notes while dragging
  const [newLength, setNewLength] = useState(2) // new notes copy the last length you used

  const shown = draft ?? notes
  const lastEnd = Math.max(0, ...shown.map((n) => n.start + n.length))
  const bars = Math.max(4, Math.ceil(lastEnd / barSteps) + 1) // always one empty bar to grow into
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

  function pointInGrid(e: { clientX: number; clientY: number }) {
    const box = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - box.left - KEYS_W, y: e.clientY - box.top }
  }

  function addNote(e: MouseEvent) {
    const { x, y } = pointInGrid(e)
    if (x < 0) return
    const note = { pitch: pitchAt(y), start: Math.floor(x / STEP_W), length: newLength }
    onChange(sortNotes([...notes, note]))
  }

  function deleteNote(index: number) {
    onChange(notes.filter((_, i) => i !== index))
  }

  function startDrag(e: PointerEvent, index: number) {
    if (e.button !== 0) return
    const note = notes[index]
    const { x, y } = pointInGrid(e)
    const noteRight = (note.start + note.length) * STEP_W
    svgRef.current!.setPointerCapture(e.pointerId)
    setDrag({ index, mode: noteRight - x <= EDGE ? 'resize' : 'move', x, y, original: note })
    setDraft(notes)
  }

  function moveDrag(e: PointerEvent) {
    if (!drag) return
    const { x, y } = pointInGrid(e)
    const dSteps = Math.round((x - drag.x) / STEP_W)
    const dRows = Math.round((y - drag.y) / ROW_H)
    const o = drag.original
    const changed: Note =
      drag.mode === 'move'
        ? {
            ...o,
            start: Math.max(0, o.start + dSteps),
            pitch: clamp(o.pitch - dRows, LOWEST, HIGHEST), // screen y grows downward
          }
        : { ...o, length: Math.max(1, o.length + dSteps) }
    setDraft(notes.map((n, i) => (i === drag.index ? changed : n)))
  }

  function endDrag() {
    if (drag && draft) {
      const changed = draft[drag.index]
      if (drag.mode === 'resize') setNewLength(changed.length)
      if (JSON.stringify(changed) !== JSON.stringify(drag.original)) onChange(sortNotes(draft))
    }
    setDrag(null)
    setDraft(null)
  }

  return (
    <div ref={scrollRef} className="h-80 overflow-auto rounded-md border border-border bg-background" data-testid="piano-roll">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="select-none"
      >
        {/* Rows: one per pitch, black keys darker. */}
        {Array.from({ length: rows }, (_, r) => {
          const pitch = HIGHEST - r
          const black = BLACK_KEYS.includes(pitch % 12)
          return (
            <g key={pitch}>
              <rect x={0} y={r * ROW_H} width={width} height={ROW_H} className={black ? 'fill-muted' : 'fill-background'} />
              <rect x={0} y={r * ROW_H} width={KEYS_W} height={ROW_H} className={black ? 'fill-foreground/70' : 'fill-card'} />
              {pitch % 12 === 0 && (
                <text x={4} y={r * ROW_H + ROW_H - 2} className="fill-muted-foreground text-[9px]">
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
              className={step % barSteps === 0 ? 'stroke-foreground/40' : 'stroke-border'}
            />
          )
        })}

        {/* Double-click target for adding notes (behind the notes). */}
        <rect x={KEYS_W} y={0} width={steps * STEP_W} height={height} fill="transparent" onDoubleClick={addNote} />

        {shown.map((n, i) => (
          <rect
            key={i}
            data-testid="roll-note"
            x={KEYS_W + n.start * STEP_W + 1}
            y={rowY(n.pitch) + 1}
            width={n.length * STEP_W - 2}
            height={ROW_H - 2}
            rx={2}
            className={drag?.index === i ? 'fill-primary/70' : 'fill-primary'}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => startDrag(e, i)}
            onDoubleClick={(e) => {
              e.stopPropagation()
              deleteNote(i)
            }}
          >
            <title>{`${noteName(n.pitch)} · drag to move, drag the right edge to resize, double-click to delete`}</title>
          </rect>
        ))}
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
