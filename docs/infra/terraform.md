# Terraform Operations

## Prerequisites

- Terraform >= 1.6
- AWS credentials with sufficient IAM permissions
- `terraform.tfvars` created from `terraform.tfvars.example` (gitignored)
- Secrets stored in AWS Secrets Manager at the path set by `app_secret_name`

## Apply

```bash
cd infra

# 1. Initialise (downloads providers, connects to S3 backend)
terraform init

# 2. Review the plan
terraform plan -out=tfplan

# 3. Apply
terraform apply tfplan
```

## Rollback

Terraform state is versioned in S3 (versioning must be enabled on the bucket).

```bash
# List previous state versions
aws s3api list-object-versions \
  --bucket nova-rewards-tf-state \
  --prefix nova-rewards/terraform.tfstate

# Restore a previous version (replace VERSION_ID)
aws s3api copy-object \
  --bucket nova-rewards-tf-state \
  --copy-source "nova-rewards-tf-state/nova-rewards/terraform.tfstate?versionId=VERSION_ID" \
  --key nova-rewards/terraform.tfstate

# Then re-apply to reconcile real infra with the restored state
terraform apply
```

For a targeted resource rollback:

```bash
# Destroy only the changed resource, then re-apply the previous config
terraform destroy -target=module.ec2.aws_launch_template.this
git checkout <previous-commit> -- infra/
terraform apply
```
