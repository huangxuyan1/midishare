/**
 * Tempo, meter and key, read from and written to the ABC header lines.
 * The parent turns each change into new ABC (see ClipForm).
 */
import { useState } from 'react'
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import type { AbcHeaders } from '@/lib/abc-headers'

const METERS = ['4/4', '3/4', '2/4', '6/8']
const KEYS = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db',
  'Am', 'Em', 'Bm', 'F#m', 'C#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm',
]

type Props = {
  headers: AbcHeaders
  onTempo: (bpm: number) => void
  onMeter: (meter: string) => void
  onKey: (key: string) => void
}

export function MetadataFields({ headers, onTempo, onMeter, onKey }: Props) {
  // Keep an unusual value from the ABC selectable instead of hiding it.
  const meters = METERS.includes(headers.meter) ? METERS : [headers.meter, ...METERS]
  const keys = KEYS.includes(headers.key) ? KEYS : [headers.key, ...KEYS]

  // The tempo box keeps its own text, so you can type "9" on the way to "90"
  // without it snapping back. When the ABC's tempo changes, the box follows.
  const [tempoText, setTempoText] = useState(String(headers.tempo))
  const [shownTempo, setShownTempo] = useState(headers.tempo)
  if (headers.tempo !== shownTempo) {
    setShownTempo(headers.tempo)
    setTempoText(String(headers.tempo))
  }

  return (
    <div className="flex flex-wrap gap-4" data-testid="metadata">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tempo">Tempo (BPM)</Label>
        <Input
          id="tempo"
          type="number"
          min={20}
          max={300}
          className="w-24 font-mono"
          value={tempoText}
          onChange={(e) => {
            setTempoText(e.target.value)
            const bpm = Number(e.target.value)
            if (bpm >= 20 && bpm <= 300) onTempo(bpm)
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="meter">Meter</Label>
        <Select value={headers.meter} onValueChange={onMeter}>
          <SelectTrigger id="meter" className="w-24 font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {meters.map((m) => (
              <SelectItem key={m} value={m} className="font-mono">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="key">Key</Label>
        <Select value={headers.key} onValueChange={onKey}>
          <SelectTrigger id="key" className="w-24 font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {keys.map((k) => (
              <SelectItem key={k} value={k} className="font-mono">
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
