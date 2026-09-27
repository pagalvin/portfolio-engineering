-- CreateEnum
CREATE TYPE "PredictionType" AS ENUM ('DIRECTION', 'PERCENT_MOVE', 'TARGET_PRICE', 'EVENT_REACTION', 'FREEFORM');

-- CreateEnum
CREATE TYPE "PredictionDirection" AS ENUM ('RISES', 'FALLS');

-- CreateEnum
CREATE TYPE "PredictionResult" AS ENUM ('CORRECT', 'INCORRECT');

-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "securityId" TEXT,
    "otherSymbol" TEXT,
    "topic" TEXT,
    "symbolSnapshot" TEXT,
    "symbolNormalizedSnapshot" TEXT,
    "type" "PredictionType" NOT NULL,
    "direction" "PredictionDirection",
    "claimText" TEXT NOT NULL,
    "eventLabel" TEXT,
    "deadline" DATE NOT NULL,
    "confidence" INTEGER NOT NULL,
    "priceAtPrediction" DECIMAL(20,8),
    "predictedPrice" DECIMAL(20,8),
    "predictedPercent" DECIMAL(20,8),
    "priceCapturedAt" TIMESTAMP(3),
    "reasoning" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "result" "PredictionResult",
    "resolutionDate" DATE,
    "actualPrice" DECIMAL(20,8),
    "outcomeNotes" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "amended" BOOLEAN NOT NULL DEFAULT false,
    "amendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_amendments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "previousSecurityId" TEXT,
    "previousOtherSymbol" TEXT,
    "previousTopic" TEXT,
    "previousSymbolSnapshot" TEXT,
    "previousSymbolNormalizedSnapshot" TEXT,
    "previousType" "PredictionType" NOT NULL,
    "previousDirection" "PredictionDirection",
    "previousClaimText" TEXT NOT NULL,
    "previousEventLabel" TEXT,
    "previousDeadline" DATE NOT NULL,
    "previousConfidence" INTEGER NOT NULL,
    "previousPriceAtPrediction" DECIMAL(20,8),
    "previousPriceCapturedAt" TIMESTAMP(3),
    "previousPredictedPrice" DECIMAL(20,8),
    "previousPredictedPercent" DECIMAL(20,8),
    "changedFields" TEXT[],
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_result_history" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "previousResult" "PredictionResult",
    "previousResolutionDate" DATE,
    "previousActualPrice" DECIMAL(20,8),
    "previousOutcomeNotes" TEXT,
    "newResult" "PredictionResult",
    "newResolutionDate" DATE,
    "newActualPrice" DECIMAL(20,8),
    "newOutcomeNotes" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_result_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_reasoning_history" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "previousReasoning" TEXT,
    "newReasoning" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_reasoning_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "predictions_organizationId_userId_deadline_result_voidedAt_idx" ON "predictions"("organizationId", "userId", "deadline", "result", "voidedAt");

-- CreateIndex
CREATE INDEX "predictions_organizationId_userId_createdAt_idx" ON "predictions"("organizationId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "predictions_organizationId_userId_type_idx" ON "predictions"("organizationId", "userId", "type");

-- CreateIndex
CREATE INDEX "predictions_organizationId_userId_result_idx" ON "predictions"("organizationId", "userId", "result");

-- CreateIndex
CREATE INDEX "predictions_organizationId_userId_amended_idx" ON "predictions"("organizationId", "userId", "amended");

-- CreateIndex
CREATE INDEX "predictions_organizationId_userId_voidedAt_idx" ON "predictions"("organizationId", "userId", "voidedAt");

-- CreateIndex
CREATE INDEX "predictions_organizationId_userId_deadline_idx" ON "predictions"("organizationId", "userId", "deadline");

-- CreateIndex
CREATE INDEX "predictions_organizationId_userId_resolutionDate_idx" ON "predictions"("organizationId", "userId", "resolutionDate");

-- CreateIndex
CREATE INDEX "predictions_organizationId_userId_symbolNormalizedSnapshot_idx" ON "predictions"("organizationId", "userId", "symbolNormalizedSnapshot");

-- CreateIndex
CREATE INDEX "predictions_organizationId_userId_confidence_result_voidedA_idx" ON "predictions"("organizationId", "userId", "confidence", "result", "voidedAt", "amended");

-- CreateIndex
CREATE INDEX "predictions_organizationId_userId_type_result_voidedAt_amen_idx" ON "predictions"("organizationId", "userId", "type", "result", "voidedAt", "amended");

-- CreateIndex
CREATE UNIQUE INDEX "predictions_organizationId_id_key" ON "predictions"("organizationId", "id");

-- CreateIndex
CREATE INDEX "prediction_amendments_organizationId_userId_predictionId_ch_idx" ON "prediction_amendments"("organizationId", "userId", "predictionId", "changedAt");

-- CreateIndex
CREATE INDEX "prediction_result_history_organizationId_userId_predictionI_idx" ON "prediction_result_history"("organizationId", "userId", "predictionId", "changedAt");

-- CreateIndex
CREATE INDEX "prediction_reasoning_history_organizationId_userId_predicti_idx" ON "prediction_reasoning_history"("organizationId", "userId", "predictionId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "securities_organizationId_id_key" ON "securities"("organizationId", "id");

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_organizationId_securityId_fkey" FOREIGN KEY ("organizationId", "securityId") REFERENCES "securities"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_amendments" ADD CONSTRAINT "prediction_amendments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_amendments" ADD CONSTRAINT "prediction_amendments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_amendments" ADD CONSTRAINT "prediction_amendments_organizationId_predictionId_fkey" FOREIGN KEY ("organizationId", "predictionId") REFERENCES "predictions"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_result_history" ADD CONSTRAINT "prediction_result_history_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_result_history" ADD CONSTRAINT "prediction_result_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_result_history" ADD CONSTRAINT "prediction_result_history_organizationId_predictionId_fkey" FOREIGN KEY ("organizationId", "predictionId") REFERENCES "predictions"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_reasoning_history" ADD CONSTRAINT "prediction_reasoning_history_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_reasoning_history" ADD CONSTRAINT "prediction_reasoning_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_reasoning_history" ADD CONSTRAINT "prediction_reasoning_history_organizationId_predictionId_fkey" FOREIGN KEY ("organizationId", "predictionId") REFERENCES "predictions"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "securities_organizationId_symbolNormalized_exchangeNormalized_k" RENAME TO "securities_organizationId_symbolNormalized_exchangeNormaliz_key";

-- Enable trigram search support for the reasoning/outcome-notes/claim-text search predicate (FR 33).
-- If a target deployment cannot enable this extension, remove this block and the trigram indexes below;
-- the store's search predicate already falls back to organization/user-scoped ILIKE and does not depend on the index.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex (tags array filter)
CREATE INDEX "predictions_tags_gin_idx" ON "predictions" USING GIN ("tags");

-- CreateIndex (trigram search support for q)
CREATE INDEX "predictions_claimText_trgm_idx" ON "predictions" USING GIN ("claimText" gin_trgm_ops);
CREATE INDEX "predictions_reasoning_trgm_idx" ON "predictions" USING GIN ("reasoning" gin_trgm_ops);
CREATE INDEX "predictions_outcomeNotes_trgm_idx" ON "predictions" USING GIN ("outcomeNotes" gin_trgm_ops);

-- Application-owned invariants that cannot be expressed in the Prisma schema.
ALTER TABLE "predictions"
  ADD CONSTRAINT "predictions_confidence_check"
    CHECK ("confidence" >= 50 AND "confidence" <= 100),
  ADD CONSTRAINT "predictions_priceAtPrediction_positive_check"
    CHECK ("priceAtPrediction" IS NULL OR "priceAtPrediction" > 0),
  ADD CONSTRAINT "predictions_predictedPrice_positive_check"
    CHECK ("predictedPrice" IS NULL OR "predictedPrice" > 0),
  ADD CONSTRAINT "predictions_actualPrice_positive_check"
    CHECK ("actualPrice" IS NULL OR "actualPrice" > 0),
  ADD CONSTRAINT "predictions_topic_freeform_only_check"
    CHECK ("topic" IS NULL OR "type" = 'FREEFORM'),
  ADD CONSTRAINT "predictions_measurable_subject_check"
    CHECK ("type" = 'FREEFORM' OR ("securityId" IS NOT NULL OR "otherSymbol" IS NOT NULL)),
  ADD CONSTRAINT "predictions_subject_snapshot_check"
    CHECK (
      ("securityId" IS NULL AND "otherSymbol" IS NULL AND "topic" IS NULL AND "symbolSnapshot" IS NULL AND "symbolNormalizedSnapshot" IS NULL)
      OR ("topic" IS NOT NULL AND "securityId" IS NULL AND "otherSymbol" IS NULL AND "symbolSnapshot" IS NULL AND "symbolNormalizedSnapshot" IS NULL)
      OR ("securityId" IS NOT NULL AND "otherSymbol" IS NULL AND "symbolSnapshot" IS NOT NULL AND "symbolNormalizedSnapshot" IS NOT NULL)
      OR ("otherSymbol" IS NOT NULL AND "securityId" IS NULL AND "symbolSnapshot" IS NOT NULL AND "symbolNormalizedSnapshot" IS NOT NULL AND "otherSymbol" = "symbolNormalizedSnapshot")
    ),
  ADD CONSTRAINT "predictions_direction_by_type_check"
    CHECK (
      ("type" = 'FREEFORM' AND "direction" IS NULL)
      OR ("type" <> 'FREEFORM' AND "direction" IS NOT NULL)
    ),
  ADD CONSTRAINT "predictions_measurable_price_check"
    CHECK (
      ("type" = 'FREEFORM' AND "priceAtPrediction" IS NULL AND "priceCapturedAt" IS NULL)
      OR ("type" <> 'FREEFORM' AND "priceAtPrediction" IS NOT NULL AND "priceCapturedAt" IS NOT NULL)
    ),
  ADD CONSTRAINT "predictions_predicted_values_by_type_check"
    CHECK (
      ("type" IN ('DIRECTION', 'FREEFORM') AND "predictedPrice" IS NULL AND "predictedPercent" IS NULL)
      OR ("type" = 'PERCENT_MOVE' AND "predictedPrice" IS NOT NULL AND "predictedPercent" IS NOT NULL)
      OR ("type" = 'TARGET_PRICE' AND "predictedPrice" IS NOT NULL)
      OR ("type" = 'EVENT_REACTION')
    ),
  ADD CONSTRAINT "predictions_result_pairing_check"
    CHECK (
      ("result" IS NULL AND "resolutionDate" IS NULL)
      OR ("result" IS NOT NULL AND "resolutionDate" IS NOT NULL)
    );
