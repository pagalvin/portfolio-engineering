# Module: Key Vault

Provisions **Azure Key Vault** for secrets management.

## Resources to provision
- Azure Key Vault
- Access policies (App Service managed identity → read secrets)
- Secret placeholders (values populated post-provision or via CI/CD)

## Secrets to manage
| Secret | Description |
|---|---|
| `DATABASE-URL` | PostgreSQL connection string |
| `JWT-SECRET` | JWT signing secret |
| `GOOGLE-CLIENT-ID` | Google OAuth2 client ID |
| `GOOGLE-CLIENT-SECRET` | Google OAuth2 client secret |
| `MICROSOFT-CLIENT-ID` | Microsoft OAuth2 client ID |
| `MICROSOFT-CLIENT-SECRET` | Microsoft OAuth2 client secret |
| `FACEBOOK-CLIENT-ID` | Facebook OAuth2 client ID |
| `FACEBOOK-CLIENT-SECRET` | Facebook OAuth2 client secret |
| `ACR-ADMIN-PASSWORD` | Container Registry admin password |

## Notes
- App Service uses managed identity — no passwords in app config
- Secrets are never stored in git or environment files
- Each environment has its own Key Vault instance
