import type { RouteObject } from 'react-router'
import { scaffoldRoutes } from './scaffoldRoutes'
import { PlaceholderPage } from './PlaceholderPage'
import { NotFoundPage } from './NotFoundPage'

/**
 * Workspace routes: scaffold placeholders + journal (in-progress)
 *
 * All workspace navigation is URL-addressable. Query params own journal scope/date:
 * - /workspace/journal?mode=day&date=YYYY-MM-DD
 * - /workspace/journal?mode=week&weekStart=YYYY-MM-DD
 * - /workspace/journal?mode=month&month=YYYY-MM
 * - /workspace/journal?mode=all
 *
 * Note: Routes are currently defined inline in App.tsx WorkspaceShell component.
 * This file is kept for reference and future modularization.
 */

export const workspaceRoutes: RouteObject[] = [
  {
    path: '/workspace',
    children: scaffoldRoutes.map((route) => ({
      path: route.path.replace('/workspace/', ''),
      element: <PlaceholderPage route={route} />,
    })),
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]

