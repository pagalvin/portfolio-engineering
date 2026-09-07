import { useEffect, useState } from 'react'
import type { AuthenticatedApiClient } from './apiClient'
import {
  DEFAULT_EFFECTIVE_APP_VERSION,
  type AppVersionResponse,
  type HelpIndexResponse,
  type HelpStatusResponse,
  type HelpTopicResponse,
} from './helpTypes'

const SEMVER = /^\d+\.\d+\.\d+$/

export async function fetchAppVersion(
  client: AuthenticatedApiClient,
): Promise<AppVersionResponse> {
  try {
    const response = await client.getAppVersion()
    return {
      version: SEMVER.test(response.version)
        ? response.version
        : DEFAULT_EFFECTIVE_APP_VERSION,
    }
  } catch {
    return { version: DEFAULT_EFFECTIVE_APP_VERSION }
  }
}

export function fetchHelpIndex(client: AuthenticatedApiClient): Promise<HelpIndexResponse> {
  return client.getHelpIndex()
}

export function fetchHelpTopic(
  client: AuthenticatedApiClient,
  helpKey: string,
): Promise<HelpTopicResponse> {
  return client.getHelpTopic(helpKey)
}

export function fetchHelpStatus(client: AuthenticatedApiClient): Promise<HelpStatusResponse> {
  return client.getHelpStatus()
}

export interface HelpQueryState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

export function useAppVersion(
  client: AuthenticatedApiClient | null,
): HelpQueryState<AppVersionResponse> {
  const [state, setState] = useState<HelpQueryState<AppVersionResponse>>({
    data: null,
    loading: Boolean(client),
    error: null,
  })
  useEffect(() => {
    if (!client) {
      setState({ data: null, loading: false, error: null })
      return
    }
    let active = true
    fetchAppVersion(client).then(
      (data) => active && setState({ data, loading: false, error: null }),
      (reason: unknown) =>
        active &&
        setState({
          data: { version: DEFAULT_EFFECTIVE_APP_VERSION },
          loading: false,
          error: reason instanceof Error ? reason : new Error('Unable to load app version.'),
        }),
    )
    return () => {
      active = false
    }
  }, [client])
  return state
}

export function useHelpIndex(
  client: AuthenticatedApiClient | null,
): HelpQueryState<HelpIndexResponse> {
  const [state, setState] = useState<HelpQueryState<HelpIndexResponse>>({
    data: null,
    loading: Boolean(client),
    error: null,
  })

  useEffect(() => {
    if (!client) {
      setState({ data: null, loading: false, error: null })
      return
    }
    let active = true
    setState((previous) => ({ ...previous, loading: true, error: null }))
    fetchHelpIndex(client).then(
      (data) => active && setState({ data, loading: false, error: null }),
      (reason: unknown) =>
        active &&
        setState({
          data: null,
          loading: false,
          error: reason instanceof Error ? reason : new Error('Unable to load help.'),
        }),
    )
    return () => {
      active = false
    }
  }, [client])

  return state
}

export function useHelpTopic(
  client: AuthenticatedApiClient | null,
  helpKey: string | undefined,
): HelpQueryState<HelpTopicResponse> {
  const [state, setState] = useState<HelpQueryState<HelpTopicResponse>>({
    data: null,
    loading: Boolean(client && helpKey),
    error: null,
  })

  useEffect(() => {
    if (!client || !helpKey) {
      setState({ data: null, loading: false, error: null })
      return
    }
    let active = true
    setState((previous) => ({ ...previous, loading: true, error: null }))
    fetchHelpTopic(client, helpKey).then(
      (data) => active && setState({ data, loading: false, error: null }),
      (reason: unknown) =>
        active &&
        setState({
          data: null,
          loading: false,
          error: reason instanceof Error ? reason : new Error('Unable to load help topic.'),
        }),
    )
    return () => {
      active = false
    }
  }, [client, helpKey])

  return state
}

export function useHelpTooltip(
  client: AuthenticatedApiClient | null,
  helpKey: string | undefined,
): HelpQueryState<HelpTopicResponse> {
  return useHelpTopic(client, helpKey)
}

export function useHelpStatus(
  client: AuthenticatedApiClient | null,
): HelpQueryState<HelpStatusResponse> {
  const [state, setState] = useState<HelpQueryState<HelpStatusResponse>>({
    data: null,
    loading: Boolean(client),
    error: null,
  })
  useEffect(() => {
    if (!client) {
      setState({ data: null, loading: false, error: null })
      return
    }
    let active = true
    fetchHelpStatus(client).then(
      (data) => active && setState({ data, loading: false, error: null }),
      (reason: unknown) =>
        active &&
        setState({
          data: null,
          loading: false,
          error: reason instanceof Error ? reason : new Error('Unable to load help status.'),
        }),
    )
    return () => {
      active = false
    }
  }, [client])
  return state
}
