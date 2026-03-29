# Nova Rewards Backend Infrastructure

This Terraform configuration provisions a secure, scalable infrastructure for the Nova Rewards backend APIs on AWS.

## Architecture Overview

The infrastructure includes:

- **Application Load Balancer (ALB)**: Distributes traffic across EC2 instances with health checks
- **Auto Scaling Group (ASG)**: Manages EC2 instances (t3.medium) with min=2, max=6 capacity
- **EC2 Instances**: Run the Nova Rewards backend application via Docker
- **Security Groups**: Enforce least-privilege network access
- **IAM Roles & Policies**: Grant minimal required permissions to EC2 instances
- **CloudWatch Monitoring**: Alarms for CPU, memory, and error rates
- **CloudWatch Logs**: Centralized logging for application and system events

## Prerequisites

1. **AWS Account**: With appropriate permissions to create EC2, ALB, IAM, and CloudWatch resources
2. **Terraform**: Version 1.0 or later
3. **AWS CLI**: Configured with credentials
4. **SSL Certificate**: An ACM certificate for HTTPS (required for ALB listener)
5. **VPC & Subnets**: Existing VPC with public and private subnets
6. **RDS Database**: PostgreSQL instance for application data
7. **Redis Cache**: ElastiCache Redis cluster for caching
8. **S3 Bucket**: For application data storage
9. **Secrets Manager**: Secrets configured for application environment variables

## Setup Instructions

### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

### 2. Create terraform.tfvars

Copy the example and fill in your AWS-specific values:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your environment-specific values:

```hcl
aws_region = "us-east-1"
environment = "prod"
vpc_id = "vpc-xxxxx"
private_subnet_ids = ["subnet-xxxxx", "subnet-yyyyy"]
public_subnet_ids = ["subnet-zzzzz", "subnet-wwwww"]
rds_endpoint = "your-rds-endpoint.rds.amazonaws.com"
redis_endpoint = "your-redis-endpoint.cache.amazonaws.com"
s3_bucket_name = "your-s3-bucket"
certificate_arn = "arn:aws:acm:region:account:certificate/id"
```

### 3. Plan the Deployment

```bash
terraform plan -out=tfplan
```

Review the planned changes carefully.

### 4. Apply the Configuration

```bash
terraform apply tfplan
```

### 5. Retrieve Outputs

After successful deployment, retrieve the ALB DNS name and other outputs:

```bash
terraform output deployment_info
```

## Configuration Details

### Security Groups

**ALB Security Group:**
- Inbound: 443 (HTTPS) and 80 (HTTP) from anywhere
- Outbound: All traffic

**EC2 Security Group:**
- Inbound: Application port (4000) from ALB only
- Outbound: 
  - RDS port (5432) to anywhere
  - Redis port (6379) to anywhere
  - DNS (53 UDP) for service discovery
  - HTTP/HTTPS (80, 443) for external APIs

### IAM Policies

**S3 Access:**
- `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` on the specified bucket

**Secrets Manager Access:**
- `secretsmanager:GetSecretValue`, `secretsmanager:DescribeSecret` on the specified path

**CloudWatch Logs:**
- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` for `/nova-rewards/*`

**CloudWatch Metrics:**
- `cloudwatch:PutMetricData` for the `NovaRewards` namespace

### Auto Scaling

- **Min Size**: 2 instances
- **Max Size**: 6 instances
- **Desired Capacity**: 2 instances (configurable)
- **Health Check**: ELB-based with 300-second grace period
- **Scaling Policies**:
  - Scale up when CPU > 70% for 2 consecutive 5-minute periods
  - Scale down when CPU < 35% for 2 consecutive 5-minute periods

### Health Checks

- **Path**: `/health`
- **Protocol**: HTTP
- **Port**: Application port (4000)
- **Interval**: 30 seconds
- **Healthy Threshold**: 2 consecutive successful checks
- **Unhealthy Threshold**: 3 consecutive failed checks
- **Timeout**: 5 seconds

### CloudWatch Alarms

1. **CPU High**: Triggers scale-up when CPU > 70%
2. **CPU Low**: Triggers scale-down when CPU < 35%
3. **Memory High**: Triggers scale-up when memory > 80%
4. **5xx Error Rate**: Alerts when error rate > 1%
5. **Unhealthy Hosts**: Alerts when any target is unhealthy
6. **Response Time**: Alerts when response time > 1 second

## Deployment Workflow

### 1. Prepare Application

Ensure the Nova Rewards backend:
- Has the `/health` endpoint returning 200 status
- Is containerized with Docker
- Has a `docker-compose.yml` for deployment

### 2. Deploy Infrastructure

```bash
terraform apply
```

### 3. Configure Application

Update the EC2 instances with:
- Environment variables (via Secrets Manager)
- Application code (via docker-compose)
- Database migrations (if needed)

### 4. Verify Deployment

```bash
# Get ALB DNS name
ALB_DNS=$(terraform output -raw alb_dns_name)

# Test health endpoint
curl https://$ALB_DNS/health

# Check CloudWatch dashboard
terraform output cloudwatch_dashboard_url
```

## Monitoring & Troubleshooting

### View Logs

```bash
# Get log group name
LOG_GROUP=$(terraform output -raw cloudwatch_log_group_name)

# View recent logs
aws logs tail $LOG_GROUP --follow
```

### Check ASG Status

```bash
ASG_NAME=$(terraform output -raw asg_name)
aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ASG_NAME
```

### View CloudWatch Metrics

```bash
# Open CloudWatch dashboard
terraform output cloudwatch_dashboard_url
```

### Troubleshoot Unhealthy Instances

```bash
# Check target group health
TG_ARN=$(terraform output -raw target_group_arn)
aws elbv2 describe-target-health --target-group-arn $TG_ARN
```

## Updating Configuration

### Scale Capacity

Update `terraform.tfvars`:

```hcl
desired_capacity = 4
```

Apply changes:

```bash
terraform apply
```

### Update Alarm Thresholds

Modify `terraform.tfvars`:

```hcl
cpu_threshold = 80
memory_threshold = 85
```

Apply changes:

```bash
terraform apply
```

### Update Instance Type

Modify `terraform.tfvars`:

```hcl
instance_type = "t3.large"
```

Apply changes (triggers instance refresh):

```bash
terraform apply
```

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will terminate all EC2 instances and delete the ALB. Ensure you have backups of any critical data.

## Cost Optimization

1. **Use Reserved Instances**: For production, consider AWS Reserved Instances for cost savings
2. **Spot Instances**: For non-critical environments, use Spot Instances
3. **Right-sizing**: Monitor actual usage and adjust instance type if needed
4. **Scheduled Scaling**: Add time-based scaling policies for predictable traffic patterns

## Security Best Practices

1. **Secrets Management**: Store sensitive data in AWS Secrets Manager
2. **IAM Least Privilege**: Review and restrict IAM policies as needed
3. **Network Isolation**: Use private subnets for EC2 instances
4. **SSL/TLS**: Always use HTTPS for production
5. **Security Groups**: Regularly audit and update security group rules
6. **Monitoring**: Enable CloudWatch detailed monitoring and set up alarms
7. **Logging**: Enable VPC Flow Logs and ALB access logs

## Troubleshooting

### Instances Not Becoming Healthy

1. Check security group rules allow traffic from ALB
2. Verify application is listening on the correct port
3. Check `/health` endpoint returns 200 status
4. Review CloudWatch logs for application errors

### ALB Not Responding

1. Verify ALB security group allows inbound 443/80
2. Check certificate ARN is valid
3. Verify target group has healthy instances
4. Check ALB access logs in S3

### Scaling Not Triggering

1. Verify CloudWatch alarms are in ALARM state
2. Check ASG has capacity to scale
3. Review ASG activity history
4. Verify scaling policies are attached

## Support & Documentation

- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [AWS ALB Documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Nova Rewards Backend](../novaRewards/backend/)
