# Quick Start Guide

Get the Nova Rewards backend infrastructure up and running in 15 minutes.

## Prerequisites

- AWS account with EC2, ALB, IAM, and CloudWatch permissions
- Terraform 1.0+
- AWS CLI configured
- Existing VPC with public and private subnets
- RDS PostgreSQL instance
- Redis ElastiCache cluster
- S3 bucket
- ACM SSL certificate

## 5-Minute Setup

### 1. Clone and Navigate

```bash
cd terraform
terraform init
```

### 2. Configure Variables

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your AWS values
```

### 3. Deploy

```bash
terraform plan -out=tfplan
terraform apply tfplan
```

### 4. Get Outputs

```bash
terraform output deployment_info
```

## Key Outputs

After deployment, you'll get:

- **ALB DNS Name**: Use this to access your application
- **ASG Name**: For managing auto-scaling
- **Target Group ARN**: For health checks
- **CloudWatch Dashboard**: For monitoring

## Test Deployment

```bash
ALB_DNS=$(terraform output -raw alb_dns_name)
curl https://$ALB_DNS/health
```

Expected response:
```json
{"success":true,"data":{"status":"ok"}}
```

## Common Commands

```bash
# View current state
terraform show

# Update configuration
terraform plan
terraform apply

# Destroy infrastructure
terraform destroy

# View specific output
terraform output alb_dns_name

# Check resource status
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names $(terraform output -raw asg_name)
```

## Monitoring

```bash
# View logs
aws logs tail $(terraform output -raw cloudwatch_log_group_name) --follow

# Check instance health
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn)

# View CloudWatch dashboard
terraform output cloudwatch_dashboard_url
```

## Troubleshooting

### Instances not healthy?
1. Check security groups allow traffic from ALB
2. Verify application is running on port 4000
3. Check `/health` endpoint returns 200

### ALB not responding?
1. Verify certificate ARN is correct
2. Check security group allows 443/80
3. Ensure target group has healthy instances

### Need help?
See `README.md` for detailed documentation or `DEPLOYMENT_GUIDE.md` for step-by-step instructions.

## Next Steps

1. Deploy application to EC2 instances
2. Configure DNS to point to ALB
3. Set up CI/CD pipeline
4. Monitor and optimize costs
