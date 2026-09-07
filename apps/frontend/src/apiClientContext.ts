import { createContext } from 'react'
import type { AuthenticatedApiClient } from './apiClient'

export const ApiClientContext = createContext<AuthenticatedApiClient | null>(null)
