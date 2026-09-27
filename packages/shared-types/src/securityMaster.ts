export type SecurityType = 'STOCK' | 'ETF' | 'INDEX' | 'OTHER'

export interface SecurityWriteRequest {
  symbol: string
  type?: SecurityType
  name?: string | null
  description?: string | null
  exchange?: string | null
  sector?: string | null
  industry?: string | null
}

export interface SecurityListQuery {
  q?: string
  status?: 'all' | 'active' | 'inactive'
  type?: SecurityType
  exchange?: string
}

export interface SecurityRecord {
  id: string
  organizationId: string
  symbol: string
  type: SecurityType
  name: string | null
  description: string | null
  exchange: string | null
  sector: string | null
  industry: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SecurityCollectionResponse {
  securities: SecurityRecord[]
  /** All securities in the organization, regardless of list filters. */
  totalCount: number
}

export interface SecurityMutationResponse {
  security: SecurityRecord
}

export interface SecurityDeleteResponse {
  success: true
  deletedSecurityId: string
}

export type SecurityErrorCode =
  | 'VALIDATION_ERROR'
  | 'SECURITY_NOT_FOUND'
  | 'SECURITY_DUPLICATE_IDENTITY'
  | 'SECURITY_BLOCKED_BY_REFERENCES'
