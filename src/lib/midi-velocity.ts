/**
 * Rewrites how hard each note is struck (its velocity, 1 to 127) in a MIDI
 * file, so that Modular plays a clip's accents the way the abcjs synth does.
 *
 * Why: abcjs gives every clip a beat accent. It writes velocity 105 on the
 * first beat of a bar, 95 on the other beats and 85 between beats. The two
 * engines turn velocity into loudness differently:
 * - the abcjs synth makes loudness proportional to the velocity;
 * - Modular follows the SoundFont rule, where loudness is proportional to the
 *   velocity squared. That makes the same accents about twice as strong.
 *
 * So each velocity v is replaced by the square root of v * 127. Squared by
 * the SoundFont rule, that is proportional to v again: 105, 95 and 85 become
 * 115, 110 and 104.
 *
 * Only the copy sent to Modular is changed. Download .mid keeps abcjs's own
 * velocities. The file layout is described in midi-import.ts.
 */

/** The velocity that sounds, in a SoundFont, as loud as `velocity` does in the abcjs synth. */
export function soundfontVelocity(velocity: number): number {
  return Math.round(Math.sqrt(velocity * 127))
}

/** A copy of the MIDI file with every note's velocity rewritten. Notes and timing are untouched. */
export function withSoundfontVelocities(midi: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(midi)
  const view = new DataView(bytes.buffer)
  if (bytes.length < 14 || chunkName(bytes, 0) !== 'MThd') return bytes // not a MIDI file: Modular will say so

  let at = 8 + view.getUint32(4) // the first chunk after the header
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at + 4)
    if (chunkName(bytes, at) === 'MTrk') rewriteTrack(bytes, at + 8, Math.min(bytes.length, at + 8 + length))
    at += 8 + length
  }
  return bytes
}

function chunkName(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(...bytes.subarray(at, at + 4))
}

/** Walks the events of one track, from `pos` to `end`, and rewrites the velocity of each note-on. */
function rewriteTrack(bytes: Uint8Array, pos: number, end: number) {
  let status = 0 // the current event type; an event may leave it out to repeat the last one

  function readVariableLength(): number {
    let value = 0
    let byte: number
    do {
      byte = bytes[pos++]
      value = value * 128 + (byte & 0x7f)
    } while (byte & 0x80 && pos < end)
    return value
  }

  while (pos < end) {
    readVariableLength() // the time since the event before; not needed here
    if (bytes[pos] & 0x80) status = bytes[pos++]

    // Meta events (FF): type, length, data.
    if (status === 0xff) {
      pos++
      pos += readVariableLength()
      continue
    }
    // System-exclusive events (F0, F7): length, data.
    if (status === 0xf0 || status === 0xf7) {
      pos += readVariableLength()
      continue
    }

    // Channel events: the high half of the status is the type. All have two
    // data bytes, except program change (C0) and channel pressure (D0) with one.
    const type = status & 0xf0
    if (type === 0xc0 || type === 0xd0) {
      pos += 1
      continue
    }
    // A note-on is the pitch, then the velocity. Velocity 0 means "note off" and stays 0.
    if (type === 0x90 && bytes[pos + 1] > 0) bytes[pos + 1] = soundfontVelocity(bytes[pos + 1])
    pos += 2
  }
}
