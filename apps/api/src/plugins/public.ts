import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify'
import {
  ACCESS_TOKEN_EXPIRES_IN,
  DEV_ACCESS_TOKEN_HEADER,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_EXPIRES_IN,
  getAppMode,
  getRefreshTokenCookieOptions,
} from '@portfolio-engineering/auth'
import {
  createAuthStore,
  getPrismaClient,
  mapUserRecordToHouseholdProfile,
  mapUserRecordToSessionUser,
  OAuthProviderType,
} from '@portfolio-engineering/database'
import type {
  JwtPayload,
  RefreshTokenPayload,
} from '@portfolio-engineering/shared-types/auth'
import {
  accessTokenResponseSchema,
  createProfileRequestSchema,
  errorMessageResponseSchema,
  oauthCallbackRequestSchema,
  profilesResponseSchema,
  refreshTokenPayloadSchema,
  selectProfileRequestSchema,
  sessionResponseSchema,
} from '@portfolio-engineering/validation/auth'
import {
  createJwtPayload,
  createRefreshTokenPayload,
  ensureLocalDefaultProfile,
  ensureOAuthCallbackAuthContext,
  getRefreshTokenExpiresAt,
  getUnconfiguredSessionResponse,
  hashToken,
} from '../lib/localAuthBootstrap.js'
import {
  OAuthVerificationError,
  verifyOAuthToken,
} from '../lib/oauthIdentity.js'

export const PROFILE_COOKIE_NAME = 'portfolio_engineering_profile_id'
const REFRESH_ROTATION_GRACE_WINDOW_MS = 30_000

const authStore = createAuthStore(getPrismaClient())

function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(
    REFRESH_TOKEN_COOKIE_NAME,
    getRefreshTokenCookieOptions(),
  )
  reply.clearCookie(
    PROFILE_COOKIE_NAME,
    getRefreshTokenCookieOptions(),
  )
}

function isAllowedForAppMode(
  appMode: 'local' | 'hosted',
  user: Awaited<ReturnType<typeof authStore.findUserById>>,
): user is NonNullable<Awaited<ReturnType<typeof authStore.findUserById>>> {
  if (!user) {
    return false
  }

  if (appMode === 'hosted') {
    return user.oauthProviders.length > 0
  }

  return true
}

async function issuePersistedTokens(
  reply: FastifyReply,
  jwtPayload: JwtPayload,
): Promise<{
  accessToken: string
  refreshToken: string
}> {
  const accessToken = await reply.jwtSign(jwtPayload, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  })
  const refreshTokenPayload = createRefreshTokenPayload(jwtPayload)
  const refreshToken = await reply.jwtSign(refreshTokenPayload, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  })

  await authStore.saveRefreshToken({
    organizationId: jwtPayload.organizationId,
    userId: jwtPayload.sub,
    tokenHash: hashToken(refreshToken),
    expiresAt: getRefreshTokenExpiresAt(),
  })

  return {
    accessToken,
    refreshToken,
  }
}

async function finalizeAuthenticatedSession(
  reply: FastifyReply,
  jwtPayload: JwtPayload,
): Promise<void> {
  const tokens = await issuePersistedTokens(reply, jwtPayload)
  reply.header(DEV_ACCESS_TOKEN_HEADER, tokens.accessToken)
  reply.header('Cache-Control', 'no-store')
  reply.setCookie(
    REFRESH_TOKEN_COOKIE_NAME,
    tokens.refreshToken,
    getRefreshTokenCookieOptions(),
  )
}

export const publicRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    status: 'ok',
  }))

  let appMode: 'local' | 'hosted' | null = null
  try {
    appMode = getAppMode()
  } catch {
    appMode = null
  }

  app.get('/auth/session', async (request, reply) => {
    if (!appMode) {
      reply.header('Cache-Control', 'no-store')
      return sessionResponseSchema.parse(getUnconfiguredSessionResponse())
    }

    const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE_NAME]

    if (refreshToken) {
      try {
        const verifiedPayload = await app.jwt.verify<RefreshTokenPayload>(refreshToken)
        const refreshPayload = refreshTokenPayloadSchema.parse(verifiedPayload)

        const storedRefreshToken = await authStore.findActiveRefreshTokenByHash({
          organizationId: refreshPayload.organizationId,
          userId: refreshPayload.sub,
          tokenHash: hashToken(refreshToken),
          now: new Date(),
          graceWindowMs: REFRESH_ROTATION_GRACE_WINDOW_MS,
        })

        if (storedRefreshToken) {
          const currentUser = await authStore.findUserById({
            organizationId: refreshPayload.organizationId,
            userId: refreshPayload.sub,
          })

          if (isAllowedForAppMode(appMode, currentUser)) {
            reply.header('Cache-Control', 'no-store')
            return sessionResponseSchema.parse({
              authenticated: true,
              configured: true,
              appMode,
              user: mapUserRecordToSessionUser(currentUser),
            })
          } else {
            clearAuthCookies(reply)
          }
        }
      } catch {
        // Invalid or expired token
      }
    }

    if (appMode === 'local') {
      const profileId = request.cookies[PROFILE_COOKIE_NAME]
      if (profileId) {
        try {
          const { organization } = await ensureLocalDefaultProfile()
          const currentUser = await authStore.findUserById({
            organizationId: organization.id,
            userId: profileId,
          })

          if (currentUser) {
            const jwtPayload = createJwtPayload(currentUser)
            await finalizeAuthenticatedSession(reply, jwtPayload)
            reply.setCookie(
              PROFILE_COOKIE_NAME,
              currentUser.id,
              getRefreshTokenCookieOptions(),
            )
            return sessionResponseSchema.parse({
              authenticated: true,
              configured: true,
              appMode: 'local',
              user: mapUserRecordToSessionUser(currentUser),
            })
          }
        } catch {
          // Failed to resolve profile from cookie
        }
      }
    }

    reply.header('Cache-Control', 'no-store')
    return sessionResponseSchema.parse({
      authenticated: false,
      configured: true,
      appMode,
      message: 'You must sign in or select a profile before your workspace data becomes available.',
    })
  })

  app.post('/auth/refresh', async (request, reply) => {
    if (!appMode) {
      reply.code(400)
      return errorMessageResponseSchema.parse({
        message: 'Application is not configured.',
      })
    }

    const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE_NAME]

    if (!refreshToken) {
      reply.code(401)
      return errorMessageResponseSchema.parse({
        message: 'A refresh token cookie is required.',
      })
    }

    let refreshPayload: RefreshTokenPayload

    try {
      const verifiedPayload = await app.jwt.verify<RefreshTokenPayload>(refreshToken)
      refreshPayload = refreshTokenPayloadSchema.parse(verifiedPayload)
    } catch {
      reply.code(401)
      reply.clearCookie(
        REFRESH_TOKEN_COOKIE_NAME,
        getRefreshTokenCookieOptions(),
      )
      return errorMessageResponseSchema.parse({
        message: 'The refresh token is invalid or expired.',
      })
    }

    const storedRefreshToken = await authStore.findActiveRefreshTokenByHash({
      organizationId: refreshPayload.organizationId,
      userId: refreshPayload.sub,
      tokenHash: hashToken(refreshToken),
      now: new Date(),
      graceWindowMs: REFRESH_ROTATION_GRACE_WINDOW_MS,
    })

    if (!storedRefreshToken) {
      reply.code(401)
      reply.clearCookie(
        REFRESH_TOKEN_COOKIE_NAME,
        getRefreshTokenCookieOptions(),
      )
      return errorMessageResponseSchema.parse({
        message: 'The refresh token is no longer active.',
      })
    }

    const currentUser = await authStore.findUserById({
      organizationId: refreshPayload.organizationId,
      userId: refreshPayload.sub,
    })

    if (!isAllowedForAppMode(appMode, currentUser)) {
      reply.code(401)
      clearAuthCookies(reply)
      return errorMessageResponseSchema.parse({
        message:
          appMode === 'hosted'
            ? 'Hosted mode requires signing in with a configured OAuth provider.'
            : 'The authenticated user is no longer available in this organization.',
      })
    }

    if (storedRefreshToken.revokedAt === null) {
      await authStore.revokeRefreshToken({
        organizationId: refreshPayload.organizationId,
        tokenHash: hashToken(refreshToken),
      })
    }

    const accessPayload = {
      sub: currentUser.id,
      email: currentUser.email,
      organizationId: currentUser.organizationId,
      role: currentUser.role,
    } satisfies JwtPayload

    const tokens = await issuePersistedTokens(reply, accessPayload)

    reply.header(DEV_ACCESS_TOKEN_HEADER, tokens.accessToken)
    reply.header('Cache-Control', 'no-store')
    reply.setCookie(
      REFRESH_TOKEN_COOKIE_NAME,
      tokens.refreshToken,
      getRefreshTokenCookieOptions(),
    )

    return accessTokenResponseSchema.parse({
      accessToken: tokens.accessToken,
    })
  })

  app.post('/auth/logout', async (request, reply) => {
    const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE_NAME]

    if (refreshToken) {
      try {
        const verifiedPayload = await app.jwt.verify<RefreshTokenPayload>(refreshToken)
        const refreshPayload = refreshTokenPayloadSchema.parse(verifiedPayload)
        await authStore.revokeRefreshToken({
          organizationId: refreshPayload.organizationId,
          tokenHash: hashToken(refreshToken),
        })
      } catch {
        // Invalid/expired refresh cookies still need to be cleared below.
      }
    }

    reply.header('Cache-Control', 'no-store')
    clearAuthCookies(reply)
    return errorMessageResponseSchema.parse({
      message: 'Signed out.',
    })
  })

  if (appMode === 'local') {
    app.get('/auth/profiles', async () => {
      const { organization } = await ensureLocalDefaultProfile()
      const users = await authStore.listProfilesInOrganization({
        organizationId: organization.id,
      })
      const profiles = users.map(mapUserRecordToHouseholdProfile)
      return profilesResponseSchema.parse({ profiles })
    })

    app.post('/auth/profiles', async (request, reply) => {
      const bodyResult = createProfileRequestSchema.safeParse(request.body)
      if (!bodyResult.success) {
        reply.code(400)
        return errorMessageResponseSchema.parse({
          message: 'Invalid profile creation payload.',
        })
      }

      const { organization } = await ensureLocalDefaultProfile()
      await authStore.createLocalProfile({
        organizationId: organization.id,
        displayName: bodyResult.data.displayName,
        email: bodyResult.data.email || undefined,
      })

      const users = await authStore.listProfilesInOrganization({
        organizationId: organization.id,
      })
      const profiles = users.map(mapUserRecordToHouseholdProfile)
      return profilesResponseSchema.parse({ profiles })
    })

    app.post('/auth/profiles/select', async (request, reply) => {
      const bodyResult = selectProfileRequestSchema.safeParse(request.body)
      if (!bodyResult.success) {
        reply.code(400)
        return errorMessageResponseSchema.parse({
          message: 'Invalid profile selection payload.',
        })
      }

      const { organization } = await ensureLocalDefaultProfile()
      const targetUser = await authStore.findUserById({
        organizationId: organization.id,
        userId: bodyResult.data.profileId,
      })

      if (!targetUser) {
        reply.code(404)
        return errorMessageResponseSchema.parse({
          message: 'Household profile not found.',
        })
      }

      await authStore.touchUserLogin({
        organizationId: organization.id,
        userId: targetUser.id,
      })

      const jwtPayload = createJwtPayload(targetUser)
      await finalizeAuthenticatedSession(reply, jwtPayload)

      reply.setCookie(
        PROFILE_COOKIE_NAME,
        targetUser.id,
        getRefreshTokenCookieOptions(),
      )

      return sessionResponseSchema.parse({
        authenticated: true,
        configured: true,
        appMode: 'local',
        user: mapUserRecordToSessionUser(targetUser),
      })
    })
  } else if (appMode === 'hosted') {
    async function handleOAuthCallback(
      request: FastifyRequest,
      reply: FastifyReply,
      provider: OAuthProviderType,
    ) {
      const bodyResult = oauthCallbackRequestSchema.safeParse(request.body)

      if (!bodyResult.success) {
        reply.code(400)
        return errorMessageResponseSchema.parse({
          message: 'Invalid OAuth callback payload.',
        })
      }

      try {
        const identity = await verifyOAuthToken(provider, bodyResult.data.token)
        const authContext = await ensureOAuthCallbackAuthContext({
          organizationSlug: bodyResult.data.organizationSlug,
          organizationName: bodyResult.data.organizationName,
          provider,
          providerUserId: identity.providerUserId,
          email: identity.email,
          displayName: identity.displayName,
        })

        await finalizeAuthenticatedSession(reply, authContext.jwtPayload)
        return sessionResponseSchema.parse(authContext.session)
      } catch (error) {
        if (error instanceof OAuthVerificationError) {
          reply.code(error.statusCode)
          return errorMessageResponseSchema.parse({
            message: error.message,
          })
        }

        throw error
      }
    }

    app.post('/auth/google/callback', async (request, reply) =>
      handleOAuthCallback(request, reply, OAuthProviderType.google),
    )
    app.post('/auth/microsoft/callback', async (request, reply) =>
      handleOAuthCallback(request, reply, OAuthProviderType.microsoft),
    )
    app.post('/auth/facebook/callback', async (request, reply) =>
      handleOAuthCallback(request, reply, OAuthProviderType.facebook),
    )
  }
}
