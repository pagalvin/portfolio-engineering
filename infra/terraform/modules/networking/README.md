# Module: Networking

Provisions **Azure Virtual Network** and subnet configuration for network isolation.

## Resources to provision
- Azure Virtual Network
- Subnets (App Service, Database, private endpoints)
- Network Security Groups
- Private endpoint for PostgreSQL (no public DB access in prod)

## Notes
- Dev environment may skip VNet for simplicity and cost
- Staging and prod should use full VNet isolation
- Database should never be publicly accessible in production
