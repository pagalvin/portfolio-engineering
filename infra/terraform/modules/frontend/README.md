# Module: Frontend

Provisions hosting for the **React 19 + Vite** frontend application.

## Resources to provision
- Azure Static Web Apps (preferred — built-in CDN, free SSL, global edge)
- Custom domain + managed TLS certificate
- API proxy rules (routes `/api/*` to App Service backend)

## Inputs (planned)
| Variable | Description |
|---|---|
| `resource_group_name` | Azure Resource Group |
| `location` | Azure region |
| `environment` | dev / staging / prod |
| `api_url` | Backend API URL to proxy to |

## Notes
- Azure Static Web Apps has a free tier suitable for dev/staging
- Built-in CDN means no separate Azure CDN resource needed
- Environment variables injected at build time via GitHub Actions
