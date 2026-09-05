import { z } from 'zod'

export const aiConnectionCreateRequestSchema = z.object({
  providerId: z.string().trim().min(1),
  label: z.string().trim().min(1).max(120),
  config: z.record(z.string(), z.unknown()),
  secrets: z.record(z.string(), z.unknown()),
})

export const aiConnectionUpdateRequestSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  secrets: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
})

export const azureOpenAiConfigSchema = z.object({
  endpoint: z.url(),
  deployment: z.string().min(1),
  apiKey: z.string().min(1),
  apiVersion: z.string().min(1),
})

export const googleGeminiConfigSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().min(1),
})

export const openAiConfigSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().min(1),
})

export type AzureOpenAiConfig = z.infer<typeof azureOpenAiConfigSchema>
export type GoogleGeminiConfig = z.infer<typeof googleGeminiConfigSchema>
export type OpenAiConfig = z.infer<typeof openAiConfigSchema>
