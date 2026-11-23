/**
 * The AI prompt box on the clip editor. Sends the prompt (and optionally the
 * current ABC, for variations) to POST /api/abc/generate, which returns ABC
 * that already passed checkAbc on the server.
 */
import { useState } from 'react'
import { getAuthToken } from 'deepspace'
import { Sparkles } from 'lucide-react'
import { Button, Checkbox, Input, Label } from '@/components/ui'

const MAX_PROMPT_LENGTH = 500 // same cap as the server route

type Props = {
  currentAbc: string
  onResult: (abc: string) => void
}

export function AiAssist({ currentAbc, onResult }: Props) {
  const [prompt, setPrompt] = useState('')
  const [useCurrent, setUseCurrent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/abc/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, currentAbc: useCurrent ? currentAbc : undefined }),
      })
      const body = (await res.json().catch(() => ({}))) as { abc?: string; error?: string }
      if (!res.ok || !body.abc) throw new Error(body.error ?? `Request failed (${res.status})`)
      onResult(body.abc)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3" data-testid="ai-assist">
      <Label htmlFor="ai-prompt">Ask the AI</Label>
      <div className="flex gap-2">
        <Input
          id="ai-prompt"
          value={prompt}
          maxLength={MAX_PROMPT_LENGTH}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && prompt.trim() && !busy && generate()}
          placeholder="4-bar lo-fi chord progression in D minor"
        />
        <Button onClick={generate} disabled={busy || prompt.trim() === ''}>
          <Sparkles className="size-4" /> {busy ? 'Writing…' : 'Generate'}
        </Button>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Checkbox checked={useCurrent} onCheckedChange={setUseCurrent} />
        Start from the current ABC (for variations)
      </label>
      {error && (
        <p className="text-sm text-destructive" data-testid="ai-error">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">The result replaces the ABC below. Check it before you save.</p>
    </div>
  )
}
