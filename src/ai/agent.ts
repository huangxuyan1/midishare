/**
 * Mounts the app's record tools (src/ai/tools.ts) as HTTP routes under
 * /_deepspace/agent. `npx deepspace agent invoke midishare <tool>` and the
 * two-user test in tests/collab.spec.ts call them to check what the server
 * stores and refuses. Every call runs as the verified caller, so the clips
 * permissions apply.
 *
 * The scaffold also had a website AI chat here. This app doesn't use it (the
 * AI assistant is the one-shot route in src/server/abc-routes.ts), so it was
 * removed.
 */

import type { Hono } from 'hono'
import { registerAgentToolRoutes, resolveAppMembership } from 'deepspace/worker'
import type { AgentToolAccessResult, AgentToolRouteOptions, JwtClaims } from 'deepspace/worker'
import { resolveAgentAuth, resolveAuth } from '../server/http-routes.js'
import type { AppContext, Env } from '../../worker.js'

/**
 * `buildTools` from src/ai/tools.ts. Its first argument runs record tools as
 * the caller and returns whole results; each tool's own result is capped for
 * the model where the SDK hands it over. Tools that need the Worker's
 * bindings take the second: the request's `env`, the verified `userId`, and
 * the `request` (store files with `appFiles(context.env, ...)`).
 */
type ToolFactory = AgentToolRouteOptions<Env>['buildTools']

export interface AgentAuthorizationContext {
  userId: string
  claims: JwtClaims
  request: Request
  env: Env
}

export interface RegisterAgentOptions {
  /** The existing app-owned tool factory from src/ai/tools.ts. */
  tools: ToolFactory
  /**
   * Optional app-specific gate for subscriptions, teams, roles, or app data.
   * It only narrows access after verified identity and app membership succeed.
   */
  authorize?: (context: AgentAuthorizationContext) => boolean | Promise<boolean>
  /**
   * The record room a verified caller's tools run in and their membership is
   * read from, for an app that keeps a room per user or team. Decide it from
   * the verified `userId`, never from input. Defaults to the app's room.
   */
  room?: (userId: string, env: Env) => string
}

function createAccessResolver(options: RegisterAgentOptions, resolveIdentity: typeof resolveAuth) {
  return async (request: Request, env: Env): Promise<AgentToolAccessResult> => {
    const auth = await resolveIdentity(request, env)
    if (!auth) return { ok: false, status: 401 }

    // Membership has exactly one definition — the caller's row in the users
    // collection of the room their tools run in (the owner is always a
    // member); a signed-in app visit creates it. It is the same primitive
    // that gates the admin and realtime routes. A membership read that could
    // not complete is 503 (retryable), never 403: a transient room failure
    // must not present as a permission denial. The grant carries the room, so
    // the tools run exactly where membership was checked.
    const room = options.room?.(auth.userId, env)
    const membership = await resolveAppMembership(env, auth.userId, request.signal, { room })
    if (!membership) return { ok: false, status: 503 }
    if (!membership.member) return { ok: false, status: 403 }

    if (options.authorize) {
      try {
        if (
          !(await options.authorize({ userId: auth.userId, claims: auth.claims, request, env }))
        ) {
          return { ok: false, status: 403 }
        }
      } catch {
        // The callback failed rather than denied — fail closed but retryable.
        return { ok: false, status: 503 }
      }
    }

    return { ok: true, auth, room }
  }
}

/**
 * Register the tool routes. A CLI caller presents an agent token; a browser
 * caller presents the normal sign-in JWT. Both go through the same checks.
 */
export function registerAgent(app: Hono<AppContext>, options: RegisterAgentOptions): void {
  registerAgentToolRoutes(app, {
    buildTools: options.tools,
    resolveAccess: createAccessResolver(options, resolveAgentAuth),
    resolveBrowserAccess: createAccessResolver(options, resolveAuth),
  })
}
