import type { FastifyPluginAsync } from 'fastify'
import { getAppMode } from '@portfolio-engineering/auth'
import {
  createAuthStore,
  getPrismaClient,
} from '@portfolio-engineering/database'
import { currentUserResponseSchema } from '@portfolio-engineering/validation/auth'
import { createJwtPayload } from '../lib/devAuthBootstrap.js'
import { aiRoutes } from './ai.js'
import { journalAnalysisRoutes } from './journalAnalysis.js'
import { journalRoutes } from './journal.js'

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

    // Register journal routes under the protected plugin
    await protectedApp.register(journalRoutes)
    await protectedApp.register(journalAnalysisRoutes)
    await protectedApp.register(aiRoutes)
  })
}
