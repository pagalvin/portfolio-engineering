# Terraform Infrastructure

Provisions all Azure resources for the SaaS deployment of this application.

## Structure

```
terraform/
├── modules/               # Reusable infrastructure modules
│   ├── database/          # Azure PostgreSQL Flexible Server
│   ├── app-service/       # Azure App Service (backend API)
│   ├── frontend/          # Azure Static Web Apps (frontend)
│   ├── container-registry/ # Azure Container Registry
│   ├── key-vault/         # Azure Key Vault (secrets)
│   └── networking/        # Azure Virtual Network + subnets
├── environments/          # Per-environment variable configs
│   ├── dev/
│   ├── staging/
│   └── prod/
└── main.tf                # Root module (to be created)
```

## Environments

| Environment | Purpose |
|---|---|
| `dev` | Developer sandbox, minimal resources, low cost |
| `staging` | Pre-production, mirrors prod configuration |
| `prod` | Live SaaS environment |

## Usage (when implemented)

```bash
cd environments/dev
terraform init
terraform plan
terraform apply
```

## Prerequisites (when implemented)
- Azure CLI installed and authenticated
- Terraform >= 1.6
- Azure subscription with appropriate permissions
