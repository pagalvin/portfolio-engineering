import type { AppMode, SessionResponse } from '@portfolio-engineering/shared-types/auth'

export function buildUnauthenticatedSession(
  appMode?: AppMode,
  message = 'Select a profile or sign in again to continue.',
): SessionResponse {
  return {
    authenticated: false,
    configured: true,
    appMode: appMode ?? 'local',
    message,
  }
}

export function getUnauthenticatedRootPath(_appMode?: AppMode): string {
  return '/'
}

export function buildActiveProfileDeletionReset(appMode?: AppMode): {
  nextSession: SessionResponse
  destination: string
} {
  const nextAppMode = appMode ?? 'local'
  return {
    nextSession: buildUnauthenticatedSession(nextAppMode),
    destination: getUnauthenticatedRootPath(nextAppMode),
  }
}
