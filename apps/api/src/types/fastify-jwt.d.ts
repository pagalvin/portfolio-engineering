import '@fastify/jwt'
import type {
  JwtPayload,
  RefreshTokenPayload,
} from '@portfolio-engineering/shared-types/auth'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload | RefreshTokenPayload
    user: JwtPayload
  }
}
