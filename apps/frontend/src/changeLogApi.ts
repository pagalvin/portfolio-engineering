import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangelogResponse } from './changeLogTypes'
import type { AuthenticatedApiClient } from './apiClient'

export interface ChangelogUnreadState {
  userId: string | null
  hasUnread: boolean | null
  requestFailed: boolean
}

const unknownUnreadState: ChangelogUnreadState = {
  userId: null,
  hasUnread: null,
  requestFailed: false,
}

export function fetchChangelog(
  client: Pick<AuthenticatedApiClient, 'getChangelog'>,
): Promise<ChangelogResponse> {
  return client.getChangelog()
}

export function acknowledgeChangelog(
  client: Pick<AuthenticatedApiClient, 'acknowledgeChangelog'>,
  input: Parameters<AuthenticatedApiClient['acknowledgeChangelog']>[0],
) {
  return client.acknowledgeChangelog(input)
}

export function recordChangelogUnreadSuccess(
  userId: string,
  response: ChangelogResponse,
): ChangelogUnreadState {
  return {
    userId,
    hasUnread: response.unreadSectionIdentities.length > 0,
    requestFailed: false,
  }
}

export function recordChangelogUnreadFailure(
  previous: ChangelogUnreadState,
  userId: string,
): ChangelogUnreadState {
  return {
    userId,
    hasUnread: previous.userId === userId ? previous.hasUnread : null,
    requestFailed: true,
  }
}

export async function loadChangelogUnreadState(
  client: Pick<AuthenticatedApiClient, 'getChangelog'>,
  userId: string,
  previous: ChangelogUnreadState,
): Promise<ChangelogUnreadState> {
  try {
    return recordChangelogUnreadSuccess(
      userId,
      await fetchChangelog(client),
    )
  } catch {
    return recordChangelogUnreadFailure(previous, userId)
  }
}

export function changelogUnreadStateForUser(
  state: ChangelogUnreadState,
  userId: string,
): ChangelogUnreadState {
  return state.userId === userId ? state : { ...unknownUnreadState, userId }
}

export function useChangelogUnreadState(
  client: AuthenticatedApiClient | null,
  userId: string | null,
): {
  state: ChangelogUnreadState
  refresh: () => void
  recordResponse: (response: ChangelogResponse) => void
} {
  const [state, setState] = useState<ChangelogUnreadState>(unknownUnreadState)
  const [refreshKey, setRefreshKey] = useState(0)
  const stateRef = useRef(state)
  const responseRevision = useRef(0)
  stateRef.current = state
  const refresh = useCallback(() => {
    setRefreshKey((previous) => previous + 1)
  }, [])
  const recordResponse = useCallback((response: ChangelogResponse) => {
    if (userId) {
      responseRevision.current += 1
      setState(recordChangelogUnreadSuccess(userId, response))
    }
  }, [userId])

  useEffect(() => {
    let active = true
    if (!client || !userId) {
      if (userId) {
        setState((previous) => recordChangelogUnreadFailure(previous, userId))
      } else {
        setState(unknownUnreadState)
      }
      return () => {
        active = false
      }
    }

    const previous = changelogUnreadStateForUser(stateRef.current, userId)
    const revisionAtRequestStart = responseRevision.current
    loadChangelogUnreadState(client, userId, previous).then(
      (nextState) => {
        if (active && revisionAtRequestStart === responseRevision.current) {
          setState((current) => nextState.requestFailed
            ? recordChangelogUnreadFailure(current, userId)
            : nextState)
        }
      },
    )

    return () => {
      active = false
    }
  }, [client, userId, refreshKey])

  return {
    state: userId ? changelogUnreadStateForUser(state, userId) : unknownUnreadState,
    refresh,
    recordResponse,
  }
}
