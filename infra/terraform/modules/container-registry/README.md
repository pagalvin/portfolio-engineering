# Module: Container Registry

Provisions **Azure Container Registry (ACR)** to store Docker images.

## Resources to provision
- Azure Container Registry
- Admin credentials (stored in Key Vault)
- Retention policy for old images

## Inputs (planned)
| Variable | Description |
|---|---|
| `resource_group_name` | Azure Resource Group |
| `location` | Azure region |
| `environment` | dev / staging / prod |
| `sku` | ACR SKU — Basic (dev), Standard (prod) |

## Notes
- CI/CD pipeline pushes images here on every merge to main
- App Service pulls images from here at deploy time
- One registry shared across dev/staging/prod environments (different image tags)
