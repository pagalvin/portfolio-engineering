import type { FastifyPluginAsync } from 'fastify'
import {
  createSecurityStore,
  getPrismaClient,
  type SecurityStore,
} from '@portfolio-engineering/database'
import {
  securityCollectionResponseSchema,
  securityDeleteResponseSchema,
  securityIdParamsSchema,
  securityListQuerySchema,
  securityMutationResponseSchema,
  securityUpdateSchema,
  securityWriteSchema,
} from '@portfolio-engineering/validation/securityMaster'

const defaultSecurityStore = createSecurityStore(getPrismaClient())

interface SecurityRouteOptions {
  securityStore?: SecurityStore
}

function validationError(error: { issues: Array<{ message: string; path: PropertyKey[] }> }) {
  return {
    code: 'VALIDATION_ERROR' as const,
    message: error.issues.map((issue) => {
      const path = issue.path.join('.')
      return path ? `${path}: ${issue.message}` : issue.message
    }).join('; '),
  }
}

function notFoundError() {
  return {
    code: 'SECURITY_NOT_FOUND' as const,
    message: 'Security not found.',
  }
}

function mapSecurity(security: Awaited<ReturnType<SecurityStore['list']>>[number]) {
  return {
    id: security.id,
    organizationId: security.organizationId,
    symbol: security.symbol,
    type: security.type,
    name: security.name,
    description: security.description,
    exchange: security.exchange,
    sector: security.sector,
    industry: security.industry,
    active: security.active,
    createdAt: security.createdAt,
    updatedAt: security.updatedAt,
  }
}

function queryFromRequest(request: { query: unknown; raw: { url?: string } }) {
  const input =
    request.query !== null && typeof request.query === 'object'
      ? { ...(request.query as Record<string, unknown>) }
      : {}

  if (!request.raw.url) {
    return input
  }

  let searchParams: URLSearchParams
  try {
    searchParams = new URL(request.raw.url, 'http://localhost').searchParams
  } catch {
    return { __invalidQuery: true }
  }

  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key)
    input[key] = values.length === 1 ? values[0] : values
  }
  return input
}

export function createSecurityMasterRoutes(
  options: SecurityRouteOptions = {},
): FastifyPluginAsync {
  const securityStore = options.securityStore ?? defaultSecurityStore

  return async (app) => {
    app.get('/api/securities', async (request, reply) => {
      const parsed = securityListQuerySchema.safeParse(queryFromRequest(request))
      if (!parsed.success) {
        reply.code(400)
        return validationError(parsed.error)
      }

      const organizationId = request.user.organizationId
      const [securities, totalCount] = await Promise.all([
        securityStore.list({
          organizationId,
          search: parsed.data.q,
          active: parsed.data.status === 'all'
            ? undefined
            : parsed.data.status === 'active',
          type: parsed.data.type,
          exchange: parsed.data.exchange,
        }),
        securityStore.count({ organizationId }),
      ])

      return securityCollectionResponseSchema.parse({
        securities: securities.map(mapSecurity),
        totalCount,
      })
    })

    app.get<{ Params: Record<string, unknown> }>(
      '/api/securities/:securityId',
      async (request, reply) => {
        const params = securityIdParamsSchema.safeParse(request.params)
        if (!params.success) {
          reply.code(400)
          return validationError(params.error)
        }

        const security = await securityStore.find({
          organizationId: request.user.organizationId,
          securityId: params.data.securityId,
        })
        if (!security) {
          reply.code(404)
          return notFoundError()
        }

        return securityMutationResponseSchema.parse({
          security: mapSecurity(security),
        })
      },
    )

    app.post('/api/securities', async (request, reply) => {
      const parsed = securityWriteSchema.safeParse(request.body)
      if (!parsed.success) {
        reply.code(400)
        return validationError(parsed.error)
      }

      const result = await securityStore.create({
        organizationId: request.user.organizationId,
        ...parsed.data,
      })
      if (result.status === 'duplicate_identity') {
        reply.code(409)
        return {
          code: 'SECURITY_DUPLICATE_IDENTITY' as const,
          message: 'A security with the same symbol and exchange already exists in this organization.',
        }
      }
      if (result.status !== 'created') {
        throw new Error(`Unexpected security create result: ${result.status}`)
      }

      reply.code(201)
      return securityMutationResponseSchema.parse({
        security: mapSecurity(result.security),
      })
    })

    app.put<{ Params: Record<string, unknown> }>(
      '/api/securities/:securityId',
      async (request, reply) => {
        const params = securityIdParamsSchema.safeParse(request.params)
        const body = securityUpdateSchema.safeParse(request.body)
        if (!params.success) {
          reply.code(400)
          return validationError(params.error)
        }
        if (!body.success) {
          reply.code(400)
          return validationError(body.error)
        }

        const result = await securityStore.update({
          organizationId: request.user.organizationId,
          securityId: params.data.securityId,
          ...body.data,
        })
        if (result.status === 'not_found') {
          reply.code(404)
          return notFoundError()
        }
        if (result.status === 'duplicate_identity') {
          reply.code(409)
          return {
            code: 'SECURITY_DUPLICATE_IDENTITY' as const,
            message: 'A security with the same symbol and exchange already exists in this organization.',
          }
        }
        if (result.status !== 'updated') {
          throw new Error(`Unexpected security update result: ${result.status}`)
        }

        return securityMutationResponseSchema.parse({
          security: mapSecurity(result.security),
        })
      },
    )

    const setActive = async (
      request: { params: unknown; user: { organizationId: string } },
      reply: { code: (statusCode: number) => typeof reply; send?: (payload: unknown) => unknown },
      active: boolean,
    ) => {
      const params = securityIdParamsSchema.safeParse(request.params)
      if (!params.success) {
        reply.code(400)
        return validationError(params.error)
      }

      const result = await securityStore.setActive({
        organizationId: request.user.organizationId,
        securityId: params.data.securityId,
        active,
      })
      if (result.status === 'not_found') {
        reply.code(404)
        return notFoundError()
      }
      if (result.status !== 'updated') {
        throw new Error(`Unexpected security active-state result: ${result.status}`)
      }

      return securityMutationResponseSchema.parse({
        security: mapSecurity(result.security),
      })
    }

    app.post<{ Params: Record<string, unknown> }>(
      '/api/securities/:securityId/activate',
      (request, reply) => setActive(request, reply, true),
    )
    app.post<{ Params: Record<string, unknown> }>(
      '/api/securities/:securityId/deactivate',
      (request, reply) => setActive(request, reply, false),
    )

    app.delete<{ Params: Record<string, unknown> }>(
      '/api/securities/:securityId',
      async (request, reply) => {
        const params = securityIdParamsSchema.safeParse(request.params)
        if (!params.success) {
          reply.code(400)
          return validationError(params.error)
        }

        const result = await securityStore.delete({
          organizationId: request.user.organizationId,
          securityId: params.data.securityId,
        })
        if (result.status === 'not_found') {
          reply.code(404)
          return notFoundError()
        }
        if (result.status === 'blocked_by_references') {
          reply.code(409)
          return {
            code: 'SECURITY_BLOCKED_BY_REFERENCES' as const,
            message: 'This security is in use and cannot be deleted. Deactivate it instead.',
          }
        }

        return securityDeleteResponseSchema.parse({
          success: true,
          deletedSecurityId: params.data.securityId,
        })
      },
    )
  }
}

export const securityMasterRoutes = createSecurityMasterRoutes()
