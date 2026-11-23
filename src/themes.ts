/**
 * Theme catalog.
 *
 * The app has one theme, `studio`, defined in themes.css and selected by
 * `data-theme` on <html> in index.html. The scaffold's `slate` tokens remain
 * in styles.css as the baseline that `studio` overrides.
 *
 * Color values live in styles.css / themes.css — this file is metadata only.
 */

export const THEMES = [
  {
    id: 'studio',
    label: 'Studio',
    description: 'Warm near-black panels with an amber accent, like a lit sequencer in a dim room.',
  },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

/** Read the currently active theme id from <html data-theme>. */
export function getActiveTheme(): ThemeId {
  if (typeof document === 'undefined') return 'studio'
  const id = document.documentElement.getAttribute('data-theme') as ThemeId | null
  return id ?? 'studio'
}

/** Look up a theme entry by id, or fall back to the first theme. */
export function getTheme(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
