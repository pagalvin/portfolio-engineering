# Module: App Service

Provisions **Azure App Service** to host the Fastify backend API.

## Resources to provision
- Azure App Service Plan
- Azure App Service (Linux container)
- App settings / environment variables (sourced from Key Vault)
- Custom domain + managed TLS certificate (prod only)
- Deployment slots (staging only) for zero-downtime deploys

## Inputs (planned)
| Variable | Description |
|---|---|
| `resource_group_name` | Azure Resource Group |
| `location` | Azure region |
| `environment` | dev / staging / prod |
| `container_image` | Full image path from Container Registry |
| `key_vault_id` | Key Vault resource ID for secret references |
| `sku` | App Service plan SKU |

## Notes
- Container image pulled from Azure Container Registry
- DATABASE_URL, JWT_SECRET, OAuth credentials all injected via Key Vault references
- Health check endpoint: `/health`
