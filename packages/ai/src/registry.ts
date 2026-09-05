import type { ProviderDefinition } from './types.js'

export const providerRegistry: Record<string, ProviderDefinition> = Object.create(null)

export function registerProvider(definition: ProviderDefinition): ProviderDefinition {
  providerRegistry[definition.id] = definition
  return definition
}

export function getProviderDefinition(providerId: string): ProviderDefinition | undefined {
  return providerRegistry[providerId]
}

export function listProviderDefinitions(): ProviderDefinition[] {
  return Object.values(providerRegistry)
}

export function isProviderUsable(providerId: string): boolean {
  return providerRegistry[providerId]?.isUsable ?? false
}
