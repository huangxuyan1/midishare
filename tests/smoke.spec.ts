import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/**
 * Smoke tests covering both page kinds this template ships:
 *   - '/'      → the static landing (top level of src/pages/): no providers,
 *                so no auth fetch and no records WebSocket on load.
 *   - '/home'  → a dynamic page (under src/pages/(app)/): the providers mount,
 *                the nav shell renders, and the records WebSocket connects.
 *
 * The "static contract" test is the guardrail for the per-page opt-out: if
 * someone moves the providers back up into _app.tsx, it fails.
 */

/** Wait for the React app shell (present on every page). */
async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 })
}

test.describe('Smoke tests', () => {
  test('static landing loads without JS errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByTestId('static-landing')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('landing carries one title, one description, one canonical', async ({ page }) => {
    // <Seo> (src/pages/index.tsx, values from src/seo.ts) hoists these into
    // <head>. Exactly one of each: index.html ships no static description or
    // canonical, because React 19 would not dedupe against them on mount.
    await page.goto('/')
    await expect(page.getByTestId('static-landing')).toBeVisible()
    await expect(page).toHaveTitle(/\S/)
    expect(await page.locator('head meta[name="description"]').count()).toBe(1)
    expect(await page.locator('head link[rel="canonical"]').count()).toBe(1)
  })

  test('static contract: landing fires no auth request, opens no websocket', async ({ page }) => {
    const offenders: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/')) offenders.push(req.url())
    })
    // Only the DO room route counts — vite's own HMR socket is a dev artifact.
    page.on('websocket', (ws) => {
      if (new URL(ws.url()).pathname.startsWith('/ws/')) offenders.push(`ws: ${ws.url()}`)
    })
    await page.goto('/')
    await expect(page.getByTestId('static-landing')).toBeVisible()
    await page.waitForTimeout(1500)
    expect(offenders).toEqual([])
  })

  test('landing shows the headline and the demo clip', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Music you can paste.')
    await expect(page.getByTestId('demo-clip')).toBeVisible()
    // The page is midishare's own, not the scaffold's.
    await expect(page).toHaveTitle(/midishare/)
    expect(await page.locator('html').getAttribute('data-theme')).toBe('studio')
  })

  test('dynamic app boundary mounts on /home', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByTestId('app-navigation')).toBeVisible({ timeout: 15000 })
  })

  test('the library shows its heading, a sign-in line and a working search box when signed out', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clip library', { timeout: 15000 })
    await expect(page.getByText('Sign in to save your own clips')).toBeVisible()
    // Either clip cards or the empty state, never a blank page.
    await expect(page.getByTestId('clip-row').or(page.getByTestId('no-clips')).first()).toBeVisible({ timeout: 15000 })
    // A search that matches nothing shows the empty state with a way back.
    await page.getByPlaceholder('Search by title or tag').fill('zzz-no-such-clip')
    await expect(page.getByTestId('no-clips')).toContainText('No clips match')
    await page.getByRole('button', { name: 'Clear the filter' }).click()
    await expect(page.getByPlaceholder('Search by title or tag')).toHaveValue('')
  })

  test('sign-in button visible when logged out', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByTestId('nav-sign-in-button')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('nav-user-name')).toHaveCount(0)
  })

  test('the Ableton page is in the nav and links to MIDI Clipboard on GitHub', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/home')
    await page.getByTestId('app-navigation').getByRole('link', { name: 'Ableton' }).click()
    await expect(page).toHaveURL(/\/ableton$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Paste a clip into Ableton.')
    await expect(page.getByRole('link', { name: 'Get MIDI Clipboard' })).toHaveAttribute(
      'href',
      'https://github.com/huangxuyan1/midi-clipboard/releases/latest',
    )
    expect(errors).toEqual([])
  })

  test('unknown route shows 404', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz')
    await waitForApp(page)
    await expect(page.locator('text=404')).toBeVisible()
  })
})
