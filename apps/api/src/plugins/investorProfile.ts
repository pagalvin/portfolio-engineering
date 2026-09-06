import type { FastifyPluginAsync } from 'fastify'
import {
  createInvestorProfileStore,
  getPrismaClient,
} from '@portfolio-engineering/database'
import {
  upsertInvestorProfileSchema,
} from '@portfolio-engineering/validation'
import { getInvestorProfileCatalogs } from '../lib/investorProfileContent.js'

const profileStore = createInvestorProfileStore(getPrismaClient())

export const investorProfileRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/investor-profile/catalogs', async () => {
    const catalogs = await getInvestorProfileCatalogs()
    return { catalogs }
  })

  app.get('/api/investor-profile', async (request) => {
    const profile = await profileStore.getProfile({
      organizationId: request.user.organizationId,
      userId: request.user.sub,
    })

    return { profile }
  })

  app.put('/api/investor-profile', async (request, reply) => {
    const parseResult = upsertInvestorProfileSchema.safeParse(request.body)

    if (!parseResult.success) {
      reply.code(400)
      return {
        message: 'Invalid investor profile payload',
        errors: parseResult.error.flatten(),
      }
    }

    const profile = await profileStore.upsertProfile({
      organizationId: request.user.organizationId,
      userId: request.user.sub,
      ...parseResult.data,
    })

    return { profile }
  })
}
