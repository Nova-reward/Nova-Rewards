# Terraform Quick Reference Guide

## Essential Commands

### Initialize Terraform
```bash
cd terraform
terraform init
```

### Validate Configuration
```bash
terraform validate
terraform fmt -check
```

### Plan Deployment
```bash
terraform plan -out=tfplan
```

### Apply Configuration
```bash
terraform apply tfplan
```

### View Outputs
```bash
terraform output
terraform output alb_dns_name
terraform output deployment_info
```

### Destroy Infrastructure
```bash
terraform destroy
```

## Configuration Quick Start

### 1. Copy Example Variables
```bash
cp terraform.tfvars.example terraform.tfvars
```

### 2. Edit terraform.tfvars
```hcl
aws_region = "us-east-1"
environment = "prod"
vpc_id = "vpc-xxxxxxxxx"
private_subnet_ids = ["subnet-xxxxxxxxx", "subnet-yyyyyyyyy"]
public_subnet_ids = ["subnet-zzzzzzzzz", "subnet-wwwwwwwww"]
rds_endpoint = "nova-rewards-db.xxxxxxxxx.rds.amazonaws.com"
redis_endpoint = "nova-rewards-cache.xxxxxxxxx.cache.amazonaws.com"
s3_bucket_name = "nova-rewards-app-bucket"
certificate_arn = "arn:aws:acm:us-east-1:xxxxxxxxx:certificate/xxxxxxxx"
```

### 3. Deploy
```bash
terraform init
terraform plan
terraform apply
```

## Key Variables

| Variable | Default | Description |
|----------|---------|-------------|
| aws_region | us-east-1 | AWS region |
| environment | - | dev, staging, or prod |
| instance_type | t3.medium | EC2 instance type |
| min_size | 2 | Min instances in ASG |
| max_size | 6 | Max instances in ASG |
| desired_capacity | 2 | Desired instances |
| app_port | 4000 | Application port |
| health_check_path | /health | Health check endpoint |
| cpu_threshold | 70 | CPU alarm threshold (%) |
| memory_threshold | 80 | Memory alarm threshold (%) |
| error_rate_threshold | 1 | 5xx error rate threshold (%) |

## Common Tasks

### Scale Up Manually
```bash
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name $(terraform output -raw asg_name) \
  --desired-capacity 4
```

### Check Instance Health
```bash
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn)
```

### View Application Logs
```bash
aws logs tail /nova-rewards/prod/app --follow
```

### SSH to Instance
```bash
# Get instance ID
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=nova-rewards-asg-instance" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text)

# Connect via Systems Manager
aws ssm start-session --target $INSTANCE_ID
```

### Test Health Endpoint
```bash
ALB_DNS=$(terraform output -raw alb_dns_name)
curl -k https://$ALB_DNS/health
```

### View CloudWatch Dashboard
```bash
# Get dashboard URL
terraform output cloudwatch_dashboard_url
```

## Troubleshooting

### Validate Configuration
```bash
terraform validate
terraform fmt -check
```

### Check Plan Before Apply
```bash
terraform plan -out=tfplan
# Review tfplan carefully
terraform apply tfplan
```

### View Current State
```bash
terraform state list
terraform state show aws_lb.main
```

### Refresh State
```bash
terraform refresh
```

### Debug Mode
```bash
TF_LOG=DEBUG terraform plan
```

## Security Checklist

- [ ] VPC ID is correct
- [ ] Subnet IDs are correct (private for EC2, public for ALB)
- [ ] RDS endpoint is accessible
- [ ] Redis endpoint is accessible
- [ ] S3 bucket exists and is accessible
- [ ] ACM certificate ARN is correct
- [ ] Secrets Manager secrets exist under nova-rewards/*
- [ ] Security groups allow required traffic
- [ ] IAM role has required permissions

## Monitoring

### CloudWatch Alarms
- CPU > 70% → Scale up
- CPU < 35% → Scale down
- Memory > 80% → Alert
- 5xx errors > 1% → Alert
- Unhealthy hosts → Alert
- Response time > 1s → Alert

### View Alarms
```bash
aws cloudwatch describe-alarms \
  --alarm-name-prefix nova-rewards
```

### View Metrics
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Average
```

## Cost Optimization

### Estimate Monthly Cost
- 2x t3.medium: ~$60
- ALB: ~$16
- Data transfer: ~$10-50
- CloudWatch: ~$5
- **Total**: ~$90-120/month

### Reduce Costs
1. Use t3.small for dev/staging
2. Reduce max_size if traffic is predictable
3. Use Reserved Instances for baseline
4. Enable S3 lifecycle policies

## File Structure

```
terraform/
├── variables.tf              # Input variables
├── iam.tf                    # IAM roles and policies
├── security_groups.tf        # Security groups
├── launch_template.tf        # EC2 launch template
├── asg.tf                    # Auto Scaling Group
├── alb.tf                    # Application Load Balancer
├── cloudwatch.tf             # CloudWatch monitoring
├── outputs.tf                # Output values
├── user_data.sh              # EC2 initialization
├── terraform.tfvars.example  # Example variables
├── terraform.tfvars          # Your variables (git-ignored)
├── .terraform/               # Terraform state (git-ignored)
├── terraform.tfstate         # State file (git-ignored)
├── QUICK_REFERENCE.md        # This file
├── DEPLOYMENT_CHECKLIST.md   # Deployment guide
├── INFRASTRUCTURE_OVERVIEW.md # Architecture docs
└── IMPLEMENTATION_SUMMARY.md  # Implementation details
```

## Important Notes

1. **State File**: Keep terraform.tfstate secure (consider S3 backend)
2. **Credentials**: Use AWS CLI profiles or environment variables
3. **Sensitive Data**: Never commit terraform.tfvars to git
4. **Backups**: Backup terraform.tfstate regularly
5. **Versioning**: Pin Terraform version in CI/CD
6. **Testing**: Always run `terraform plan` before `apply`

## Useful Links

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [AWS ALB Documentation](https://docs.aws.amazon.com/elasticloadbalancing/)
- [AWS Auto Scaling](https://docs.aws.amazon.com/autoscaling/)
- [AWS CloudWatch](https://docs.aws.amazon.com/cloudwatch/)

## Support

For issues or questions:
1. Check DEPLOYMENT_CHECKLIST.md for troubleshooting
2. Review INFRASTRUCTURE_OVERVIEW.md for architecture details
3. Check Terraform logs: `TF_LOG=DEBUG terraform plan`
4. Review AWS CloudWatch logs for application errors
