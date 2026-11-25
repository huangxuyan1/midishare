/**
 * The button that switches between the dark and the light theme.
 * It shows a sun in the dark theme and a moon in the light one: the icon is
 * where a click takes you.
 */
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { getActiveTheme, setActiveTheme, type ThemeId } from '../themes'

export function ThemeToggle() {
  // Start from the default and read the real theme after mounting. The landing
  // page is prerendered without a browser, so the first render must not depend
  // on what this visitor saved.
  const [theme, setTheme] = useState<ThemeId>('studio')
  useEffect(() => setTheme(getActiveTheme()), [])

  const next: ThemeId = theme === 'studio' ? 'daylight' : 'studio'
  const label = next === 'daylight' ? 'Switch to the light theme' : 'Switch to the dark theme'

  function toggle() {
    setActiveTheme(next)
    setTheme(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
      className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {next === 'daylight' ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  )
}
