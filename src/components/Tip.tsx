/**
 * A tooltip around one element, usually a button:
 *   <Tip text="Undo (Ctrl+Z)"><Button>…</Button></Tip>
 * It uses the UI kit's Tooltip, so it follows the theme (a `title` attribute
 * would show the browser's own tooltip).
 */
import type { ReactElement } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui'

export function Tip({ text, children }: { text: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}
