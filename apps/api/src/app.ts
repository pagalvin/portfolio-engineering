import fastifyCookie from '@fastify/cookie'
import Fastify, { type FastifyInstance } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import { getAppMode, getJwtSecret } from '@portfolio-engineering/auth'
import { publicRoutes } from './plugins/public.js'
import { protectedRoutes } from './plugins/protected.js'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  })

  try {
    const mode = getAppMode()
    if (!mode) {
      app.log.warn(
        'APP_MODE environment variable is unset or invalid. Session checks will report an unconfigured state.',
      )
    } else {
      app.log.info(`Initializing application in APP_MODE=${mode}`)
    }
  } catch (error) {
    app.log.warn(
      { err: error },
      'Failed to parse APP_MODE. Server starting in unconfigured session state.',
    )
  }

  await app.register(fastifyCookie)

  await app.register(fastifyJwt, {
    secret: getJwtSecret(),
  })

  await app.register(publicRoutes)
  await app.register(protectedRoutes)

  return app
}
