# Environment: Staging

Pre-production environment. Mirrors production configuration as closely as possible.

## Characteristics
- Same SKUs as production (or one tier below)
- VNet isolation enabled
- Deployment slots for zero-downtime deploy testing
- Seeded with anonymized test data

## Purpose
- Final validation before production releases
- Load/performance testing
- OAuth provider testing (separate app registrations from prod)
