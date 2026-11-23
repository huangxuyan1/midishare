/**
 * POST /api/abc/generate - the AI assistant.
 *
 * Body: { prompt: string, currentAbc?: string }
 * Reply: { abc: string } or { error: string }
 *
 * The model call goes through DeepSpace's AI proxy (createDeepSpaceAI), so no
 * API key lives in the app. Passing the caller's JWT bills the signed-in user,
 * not the app owner. The ABC is checked with the same checkAbc the editor
 * uses; if it doesn't parse, the model gets one retry with the parse errors.
 */
import type { Hono } from 'hono'
import { APICallError, generateText, type ModelMessage } from 'ai'
import { createDeepSpaceAI, DEEPSPACE_AI_DEFAULTS } from 'deepspace/worker'
import { checkAbc } from '../lib/abc.js'
import { CLIP_LIMITS } from '../schemas/clips-schema.js'
import { resolveAuth } from './http-routes.js'
import type { AppContext } from '../../worker.js'

export const MAX_PROMPT_LENGTH = 500
const MAX_ATTEMPTS = 2
// A clip is at most 5000 characters, roughly 2000 tokens. DeepSpace reserves
// credits for the whole allowance before each call (64k tokens if unset), so
// keep it small: that also bounds what one request can cost.
const MAX_OUTPUT_TOKENS = 2000

const SYSTEM_PROMPT = `You write short musical clips in ABC notation (ABC standard 2.1).
Reply with ABC only: no explanation, no Markdown, no code fences.
Rules:
- Start with the headers X:1, T:<short title>, M:<meter>, L:<unit note length>, Q:<tempo>, and end the headers with K:<key>.
- One voice only. Do not use V: lines, lyrics (w:) or multiple tunes.
- Play notes together as a chord with square brackets, e.g. [DFA]2.
- Chord symbols in quotes like "Dm" are allowed.
- Keep it short: at most 16 bars, under ${CLIP_LIMITS.abc} characters.
- Every bar must add up to the meter.`

export function registerAbcRoutes(app: Hono<AppContext>): void {
  app.post('/api/abc/generate', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Sign in to use the assistant.' }, 401)

    const body = await c.req.json().catch(() => null)
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    const currentAbc = typeof body?.currentAbc === 'string' ? body.currentAbc : ''
    if (!prompt) return c.json({ error: 'Write a prompt first.' }, 400)
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return c.json({ error: `Keep the prompt under ${MAX_PROMPT_LENGTH} characters.` }, 400)
    }
    if (currentAbc.length > CLIP_LIMITS.abc) return c.json({ error: 'The current ABC is too long.' }, 400)

    // The JWT was already verified above; pass it on so the caller is billed.
    const token = c.req.header('Authorization')!.slice('Bearer '.length)
    const ai = createDeepSpaceAI(c.env, 'anthropic', { authToken: token })

    const request = currentAbc
      ? `${prompt}\n\nStart from this clip:\n${currentAbc}`
      : prompt
    const messages: ModelMessage[] = [{ role: 'user', content: request }]

    let errors: string[] = []
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let text: string
      try {
        const result = await generateText({
          model: ai(DEEPSPACE_AI_DEFAULTS.directGeneration),
          system: SYSTEM_PROMPT,
          messages,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        })
        text = result.text
      } catch (err) {
        if (APICallError.isInstance(err) && err.statusCode === 402) {
          return c.json({ error: 'Not enough DeepSpace credits for an AI request.' }, 402)
        }
        throw err
      }
      const abc = stripCodeFence(text)
      const check = checkAbc(abc)
      if (check.ok && abc.length <= CLIP_LIMITS.abc) return c.json({ abc })

      errors = check.ok ? [`The ABC is longer than ${CLIP_LIMITS.abc} characters.`] : check.errors
      // Show the model its answer and what was wrong, then ask again.
      messages.push({ role: 'assistant', content: text })
      messages.push({
        role: 'user',
        content: `That ABC has problems:\n${errors.join('\n')}\nReply with corrected ABC only.`,
      })
    }
    return c.json({ error: `The AI's ABC didn't parse: ${errors.join(' ')}` }, 502)
  })
}

/** Models sometimes wrap the answer in ```abc ... ``` despite being told not to. */
function stripCodeFence(text: string): string {
  return text.replace(/^\s*```[a-z]*\s*\n/i, '').replace(/\n```\s*$/, '').trim()
}
