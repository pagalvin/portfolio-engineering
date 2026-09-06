/**
 * Personal Investor Profile Validation Schemas
 *
 * Zod schemas for request validation, profile upsert, and repo-sourced catalogs.
 * Used by API routes and frontend client.
 */

import { z } from 'zod'

export const experienceLevelSchema = z.enum([
  'BEGINNER',
  'INTERMEDIATE',
  'EXPERIENCED',
])

export type ExperienceLevel = z.infer<typeof experienceLevelSchema>

export const upsertInvestorProfileSchema = z.object({
  preferredName: z.string().max(100).nullable().optional(),
  experienceLevel: experienceLevelSchema.nullable().optional(),
  portfolioContext: z.array(z.string()).nullable().optional(),
  primaryObjective: z.string().max(100).nullable().optional(),
  strategyPresets: z.array(z.string()).nullable().optional(),
  customStrategyDescription: z.string().max(5000).nullable().optional(),
  freeformAiContext: z.string().max(5000).nullable().optional(),
})

export type UpsertInvestorProfileInput = z.infer<typeof upsertInvestorProfileSchema>

export const investorProfileOptionItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  educationalHint: z.string().optional(),
})

export type InvestorProfileOptionItem = z.infer<typeof investorProfileOptionItemSchema>

export const investorProfileCatalogsSchema = z.object({
  objectives: z.array(investorProfileOptionItemSchema),
  strategies: z.array(investorProfileOptionItemSchema),
})

export type InvestorProfileCatalogs = z.infer<typeof investorProfileCatalogsSchema>
