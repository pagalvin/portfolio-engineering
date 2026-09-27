-- CreateEnum
CREATE TYPE "SecurityType" AS ENUM ('STOCK', 'ETF', 'INDEX', 'OTHER');

-- CreateTable
CREATE TABLE "securities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "symbolNormalized" TEXT NOT NULL,
    "type" "SecurityType" NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "exchange" TEXT,
    "exchangeNormalized" TEXT NOT NULL,
    "sector" TEXT,
    "industry" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "securities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "securities_organizationId_symbolNormalized_exchangeNormalized_key" ON "securities"("organizationId", "symbolNormalized", "exchangeNormalized");

-- CreateIndex
CREATE INDEX "securities_organizationId_idx" ON "securities"("organizationId");

-- CreateIndex
CREATE INDEX "securities_organizationId_symbolNormalized_idx" ON "securities"("organizationId", "symbolNormalized");

-- CreateIndex
CREATE INDEX "securities_organizationId_exchangeNormalized_idx" ON "securities"("organizationId", "exchangeNormalized");

-- CreateIndex
CREATE INDEX "securities_organizationId_active_idx" ON "securities"("organizationId", "active");

-- CreateIndex
CREATE INDEX "securities_organizationId_type_idx" ON "securities"("organizationId", "type");

-- CreateIndex
CREATE INDEX "securities_organizationId_updatedAt_idx" ON "securities"("organizationId", "updatedAt");

-- AddForeignKey
ALTER TABLE "securities" ADD CONSTRAINT "securities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
