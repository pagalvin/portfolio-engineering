import { z } from 'zod'

export const userRoleSchema = z.enum(['admin', 'member'])

export const sessionUserSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  email: z.email(),
})

export const authenticatedSessionResponseSchema = z.object({
  authenticated: z.literal(true),
  user: sessionUserSchema,
})

export const unauthenticatedSessionResponseSchema = z.object({
  authenticated: z.literal(false),
  message: z.string().min(1),
})

export const sessionResponseSchema = z.union([
  authenticatedSessionResponseSchema,
  unauthenticatedSessionResponseSchema,
])

export const jwtPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  organizationId: z.string().min(1),
  role: userRoleSchema,
})

export const refreshTokenPayloadSchema = jwtPayloadSchema.extend({
  jti: z.uuid(),
  tokenType: z.literal('refresh'),
})

export const demoAuthQuerySchema = z.object({
  demoAuth: z.enum(['authenticated', 'unauthenticated']).optional(),
})

export const oauthCallbackRequestSchema = z.object({
  organizationSlug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  organizationName: z.string().min(1).max(120),
  token: z.string().min(1),
})

export const accessTokenResponseSchema = z.object({
  accessToken: z.string().min(1),
})

export const errorMessageResponseSchema = z.object({
  message: z.string().min(1),
})

export const currentUserResponseSchema = z.object({
  user: jwtPayloadSchema,
})
