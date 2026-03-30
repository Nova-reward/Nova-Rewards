# Nova Rewards EC2 Infrastructure Overview

## Architecture

This Terraform configuration provisions a secure, scalable, and highly available infrastructure for the Nova Rewards backend APIs on AWS.

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Internet (0.0.0.0/0)                    │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS (443)
                             ▼
                    ┌────────────────┐
                    │  ALB (Public)  │
                    │  Security Group│
                    └────────┬───────┘
                             │ HTTP (4000)
                ┌────────────┴────────────┐
                ▼                         ▼
        ┌──────────────┐         ┌──────────────┐
        │  EC2 Instance│         │  EC2 Instance│
        │  (Private)   │         │  (Private)   │
        │  t3.medium   │         │  t3.medium   │
        │  Min: 2      │         │  Max: 6      │
        │  Security SG │         │  Security SG │
        └──────┬───────┘         └──────┬───────┘
               │                        │
        ┌──────┴────────────────────────┴──────┐
        │                                       │
        ▼                                       ▼
   ┌─────────────┐                      ┌──────────────┐
   │ RDS (5432)  │                      │ Redis (6379) │
   │ PostgreSQL  │                      │ Cache        │
   └─────────────┘                      └──────────────┘
        │
        ▼
   ┌─────────────┐
   │ S3 Bucket   │
   │ Application │
   │ Data        │
   └─────────────┘
```

## Key Features

### High Availability
- **Multi-AZ Deployment**: ALB and EC2 instances span multiple availability zones
- **Auto Scaling Group**: Automatically scales between 2-6 instances based on demand
- **Health Checks**: ALB performs health checks every 30 seconds
- **Connection Draining**: 30-second deregistration delay for graceful shutdowns

### Security
- **Least Privilege IAM**: EC2 instances have minimal required permissions
  - S3 bucket access (specific bucket only)
  - Secrets Manager access (nova-rewards/* path only)
  - CloudWatch Logs and Metrics
- **Security Groups**: Strict ingress/egress rules
  - EC2 accepts traffic only from ALB on port 4000
  - EC2 can reach RDS (5432) and Redis (6379)
  - ALB accepts HTTPS (443) and HTTP (80) from anywhere
- **Encrypted Storage**: EBS volumes encrypted by default
- **IMDSv2**: Enforced for EC2 metadata access

### Monitoring & Alerting
- **CloudWatch Alarms**:
  - CPU > 70% (triggers scale-up)
  - CPU < 35% (triggers scale-down)
  - Memory > 80% (informational)
  - 5xx error rate > 1% (informational)
  - Unhealthy hosts (informational)
  - Response time > 1s (informational)
- **CloudWatch Dashboard**: Real-time metrics visualization
- **CloudWatch Logs**: Centralized application and system logs
- **Custom Metrics**: Memory and disk utilization via CloudWatch agent

### Cost Optimization
- **t3.medium Instances**: Burstable instances for cost-effective scaling
- **Auto Scaling**: Scales down during low-traffic periods
- **Efficient Storage**: 30GB gp3 volumes (better price/performance than gp2)
- **Log Retention**: 30 days for prod, 7 days for dev/staging

## Infrastructure Details

### EC2 Instances
- **Instance Type**: t3.medium (2 vCPU, 4GB RAM)
- **AMI**: Latest Amazon Linux 2
- **Storage**: 30GB gp3 encrypted EBS volume
- **Monitoring**: Detailed CloudWatch monitoring enabled
- **User Data**: Installs Docker, Docker Compose, and CloudWatch agent

### Auto Scaling Group
- **Min Size**: 2 instances (high availability)
- **Max Size**: 6 instances (cost control)
- **Desired Capacity**: 2 instances
- **Health Check Type**: ELB (uses ALB health checks)
- **Health Check Grace Period**: 300 seconds
- **Instance Refresh**: Rolling updates with 50% minimum healthy percentage

### Application Load Balancer
- **Type**: Application Load Balancer (Layer 7)
- **Scheme**: Internet-facing
- **Subnets**: Deployed across public subnets in multiple AZs
- **Deletion Protection**: Enabled for prod environment
- **Cross-Zone Load Balancing**: Enabled

### Target Group
- **Protocol**: HTTP
- **Port**: 4000 (application port)
- **Health Check**:
  - Path: `/health`
  - Expected Response: 200
  - Interval: 30 seconds
  - Timeout: 5 seconds
  - Healthy Threshold: 2
  - Unhealthy Threshold: 3
- **Stickiness**: Enabled (86400 second cookie duration)
- **Deregistration Delay**: 30 seconds

### Security Groups

#### ALB Security Group
**Inbound**:
- Port 443 (HTTPS) from 0.0.0.0/0
- Port 80 (HTTP) from 0.0.0.0/0

**Outbound**:
- All traffic to 0.0.0.0/0

#### EC2 Security Group
**Inbound**:
- Port 4000 (HTTP) from ALB security group only

**Outbound**:
- Port 5432 (RDS) to 0.0.0.0/0
- Port 6379 (Redis) to 0.0.0.0/0
- Port 53 (DNS) to 0.0.0.0/0
- Port 80 (HTTP) to 0.0.0.0/0
- Port 443 (HTTPS) to 0.0.0.0/0

### IAM Configuration

#### EC2 Role Policies

**S3 Access**:
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",
    "s3:PutObject",
    "s3:DeleteObject",
    "s3:ListBucket"
  ],
  "Resource": [
    "arn:aws:s3:::bucket-name",
    "arn:aws:s3:::bucket-name/*"
  ]
}
```

**Secrets Manager Access**:
```json
{
  "Effect": "Allow",
  "Action": [
    "secretsmanager:GetSecretValue",
    "secretsmanager:DescribeSecret"
  ],
  "Resource": "arn:aws:secretsmanager:region:account:secret:nova-rewards/*"
}
```

**CloudWatch Logs**:
```json
{
  "Effect": "Allow",
  "Action": [
    "logs:CreateLogGroup",
    "logs:CreateLogStream",
    "logs:PutLogEvents",
    "logs:DescribeLogStreams"
  ],
  "Resource": "arn:aws:logs:region:account:log-group:/nova-rewards/*"
}
```

**CloudWatch Metrics**:
```json
{
  "Effect": "Allow",
  "Action": ["cloudwatch:PutMetricData"],
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "cloudwatch:namespace": "NovaRewards"
    }
  }
}
```

### CloudWatch Monitoring

#### Metrics Collected
- **CPU Utilization**: AWS/EC2 namespace
- **Memory Utilization**: NovaRewards namespace (custom metric)
- **Disk Utilization**: NovaRewards namespace (custom metric)
- **Request Count**: AWS/ApplicationELB namespace
- **HTTP Status Codes**: AWS/ApplicationELB namespace
- **Target Response Time**: AWS/ApplicationELB namespace
- **Healthy/Unhealthy Host Count**: AWS/ApplicationELB namespace

#### Alarms
1. **CPU High**: Triggers scale-up when CPU > 70% for 10 minutes
2. **CPU Low**: Triggers scale-down when CPU < 35% for 10 minutes
3. **Memory High**: Alert when memory > 80% for 10 minutes
4. **5xx Error Rate**: Alert when 5xx errors > 1% for 10 minutes
5. **Unhealthy Hosts**: Alert when any host is unhealthy
6. **Response Time**: Alert when response time > 1 second

#### Dashboard
Real-time visualization of:
- CPU and memory utilization
- Request counts and error rates
- Response times
- Healthy/unhealthy host counts

### CloudWatch Logs

**Log Group**: `/nova-rewards/{environment}/app`
- **Retention**: 30 days (prod), 7 days (dev/staging)
- **Sources**:
  - Application logs (via Docker)
  - CloudWatch agent logs
  - System logs

## Deployment Workflow

### 1. Prerequisites
- AWS account with appropriate permissions
- VPC with public and private subnets
- RDS PostgreSQL instance
- Redis cluster/instance
- S3 bucket
- Secrets Manager secrets
- ACM SSL certificate

### 2. Configuration
- Copy `terraform.tfvars.example` to `terraform.tfvars`
- Update with your specific values
- Review security group rules

### 3. Deployment
```bash
terraform init
terraform plan
terraform apply
```

### 4. Verification
- Check ALB health checks
- Verify EC2 instances are running
- Test health endpoint
- Monitor CloudWatch metrics

### 5. Application Deployment
- Deploy backend application to instances
- Configure environment variables
- Start application services

## Scaling Behavior

### Automatic Scaling
- **Scale Up**: When average CPU > 70% for 2 consecutive 5-minute periods
- **Scale Down**: When average CPU < 35% for 2 consecutive 5-minute periods
- **Cooldown**: 5 minutes between scaling actions
- **Max Instances**: 6 (prevents runaway costs)
- **Min Instances**: 2 (ensures high availability)

### Manual Scaling
```bash
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name nova-rewards-asg \
  --desired-capacity 4
```

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

## Disaster Recovery

### Backup Strategy
- **RDS**: Automated backups (7-day retention)
- **S3**: Versioning enabled
- **Configuration**: Stored in Terraform state (backup to S3)

### Recovery Procedures
1. **Instance Failure**: ASG automatically replaces failed instances
2. **AZ Failure**: ALB routes traffic to instances in other AZs
3. **Complete Failure**: Redeploy using Terraform

### RTO/RPO
- **RTO** (Recovery Time Objective): < 5 minutes (ASG replacement)
- **RPO** (Recovery Point Objective): < 1 minute (ALB health checks)

## Security Best Practices

1. **Network Isolation**: EC2 instances in private subnets
2. **Least Privilege**: IAM policies restricted to required resources
3. **Encryption**: EBS volumes encrypted, HTTPS for ALB
4. **Monitoring**: CloudWatch alarms for security events
5. **Patching**: Regular OS and application updates
6. **Secrets Management**: Use Secrets Manager for sensitive data
7. **Audit Logging**: CloudTrail for API calls, CloudWatch Logs for application logs

## Troubleshooting

### Common Issues

**Instances not passing health checks**:
- Verify security group allows ALB traffic
- Check application is listening on port 4000
- Verify `/health` endpoint returns 200
- Check application logs in CloudWatch

**Cannot reach RDS/Redis**:
- Verify security group outbound rules
- Check RDS/Redis security groups allow inbound
- Test connectivity: `telnet endpoint port`

**High CPU/Memory**:
- Check application logs for errors
- Monitor CloudWatch metrics
- Consider scaling up instance type
- Optimize application code

**ALB not distributing traffic**:
- Verify target group health checks
- Check ALB listener configuration
- Verify security groups allow traffic

## Files Overview

- **variables.tf**: Input variables and validation
- **iam.tf**: IAM roles, policies, and instance profiles
- **security_groups.tf**: Security group definitions
- **launch_template.tf**: EC2 launch template configuration
- **asg.tf**: Auto Scaling Group and scaling policies
- **alb.tf**: Application Load Balancer and target group
- **cloudwatch.tf**: CloudWatch alarms, logs, and dashboard
- **outputs.tf**: Output values for use in other systems
- **user_data.sh**: EC2 initialization script
- **terraform.tfvars.example**: Example variable values

## Next Steps

1. Review and customize the configuration for your environment
2. Create necessary AWS resources (VPC, RDS, Redis, S3, ACM)
3. Deploy infrastructure using Terraform
4. Deploy backend application to instances
5. Configure monitoring and alerting
6. Implement CI/CD pipeline for deployments
7. Set up backup and disaster recovery procedures
