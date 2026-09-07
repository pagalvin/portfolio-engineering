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

export const profileBackupSectionManifestSchema = z.object({
  profile: z.string().min(1),
  investorProfile: z.string().min(1),
  journal: z.string().min(1),
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
