/**
 * Navigation Config
 *
 * Add one entry per nav item. Routes are handled by generouted
 * (file-based routing in src/pages/), this just controls what
 * appears in the navigation bar.
 */

import type { Role } from './constants'

export interface NavItem {
  path: string
  label: string
  roles?: Role[]
  devOnly?: boolean
}

export const nav: NavItem[] = [
  { path: '/home', label: 'Clips' },
  // Your own drafts and published clips. Needs an account.
  { path: '/me', label: 'My clips', roles: ['viewer', 'member', 'admin'] },
  // How to paste a clip into Ableton Live with MIDI Clipboard. Open to everyone.
  { path: '/ableton', label: 'Ableton' },
  // Settings needs an account, so signed-out visitors don't see the link.
  { path: '/settings', label: 'Settings', roles: ['viewer', 'member', 'admin'] },
  // "New clip" is the button on the right of the bar (see Navigation.tsx).
  // ── Features add nav items below this line ──
]
