import type { RouteObject } from 'react-router'

export const HELP_LANDING_ROUTE = '/help'
export const HELP_TOPIC_ROUTE = '/help/:helpKey'

/**
 * This is the route ownership contract used by the authenticated workspace.
 * Keeping it separate from the rendered shell makes direct-load and refresh
 * behavior testable without replacing the application's BrowserRouter.
 */
export const helpRouteDefinitions: readonly RouteObject[] = [
  { path: HELP_LANDING_ROUTE, handle: { requiresAuthentication: true } },
  { path: HELP_TOPIC_ROUTE, handle: { requiresAuthentication: true } },
]

export function helpTopicPath(helpKey: string): string {
  return `${HELP_LANDING_ROUTE}/${encodeURIComponent(helpKey)}`
}

export function canonicalHelpRedirectPath(
  status: 'available' | 'redirect' | 'unavailable',
  redirectTo: string | undefined,
): string | null {
  if (status !== 'redirect' || !redirectTo) {
    return null
  }

  return helpTopicPath(redirectTo)
}
