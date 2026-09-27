export type AppMode = 'local' | 'hosted'

export interface SessionUser {
  id: string
  displayName: string
  email: string
}

export interface AuthenticatedSessionResponse {
  authenticated: true
  configured?: true
  appMode: AppMode
  user: SessionUser
}

export interface UnauthenticatedSessionResponse {
  authenticated: false
  configured?: true
  appMode?: AppMode
  message: string
}

export interface UnconfiguredSessionResponse {
  authenticated: false
  configured: false
  appMode?: null
  message: string
  instructions: string[]
}

export type SessionResponse =
  | AuthenticatedSessionResponse
  | UnauthenticatedSessionResponse
  | UnconfiguredSessionResponse

export interface HouseholdProfile {
  id: string
  displayName: string
  email: string
  lastLoginAt?: string | null
  journalEntryCount?: number
  hasInvestorProfile?: boolean
}

export interface CreateProfileRequest {
  displayName: string
  email?: string
}

export interface SelectProfileRequest {
  profileId: string
}

export interface DeleteProfileResponse {
  success: boolean
  deletedProfileId: string
}

export interface ProfileBackupIntuitionLedgerSectionManifest {
  predictions: string
  amendmentHistory: string
  resultHistory: string
  reasoningHistory: string
}

export interface ProfileBackupSectionManifest {
  profile: string
  investorProfile: string
  journal: string
  intuitionLedger: ProfileBackupIntuitionLedgerSectionManifest
}

export interface ProfileBackupMeta {
  description: string
  sections: ProfileBackupSectionManifest
}

export interface ProfileBackupProfileData {
  displayName: string
  email: string
  role: UserRole
  createdAt: string
}

export interface ProfileBackupInvestorProfileData {
  preferredName?: string | null
  experienceLevel?: string | null
  portfolioContext?: unknown | null
  primaryObjective?: string | null
  strategyPresets?: unknown | null
  customStrategyDescription?: string | null
  freeformAiContext?: string | null
}

export interface ProfileBackupJournalEntry {
  localDate: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface ProfileBackupJournalData {
  count: number
  entries: ProfileBackupJournalEntry[]
}

export interface ProfileBackupPredictionRecord {
  id: string
  securityId: string | null
  otherSymbol: string | null
  topic: string | null
  symbolSnapshot: string | null
  symbolNormalizedSnapshot: string | null
  type: string
  direction: string | null
  claimText: string
  eventLabel: string | null
  deadline: string
  confidence: number
  priceAtPrediction: string | null
  predictedPrice: string | null
  predictedPercent: string | null
  priceCapturedAt: string | null
  reasoning: string | null
  tags: string[]
  result: string | null
  resolutionDate: string | null
  actualPrice: string | null
  outcomeNotes: string | null
  voidedAt: string | null
  voidReason: string | null
  amended: boolean
  amendedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ProfileBackupPredictionAmendmentRecord {
  id: string
  predictionId: string
  previousSecurityId: string | null
  previousOtherSymbol: string | null
  previousTopic: string | null
  previousSymbolSnapshot: string | null
  previousSymbolNormalizedSnapshot: string | null
  previousType: string
  previousDirection: string | null
  previousClaimText: string
  previousEventLabel: string | null
  previousDeadline: string
  previousConfidence: number
  previousPriceAtPrediction: string | null
  previousPriceCapturedAt: string | null
  previousPredictedPrice: string | null
  previousPredictedPercent: string | null
  changedFields: string[]
  changedAt: string
}

export interface ProfileBackupPredictionResultHistoryRecord {
  id: string
  predictionId: string
  previousResult: string | null
  previousResolutionDate: string | null
  previousActualPrice: string | null
  previousOutcomeNotes: string | null
  newResult: string | null
  newResolutionDate: string | null
  newActualPrice: string | null
  newOutcomeNotes: string | null
  changedAt: string
}

export interface ProfileBackupPredictionReasoningHistoryRecord {
  id: string
  predictionId: string
  previousReasoning: string | null
  newReasoning: string | null
  changedAt: string
}

export interface ProfileBackupIntuitionLedgerData {
  predictions: {
    count: number
    records: ProfileBackupPredictionRecord[]
  }
  amendmentHistory: {
    count: number
    records: ProfileBackupPredictionAmendmentRecord[]
  }
  resultHistory: {
    count: number
    records: ProfileBackupPredictionResultHistoryRecord[]
  }
  reasoningHistory: {
    count: number
    records: ProfileBackupPredictionReasoningHistoryRecord[]
  }
}

export interface ProfileBackupPayload {
  $schema?: string
  version: string
  exportedAt: string
  appVersion: string
  appMode: AppMode
  _meta: ProfileBackupMeta
  data: {
    profile: ProfileBackupProfileData
    investorProfile: ProfileBackupInvestorProfileData | null
    journal: ProfileBackupJournalData
    intuitionLedger: ProfileBackupIntuitionLedgerData
  }
}

export interface ProfilesResponse {
  profiles: HouseholdProfile[]
}

export type UserRole = 'admin' | 'member'

export interface JwtPayload {
  sub: string
  email: string
  organizationId: string
  role: UserRole
}

export interface RefreshTokenPayload extends JwtPayload {
  jti: string
  tokenType: 'refresh'
}

export interface AccessTokenResponse {
  accessToken: string
}

export interface ErrorMessageResponse {
  message: string
}

export interface CurrentUserResponse {
  user: JwtPayload
}
