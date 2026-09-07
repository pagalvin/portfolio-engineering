-- CreateTable
CREATE TABLE "help_runtime_caches" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "indexPayload" JSONB,
    "contentPayload" JSONB,
    "effectiveAppVersion" TEXT,
    "contentVersion" TEXT,
    "schemaVersion" INTEGER,
    "freshnessStatus" TEXT NOT NULL DEFAULT 'unavailable',
    "lastRefreshStatus" TEXT NOT NULL DEFAULT 'never_attempted',
    "fetchedAt" TIMESTAMP(3),
    "lastDownloadAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_runtime_caches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "help_runtime_caches_channelId_key" ON "help_runtime_caches"("channelId");

-- Add constraints for the application-owned state machine and atomic payload boundary.
ALTER TABLE "help_runtime_caches"
  ADD CONSTRAINT "help_runtime_caches_freshnessStatus_check"
    CHECK ("freshnessStatus" IN ('fresh', 'stale', 'unavailable')),
  ADD CONSTRAINT "help_runtime_caches_lastRefreshStatus_check"
    CHECK ("lastRefreshStatus" IN ('never_attempted', 'succeeded', 'failed', 'invalid')),
  ADD CONSTRAINT "help_runtime_caches_schemaVersion_check"
    CHECK ("schemaVersion" IS NULL OR "schemaVersion" >= 0),
  ADD CONSTRAINT "help_runtime_caches_payload_boundary_check"
    CHECK (
      (
        "indexPayload" IS NULL
        AND "contentPayload" IS NULL
        AND "effectiveAppVersion" IS NULL
        AND "contentVersion" IS NULL
        AND "schemaVersion" IS NULL
      )
      OR (
        "indexPayload" IS NOT NULL
        AND "contentPayload" IS NOT NULL
        AND "effectiveAppVersion" IS NOT NULL
        AND "contentVersion" IS NOT NULL
        AND "schemaVersion" IS NOT NULL
        AND jsonb_typeof("indexPayload") = 'object'
        AND jsonb_typeof("contentPayload") = 'object'
      )
    );
