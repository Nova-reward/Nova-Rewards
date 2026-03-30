# EC2 Infrastructure Deployment Checklist

## Pre-Deployment Requirements

### AWS Account Setup
- [ ] AWS account with appropriate permissions
- [ ] AWS CLI configured with credentials
- [ ] Terraform installed (v1.0+)

### Network Infrastructure
- [ ] VPC created
- [ ] At least 2 private subnets (for EC2 instances)
- [ ] At least 2 public subnets (for ALB)
- [ ] Internet Gateway attached to VPC
- [ ] NAT Gateway in public subnet (for EC2 outbound access)
- [ ] Route tables configured correctly

### Database & Cache
- [ ] RDS PostgreSQL instance created and running
- [ ] RDS endpoint and port noted
- [ ] Redis cluster/instance created and running
- [ ] Redis endpoint and port noted
- [ ] Security groups allow EC2 access to RDS (port 5432) and Redis (port 6379)

### S3 & Secrets
- [ ] S3 bucket created for application data
- [ ] S3 bucket name noted
- [ ] Secrets Manager secrets created under `nova-rewards/*` path
- [ ] Application secrets (DB credentials, API keys, etc.) stored in Secrets Manager

### SSL Certificate
- [ ] SSL certificate created in AWS Certificate Manager (ACM)
- [ ] Certificate ARN noted
- [ ] Certificate covers your domain name

## Deployment Steps

### 1. Prepare Terraform Variables
```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your actual values:
- VPC ID
- Subnet IDs (private and public)
- RDS endpoint and port
- Redis endpoint and port
- S3 bucket name
- ACM certificate ARN
- Environment (dev/staging/prod)

### 2. Initialize Terraform
```bash
terraform init
```

### 3. Validate Configuration
```bash
terraform validate
terraform fmt -check
```

### 4. Plan Deployment
```bash
terraform plan -out=tfplan
```

Review the plan carefully. Expected resources:
- 1 Application Load Balancer
- 1 Target Group
- 1 Auto Scaling Group
- 1 Launch Template
- 2 Security Groups (ALB + EC2)
- 1 IAM Role + Instance Profile
- 5 IAM Policies (S3, Secrets Manager, CloudWatch Logs, CloudWatch Metrics)
- 1 CloudWatch Log Group
- 5 CloudWatch Alarms
- 1 CloudWatch Dashboard

### 5. Apply Configuration
```bash
terraform apply tfplan
```

### 6. Verify Deployment
```bash
# Get outputs
terraform output

# Check ALB DNS name
terraform output alb_dns_name

# Check ASG status
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names $(terraform output -raw asg_name) \
  --region us-east-1
```

## Post-Deployment Verification

### 1. ALB Health Check
```bash
# Wait 2-3 minutes for instances to launch and pass health checks
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn) \
  --region us-east-1
```

Expected: All targets should show `State: healthy`

### 2. EC2 Instances
```bash
# List running instances
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=nova-rewards-asg-instance" \
  --region us-east-1
```

### 3. CloudWatch Logs
```bash
# Check application logs
aws logs tail /nova-rewards/prod/app --follow --region us-east-1
```

### 4. CloudWatch Dashboard
- Navigate to CloudWatch console
- View dashboard: `nova-rewards-prod`
- Verify metrics are being collected

### 5. Test ALB
```bash
# Get ALB DNS name
ALB_DNS=$(terraform output -raw alb_dns_name)

# Test health endpoint
curl -k https://$ALB_DNS/health

# Expected response: 200 OK
```

## Security Verification

### 1. Security Groups
```bash
# Verify EC2 security group
aws ec2 describe-security-groups \
  --group-ids $(terraform output -raw ec2_security_group_id) \
  --region us-east-1
```

Expected inbound rules:
- Port 4000 from ALB security group only

Expected outbound rules:
- Port 5432 (RDS)
- Port 6379 (Redis)
- Port 53 (DNS)
- Port 80 (HTTP)
- Port 443 (HTTPS)

### 2. IAM Permissions
```bash
# Verify IAM role policies
aws iam list-role-policies \
  --role-name $(terraform output -raw iam_role_arn | cut -d'/' -f2) \
  --region us-east-1
```

Expected policies:
- S3 access (specific bucket only)
- Secrets Manager access (nova-rewards/* path only)
- CloudWatch Logs
- CloudWatch Metrics

## Troubleshooting

### Instances Not Passing Health Checks
1. SSH into an instance and check application logs
2. Verify security group allows traffic from ALB
3. Verify application is listening on port 4000
4. Check `/health` endpoint returns 200

### CloudWatch Alarms Not Triggering
1. Verify CloudWatch agent is running on instances
2. Check `/opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log`
3. Verify IAM role has CloudWatch Metrics permissions

### Cannot Connect to RDS/Redis
1. Verify security groups allow outbound traffic
2. Verify RDS/Redis security groups allow inbound from EC2 SG
3. Test connectivity: `telnet <endpoint> <port>`

## Scaling Configuration

### Auto Scaling Policies
- **Scale Up**: When CPU > 70% for 10 minutes
- **Scale Down**: When CPU < 35% for 10 minutes
- **Min Instances**: 2
- **Max Instances**: 6
- **Cooldown Period**: 5 minutes

### Manual Scaling
```bash
# Set desired capacity
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name $(terraform output -raw asg_name) \
  --desired-capacity 4 \
  --region us-east-1
```

## Monitoring & Alerts

### CloudWatch Alarms
1. **CPU High** (> 70%): Triggers scale-up
2. **CPU Low** (< 35%): Triggers scale-down
3. **Memory High** (> 80%): Informational
4. **5xx Error Rate High** (> 1%): Informational
5. **Unhealthy Hosts**: Informational
6. **Response Time High** (> 1s): Informational

### Recommended SNS Topics
Create SNS topics for alarm notifications:
```bash
aws sns create-topic --name nova-rewards-alerts
```

Update alarm actions to send to SNS topic.

## Cleanup

To destroy all resources:
```bash
terraform destroy
```

Confirm when prompted. This will remove:
- ALB and target groups
- Auto Scaling Group and launch template
- EC2 instances
- Security groups
- IAM roles and policies
- CloudWatch log group and alarms

**Note**: RDS, Redis, and S3 are not managed by this Terraform configuration and must be cleaned up separately if needed.

## Cost Optimization

### Current Configuration
- **Instance Type**: t3.medium (burstable, cost-effective)
- **Min Instances**: 2 (high availability)
- **Max Instances**: 6 (controlled scaling)
- **Storage**: 30GB gp3 per instance (encrypted)

### Cost Reduction Options
1. Use t3.small for dev/staging environments
2. Reduce max_size if traffic is predictable
3. Use Reserved Instances for baseline capacity
4. Enable S3 lifecycle policies for log retention

### Estimated Monthly Cost (us-east-1)
- 2x t3.medium: ~$60
- ALB: ~$16
- Data transfer: ~$10-50 (varies)
- CloudWatch: ~$5
- **Total**: ~$90-120/month (baseline)

## Next Steps

1. Deploy backend application to instances
2. Configure DNS records to point to ALB
3. Set up CI/CD pipeline for deployments
4. Configure backup and disaster recovery
5. Implement additional monitoring and logging
6. Set up automated patching for EC2 instances
