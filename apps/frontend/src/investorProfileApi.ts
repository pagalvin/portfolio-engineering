import type { AuthenticatedApiClient } from './apiClient'

export type ExperienceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'EXPERIENCED'

export interface InvestorProfileRecord {
  readonly id: string
  readonly organizationId: string
  readonly userId: string
  readonly preferredName: string | null
  readonly experienceLevel: ExperienceLevel | null
  readonly portfolioContext: readonly string[] | null
  readonly primaryObjective: string | null
  readonly strategyPresets: readonly string[] | null
  readonly customStrategyDescription: string | null
  readonly freeformAiContext: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface InvestorProfileOptionItem {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly educationalHint?: string
}

export interface InvestorProfileCatalogs {
  readonly objectives: readonly InvestorProfileOptionItem[]
  readonly strategies: readonly InvestorProfileOptionItem[]
}

export interface UpsertInvestorProfileInput {
  readonly preferredName?: string | null
  readonly experienceLevel?: ExperienceLevel | null
  readonly portfolioContext?: readonly string[] | null
  readonly primaryObjective?: string | null
  readonly strategyPresets?: readonly string[] | null
  readonly customStrategyDescription?: string | null
  readonly freeformAiContext?: string | null
}

export async function fetchInvestorProfile(
  apiClient: AuthenticatedApiClient,
): Promise<{ profile: InvestorProfileRecord | null }> {
  return apiClient.getInvestorProfile()
}

export async function updateInvestorProfile(
  apiClient: AuthenticatedApiClient,
  input: UpsertInvestorProfileInput,
): Promise<{ profile: InvestorProfileRecord }> {
  return apiClient.updateInvestorProfile(input)
}

export async function fetchInvestorProfileCatalogs(
  apiClient: AuthenticatedApiClient,
): Promise<{ catalogs: InvestorProfileCatalogs }> {
  return apiClient.getInvestorProfileCatalogs()
}
