import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

const globalForPrisma = globalThis as typeof globalThis & {
  portfolioEngineeringPrisma?: PrismaClient
}

const defaultDatabaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/portfolio_engineering_dev?schema=public'

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: defaultDatabaseUrl,
    }),
  })
}

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.portfolioEngineeringPrisma) {
    globalForPrisma.portfolioEngineeringPrisma = createPrismaClient()
  }

  return globalForPrisma.portfolioEngineeringPrisma
}
