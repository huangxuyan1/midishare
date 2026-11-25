/**
 * /ableton - what MIDI Clipboard is and how to get it.
 *
 * MIDI Clipboard is a separate project (a remote script for Ableton Live) that
 * pastes ABC text from the clipboard into a MIDI clip, and copies notes out of
 * Live as ABC. This page only describes it and links to its latest release
 * and its install guide on GitHub; there is no data here, so it reads nothing
 * from DeepSpace.
 *
 * Keep the claims in step with that repo's README. If it changes (new
 * shortcuts, another platform), change the text here.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { LEGEND } from '@/lib/utils'

const REPO_URL = 'https://github.com/huangxuyan1/midi-clipboard'
const DOWNLOAD_URL = `${REPO_URL}/releases/latest`
const INSTALL_URL = `${REPO_URL}#install`

const PRIMARY_LINK =
  'inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90'
const QUIET_LINK =
  'inline-flex h-11 items-center gap-2 rounded-md border border-border px-5 text-sm font-medium text-foreground hover:bg-accent'
const TEXT_LINK = 'text-foreground underline underline-offset-4 hover:text-primary'

/** A keyboard shortcut, e.g. <Shortcut keys={['Ctrl', 'C']} />. The keys stay on one line. */
function Shortcut({ keys }: { keys: string[] }) {
  return (
    <span className="whitespace-nowrap">
      {keys.map((key) => (
        <kbd key={key} className="mx-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
          {key}
        </kbd>
      ))}
    </span>
  )
}

/** From a clip on this site to a clip in Live, and back. */
const STEPS: { name: string; text: ReactNode }[] = [
  {
    name: 'Copy',
    text: (
      <>
        Open any clip here and press <strong className="font-medium text-foreground">Copy ABC</strong>.
      </>
    ),
  },
  {
    name: 'Paste',
    text: (
      <>
        In Live, open a MIDI clip and press <Shortcut keys={['Ctrl', 'Shift', 'V']} />, or{' '}
        <Shortcut keys={['Cmd', 'Shift', 'V']} /> on a Mac. The notes are in the clip.
      </>
    ),
  },
  {
    name: 'Send it back',
    text: (
      <>
        Select notes in Live and press <Shortcut keys={['Ctrl', 'C']} />, or <Shortcut keys={['Cmd', 'C']} /> on a
        Mac. They are on your clipboard as ABC, ready to paste into a new clip here.
      </>
    ),
  },
]

const INSTALL = [
  'Download the zip for Windows or for macOS from GitHub, and unzip it.',
  "Put the MidiClipboard folder in Ableton's User Library, inside Remote Scripts, and restart Live.",
  "In Live's preferences, under Link/Tempo/MIDI, pick MidiClipboard as a Control Surface.",
]

const GOOD_TO_KNOW = [
  'It works with Ableton Live 11 and 12, on Windows 10 or 11 and on macOS 10.15 or later.',
  'A Mac needs two extra steps, because Apple has not notarized the helper. The install guide has them.',
  "Every note keeps its pitch, start and length. Velocity does not carry over: ABC has no place for it, so pasted notes get Live's default velocity.",
  'Chord symbols like "Dm" paste as a bass-and-chord accompaniment, the same notes this site plays.',
  "The shortcuts only work while Live is the front window, and Live's own copy and paste keep working.",
]

export default function AbletonPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-14 px-4 py-12">
      <header className="flex flex-col items-start gap-5">
        <p className={LEGEND}>MIDI Clipboard for Ableton Live</p>
        <h1 className="font-mono text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Paste a clip into Ableton.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          MIDI Clipboard is a small add-on for Ableton Live. Copy a clip here, press one shortcut in Live, and the
          notes are in your MIDI clip. No file to export, nothing to drag.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" className={PRIMARY_LINK}>
            Get MIDI Clipboard <ExternalLink className="size-4" aria-hidden />
          </a>
          <Link to="/home" className={QUIET_LINK}>
            Browse clips <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className={LEGEND}>How it works</h2>
        <ol className="divide-y divide-border border-y border-border">
          {STEPS.map((step, i) => (
            <li key={step.name} className="grid grid-cols-[2.5rem_1fr] items-baseline gap-x-4 gap-y-1 py-5 sm:grid-cols-[2.5rem_9rem_1fr]">
              <span className="font-mono text-sm text-primary">0{i + 1}</span>
              <span className="font-medium">{step.name}</span>
              <span className="col-start-2 text-muted-foreground sm:col-start-3">{step.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-10 md:grid-cols-2">
        <section className="flex flex-col gap-4">
          <h2 className={LEGEND}>Install</h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground marker:font-mono marker:text-primary">
            {INSTALL.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            The exact folder and menu names are in the{' '}
            <a href={INSTALL_URL} target="_blank" rel="noreferrer" className={TEXT_LINK}>
              install guide on GitHub
            </a>
            .
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className={LEGEND}>Good to know</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted-foreground marker:text-primary">
            {GOOD_TO_KNOW.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
