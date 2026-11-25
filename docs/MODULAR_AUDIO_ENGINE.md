# Modular as the audio engine (the plan from 2026-11-23; built on 2026-11-24)

Status on 2026-11-24: **built.** The site plays through Modular; see `src/lib/audio-engine.ts`, `src/lib/modular-engine.ts` and the rows of that day in [BUILD_LOG.md](BUILD_LOG.md). What was built differs from this plan in places: Modular renders each clip whole into a buffer that Web Audio plays, and the soundfont instrument is a node inside Modular. The rest of this file is the plan as written on 2026-11-23, kept for the record.

This file records what the agent found when it inspected Modular, and the plan that came out of it, so the work can start later without repeating the inspection.

- Modular: `C:\Users\alvin\Documents\Projects\Modular`, public GitHub `huangxuyan1/Modular`.
- Inspected read-only at commit `a8c433b` on `main`. Nothing in Modular was changed.
- Facts about Modular below were true at that commit. Check them again before relying on them.

## How midishare makes sound today

`src/lib/use-playback.ts` uses the synth built into abcjs:

1. abcjs parses the ABC into note events.
2. `synth.init` downloads one recorded piano note per pitch from a public soundfont (FluidR3_GM) on `paulrosen.github.io/midi-js-soundfonts`.
3. `synth.prime()` mixes the whole clip into one audio buffer. `synth.start()` plays it through Web Audio, and `seek` is how Play resumes from the playhead.

The playhead is not driven by the audio. It is computed from the clock and the tune's milliseconds per bar.

Two weaknesses: the samples come from a third-party host at play time, and the sound is not Xuyan's own work.

## What Modular has

Modular is a C++20 graph runtime: `kernel/` (graph, typed ports, compile, block loop), `nodes/` (primitive nodes), `workspace/` (authoring), `apps/` (a render CLI, a MIDI CLI, a Windows graph editor).

| Have | Detail |
|---|---|
| MIDI playback nodes | `MidiFileNode` and `MidiBlockNode` play stored MIDI when triggered. `MidiFile::parse(bytes)` reads a Standard MIDI File from memory. |
| Polyphony | `VoiceAllocatorNode` splits one MIDI stream into N mono streams. `MixNode` sums them. `GainNode` sets the level. |
| Offline sink | `CaptureSinkNode` collects the rendered audio in memory. |
| Example host | `apps/midi_cli/main.cpp` builds trigger → MIDI file → 8 voices → mix → gain → capture, and runs `Engine::process` block by block. |

| Missing | Detail |
|---|---|
| A web build | Nothing in the repo mentions Emscripten or WebAssembly. `emcc` is not installed on Xuyan's Windows machine. |
| A browser audio output | `AudioOutputNode` uses Windows WinMM. |
| A usable instrument | `SineSynthNode` is a bare sine with hard on/off: no envelope, and velocity is ignored. |
| Sample playback | No soundfont parser and no sample-player node. |
| Seek | `MidiBlockNode` always starts from the top. Its docs say seek and loop are deferred. |

## The route: render offline, play with Web Audio

Keep the shape midishare already has. Only the step that makes the audio buffer changes.

```text
ABC -> abcjs MIDI bytes -> MidiFile::parse -> MidiFileNode -> VoiceAllocator
    -> instrument voices -> Mix -> Gain -> CaptureSink -> Float32Array -> Web Audio buffer
```

- abcjs already produces the MIDI bytes; Download .mid uses them. What you hear would equal what you download.
- Seek, stop and resume stay in Web Audio, so Modular's missing seek does not matter.
- abcjs stays for parsing, sheet music and MIDI export.
- A realtime AudioWorklet version would also need a sink node that hands over one block at a time, and seek in `MidiBlockNode`. Leave it for later.

## What to build

### In Modular

| Piece | What it is |
|---|---|
| Emscripten build | A target for `modular_kernel`, the header-only nodes and `modular_midi`. C++ exceptions must be enabled, because graph and compile errors throw. No threads and no filesystem are needed. |
| Render function | One exported function, for example `render(midiBytes, sampleRate) -> samples`. It builds the graph the way `midi_cli` does, with about 16 voices instead of 8, and renders extra frames after the last note for the release tail. |
| Instrument | The soundfont supernode below. The existing sine voice is enough to prove the pipeline first. |

### The soundfont supernode

A supernode is an inner graph of primitive nodes with boundary nodes for its ports. It is flattened at compile.

| Piece | What it is |
|---|---|
| SF2 parser | Reads a soundfont at authoring time, as `MidiFile` does for MIDI: sample data, key and velocity ranges, root key and tuning, loop points, volume envelope. A subset that covers one piano preset is enough. |
| Sample voice node (primitive) | MIDI events in, mono audio out. Note-on picks the zone, resamples to pitch, loops, and applies velocity and the envelope. Note-off starts the release. Output must not depend on block size, and `process()` must not allocate. |
| The supernode | MIDI-in boundary → `VoiceAllocatorNode(16)` → 16 sample voices → `MixNode` → audio-out boundary. Everything except the voices exists. |
| A soundfont file | A small piano SF2 with a licence that allows redistribution. FluidR3_GM is far too large to send to a browser. |

Open design questions, for Modular's own grilling:

- **Shared sample data.** If each of the 16 voices owns a copy of the samples, memory multiplies. Sharing one copy touches Modular's rule that stored content belongs to its node.
- **Release tails.** `VoiceAllocatorNode` frees a voice at note-off, so the next note can cut a tail that is still sounding.

### In midishare

| Piece | What it is |
|---|---|
| The built engine | Commit the `.wasm` and its loader, and record the Modular commit it was built from. `deepspace deploy` runs `vite build` and cannot run `emcc`. |
| Loader | A small module that loads the WASM once and exposes `renderClip(midiBytes, sampleRate)`. |
| `src/lib/use-playback.ts` | Replace `synth.init`, `prime`, `start`, `seek` and `stop` with: render through Modular, wrap the samples in an `AudioBuffer`, and play it with an `AudioBufferSourceNode` started at the playhead's offset. The playhead code stays. The duration comes from the buffer. |
| Docs | README, SUBMISSION.md and HANDOFF.md list "Modular/WASM playback" as out of scope. Change them when this ships. |

## Order and risks

1. Install Emscripten and get the kernel to build to WASM.
2. Get the sine voice playing in midishare end to end. This proves the risky parts: toolchain, loading, playback.
3. Build the soundfont supernode and swap it in.
4. Keep the abcjs synth until the Modular path is verified on the live site. Then remove it.

Risks:

- **Toolchain.** The first WASM build of a C++20 project usually needs fixes.
- **Sound.** A sine voice sounds worse than the sampled piano. Only the soundfont voice makes this an improvement.
- **Modular's process.** Its `CLAUDE.md` asks for grilling, a spec and tickets before code, with Xuyan choosing each phase. Do this work in a session opened in the Modular folder.
- **Work in flight.** On 2026-11-23 Modular had an open worktree named `audio-subtype-spec` and had been edited that morning.
