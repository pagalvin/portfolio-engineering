# Module: Database

Provisions **Azure PostgreSQL Flexible Server** for the SaaS deployment.

## Resources to provision
- Azure PostgreSQL Flexible Server
- PostgreSQL database instance
- Firewall rules (allow App Service, deny public access)
- Diagnostic settings (logs to Azure Monitor)

## Inputs (planned)
| Variable | Description |
|---|---|
| `resource_group_name` | Azure Resource Group to deploy into |
| `location` | Azure region |
| `environment` | dev / staging / prod |
| `db_name` | Database name |
| `db_admin_username` | Admin username (stored in Key Vault) |
| `db_admin_password` | Admin password (stored in Key Vault) |
| `sku_name` | Server SKU (e.g. `B_Standard_B1ms` for dev) |

## Notes
- Dev environment should use smallest SKU to minimize cost
- Production should have high availability enabled
- Connection string injected into App Service via Key Vault reference
