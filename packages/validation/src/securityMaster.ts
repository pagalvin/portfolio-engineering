import { z } from 'zod'

export const securityTypeSchema = z.enum(['STOCK', 'ETF', 'INDEX', 'OTHER'])

const optionalText = (max: number) =>
  z.string().max(max).nullable().optional()

export const securityWriteSchema = z.object({
  symbol: z.string().trim().min(1, 'Symbol is required').max(100),
  type: securityTypeSchema.default('OTHER'),
  name: optionalText(200),
  description: optionalText(10_000),
  exchange: optionalText(100),
  sector: optionalText(200),
  industry: optionalText(200),
}).strict()

export const securityUpdateSchema = securityWriteSchema

export const securityIdParamsSchema = z.object({
  securityId: z.string().trim().min(1),
}).strict()

export const securityListQuerySchema = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  type: securityTypeSchema.optional(),
  exchange: z.string().max(100).optional(),
}).strict()

export const securityRecordSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  symbol: z.string(),
  type: securityTypeSchema,
  name: z.string().nullable(),
  description: z.string().nullable(),
  exchange: z.string().nullable(),
  sector: z.string().nullable(),
  industry: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const securityCollectionResponseSchema = z.object({
  securities: z.array(securityRecordSchema),
  totalCount: z.number().int().nonnegative(),
})

export const securityMutationResponseSchema = z.object({
  security: securityRecordSchema,
})

export const securityDeleteResponseSchema = z.object({
  success: z.literal(true),
  deletedSecurityId: z.string(),
})

export const securityErrorResponseSchema = z.object({
  code: z.enum([
    'VALIDATION_ERROR',
    'SECURITY_NOT_FOUND',
    'SECURITY_DUPLICATE_IDENTITY',
    'SECURITY_BLOCKED_BY_REFERENCES',
  ]),
  message: z.string(),
})
