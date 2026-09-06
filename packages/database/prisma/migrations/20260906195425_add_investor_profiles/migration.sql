-- CreateTable
CREATE TABLE "investor_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredName" TEXT,
    "experienceLevel" TEXT,
    "portfolioContext" JSONB,
    "primaryObjective" TEXT,
    "strategyPresets" JSONB,
    "customStrategyDescription" TEXT,
    "freeformAiContext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investor_profiles_organizationId_idx" ON "investor_profiles"("organizationId");

-- CreateIndex
CREATE INDEX "investor_profiles_userId_idx" ON "investor_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "investor_profiles_organizationId_userId_key" ON "investor_profiles"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "investor_profiles" ADD CONSTRAINT "investor_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_profiles" ADD CONSTRAINT "investor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
