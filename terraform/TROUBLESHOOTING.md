# Troubleshooting Guide

Common issues and solutions for Nova Rewards infrastructure.

## Deployment Issues

### Terraform Init Fails

**Error**: `Error: Failed to download module`

**Solution**:
```bash
# Clear Terraform cache
rm -rf .terraform

# Reinitialize
terraform init

# Check provider version
terraform version
```

### Insufficient Permissions

**Error**: `Error: UnauthorizedOperation`

**Solution**:
1. Verify AWS credentials are configured
2. Check IAM user has required permissions:
   - EC2 (create instances, security groups)
   - ELB (create load balancers)
   - IAM (create roles and policies)
   - CloudWatch (create alarms and logs)
3. Use AWS CLI to verify:
   ```bash
   aws sts get-caller-identity
   ```

### VPC/Subnet Not Found

**Error**: `Error: InvalidParameterValue: Invalid id: "vpc-xxxxx"`

**Solution**:
1. Verify VPC ID exists in your region
2. Check subnets are in the same VPC
3. Verify subnets are in the correct region
4. List available resources:
   ```bash
   aws ec2 describe-vpcs
   aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-xxxxx"
   ```

### Certificate Not Found

**Error**: `Error: InvalidParameterValue: Certificate not found`

**Solution**:
1. Verify certificate ARN is correct
2. Check certificate is in the same region
3. Ensure certificate is in ISSUED state
4. List certificates:
   ```bash
   aws acm list-certificates --region us-east-1
   ```

## Instance Issues

### Instances Not Becoming Healthy

**Symptoms**: Target group shows "unhealthy" status

**Diagnosis**:
```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn)

# SSH into instance
aws ssm start-session --target i-xxxxxxxxx

# Check application status
docker-compose ps
docker-compose logs app

# Test health endpoint
curl http://localhost:4000/health
```

**Solutions**:

1. **Application not running**
   ```bash
   # On EC2 instance
   cd /opt/nova-rewards
   docker-compose up -d
   docker-compose logs app
   ```

2. **Port not listening**
   ```bash
   # Check if port 4000 is listening
   netstat -tlnp | grep 4000
   
   # Check application logs
   docker-compose logs app
   ```

3. **Security group blocking traffic**
   ```bash
   # Verify security group allows ALB traffic
   aws ec2 describe-security-groups \
     --group-ids $(terraform output -raw ec2_security_group_id)
   ```

4. **Health check path incorrect**
   ```bash
   # Test health endpoint
   curl -v http://localhost:4000/health
   
   # Should return 200 with JSON response
   ```

### Instances Terminating Immediately

**Symptoms**: Instances launch then terminate

**Diagnosis**:
```bash
# Check ASG activity
aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name $(terraform output -raw asg_name)

# Check instance status
aws ec2 describe-instance-status \
  --instance-ids i-xxxxxxxxx
```

**Solutions**:

1. **User data script failing**
   ```bash
   # SSH into instance and check logs
   tail -f /var/log/user-data.log
   tail -f /var/log/cloud-init-output.log
   ```

2. **Insufficient disk space**
   ```bash
   # Check disk usage
   df -h
   
   # Increase root volume size in launch_template.tf
   ```

3. **Docker not starting**
   ```bash
   # Check Docker status
   systemctl status docker
   
   # Check Docker logs
   journalctl -u docker -n 50
   ```

## Load Balancer Issues

### ALB Not Responding

**Symptoms**: Cannot reach ALB DNS name

**Diagnosis**:
```bash
# Check ALB status
aws elbv2 describe-load-balancers \
  --load-balancer-arns $(terraform output -raw alb_arn)

# Check target group
aws elbv2 describe-target-groups \
  --target-group-arns $(terraform output -raw target_group_arn)

# Test connectivity
curl -v https://$(terraform output -raw alb_dns_name)/health
```

**Solutions**:

1. **Security group blocking traffic**
   ```bash
   # Verify ALB security group allows 443/80
   aws ec2 describe-security-groups \
     --group-ids $(terraform output -raw alb_security_group_id)
   ```

2. **Certificate issue**
   ```bash
   # Verify certificate
   aws acm describe-certificate \
     --certificate-arn arn:aws:acm:region:account:certificate/id
   ```

3. **No healthy targets**
   ```bash
   # Check target health
   aws elbv2 describe-target-health \
     --target-group-arn $(terraform output -raw target_group_arn)
   ```

### High Response Times

**Symptoms**: Requests taking > 1 second

**Diagnosis**:
```bash
# Check ALB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=$(terraform output -raw alb_arn | cut -d: -f6) \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

**Solutions**:

1. **Application performance**
   - Check application logs for slow queries
   - Monitor database performance
   - Check Redis connectivity

2. **Network latency**
   - Check EC2 instance CPU/memory
   - Verify network connectivity
   - Check for packet loss

3. **Database performance**
   - Check RDS CPU/connections
   - Optimize slow queries
   - Add database indexes

## Scaling Issues

### Auto Scaling Not Triggering

**Symptoms**: Instances not scaling up/down

**Diagnosis**:
```bash
# Check scaling policies
aws autoscaling describe-policies \
  --auto-scaling-group-name $(terraform output -raw asg_name)

# Check CloudWatch alarms
aws cloudwatch describe-alarms \
  --alarm-names nova-rewards-cpu-high nova-rewards-cpu-low

# Check ASG activity
aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name $(terraform output -raw asg_name)
```

**Solutions**:

1. **Alarms not in ALARM state**
   ```bash
   # Check alarm state
   aws cloudwatch describe-alarms \
     --alarm-names nova-rewards-cpu-high
   
   # Generate load to trigger alarm
   ab -n 10000 -c 100 https://alb-dns/health
   ```

2. **ASG at capacity limits**
   ```bash
   # Check current capacity
   aws autoscaling describe-auto-scaling-groups \
     --auto-scaling-group-names $(terraform output -raw asg_name)
   
   # Increase max size if needed
   ```

3. **Scaling policies not attached**
   ```bash
   # Verify policies exist
   aws autoscaling describe-policies \
     --auto-scaling-group-name $(terraform output -raw asg_name)
   ```

## Monitoring Issues

### CloudWatch Alarms Not Firing

**Symptoms**: Alarms stuck in INSUFFICIENT_DATA

**Diagnosis**:
```bash
# Check alarm state
aws cloudwatch describe-alarms \
  --alarm-names nova-rewards-cpu-high

# Check metrics
aws cloudwatch list-metrics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization
```

**Solutions**:

1. **No metrics being published**
   - Verify CloudWatch agent is running
   - Check IAM permissions for CloudWatch
   - Review agent configuration

2. **Alarm threshold too high**
   - Adjust threshold in terraform.tfvars
   - Reapply Terraform configuration

3. **Insufficient data points**
   - Wait for more data (alarms need 2 periods)
   - Generate load to trigger metrics

### Missing Logs

**Symptoms**: No logs in CloudWatch

**Diagnosis**:
```bash
# Check log group exists
aws logs describe-log-groups \
  --log-group-name-prefix /nova-rewards

# Check log streams
aws logs describe-log-streams \
  --log-group-name $(terraform output -raw cloudwatch_log_group_name)
```

**Solutions**:

1. **CloudWatch agent not running**
   ```bash
   # SSH into instance
   systemctl status amazon-cloudwatch-agent
   
   # Start agent
   systemctl start amazon-cloudwatch-agent
   ```

2. **IAM permissions missing**
   - Verify EC2 role has CloudWatch Logs permissions
   - Check policy in iam.tf

3. **Application not logging**
   - Check application configuration
   - Verify log output is going to stdout

## Network Issues

### Cannot SSH into Instance

**Symptoms**: SSH connection timeout

**Solutions**:

1. **Use AWS Systems Manager Session Manager**
   ```bash
   aws ssm start-session --target i-xxxxxxxxx
   ```

2. **Check security group**
   ```bash
   # Verify security group allows SSH (port 22)
   aws ec2 describe-security-groups \
     --group-ids sg-xxxxxxxxx
   ```

3. **Check instance status**
   ```bash
   aws ec2 describe-instance-status \
     --instance-ids i-xxxxxxxxx
   ```

### Cannot Reach RDS/Redis

**Symptoms**: Connection timeout to database/cache

**Solutions**:

1. **Check security group outbound rules**
   ```bash
   aws ec2 describe-security-groups \
     --group-ids $(terraform output -raw ec2_security_group_id)
   ```

2. **Verify RDS/Redis security groups**
   ```bash
   # Check RDS security group allows EC2 traffic
   aws ec2 describe-security-groups \
     --group-ids sg-rds-xxxxxxxxx
   ```

3. **Test connectivity**
   ```bash
   # From EC2 instance
   nc -zv rds-endpoint.rds.amazonaws.com 5432
   nc -zv redis-endpoint.cache.amazonaws.com 6379
   ```

## Performance Issues

### High CPU Usage

**Symptoms**: CPU consistently > 70%

**Solutions**:

1. **Check application performance**
   ```bash
   # SSH into instance
   top
   docker stats
   ```

2. **Optimize application**
   - Profile application code
   - Optimize database queries
   - Add caching

3. **Scale up**
   - Increase instance type
   - Increase desired capacity

### High Memory Usage

**Symptoms**: Memory consistently > 80%

**Solutions**:

1. **Check memory usage**
   ```bash
   # SSH into instance
   free -h
   docker stats
   ```

2. **Optimize application**
   - Check for memory leaks
   - Optimize data structures
   - Increase Node.js heap size

3. **Scale up**
   - Increase instance type
   - Increase desired capacity

## Rollback Procedures

### Rollback Terraform Changes

```bash
# View previous state
terraform show

# Rollback to previous version
git checkout HEAD~1 -- terraform/

# Reapply previous configuration
terraform apply
```

### Rollback Application

```bash
# Get previous Docker image
docker pull node:20-alpine

# Restart with previous version
docker-compose down
docker-compose up -d
```

### Rollback Infrastructure

```bash
# Destroy current infrastructure
terraform destroy

# Reapply from backup
terraform apply -var-file=backup.tfvars
```

## Getting Help

1. **Check logs**
   ```bash
   aws logs tail $(terraform output -raw cloudwatch_log_group_name) --follow
   ```

2. **Review CloudWatch dashboard**
   ```bash
   terraform output cloudwatch_dashboard_url
   ```

3. **Check AWS Health Dashboard**
   - https://phd.aws.amazon.com/

4. **Contact AWS Support**
   - AWS Support Center: https://console.aws.amazon.com/support/

5. **Review documentation**
   - README.md: Comprehensive guide
   - ARCHITECTURE.md: System design
   - DEPLOYMENT_GUIDE.md: Step-by-step instructions
