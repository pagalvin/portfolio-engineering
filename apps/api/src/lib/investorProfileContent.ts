import {
  investorProfileCatalogsSchema,
  type InvestorProfileCatalogs,
  type InvestorProfileOptionItem,
} from '@portfolio-engineering/validation'

import bundledObjectives from './investorProfileObjectives.json' with { type: 'json' }
import bundledStrategies from './investorProfileStrategies.json' with { type: 'json' }

const bundledCatalogs: InvestorProfileCatalogs = {
  objectives: bundledObjectives as InvestorProfileOptionItem[],
  strategies: bundledStrategies as InvestorProfileOptionItem[],
}

let cachedCatalogs: InvestorProfileCatalogs | null = null

export async function getInvestorProfileCatalogs(): Promise<InvestorProfileCatalogs> {
  if (cachedCatalogs) {
    return cachedCatalogs
  }

  // Attempt validation of bundled fallback
  const parseResult = investorProfileCatalogsSchema.safeParse(bundledCatalogs)
  if (parseResult.success) {
    cachedCatalogs = parseResult.data
    return cachedCatalogs
  }

  return bundledCatalogs
}

export function clearInvestorProfileCatalogsCache(): void {
  cachedCatalogs = null
}
