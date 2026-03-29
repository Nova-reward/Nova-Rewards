# Nova Rewards EC2 Infrastructure - Complete Terraform Configuration

## Overview

This directory contains a complete, production-ready Terraform configuration for provisioning secure, scalable EC2 instances to host the Nova Rewards backend APIs on AWS.

## Quick Start

### 1. Prerequisites
- AWS account with appropriate permissions
- Terraform v1.0 or later installed
- AWS CLI configured with credentials
- VPC with public and private subnets
- RDS PostgreSQL instance
- Redis cluster/instance
- S3 bucket
- ACM SSL certificate

### 2. Configuration
```bash
# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

### 3. Deploy
```bash
# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Plan deployment
terraform plan -out=tfplan

# Apply configuration
terraform apply tfplan
```

### 4. Verify
```bash
# Get outputs
terraform output

# Check ALB DNS name
terraform output alb_dns_name

# Verify instances are healthy
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn)
```

## Architecture

```
Internet (0.0.0.0/0)
    ↓ HTTPS (443)
    ↓
┌─────────────────┐
│  ALB (Public)   │
│  Security Group │
└────────┬────────┘
         ↓ HTTP (4000)
    ┌────┴────┐
    ↓         ↓
┌────────┐ ┌────────┐
│ EC2 #1 │ │ EC2 #2 │ ... (2-6 instances)
│Private │ │Private │
└────┬───┘ └────┬───┘
     ↓         ↓
  ┌──┴─────────┴──┐
  ↓               ↓
┌────────┐    ┌────────┐
│  RDS   │    │ Redis  │
│ (5432) │    │ (6379) │
└────────┘    └────────┘
```

## Key Features

### High Availability
- Multi-AZ deployment across public and private subnets
- Auto Scaling Group with 2-6 instances
- Application Load Balancer with health checks
- Connection draining for graceful shutdowns
- Rolling instance refresh for zero-downtime updates

### Security
- Least-privilege IAM policies
- Restricted security groups (ALB → EC2 → RDS/Redis)
- Encrypted EBS volumes
- IMDSv2 enforcement
- HTTPS support with ACM certificate
- Secrets Manager integration
- CloudWatch Logs for audit trail

### Monitoring & Alerting
- CPU utilization alarms (scale-up at 70%, scale-down at 35%)
- Memory utilization alarm (> 80%)
- 5xx error rate alarm (> 1%)
- Unhealthy hosts detection
- Response time monitoring (> 1s)
- CloudWatch dashboard for visualization
- Centralized logging to CloudWatch

### Cost Optimization
- t3.medium burstable instances (cost-effective)
- Auto-scaling to match demand
- gp3 volumes (better price/performance)
- Configurable log retention
- Estimated monthly cost: $90-120 (baseline)

## File Structure

### Terraform Configuration
- **variables.tf** - Input variables with validation
- **iam.tf** - IAM roles and policies
- **security_groups.tf** - Security group definitions
- **launch_template.tf** - EC2 launch template
- **asg.tf** - Auto Scaling Group configuration
- **alb.tf** - Application Load Balancer
- **cloudwatch.tf** - CloudWatch monitoring
- **outputs.tf** - Output values
- **user_data.sh** - EC2 initialization script

### Configuration & Examples
- **terraform.tfvars.example** - Example variables file

### Documentation
- **DEPLOYMENT_CHECKLIST.md** - Step-by-step deployment guide
- **INFRASTRUCTURE_OVERVIEW.md** - Architecture and design details
- **QUICK_REFERENCE.md** - Common commands and tasks
- **TROUBLESHOOTING_GUIDE.md** - Issue resolution guide
- **IMPLEMENTATION_SUMMARY.md** - Implementation details
- **VALIDATION_CHECKLIST.md** - Pre-deployment validation
- **DELIVERABLES.md** - Project deliverables summary
- **README_INFRASTRUCTURE.md** - This file

## Configuration Variables

### Required Variables
```hcl
vpc_id                  # VPC ID for resources
private_subnet_ids      # Private subnets for EC2
public_subnet_ids       # Public subnets for ALB
rds_endpoint            # RDS database endpoint
redis_endpoint          # Redis cache endpoint
s3_bucket_name          # S3 bucket for application
certificate_arn         # ACM certificate for HTTPS
environment             # dev, staging, or prod
```

### Optional Variables (with defaults)
```hcl
aws_region              # Default: us-east-1
app_name                # Default: nova-rewards
instance_type           # Default: t3.medium
min_size                # Default: 2
max_size                # Default: 6
desired_capacity        # Default: 2
health_check_path       # Default: /health
app_port                # Default: 4000
rds_port                # Default: 5432
redis_port              # Default: 6379
secrets_manager_path    # Default: nova-rewards/*
cpu_threshold           # Default: 70
memory_threshold        # Default: 80
error_rate_threshold    # Default: 1
enable_detailed_monitoring  # Default: true
tags                    # Default: {}
```

## Deployment Specifications

### EC2 Instances
- **Type**: t3.medium (2 vCPU, 4GB RAM)
- **Count**: 2-6 (auto-scaling)
- **Storage**: 30GB gp3 encrypted
- **AMI**: Latest Amazon Linux 2
- **Monitoring**: Detailed CloudWatch metrics

### Application Load Balancer
- **Type**: Application Load Balancer (Layer 7)
- **Scheme**: Internet-facing
- **Health Check**: GET /health expecting 200
- **Stickiness**: Enabled (86400s cookie)
- **Deregistration Delay**: 30 seconds

### Network Configuration
- **Inbound (ALB)**: 80 (HTTP), 443 (HTTPS) from anywhere
- **Inbound (EC2)**: 4000 (app) from ALB only
- **Outbound (EC2)**: RDS (5432), Redis (6379), DNS (53), HTTP (80), HTTPS (443)

### Scaling Configuration
- **Min Instances**: 2
- **Max Instances**: 6
- **Scale-Up Trigger**: CPU > 70% for 10 minutes
- **Scale-Down Trigger**: CPU < 35% for 10 minutes
- **Cooldown**: 5 minutes between scaling actions

### Monitoring & Alarms
- **CPU High**: > 70% (triggers scale-up)
- **CPU Low**: < 35% (triggers scale-down)
- **Memory High**: > 80% (informational)
- **5xx Error Rate**: > 1% (informational)
- **Unhealthy Hosts**: Any unhealthy (informational)
- **Response Time**: > 1 second (informational)

## Deployment Steps

### Step 1: Prepare Configuration
```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

### Step 2: Initialize Terraform
```bash
terraform init
```

### Step 3: Validate Configuration
```bash
terraform validate
terraform fmt -check
```

### Step 4: Plan Deployment
```bash
terraform plan -out=tfplan
```

### Step 5: Review Plan
Carefully review the plan output to ensure all resources are correct.

### Step 6: Apply Configuration
```bash
terraform apply tfplan
```

### Step 7: Verify Deployment
```bash
# Get outputs
terraform output

# Check ALB DNS name
terraform output alb_dns_name

# Verify instances are healthy
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn)
```

## Post-Deployment

### 1. Deploy Backend Application
- SSH into EC2 instances or use Systems Manager Session Manager
- Deploy Nova Rewards backend application
- Configure environment variables from Secrets Manager
- Start application services

### 2. Configure DNS
- Create Route53 record pointing to ALB DNS name
- Update application configuration with domain name
- Test HTTPS connectivity

### 3. Set Up Monitoring
- Create SNS topics for alarm notifications
- Subscribe to alarms for critical metrics
- Configure log aggregation and analysis
- Set up dashboards for operations team

### 4. Implement CI/CD
- Create deployment pipeline
- Automate application updates
- Implement blue-green deployments
- Set up automated testing

## Outputs

After deployment, the following outputs are available:

```bash
terraform output alb_dns_name              # ALB DNS for application access
terraform output asg_name                  # Auto Scaling Group name
terraform output target_group_arn          # Target Group ARN
terraform output ec2_security_group_id     # EC2 security group ID
terraform output iam_instance_profile_arn  # IAM instance profile ARN
terraform output cloudwatch_log_group_name # CloudWatch log group name
terraform output deployment_info           # Complete deployment info object
```

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
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=nova-rewards-asg-instance" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text)

aws ssm start-session --target $INSTANCE_ID
```

### Test Health Endpoint
```bash
ALB_DNS=$(terraform output -raw alb_dns_name)
curl -k https://$ALB_DNS/health
```

## Troubleshooting

### Instances Not Passing Health Checks
1. Check security group allows ALB traffic on port 4000
2. Verify application is listening on port 4000
3. Test health endpoint: `curl http://instance-ip:4000/health`
4. Check application logs in CloudWatch

### Cannot Connect to RDS/Redis
1. Verify EC2 security group outbound rules
2. Check RDS/Redis security groups allow inbound
3. Test connectivity: `telnet endpoint port`
4. Verify network ACLs allow traffic

### CloudWatch Alarms Not Triggering
1. Verify CloudWatch agent is running
2. Check IAM role has CloudWatch permissions
3. Verify metrics are being published
4. Check alarm configuration

For more troubleshooting help, see TROUBLESHOOTING_GUIDE.md

## Cost Estimation

### Monthly Costs (us-east-1, baseline 2 instances)
- **EC2**: 2x t3.medium = ~$60
- **ALB**: ~$16
- **Data Transfer**: ~$10-50
- **CloudWatch**: ~$5
- **Total**: ~$90-120/month

### Cost Optimization Tips
1. Use Reserved Instances for baseline capacity
2. Implement Savings Plans for predictable workloads
3. Use Spot Instances for non-critical workloads
4. Monitor and optimize CloudWatch log retention
5. Use S3 lifecycle policies for old logs

## Security Best Practices

1. **Network Isolation**: EC2 instances in private subnets
2. **Least Privilege**: IAM policies restricted to required resources
3. **Encryption**: EBS volumes encrypted, HTTPS for ALB
4. **Monitoring**: CloudWatch alarms for security events
5. **Patching**: Regular OS and application updates
6. **Secrets Management**: Use Secrets Manager for sensitive data
7. **Audit Logging**: CloudTrail for API calls, CloudWatch Logs for application logs

## Documentation

### Getting Started
- Start with DEPLOYMENT_CHECKLIST.md for step-by-step instructions
- Review INFRASTRUCTURE_OVERVIEW.md for architecture details
- Use QUICK_REFERENCE.md for common commands

### Troubleshooting
- Check TROUBLESHOOTING_GUIDE.md for issue resolution
- Review VALIDATION_CHECKLIST.md for pre-deployment validation
- Consult IMPLEMENTATION_SUMMARY.md for implementation details

### Reference
- DELIVERABLES.md - Project deliverables summary
- README_INFRASTRUCTURE.md - This file

## Support

For issues or questions:
1. Check the relevant documentation file
2. Review TROUBLESHOOTING_GUIDE.md for common issues
3. Consult AWS documentation
4. Review Terraform logs with `TF_LOG=DEBUG`

## Resources

- [Terraform Documentation](https://www.terraform.io/docs)
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [AWS ALB Documentation](https://docs.aws.amazon.com/elasticloadbalancing/)
- [AWS Auto Scaling](https://docs.aws.amazon.com/autoscaling/)
- [AWS CloudWatch](https://docs.aws.amazon.com/cloudwatch/)

## License

This Terraform configuration is part of the Nova Rewards project.

## Version

- **Version**: 1.0
- **Last Updated**: March 28, 2026
- **Status**: Production Ready

---

**Ready to deploy? Start with DEPLOYMENT_CHECKLIST.md**
