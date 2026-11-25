/**
 * Theme catalog and the theme switch.
 *
 * The app has two themes: `studio` (dark, the default) and `daylight` (light).
 * The active one is the `data-theme` attribute on <html>. The colors of each
 * live in themes.css; this file only names them and switches between them.
 *
 * The visitor's choice is saved in localStorage. A small script in index.html
 * reads it before the first paint, so a reload doesn't flash the other theme.
 * Keep THEME_STORAGE_KEY and the theme ids in sync with that script.
 */

export const THEMES = [
  {
    id: 'studio',
    label: 'Dark',
    description: 'Warm near-black panels with an amber accent, like a lit sequencer in a dim room.',
  },
  {
    id: 'daylight',
    label: 'Light',
    description: 'Cool gray panels with a teal accent, like the faceplate of a hardware synth.',
  },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const THEME_STORAGE_KEY = 'midishare-theme'

/** Read the currently active theme id from <html data-theme>. */
export function getActiveTheme(): ThemeId {
  if (typeof document === 'undefined') return 'studio'
  const id = document.documentElement.getAttribute('data-theme') as ThemeId | null
  return id ?? 'studio'
}

/** Switch the page to a theme and remember it for the next visit. */
export function setActiveTheme(id: ThemeId) {
  document.documentElement.setAttribute('data-theme', id)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id)
  } catch {
    // Storage can be blocked (private mode). The theme still changes for this visit.
  }
}

/** Look up a theme entry by id, or fall back to the first theme. */
export function getTheme(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
