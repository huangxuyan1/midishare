/**
 * Design Direction
 *
 * Product: midishare is where people who write short musical ideas keep them
 *   as ABC text that plays, edits on a piano roll, and pastes anywhere.
 * Emotion: the quiet focus of a late session, when a four-bar loop finally sits right.
 * Metaphor: a step sequencer's lit grid in a dim room.
 * References: the faceplate lettering of a hardware synth; a mixing desk's
 *   meter bridge; a typeset tune book.
 * Signature: a piano roll whose amber playhead turns each note amber as it passes.
 * Hero: the playhead crosses a two-bar clip, with the same clip as ABC text under it.
 *
 * Style Tile
 * - Color: warm near-black dominant, amber accent, muted everywhere except what plays.
 * - Type: IBM Plex Mono (headline, labels) + IBM Plex Sans (body) — the product
 *   is plain text you can read, so the headline is set like text you could paste.
 * - Theme: dark by default — a music tool, used next to a DAW. A light theme
 *   (Daylight, see themes.css) is one click away.
 * - Art direction: modern minimalism — flat panels, hairline borders, one accent.
 * - Motion: mechanical — one linear sweep of the playhead, nothing else moves.
 * - Voice: second person; short sentences; no exclamation points.
 */
/**
 * Landing page — a STATIC page.
 *
 * It lives at the top level of src/pages/ (not under (app)/), so it renders
 * with no DeepSpace providers: no auth session fetch, no records WebSocket.
 * It is also prerendered to static HTML at build (prerender.ts), so it must
 * render without a browser: no window/document during render, and the one
 * animation is CSS keyframes (see the end of styles.css).
 * `<Seo>` comes first and reads src/seo.ts.
 */

import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Logo } from '../components/Logo'
import { Seo } from '../components/Seo'
import { ThemeToggle } from '../components/ThemeToggle'
import { DemoClip } from '../components/landing/DemoClip'
import { LEGEND } from '../lib/utils'
import { seo } from '../seo'

/** What you can do with one clip. Shown as a numbered list, not as cards. */
const WAYS = [
  { name: 'Play it', text: 'Press space. The playhead runs across the roll and the notes light up.' },
  { name: 'Edit it', text: 'Drag notes on the piano roll or type the ABC. Each one rewrites the other.' },
  { name: 'Ask for it', text: 'Describe a loop. The AI drafts it as ABC, and only ABC that parses comes back.' },
  { name: 'Take it', text: 'Copy the text into a chat, a note or a forum post. Or download a .mid file.' },
]

const PRIMARY_LINK =
  'inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90'
const QUIET_LINK =
  'inline-flex h-11 items-center gap-2 rounded-md border border-border px-5 text-sm font-medium text-foreground hover:bg-accent'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="flex min-h-screen flex-col">
        <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Logo />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/home" className="text-sm text-muted-foreground hover:text-foreground">
              Browse clips
            </Link>
          </div>
        </header>

        <main className="flex-1">
          {/* Hero: the pitch on the left, a clip playing on the right. */}
          <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[5fr_6fr] lg:py-24">
            <div>
              <p className={LEGEND}>Music clips as ABC text</p>
              <h1 className="mt-5 font-mono text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
                Music you can paste.
              </h1>
              <p className="mt-6 max-w-md text-lg text-muted-foreground">
                Every clip here is a few lines of ABC text. Draw it on a piano roll, hear it, then copy it anywhere
                text goes.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/home" className={PRIMARY_LINK}>
                  Browse clips <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link to="/new" className={QUIET_LINK}>
                  Write a clip
                </Link>
              </div>
            </div>
            <DemoClip />
          </section>

          <section className="border-y border-border bg-card">
            <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1fr_2fr]">
              <h2 className="text-3xl font-semibold leading-tight">One clip. Four things to do with it.</h2>
              <ol className="divide-y divide-border border-y border-border">
                {WAYS.map((way, i) => (
                  <li key={way.name} className="grid grid-cols-[2.5rem_1fr] items-baseline gap-x-4 gap-y-1 py-5 sm:grid-cols-[2.5rem_8rem_1fr]">
                    <span className="font-mono text-sm text-primary">0{i + 1}</span>
                    <span className="font-medium">{way.name}</span>
                    <span className="col-start-2 text-muted-foreground sm:col-start-3">{way.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-20">
            <h2 className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl">Start with four bars.</h2>
            <Link to="/home" className={PRIMARY_LINK}>
              Open the library <ArrowRight className="size-4" aria-hidden />
            </Link>
          </section>
        </main>

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6">
            <Logo />
            <p className="text-xs text-muted-foreground">Built on DeepSpace. Notation and sound by abcjs.</p>
          </div>
        </footer>
      </div>
    </>
  )
}
