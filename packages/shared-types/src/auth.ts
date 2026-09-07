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

export interface ProfileBackupSectionManifest {
  profile: string
  investorProfile: string
  journal: string
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
