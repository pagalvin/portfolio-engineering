export interface SessionUser {
  id: string
  displayName: string
  email: string
}

export interface AuthenticatedSessionResponse {
  authenticated: true
  user: SessionUser
}

export interface UnauthenticatedSessionResponse {
  authenticated: false
  message: string
}

export type SessionResponse =
  | AuthenticatedSessionResponse
  | UnauthenticatedSessionResponse

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
