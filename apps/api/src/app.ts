import fastifyCookie from '@fastify/cookie'
import Fastify, { type FastifyInstance } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import { getJwtSecret } from '@portfolio-engineering/auth'
import { publicRoutes } from './plugins/public.js'
import { protectedRoutes } from './plugins/protected.js'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  })

  await app.register(fastifyCookie)

  await app.register(fastifyJwt, {
    secret: getJwtSecret(),
  })

  await app.register(publicRoutes)
  await app.register(protectedRoutes)

  return app
}
