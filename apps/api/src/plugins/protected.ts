import type { FastifyPluginAsync } from 'fastify'
import { getAppMode } from '@portfolio-engineering/auth'
import {
  createAuthStore,
  getPrismaClient,
} from '@portfolio-engineering/database'
import {
  REFRESH_TOKEN_COOKIE_NAME,
  getRefreshTokenCookieOptions,
} from '@portfolio-engineering/auth'
import {
  currentUserResponseSchema,
  deleteProfileResponseSchema,
  errorMessageResponseSchema,
  profileBackupPayloadSchema,
} from '@portfolio-engineering/validation/auth'
import { helpRefreshResponseSchema } from '@portfolio-engineering/validation'
import { createJwtPayload } from '../lib/devAuthBootstrap.js'
import { aiRoutes } from './ai.js'
import { journalAnalysisRoutes } from './journalAnalysis.js'
import { journalRoutes } from './journal.js'
import { investorProfileRoutes } from './investorProfile.js'
import { helpRoutes } from './help.js'
import { refreshHelp } from '../lib/helpRefresh.js'

const authStore = createAuthStore(getPrismaClient())

export const protectedRoutes: FastifyPluginAsync = async (app) => {
  const appMode = getAppMode()

  app.register(async (protectedApp) => {
    protectedApp.addHook('onRequest', async (request, reply) => {
      await request.jwtVerify()

      const currentUser = await authStore.findUserById({
        organizationId: request.user.organizationId,
        userId: request.user.sub,
      })

      if (!currentUser) {
        reply.code(401)
        return reply.send({
          message: 'The authenticated user is no longer available in this organization.',
        })
      }

      if (appMode === 'hosted' && currentUser.oauthProviders.length === 0) {
        reply.code(401)
        return reply.send({
          message: 'Hosted mode requires signing in with a configured OAuth provider.',
        })
      }

      request.user = createJwtPayload({
        id: currentUser.id,
        email: currentUser.email,
        organizationId: currentUser.organizationId,
        role: currentUser.role,
      })
    })

    protectedApp.get('/api/me', async (request) =>
      currentUserResponseSchema.parse({
        user: request.user,
      }),
    )

    protectedApp.get('/api/user/profile/export', async (request, reply) => {
      const backup = await authStore.getProfileBackup({
        organizationId: request.user.organizationId,
        userId: request.user.sub,
        appVersion: '0.1.0',
        appMode: appMode ?? 'hosted',
      })

      if (!backup) {
        reply.code(404)
        return errorMessageResponseSchema.parse({
          message: 'Profile not found.',
        })
      }

      const slug =
        backup.data.profile.displayName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'profile'
      const dateStr = new Date().toISOString().slice(0, 10)
      const filename = `profile-${slug}-backup-${dateStr}.json`

      reply.header('Content-Type', 'application/json; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="${filename}"`)
      return profileBackupPayloadSchema.parse(backup)
    })

    protectedApp.delete('/api/user/profile', async (request, reply) => {
      const result = await authStore.deleteProfile({
        organizationId: request.user.organizationId,
        userId: request.user.sub,
      })

      if (!result.deleted || !result.deletedUserId) {
        reply.code(404)
        return errorMessageResponseSchema.parse({
          message: 'Profile not found.',
        })
      }

      reply.clearCookie(
        REFRESH_TOKEN_COOKIE_NAME,
        getRefreshTokenCookieOptions(),
      )

      return deleteProfileResponseSchema.parse({
        success: true,
        deletedProfileId: result.deletedUserId,
      })
    })

    // Register journal routes under the protected plugin
    await protectedApp.register(journalRoutes)
    await protectedApp.register(journalAnalysisRoutes)
    await protectedApp.register(aiRoutes)
    await protectedApp.register(investorProfileRoutes)
    await protectedApp.register(helpRoutes)
    protectedApp.post('/api/help/refresh', async () => {
      const result = await refreshHelp({ logger: app.log })
      return helpRefreshResponseSchema.parse({
        refreshStatus: result.record.lastRefreshStatus,
        freshness: result.record.freshnessStatus,
        fetchedAt: result.record.fetchedAt?.toISOString() ?? null,
        lastDownloadAttemptAt: result.record.lastDownloadAttemptAt?.toISOString() ?? null,
      })
    })
  })
}
