import type { FastifyPluginAsync } from 'fastify'
import {
  getProviderDefinition,
  listProviderDefinitions,
} from '@portfolio-engineering/ai'
import type { TestResult } from '@portfolio-engineering/ai'
import type {
  ProviderDefinition,
  ProviderFieldDefinition,
} from '@portfolio-engineering/ai'
import {
  createAiConnectionStore,
  getPrismaClient,
  type SafeAiConnectionRecord,
} from '@portfolio-engineering/database'
import {
  aiConnectionCreateRequestSchema,
  aiConnectionUpdateRequestSchema,
} from '@portfolio-engineering/validation/aiConnection'
import { z } from 'zod'
import {
  isAiTestEscalated,
  reserveAiTestSlot,
} from '../lib/aiTestLimits.js'

type PublicProviderField = ProviderFieldDefinition

interface PublicProviderMetadata {
  readonly id: string
  readonly displayName: string
  readonly fields: readonly PublicProviderField[]
  readonly usable: boolean
}

interface ProvidersResponse {
  readonly providers: readonly PublicProviderMetadata[]
}

interface AiConnectionResponse extends Omit<
  SafeAiConnectionRecord,
  'organizationId' | 'configPayload' | 'lastTestErrorSummary'
> {
  readonly config: Record<string, unknown>
  readonly health: 'ready' | 'untested' | 'failing' | 'disabled'
  readonly escalated: boolean
  readonly lastErrorSummary: string | null
}

interface ConnectionsResponse {
  readonly connections: readonly AiConnectionResponse[]
}

interface ProviderTestAdapter {
  generateText(
    prompt: string,
    options: { readonly connectionId: string },
  ): Promise<TestResult>
}

function toSafeTestFailure(
  connection: SafeAiConnectionRecord,
): TestResult {
  return {
    status: 'failure',
    providerId: connection.providerId,
    connectionId: connection.id,
    testedAt: new Date().toISOString(),
    failureKind: 'unknown',
    message: 'The connection test could not be completed.',
  }
}

function toSafeErrorLog(error: unknown): {
  readonly name: string
} {
  if (error instanceof Error) {
    return {
      name: error.name,
    }
  }

  return {
    name: 'UnknownError',
  }
}

const aiConnectionStore = createAiConnectionStore(getPrismaClient())

function getHealthState(
  connection: SafeAiConnectionRecord,
): AiConnectionResponse['health'] {
  if (!connection.enabled) {
    return 'disabled'
  }

  if (connection.lastTestStatus === 'success') {
    return 'ready'
  }

  if (connection.lastTestStatus === 'failure') {
    return 'failing'
  }

  return 'untested'
}

function toConnectionResponse(
  connection: SafeAiConnectionRecord,
): AiConnectionResponse {
  const {
    organizationId: _organizationId,
    configPayload,
    lastTestErrorSummary,
    ...safeConnection
  } = connection

  return {
    ...safeConnection,
    config: getProviderFields(configPayload as Record<string, unknown>),
    health: getHealthState(connection),
    escalated: isAiTestEscalated({
      failureKind: connection.lastTestFailureKind,
      consecutiveFailureCount: connection.consecutiveFailureCount,
    }),
    lastErrorSummary: lastTestErrorSummary,
  }
}

function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join('.') : 'configuration'
      return `${field}: ${issue.message}`
    })
    .join('; ')
}

function getProviderFields(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const { schemaVersion: _schemaVersion, ...providerFields } = payload
  return providerFields
}

function validateProviderPayload(
  definition: ProviderDefinition,
  config: Record<string, unknown>,
  secrets: Record<string, unknown>,
): void {
  const fieldNames = new Set(definition.fields.map((field) => field.name))
  const secretFieldNames = new Set(
    definition.fields
      .filter((field) => field.secret)
      .map((field) => field.name),
  )

  for (const fieldName of Object.keys(config)) {
    if (!fieldNames.has(fieldName)) {
      throw new Error(`config.${fieldName}: unknown provider field`)
    }

    if (secretFieldNames.has(fieldName)) {
      throw new Error(`config.${fieldName}: secret fields must be sent in secrets`)
    }
  }

  for (const fieldName of Object.keys(secrets)) {
    if (!fieldNames.has(fieldName)) {
      throw new Error(`secrets.${fieldName}: unknown provider field`)
    }

    if (!secretFieldNames.has(fieldName)) {
      throw new Error(`secrets.${fieldName}: non-secret fields must be sent in config`)
    }
  }

  const payload = {
    ...config,
    ...secrets,
  }

  try {
    definition.adapterFactory(payload)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw new Error(formatValidationError(error))
    }

    throw error
  }
}

function validateProviderConfig(
  definition: ProviderDefinition,
  config: Record<string, unknown>,
): void {
  const fieldNames = new Set(definition.fields.map((field) => field.name))
  const nonSecretFields = definition.fields.filter((field) => !field.secret)

  for (const fieldName of Object.keys(config)) {
    if (!fieldNames.has(fieldName)) {
      throw new Error(`config.${fieldName}: unknown provider field`)
    }

    if (definition.fields.find((field) => field.name === fieldName)?.secret) {
      throw new Error(`config.${fieldName}: secret fields must be sent in secrets`)
    }
  }

  for (const field of nonSecretFields) {
    if (field.required && config[field.name] === undefined) {
      throw new Error(`config.${field.name}: Invalid input: expected a value`)
    }
  }

  const schema =
    definition.id === 'azure-openai'
      ? z.object({
          endpoint: z.url(),
          deployment: z.string().min(1),
          apiVersion: z.string().min(1),
        })
      : z.object({
          model: z.string().min(1),
        })

  try {
    schema.parse(config)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw new Error(formatValidationError(error))
    }

    throw error
  }
}

function toPublicProviderMetadata(
  definition: ReturnType<typeof listProviderDefinitions>[number],
): PublicProviderMetadata {
  return {
    id: definition.id,
    displayName: definition.displayName,
    fields: definition.fields,
    usable: definition.isUsable,
  }
}

export const aiRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: ProvidersResponse }>(
    '/api/ai/providers',
    async () => ({
      providers: listProviderDefinitions()
        .filter((definition) => definition.isUsable)
        .map(toPublicProviderMetadata),
    }),
  )

  app.get<{ Reply: ConnectionsResponse }>(
    '/api/ai/connections',
    async (request) => ({
      connections: (await aiConnectionStore.list({
        organizationId: request.user.organizationId,
      })).map(toConnectionResponse),
    }),
  )

  app.post<{
    Body: unknown
    Reply: AiConnectionResponse | { code: string; message: string }
  }>('/api/ai/connections', async (request, reply) => {
    const requestResult = aiConnectionCreateRequestSchema.safeParse(request.body)

    if (!requestResult.success) {
      reply.code(400)
      return {
        code: 'VALIDATION_ERROR',
        message: formatValidationError(requestResult.error),
      }
    }

    const input = requestResult.data
    const definition = getProviderDefinition(input.providerId)

    if (!definition || !definition.isUsable) {
      reply.code(400)
      return {
        code: 'VALIDATION_ERROR',
        message: `providerId: unsupported provider '${input.providerId}'`,
      }
    }

    try {
      validateProviderPayload(definition, input.config, input.secrets)
    } catch (error: unknown) {
      if (error instanceof Error) {
        reply.code(400)
        return {
          code: 'VALIDATION_ERROR',
          message: error.message,
        }
      }

      throw error
    }

    const connection = await aiConnectionStore.create({
      organizationId: request.user.organizationId,
      providerId: input.providerId,
      label: input.label,
      configPayload: {
        schemaVersion: 1,
        ...input.config,
      },
      secret: {
        schemaVersion: 1,
        ...input.secrets,
      },
    })

    if (!connection) {
      reply.code(409)
      return {
        code: 'CONFLICT',
        message: `A connection labeled '${input.label}' already exists in this organization.`,
      }
    }

    reply.code(201)
    return toConnectionResponse(connection)
  })

  app.patch<{
    Params: { id: string }
    Body: unknown
    Reply: AiConnectionResponse | { code: string; message: string }
  }>('/api/ai/connections/:id', async (request, reply) => {
    const requestResult = aiConnectionUpdateRequestSchema.safeParse(request.body)

    if (!requestResult.success) {
      reply.code(400)
      return {
        code: 'VALIDATION_ERROR',
        message: formatValidationError(requestResult.error),
      }
    }

    const input = requestResult.data
    if (
      input.label === undefined &&
      input.config === undefined &&
      input.secrets === undefined &&
      input.enabled === undefined
    ) {
      reply.code(400)
      return {
        code: 'VALIDATION_ERROR',
        message: 'At least one connection field must be provided.',
      }
    }

    const organizationId = request.user.organizationId
    const existing = await aiConnectionStore.findById({
      organizationId,
      connectionId: request.params.id,
    })

    if (!existing) {
      reply.code(404)
      return {
        code: 'NOT_FOUND',
        message: 'The requested AI connection was not found.',
      }
    }

    const definition = getProviderDefinition(existing.providerId)
    if (!definition || !definition.isUsable) {
      reply.code(400)
      return {
        code: 'VALIDATION_ERROR',
        message: `providerId: unsupported provider '${existing.providerId}'`,
      }
    }

    try {
      if (input.config !== undefined) {
        validateProviderConfig(definition, {
          ...getProviderFields(existing.configPayload as Record<string, unknown>),
          ...input.config,
        })
      }

      if (input.secrets !== undefined) {
        for (const fieldName of Object.keys(input.secrets)) {
          const field = definition.fields.find(
            (candidate) => candidate.name === fieldName,
          )
          if (!field) {
            throw new Error(`secrets.${fieldName}: unknown provider field`)
          }
          if (!field.secret) {
            throw new Error(
              `secrets.${fieldName}: non-secret fields must be sent in config`,
            )
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        reply.code(400)
        return {
          code: 'VALIDATION_ERROR',
          message: error.message,
        }
      }
      throw error
    }

    if (input.enabled !== undefined && input.label === undefined &&
      input.config === undefined && input.secrets === undefined) {
      const connection = input.enabled
        ? await aiConnectionStore.enable({
            organizationId,
            connectionId: request.params.id,
          })
        : await aiConnectionStore.disable({
            organizationId,
            connectionId: request.params.id,
          })

      if (!connection) {
        reply.code(404)
        return {
          code: 'NOT_FOUND',
          message: 'The requested AI connection was not found.',
        }
      }

      return toConnectionResponse(connection)
    }

    const connection = await aiConnectionStore.update({
      organizationId,
      connectionId: request.params.id,
      label: input.label,
      configPayload:
        input.config === undefined
          ? undefined
          : {
              ...(existing.configPayload as Record<string, unknown>),
              ...input.config,
              schemaVersion: 1,
            },
      secret:
        input.secrets === undefined
          ? undefined
          : {
              schemaVersion: 1,
              ...input.secrets,
            },
    })

    if (!connection) {
      const duplicate = input.label
        ? (await aiConnectionStore.list({ organizationId })).some(
            (candidate) =>
              candidate.id !== request.params.id &&
              candidate.label === input.label,
          )
        : false

      reply.code(duplicate ? 409 : 404)
      return {
        code: duplicate ? 'CONFLICT' : 'NOT_FOUND',
        message: duplicate
          ? `A connection labeled '${input.label}' already exists in this organization.`
          : 'The requested AI connection was not found.',
      }
    }

    if (input.enabled !== undefined) {
      const toggled = input.enabled
        ? await aiConnectionStore.enable({
            organizationId,
            connectionId: request.params.id,
          })
        : await aiConnectionStore.disable({
            organizationId,
            connectionId: request.params.id,
          })

      if (!toggled) {
        reply.code(404)
        return {
          code: 'NOT_FOUND',
          message: 'The requested AI connection was not found.',
        }
      }

      return toConnectionResponse(toggled)
    }

    return toConnectionResponse(connection)
  })

  app.delete<{
    Params: { id: string }
    Reply: { deleted: true } | { code: string; message: string }
  }>('/api/ai/connections/:id', async (request, reply) => {
    const connection = await aiConnectionStore.delete({
      organizationId: request.user.organizationId,
      connectionId: request.params.id,
    })

    if (!connection) {
      reply.code(404)
      return {
        code: 'NOT_FOUND',
        message: 'The requested AI connection was not found.',
      }
    }

    return { deleted: true }
  })

  app.post<{
    Params: { id: string }
    Reply: TestResult | { code: string; message: string }
  }>('/api/ai/connections/:id/test', async (request, reply) => {
    const organizationId = request.user.organizationId
    const connection = await aiConnectionStore.findById({
      organizationId,
      connectionId: request.params.id,
    })

    if (!connection) {
      reply.code(404)
      return {
        code: 'NOT_FOUND',
        message: 'The requested AI connection was not found.',
      }
    }

    const definition = getProviderDefinition(connection.providerId)
    if (!definition || !definition.isUsable) {
      reply.code(400)
      return {
        code: 'VALIDATION_ERROR',
        message: `providerId: unsupported provider '${connection.providerId}'`,
      }
    }

    const limit = reserveAiTestSlot(organizationId, connection.id)
    if (!limit.allowed) {
      const testedAt = new Date()
      await aiConnectionStore.updateTestMetadata({
        organizationId,
        connectionId: connection.id,
        testedAt,
        status: 'failure',
        failureKind: 'rate_limit',
        errorSummary: `Testing cannot resume before ${limit.retryAt?.toISOString() ?? 'a later time'}.`,
      })
      reply.code(429)
      return {
        code: 'RATE_LIMITED',
        message: `Testing cannot resume before ${limit.retryAt?.toISOString() ?? 'a later time'}.`,
      }
    }

    let result: TestResult | undefined
    let secretPayload: Record<string, unknown> = {}

    try {
      const decryptedSecret = await aiConnectionStore.decryptSecretForInvocation({
        organizationId,
        connectionId: connection.id,
      })
      secretPayload = typeof decryptedSecret === 'string'
        ? { apiKey: decryptedSecret }
        : decryptedSecret
    } catch (error: unknown) {
      request.log.error(
        {
          error: toSafeErrorLog(error),
          providerId: connection.providerId,
          connectionId: connection.id,
        },
        'AI connection credential decryption failed',
      )
      result = toSafeTestFailure(connection)
    }

    if (!result) {
      let adapter: ProviderTestAdapter | undefined
      try {
        adapter = definition.adapterFactory({
          ...getProviderFields(connection.configPayload as Record<string, unknown>),
          ...getProviderFields(secretPayload),
        }) as ProviderTestAdapter
      } catch (error: unknown) {
        if (!(error instanceof z.ZodError)) {
          request.log.error(
            {
              error: toSafeErrorLog(error),
              providerId: connection.providerId,
              connectionId: connection.id,
            },
            'AI connection adapter setup failed',
          )
          throw error
        }

        result = toSafeTestFailure(connection)
      }

      if (!result && adapter) {
        result = await adapter.generateText(
          'Say hello and confirm you are online.',
          { connectionId: connection.id },
        )
      }
    }

    if (!result) {
      throw new Error('AI connection test did not produce a result.')
    }

    await aiConnectionStore.updateTestMetadata({
      organizationId,
      connectionId: connection.id,
      testedAt: new Date(result.testedAt),
      status: result.status,
      failureKind: result.status === 'failure' ? result.failureKind : null,
      errorSummary: result.status === 'failure' ? result.message : null,
    })

    return result
  })
}
