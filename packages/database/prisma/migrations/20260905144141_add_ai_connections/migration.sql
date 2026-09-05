-- CreateTable
CREATE TABLE "ai_connections" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "secretPayload" JSONB NOT NULL,
    "configPayload" JSONB NOT NULL,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestFailureKind" TEXT,
    "lastTestErrorSummary" TEXT,
    "consecutiveFailureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_connections_organizationId_idx" ON "ai_connections"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_connections_organizationId_label_key" ON "ai_connections"("organizationId", "label");

-- AddForeignKey
ALTER TABLE "ai_connections" ADD CONSTRAINT "ai_connections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
