# Environment: Production

Live SaaS environment serving real users.

## Characteristics
- Production-grade PostgreSQL SKU with high availability
- Standard App Service Plan with autoscaling
- Full VNet isolation — database not publicly accessible
- Azure Monitor + alerting enabled
- Automated backups for PostgreSQL
- Custom domain + managed TLS

## Notes
- Never apply Terraform changes to prod without staging validation first
- Use `terraform plan` output reviewed by at least one other person before `apply`
- State stored in Azure Storage (remote backend — to be configured)
