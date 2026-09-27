import { z } from 'zod'

export const userRoleSchema = z.enum(['admin', 'member'])
export const appModeSchema = z.enum(['local', 'hosted'])

export const sessionUserSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  email: z.email(),
})

export const authenticatedSessionResponseSchema = z.object({
  authenticated: z.literal(true),
  configured: z.literal(true).optional(),
  appMode: appModeSchema,
  user: sessionUserSchema,
})

export const unauthenticatedSessionResponseSchema = z.object({
  authenticated: z.literal(false),
  configured: z.literal(true).optional(),
  appMode: appModeSchema.optional(),
  message: z.string().min(1),
})

export const unconfiguredSessionResponseSchema = z.object({
  authenticated: z.literal(false),
  configured: z.literal(false),
  appMode: z.null().optional(),
  message: z.string().min(1),
  instructions: z.array(z.string().min(1)),
})

export const sessionResponseSchema = z.union([
  authenticatedSessionResponseSchema,
  unauthenticatedSessionResponseSchema,
  unconfiguredSessionResponseSchema,
])

export const householdProfileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().min(1),
  lastLoginAt: z.string().nullable().optional(),
  journalEntryCount: z.number().int().nonnegative().optional(),
  hasInvestorProfile: z.boolean().optional(),
})

export const createProfileRequestSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required.').max(100),
  email: z
    .string()
    .trim()
    .email('Invalid email address format.')
    .optional()
    .or(z.literal('')),
})

export const selectProfileRequestSchema = z.object({
  profileId: z.string().min(1),
})

export const deleteProfileParamsSchema = z.object({
  id: z.string().min(1),
})

export const deleteProfileResponseSchema = z.object({
  success: z.boolean(),
  deletedProfileId: z.string().min(1),
})

export const profileBackupIntuitionLedgerSectionManifestSchema = z.object({
  predictions: z.string().min(1),
  amendmentHistory: z.string().min(1),
  resultHistory: z.string().min(1),
  reasoningHistory: z.string().min(1),
})

export const profileBackupSectionManifestSchema = z.object({
  profile: z.string().min(1),
  investorProfile: z.string().min(1),
  journal: z.string().min(1),
  intuitionLedger: profileBackupIntuitionLedgerSectionManifestSchema,
})

export const profileBackupMetaSchema = z.object({
  description: z.string().min(1),
  sections: profileBackupSectionManifestSchema,
})

export const profileBackupProfileDataSchema = z.object({
  displayName: z.string().min(1),
  email: z.string().min(1),
  role: userRoleSchema,
  createdAt: z.string().min(1),
})

export const profileBackupInvestorProfileDataSchema = z
  .object({
    preferredName: z.string().nullable().optional(),
    experienceLevel: z.string().nullable().optional(),
    portfolioContext: z.unknown().nullable().optional(),
    primaryObjective: z.string().nullable().optional(),
    strategyPresets: z.unknown().nullable().optional(),
    customStrategyDescription: z.string().nullable().optional(),
    freeformAiContext: z.string().nullable().optional(),
  })
  .nullable()

export const profileBackupJournalEntrySchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.string(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

export const profileBackupJournalDataSchema = z.object({
  count: z.number().int().nonnegative(),
  entries: z.array(profileBackupJournalEntrySchema),
})

export const profileBackupPredictionRecordSchema = z.object({
  id: z.string().min(1),
  securityId: z.string().nullable(),
  otherSymbol: z.string().nullable(),
  topic: z.string().nullable(),
  symbolSnapshot: z.string().nullable(),
  symbolNormalizedSnapshot: z.string().nullable(),
  type: z.string().min(1),
  direction: z.string().nullable(),
  claimText: z.string(),
  eventLabel: z.string().nullable(),
  deadline: z.string().min(1),
  confidence: z.number().int(),
  priceAtPrediction: z.string().nullable(),
  predictedPrice: z.string().nullable(),
  predictedPercent: z.string().nullable(),
  priceCapturedAt: z.string().nullable(),
  reasoning: z.string().nullable(),
  tags: z.array(z.string()),
  result: z.string().nullable(),
  resolutionDate: z.string().nullable(),
  actualPrice: z.string().nullable(),
  outcomeNotes: z.string().nullable(),
  voidedAt: z.string().nullable(),
  voidReason: z.string().nullable(),
  amended: z.boolean(),
  amendedAt: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

export const profileBackupPredictionAmendmentRecordSchema = z.object({
  id: z.string().min(1),
  predictionId: z.string().min(1),
  previousSecurityId: z.string().nullable(),
  previousOtherSymbol: z.string().nullable(),
  previousTopic: z.string().nullable(),
  previousSymbolSnapshot: z.string().nullable(),
  previousSymbolNormalizedSnapshot: z.string().nullable(),
  previousType: z.string().min(1),
  previousDirection: z.string().nullable(),
  previousClaimText: z.string(),
  previousEventLabel: z.string().nullable(),
  previousDeadline: z.string().min(1),
  previousConfidence: z.number().int(),
  previousPriceAtPrediction: z.string().nullable(),
  previousPriceCapturedAt: z.string().nullable(),
  previousPredictedPrice: z.string().nullable(),
  previousPredictedPercent: z.string().nullable(),
  changedFields: z.array(z.string()),
  changedAt: z.string().min(1),
})

export const profileBackupPredictionResultHistoryRecordSchema = z.object({
  id: z.string().min(1),
  predictionId: z.string().min(1),
  previousResult: z.string().nullable(),
  previousResolutionDate: z.string().nullable(),
  previousActualPrice: z.string().nullable(),
  previousOutcomeNotes: z.string().nullable(),
  newResult: z.string().nullable(),
  newResolutionDate: z.string().nullable(),
  newActualPrice: z.string().nullable(),
  newOutcomeNotes: z.string().nullable(),
  changedAt: z.string().min(1),
})

export const profileBackupPredictionReasoningHistoryRecordSchema = z.object({
  id: z.string().min(1),
  predictionId: z.string().min(1),
  previousReasoning: z.string().nullable(),
  newReasoning: z.string().nullable(),
  changedAt: z.string().min(1),
})

export const profileBackupIntuitionLedgerDataSchema = z.object({
  predictions: z.object({
    count: z.number().int().nonnegative(),
    records: z.array(profileBackupPredictionRecordSchema),
  }),
  amendmentHistory: z.object({
    count: z.number().int().nonnegative(),
    records: z.array(profileBackupPredictionAmendmentRecordSchema),
  }),
  resultHistory: z.object({
    count: z.number().int().nonnegative(),
    records: z.array(profileBackupPredictionResultHistoryRecordSchema),
  }),
  reasoningHistory: z.object({
    count: z.number().int().nonnegative(),
    records: z.array(profileBackupPredictionReasoningHistoryRecordSchema),
  }),
})

export const profileBackupPayloadSchema = z.object({
  $schema: z.string().optional(),
  version: z.string().min(1),
  exportedAt: z.string().min(1),
  appVersion: z.string().min(1),
  appMode: appModeSchema,
  _meta: profileBackupMetaSchema,
  data: z.object({
    profile: profileBackupProfileDataSchema,
    investorProfile: profileBackupInvestorProfileDataSchema,
    journal: profileBackupJournalDataSchema,
    intuitionLedger: profileBackupIntuitionLedgerDataSchema,
  }),
})

export const profilesResponseSchema = z.object({
  profiles: z.array(householdProfileSchema),
})

export const jwtPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  organizationId: z.string().min(1),
  role: userRoleSchema,
})

export const refreshTokenPayloadSchema = jwtPayloadSchema.extend({
  jti: z.uuid(),
  tokenType: z.literal('refresh'),
})

export const demoAuthQuerySchema = z.object({
  demoAuth: z.enum(['authenticated', 'unauthenticated']).optional(),
})

export const oauthCallbackRequestSchema = z.object({
  organizationSlug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  organizationName: z.string().min(1).max(120),
  token: z.string().min(1),
})

export const accessTokenResponseSchema = z.object({
  accessToken: z.string().min(1),
})

export const errorMessageResponseSchema = z.object({
  message: z.string().min(1),
})

export const currentUserResponseSchema = z.object({
  user: jwtPayloadSchema,
})
