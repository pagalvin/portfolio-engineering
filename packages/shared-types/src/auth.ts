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
}

export interface CreateProfileRequest {
  displayName: string
  email?: string
}

export interface SelectProfileRequest {
  profileId: string
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
