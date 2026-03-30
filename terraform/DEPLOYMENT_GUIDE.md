# Nova Rewards Backend Deployment Guide

This guide walks through deploying the Nova Rewards backend to AWS using the Terraform infrastructure.

## Pre-Deployment Checklist

- [ ] AWS account with appropriate permissions
- [ ] Terraform installed (v1.0+)
- [ ] AWS CLI configured with credentials
- [ ] VPC and subnets created
- [ ] RDS PostgreSQL instance running
- [ ] Redis ElastiCache cluster running
- [ ] S3 bucket created for application data
- [ ] Secrets Manager secrets configured
- [ ] ACM SSL certificate created
- [ ] Docker image built and pushed to ECR (optional, or use docker-compose)

## Step 1: Prepare AWS Resources

### Create VPC and Subnets

```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc --cidr-block 10.0.0.0/16 --query 'Vpc.VpcId' --output text)

# Create public subnets
PUBLIC_SUBNET_1=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --availability-zone us-east-1a --query 'Subnet.SubnetId' --output text)
PUBLIC_SUBNET_2=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 --availability-zone us-east-1b --query 'Subnet.SubnetId' --output text)

# Create private subnets
PRIVATE_SUBNET_1=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.10.0/24 --availability-zone us-east-1a --query 'Subnet.SubnetId' --output text)
PRIVATE_SUBNET_2=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.11.0/24 --availability-zone us-east-1b --query 'Subnet.SubnetId' --output text)

echo "VPC: $VPC_ID"
echo "Public Subnets: $PUBLIC_SUBNET_1, $PUBLIC_SUBNET_2"
echo "Private Subnets: $PRIVATE_SUBNET_1, $PRIVATE_SUBNET_2"
```

### Create RDS Database

```bash
aws rds create-db-instance \
  --db-instance-identifier nova-rewards-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username postgres \
  --master-user-password 'YourSecurePassword123!' \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name default \
  --publicly-accessible false
```

### Create Redis Cache

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id nova-rewards-cache \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --security-group-ids sg-xxxxxxxx
```

### Create S3 Bucket

```bash
aws s3 mb s3://nova-rewards-app-data-$(date +%s) --region us-east-1
```

### Create Secrets Manager Secrets

```bash
aws secretsmanager create-secret \
  --name nova-rewards/db-password \
  --secret-string 'YourSecurePassword123!'

aws secretsmanager create-secret \
  --name nova-rewards/jwt-secret \
  --secret-string 'YourJWTSecret123!'

aws secretsmanager create-secret \
  --name nova-rewards/api-keys \
  --secret-string '{
    "stripe_key": "sk_live_xxxxx",
    "sendgrid_key": "SG.xxxxx"
  }'
```

### Create ACM Certificate

```bash
# For existing domain
aws acm request-certificate \
  --domain-name api.novarewards.com \
  --validation-method DNS \
  --region us-east-1

# Or import existing certificate
aws acm import-certificate \
  --certificate-body file://Certificate.pem \
  --certificate-chain file://CertificateChain.pem \
  --private-key file://PrivateKey.pem \
  --region us-east-1
```

## Step 2: Configure Terraform

### Initialize Terraform

```bash
cd terraform
terraform init
```

### Create terraform.tfvars

```bash
cat > terraform.tfvars <<EOF
aws_region = "us-east-1"
environment = "prod"
app_name = "nova-rewards"
instance_type = "t3.medium"

min_size = 2
max_size = 6
desired_capacity = 2

vpc_id = "$VPC_ID"
private_subnet_ids = ["$PRIVATE_SUBNET_1", "$PRIVATE_SUBNET_2"]
public_subnet_ids = ["$PUBLIC_SUBNET_1", "$PUBLIC_SUBNET_2"]

rds_endpoint = "nova-rewards-db.xxxxxxxxx.rds.amazonaws.com"
rds_port = 5432

redis_endpoint = "nova-rewards-cache.xxxxxxxxx.cache.amazonaws.com"
redis_port = 6379

s3_bucket_name = "nova-rewards-app-data-xxxxx"
secrets_manager_path = "nova-rewards/*"

cpu_threshold = 70
memory_threshold = 80
error_rate_threshold = 1

certificate_arn = "arn:aws:acm:us-east-1:xxxxxxxxx:certificate/xxxxxxxxx"

enable_detailed_monitoring = true

tags = {
  Owner = "DevOps"
  Environment = "prod"
  Project = "NovaRewards"
}
EOF
```

## Step 3: Plan and Deploy Infrastructure

### Validate Configuration

```bash
terraform validate
```

### Plan Deployment

```bash
terraform plan -out=tfplan
```

Review the output carefully to ensure all resources are correct.

### Apply Configuration

```bash
terraform apply tfplan
```

Wait for the deployment to complete (typically 5-10 minutes).

### Retrieve Outputs

```bash
terraform output deployment_info
```

Save the outputs for use in subsequent steps:

```bash
ALB_DNS=$(terraform output -raw alb_dns_name)
ASG_NAME=$(terraform output -raw asg_name)
TG_ARN=$(terraform output -raw target_group_arn)
LOG_GROUP=$(terraform output -raw cloudwatch_log_group_name)

echo "ALB DNS: $ALB_DNS"
echo "ASG Name: $ASG_NAME"
echo "Target Group ARN: $TG_ARN"
echo "Log Group: $LOG_GROUP"
```

## Step 4: Deploy Application

### Prepare Docker Compose

Create a `docker-compose.yml` on the EC2 instances:

```yaml
version: '3.8'

services:
  app:
    image: node:20-alpine
    working_dir: /app
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: postgresql://user:password@${RDS_ENDPOINT}:5432/nova_rewards
      REDIS_URL: redis://${REDIS_ENDPOINT}:6379
      AWS_REGION: us-east-1
      S3_BUCKET: ${S3_BUCKET_NAME}
    volumes:
      - ./:/app
    command: npm start
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

### SSH into EC2 Instance

```bash
# Get instance ID
INSTANCE_ID=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names $ASG_NAME \
  --query 'AutoScalingGroups[0].Instances[0].InstanceId' \
  --output text)

# SSH into instance
aws ssm start-session --target $INSTANCE_ID
```

### Deploy Application

```bash
# On EC2 instance
cd /opt/nova-rewards

# Create docker-compose.yml with environment variables
cat > docker-compose.yml <<'EOF'
version: '3.8'
services:
  app:
    image: node:20-alpine
    working_dir: /app
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      AWS_REGION: us-east-1
    volumes:
      - ./:/app
    command: npm start
    restart: always
EOF

# Start application
docker-compose up -d

# Verify application is running
curl http://localhost:4000/health
```

## Step 5: Verify Deployment

### Check ALB Health

```bash
# Get target group health
aws elbv2 describe-target-health --target-group-arn $TG_ARN

# Expected output: HealthState = healthy
```

### Test Health Endpoint

```bash
# Test via ALB
curl https://$ALB_DNS/health

# Expected output: {"success":true,"data":{"status":"ok"}}
```

### Check CloudWatch Logs

```bash
# View recent logs
aws logs tail $LOG_GROUP --follow

# View specific time range
aws logs filter-log-events \
  --log-group-name $LOG_GROUP \
  --start-time $(date -d '10 minutes ago' +%s)000
```

### Monitor CloudWatch Dashboard

```bash
# Open dashboard in browser
echo "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=nova-rewards-prod"
```

## Step 6: Configure DNS

### Update Route 53

```bash
# Get ALB zone ID
ZONE_ID=$(terraform output -raw alb_zone_id)

# Create Route 53 record
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.novarewards.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "'$ZONE_ID'",
          "DNSName": "'$ALB_DNS'",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

## Step 7: Post-Deployment Verification

### Run Health Checks

```bash
# Test API endpoints
curl -X GET https://api.novarewards.com/health
curl -X GET https://api.novarewards.com/api/users/profile

# Check response times
time curl https://api.novarewards.com/health
```

### Monitor Metrics

```bash
# Get CPU utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=AutoScalingGroupName,Value=$ASG_NAME \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

### Test Scaling

```bash
# Generate load to test auto-scaling
ab -n 10000 -c 100 https://api.novarewards.com/health

# Monitor ASG
watch -n 5 'aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names '$ASG_NAME' \
  --query "AutoScalingGroups[0].[DesiredCapacity,Instances[].InstanceId]"'
```

## Troubleshooting

### Instances Not Becoming Healthy

1. Check security group rules
2. Verify application is running: `docker-compose ps`
3. Check application logs: `docker-compose logs app`
4. Verify health endpoint: `curl http://localhost:4000/health`

### ALB Not Responding

1. Check ALB security group allows 443/80
2. Verify certificate is valid
3. Check target group has healthy instances
4. Review ALB access logs

### Scaling Not Working

1. Check CloudWatch alarms: `aws cloudwatch describe-alarms`
2. Review ASG activity: `aws autoscaling describe-scaling-activities --auto-scaling-group-name $ASG_NAME`
3. Check ASG policies: `aws autoscaling describe-policies --auto-scaling-group-name $ASG_NAME`

## Rollback

If deployment fails, rollback with:

```bash
terraform destroy
```

Then investigate the issue and redeploy.

## Next Steps

1. Set up CI/CD pipeline for automated deployments
2. Configure backup and disaster recovery
3. Set up monitoring and alerting
4. Implement auto-scaling policies based on actual traffic patterns
5. Optimize costs with Reserved Instances or Spot Instances
