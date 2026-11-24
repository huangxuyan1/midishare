/**
 * The audio engine that uses the synth built into abcjs.
 *
 * abcjs downloads one recorded piano note per pitch from its sample host
 * (and keeps them for the life of the page), then mixes the whole clip into
 * one buffer. We take that buffer and play it ourselves (see audio-engine.ts),
 * so abcjs's own start, seek and stop are not used.
 */
import abcjs from 'abcjs'
import type { AudioEngine } from './audio-engine'

export const abcjsEngine: AudioEngine = {
  async render(abc, context) {
    const [tune] = abcjs.parseOnly(abc)
    if (!tune) return null
    const synth = new abcjs.synth.CreateSynth()
    // Loads the instrument samples, then renders the audio buffer.
    await synth.init({ visualObj: tune, audioContext: context })
    await synth.prime()
    return synth.getAudioBuffer() ?? null // no buffer when the tune has no notes
  },
}
