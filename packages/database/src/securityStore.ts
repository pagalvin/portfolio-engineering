import { Prisma } from './generated/prisma/client.js'
import type {
  PrismaClient,
  Security,
  SecurityType,
} from './generated/prisma/client.js'

export function normalizeSecurityIdentity(value: string): string {
  return value.normalize('NFKC').trim().toUpperCase()
}

export class InvalidSecuritySymbolError extends Error {
  constructor() {
    super('Security symbol must not be blank after normalization.')
    this.name = 'InvalidSecuritySymbolError'
  }
}

export interface SecurityFields {
  symbol: string
  type: SecurityType
  name?: string | null
  description?: string | null
  exchange?: string | null
  sector?: string | null
  industry?: string | null
  active?: boolean
}

export interface SecurityListInput {
  organizationId: string
  search?: string
  active?: boolean
  type?: SecurityType
  exchange?: string | null
}

export type SecurityWriteResult =
  | { status: 'created'; security: Security }
  | { status: 'updated'; security: Security }
  | { status: 'not_found' }
  | { status: 'duplicate_identity' }

export type SecurityDeleteResult =
  | { status: 'deleted' }
  | { status: 'not_found' }
  | { status: 'blocked_by_references' }

export interface SecurityStore {
  create(input: SecurityFields & { organizationId: string }): Promise<SecurityWriteResult>
  list(input: SecurityListInput): Promise<Security[]>
  count(input: { organizationId: string }): Promise<number>
  find(input: { organizationId: string; securityId: string }): Promise<Security | null>
  update(input: SecurityFields & { organizationId: string; securityId: string }): Promise<SecurityWriteResult>
  setActive(input: {
    organizationId: string
    securityId: string
    active: boolean
  }): Promise<SecurityWriteResult>
  delete(input: { organizationId: string; securityId: string }): Promise<SecurityDeleteResult>
}

function identityValues(input: SecurityFields): {
  symbolNormalized: string
  exchangeNormalized: string
} {
  const symbolNormalized = normalizeSecurityIdentity(input.symbol)
  if (!symbolNormalized) {
    throw new InvalidSecuritySymbolError()
  }

  return {
    symbolNormalized,
    exchangeNormalized: normalizeSecurityIdentity(input.exchange ?? ''),
  }
}

function isKnownRequestError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
}

export function createSecurityStore(prisma: PrismaClient): SecurityStore {
  return {
    async create(input) {
      const { organizationId, symbol, type, name, description, exchange, sector, industry } = input
      const identity = identityValues(input)

      try {
        const security = await prisma.security.create({
          data: {
            organizationId,
            symbol,
            symbolNormalized: identity.symbolNormalized,
            type,
            name: name ?? null,
            description: description ?? null,
            exchange: exchange ?? null,
            exchangeNormalized: identity.exchangeNormalized,
            sector: sector ?? null,
            industry: industry ?? null,
            active: input.active ?? true,
          },
        })
        return { status: 'created', security }
      } catch (error: unknown) {
        if (isKnownRequestError(error, 'P2002')) {
          return { status: 'duplicate_identity' }
        }
        throw error
      }
    },

    list(input) {
      const where: Prisma.SecurityWhereInput = {
        organizationId: input.organizationId,
        ...(input.active === undefined ? {} : { active: input.active }),
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.exchange === undefined
          ? {}
          : { exchangeNormalized: normalizeSecurityIdentity(input.exchange ?? '') }),
        ...(input.search?.trim()
          ? {
              OR: [
                { symbol: { contains: input.search.trim(), mode: 'insensitive' } },
                { name: { contains: input.search.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
      }

      return prisma.security.findMany({
        where,
        orderBy: [{ symbolNormalized: 'asc' }, { exchangeNormalized: 'asc' }],
      })
    },

    count({ organizationId }) {
      return prisma.security.count({ where: { organizationId } })
    },

    find({ organizationId, securityId }) {
      return prisma.security.findFirst({
        where: { id: securityId, organizationId },
      })
    },

    async update(input) {
      const { organizationId, securityId, symbol, type, name, description, exchange, sector, industry } = input
      const identity = identityValues(input)

      try {
        const result = await prisma.security.updateMany({
          where: { id: securityId, organizationId },
          data: {
            symbol,
            symbolNormalized: identity.symbolNormalized,
            type,
            name: name ?? null,
            description: description ?? null,
            exchange: exchange ?? null,
            exchangeNormalized: identity.exchangeNormalized,
            sector: sector ?? null,
            industry: industry ?? null,
            ...(input.active === undefined ? {} : { active: input.active }),
          },
        })
        if (result.count === 0) {
          return { status: 'not_found' }
        }

        const security = await prisma.security.findFirst({
          where: { id: securityId, organizationId },
        })
        if (!security) {
          return { status: 'not_found' }
        }

        return { status: 'updated', security }
      } catch (error: unknown) {
        if (isKnownRequestError(error, 'P2002')) {
          return { status: 'duplicate_identity' }
        }
        if (isKnownRequestError(error, 'P2025')) {
          return { status: 'not_found' }
        }
        throw error
      }
    },

    async setActive({ organizationId, securityId, active }) {
      const result = await prisma.security.updateMany({
        where: { id: securityId, organizationId },
        data: { active },
      })
      if (result.count === 0) {
        return { status: 'not_found' }
      }

      const security = await prisma.security.findFirstOrThrow({
        where: { id: securityId, organizationId },
      })
      return { status: 'updated', security }
    },

    async delete({ organizationId, securityId }) {
      try {
        const result = await prisma.security.deleteMany({
          where: { id: securityId, organizationId },
        })
        return result.count === 0
          ? { status: 'not_found' }
          : { status: 'deleted' }
      } catch (error: unknown) {
        if (isKnownRequestError(error, 'P2003')) {
          return { status: 'blocked_by_references' }
        }
        throw error
      }
    },
  }
}
