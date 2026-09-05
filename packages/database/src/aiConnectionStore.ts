import type {
  AiConnection,
  Prisma,
  PrismaClient,
} from './generated/prisma/client.js'

import {
  decryptSecret,
  encryptSecret,
  getEncryptionKey,
  type EncryptedSecret,
} from '@portfolio-engineering/crypto'

export type AiConnectionSecretInput =
  | Record<string, unknown>
  | string
  | null
  | undefined

export type AiConnectionStatus = 'success' | 'failure'

export type SafeAiConnectionRecord = Omit<AiConnection, 'secretPayload'> & {
  secretPayload?: never
}

export interface AiConnectionStore {
  create(input: {
    organizationId: string
    providerId: string
    label: string
    configPayload: Record<string, unknown>
    secret: AiConnectionSecretInput
  }): Promise<SafeAiConnectionRecord | null>
  list(input: {
    organizationId: string
  }): Promise<SafeAiConnectionRecord[]>
  find(input: {
    organizationId: string
    connectionId: string
  }): Promise<SafeAiConnectionRecord | null>
  findById(input: {
    organizationId: string
    connectionId: string
  }): Promise<SafeAiConnectionRecord | null>
  update(input: {
    organizationId: string
    connectionId: string
    providerId?: string
    label?: string
    configPayload?: Record<string, unknown>
    secret?: AiConnectionSecretInput
  }): Promise<SafeAiConnectionRecord | null>
  delete(input: {
    organizationId: string
    connectionId: string
  }): Promise<SafeAiConnectionRecord | null>
  enable(input: {
    organizationId: string
    connectionId: string
  }): Promise<SafeAiConnectionRecord | null>
  disable(input: {
    organizationId: string
    connectionId: string
  }): Promise<SafeAiConnectionRecord | null>
  updateTestMetadata(input: {
    organizationId: string
    connectionId: string
    testedAt?: Date
    status: AiConnectionStatus
    failureKind?: string | null
    errorSummary?: string | null
    consecutiveFailureCount?: number
  }): Promise<SafeAiConnectionRecord | null>
  decryptSecret(input: {
    organizationId: string
    connectionId: string
  }): Promise<Record<string, unknown> | string>
  decryptSecretForInvocation(input: {
    organizationId: string
    connectionId: string
  }): Promise<Record<string, unknown> | string>
}

const safeAiConnectionSelect = {
  id: true,
  organizationId: true,
  providerId: true,
  label: true,
  enabled: true,
  configPayload: true,
  lastTestedAt: true,
  lastTestStatus: true,
  lastTestFailureKind: true,
  lastTestErrorSummary: true,
  consecutiveFailureCount: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AiConnectionSelect

function isBlankSecret(secret: AiConnectionSecretInput): boolean {
  if (secret === undefined || secret === null) {
    return true
  }

  if (typeof secret === 'string') {
    return secret.trim().length === 0
  }

  if (Array.isArray(secret)) {
    return secret.length === 0
  }

  if (typeof secret === 'object') {
    const values = Object.values(secret)
    if (values.length === 0) {
      return true
    }

    return values.every((value) => isBlankSecret(value as AiConnectionSecretInput))
  }

  return false
}

function serializePlaintextSecret(secret: AiConnectionSecretInput): string {
  if (typeof secret === 'string') {
    return secret
  }

  if (secret === undefined || secret === null) {
    return ''
  }

  if (typeof secret === 'object') {
    return JSON.stringify(secret)
  }

  return String(secret)
}

function sanitizeAiConnection(record: AiConnection): SafeAiConnectionRecord {
  const { secretPayload: _secretPayload, ...safeRecord } = record
  return safeRecord as SafeAiConnectionRecord
}

function getEncryptedSecretEnvelope(secret: AiConnectionSecretInput): EncryptedSecret {
  const plaintext = serializePlaintextSecret(secret)
  if (plaintext.length === 0) {
    throw new Error('Secret value must not be blank when encrypting.')
  }

  return encryptSecret(plaintext, getEncryptionKey(), 'active')
}

function isEncryptedSecretEnvelope(value: unknown): value is EncryptedSecret {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.algorithm === 'string' &&
    typeof candidate.authTag === 'string' &&
    typeof candidate.ciphertext === 'string' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.keyVersion === 'string' &&
    candidate.version === 1
  )
}

export function createAiConnectionStore(prisma: PrismaClient): AiConnectionStore {
  return {
    async create(input) {
      try {
        const record = await prisma.aiConnection.create({
          data: {
            organizationId: input.organizationId,
            providerId: input.providerId,
            label: input.label,
            enabled: true,
            configPayload: input.configPayload as Prisma.InputJsonValue,
            secretPayload: getEncryptedSecretEnvelope(input.secret) as unknown as Prisma.InputJsonValue,
          },
          select: safeAiConnectionSelect,
        })

        return sanitizeAiConnection(record as AiConnection)
      } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error) {
          const code = String((error as { code?: string }).code)
          if (code === 'P2002') {
            return null
          }
        }

        throw error
      }
    },

    async list(input) {
      const records = await prisma.aiConnection.findMany({
        where: {
          organizationId: input.organizationId,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        select: safeAiConnectionSelect,
      })

      return records.map((record) => sanitizeAiConnection(record as AiConnection))
    },

    async find(input) {
      const record = await prisma.aiConnection.findFirst({
        where: {
          id: input.connectionId,
          organizationId: input.organizationId,
        },
        select: safeAiConnectionSelect,
      })

      return record ? sanitizeAiConnection(record as AiConnection) : null
    },

    async findById(input) {
      return this.find(input)
    },

    async update(input) {
      const existing = await prisma.aiConnection.findFirst({
        where: {
          id: input.connectionId,
          organizationId: input.organizationId,
        },
      })

      if (!existing) {
        return null
      }

      const hasConnectionEdit =
        input.providerId !== undefined ||
        input.label !== undefined ||
        input.configPayload !== undefined ||
        (input.secret !== undefined && !isBlankSecret(input.secret))

      // Keep an observed failure visible while the user repairs the
      // connection. Only a successful test may clear failure metadata.
      // Successful results are still invalidated by edits so they cannot
      // present stale configuration as ready.
      const shouldResetTestMetadata =
        hasConnectionEdit && existing.lastTestStatus !== 'failure'

      const data: Prisma.AiConnectionUpdateInput = {
        ...(input.providerId !== undefined ? { providerId: input.providerId } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.configPayload !== undefined
          ? { configPayload: input.configPayload as Prisma.InputJsonValue }
          : {}),
      }

      if (input.secret !== undefined && !isBlankSecret(input.secret)) {
        data.secretPayload = getEncryptedSecretEnvelope(input.secret) as unknown as Prisma.InputJsonValue
      }

      if (shouldResetTestMetadata) {
        data.lastTestedAt = null
        data.lastTestStatus = null
        data.lastTestFailureKind = null
        data.lastTestErrorSummary = null
        data.consecutiveFailureCount = 0
      }

      try {
        const record = await prisma.aiConnection.update({
          where: {
            id: input.connectionId,
          },
          data,
          select: safeAiConnectionSelect,
        })

        return sanitizeAiConnection(record as AiConnection)
      } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error) {
          const code = String((error as { code?: string }).code)
          if (code === 'P2025') {
            return null
          }
        }

        throw error
      }
    },

    async delete(input) {
      try {
        const record = await prisma.aiConnection.delete({
          where: {
            id: input.connectionId,
            organizationId: input.organizationId,
          },
          select: safeAiConnectionSelect,
        })

        return sanitizeAiConnection(record as AiConnection)
      } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error) {
          const code = String((error as { code?: string }).code)
          if (code === 'P2025') {
            return null
          }
        }

        throw error
      }
    },

    async enable(input) {
      try {
        const record = await prisma.aiConnection.update({
          where: {
            id: input.connectionId,
            organizationId: input.organizationId,
          },
          data: {
            enabled: true,
          },
          select: safeAiConnectionSelect,
        })

        return sanitizeAiConnection(record as AiConnection)
      } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error) {
          const code = String((error as { code?: string }).code)
          if (code === 'P2025') {
            return null
          }
        }

        throw error
      }
    },

    async disable(input) {
      try {
        const record = await prisma.aiConnection.update({
          where: {
            id: input.connectionId,
            organizationId: input.organizationId,
          },
          data: {
            enabled: false,
          },
          select: safeAiConnectionSelect,
        })

        return sanitizeAiConnection(record as AiConnection)
      } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error) {
          const code = String((error as { code?: string }).code)
          if (code === 'P2025') {
            return null
          }
        }

        throw error
      }
    },

    async updateTestMetadata(input) {
      const existing = await prisma.aiConnection.findFirst({
        where: {
          id: input.connectionId,
          organizationId: input.organizationId,
        },
      })

      if (!existing) {
        return null
      }

      const status = input.status
      const nextCount =
        status === 'success'
          ? 0
          : input.consecutiveFailureCount ?? existing.consecutiveFailureCount + 1

      const record = await prisma.aiConnection.update({
        where: {
          id: input.connectionId,
          organizationId: input.organizationId,
        },
        data: {
          lastTestedAt: input.testedAt ?? new Date(),
          lastTestStatus: status,
          lastTestFailureKind:
            status === 'success' ? null : input.failureKind ?? null,
          lastTestErrorSummary:
            status === 'success' ? null : input.errorSummary ?? null,
          consecutiveFailureCount: nextCount,
        },
        select: safeAiConnectionSelect,
      })

      return sanitizeAiConnection(record as AiConnection)
    },

    async decryptSecret(input) {
      const record = await prisma.aiConnection.findFirst({
        where: {
          id: input.connectionId,
          organizationId: input.organizationId,
        },
      })

      if (!record) {
        throw new Error('The requested AI connection was not found in the expected organization.')
      }

      if (!isEncryptedSecretEnvelope(record.secretPayload)) {
        throw new Error('The stored AI connection secret payload is malformed.')
      }

      const plaintext = decryptSecret(record.secretPayload, getEncryptionKey())

      try {
        return JSON.parse(plaintext) as Record<string, unknown>
      } catch {
        return plaintext
      }
    },

    async decryptSecretForInvocation(input) {
      return this.decryptSecret(input)
    },
  }
}
