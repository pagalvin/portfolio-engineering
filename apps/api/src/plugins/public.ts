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
  getRefreshTokenCookieOptions,
} from '@portfolio-engineering/auth'
import {
  createAuthStore,
  getPrismaClient,
  OAuthProviderType,
} from '@portfolio-engineering/database'
import type {
  JwtPayload,
  RefreshTokenPayload,
} from '@portfolio-engineering/shared-types/auth'
import {
  accessTokenResponseSchema,
  demoAuthQuerySchema,
  errorMessageResponseSchema,
  oauthCallbackRequestSchema,
  refreshTokenPayloadSchema,
  sessionResponseSchema,
} from '@portfolio-engineering/validation/auth'
import {
  createRefreshTokenPayload,
  ensureDevelopmentAuthContext,
  ensureOAuthCallbackAuthContext,
  getDemoAuthMode,
  getRefreshTokenExpiresAt,
  getUnauthenticatedSessionResponse,
  hashToken,
} from '../lib/devAuthBootstrap.js'
import {
  OAuthVerificationError,
  verifyOAuthToken,
} from '../lib/oauthIdentity.js'

const authStore = createAuthStore(getPrismaClient())

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

  app.get('/auth/session', async (request, reply) => {
    const queryResult = demoAuthQuerySchema.safeParse(request.query)

    if (!queryResult.success) {
      reply.code(400)
      return sessionResponseSchema.parse({
        authenticated: false,
        message: "Unsupported demoAuth value. Use 'authenticated' or 'unauthenticated'.",
      })
    }

    const demoAuthMode = getDemoAuthMode(queryResult.data.demoAuth)

    if (!demoAuthMode) {
      reply.code(400)
      return sessionResponseSchema.parse({
        authenticated: false,
        message: "Unsupported demoAuth value. Use 'authenticated' or 'unauthenticated'.",
      })
    }

    if (demoAuthMode === 'authenticated') {
      const authContext = await ensureDevelopmentAuthContext()
      await finalizeAuthenticatedSession(reply, authContext.jwtPayload)

      return sessionResponseSchema.parse(authContext.session)
    }

    const session = getUnauthenticatedSessionResponse()
    reply.code(401)
    reply.clearCookie(
      REFRESH_TOKEN_COOKIE_NAME,
      getRefreshTokenCookieOptions(),
    )

    return sessionResponseSchema.parse(session)
  })

  app.post('/auth/refresh', async (request, reply) => {
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

    if (!currentUser) {
      reply.code(401)
      reply.clearCookie(
        REFRESH_TOKEN_COOKIE_NAME,
        getRefreshTokenCookieOptions(),
      )
      return errorMessageResponseSchema.parse({
        message: 'The authenticated user is no longer available in this organization.',
      })
    }

    const revokedRefreshToken = await authStore.revokeRefreshToken({
      organizationId: refreshPayload.organizationId,
      tokenHash: hashToken(refreshToken),
    })

    if (!revokedRefreshToken) {
      reply.code(401)
      reply.clearCookie(
        REFRESH_TOKEN_COOKIE_NAME,
        getRefreshTokenCookieOptions(),
      )
      return errorMessageResponseSchema.parse({
        message: 'The refresh token could not be rotated.',
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
}
