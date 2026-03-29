# Terraform & Infrastructure Troubleshooting Guide

## Terraform Deployment Issues

### Issue: "terraform: command not found"
**Cause**: Terraform is not installed or not in PATH
**Solution**:
1. Install Terraform from https://www.terraform.io/downloads.html
2. Add Terraform to PATH
3. Verify: `terraform version`

### Issue: "Error: Failed to query available provider packages"
**Cause**: Network connectivity or provider registry issue
**Solution**:
```bash
# Clear cache and reinitialize
rm -rf .terraform
terraform init
```

### Issue: "Error: Missing required argument"
**Cause**: Missing variable in terraform.tfvars
**Solution**:
1. Check error message for missing variable name
2. Add to terraform.tfvars:
```hcl
variable_name = "value"
```
3. Rerun `terraform plan`

### Issue: "Error: Invalid value for variable"
**Cause**: Variable value doesn't match validation rules
**Solution**:
1. Check variable validation in variables.tf
2. For environment: must be "dev", "staging", or "prod"
3. For lists: ensure proper format with brackets
4. Update terraform.tfvars with valid value

### Issue: "Error: Conflicting configuration arguments"
**Cause**: Duplicate or conflicting resource definitions
**Solution**:
1. Check for duplicate resource blocks
2. Verify resource names are unique
3. Run `terraform validate`

### Issue: "Error: Resource already exists"
**Cause**: Resource already exists in AWS
**Solution**:
```bash
# Option 1: Import existing resource
terraform import aws_security_group.alb_sg sg-xxxxxxxxx

# Option 2: Destroy and recreate
terraform destroy -target=aws_security_group.alb_sg
terraform apply

# Option 3: Manually delete in AWS console and reapply
```

## AWS Deployment Issues

### Issue: Instances Not Passing Health Checks

**Symptoms**:
- Target group shows "Unhealthy" status
- ALB cannot reach instances
- No traffic reaching application

**Diagnosis**:
```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn)

# SSH to instance
aws ssm start-session --target i-xxxxxxxxx

# Check if application is running
curl http://localhost:4000/health

# Check security group
aws ec2 describe-security-groups \
  --group-ids $(terraform output -raw ec2_security_group_id)
```

**Solutions**:

1. **Application not listening on port 4000**:
   - Check user_data.sh executed successfully
   - Verify application is running: `docker ps`
   - Check application logs: `docker logs <container-id>`
   - Verify port mapping in docker-compose.yml

2. **Health check endpoint not returning 200**:
   - Test endpoint: `curl http://localhost:4000/health`
   - Check application logs for errors
   - Verify endpoint is implemented
   - Check response format (should be plain text or JSON)

3. **Security group blocking traffic**:
   - Verify inbound rule allows port 4000 from ALB SG
   - Check ALB security group ID matches rule
   - Verify no network ACLs blocking traffic
   - Test connectivity: `telnet localhost 4000`

4. **Instance initialization incomplete**:
   - Check user_data logs: `tail -f /var/log/user-data.log`
   - Verify Docker is running: `systemctl status docker`
   - Check systemd service: `systemctl status nova-rewards`
   - Wait 5 minutes for full initialization

### Issue: Cannot Connect to RDS

**Symptoms**:
- Application cannot connect to database
- Connection timeout errors
- "Connection refused" errors

**Diagnosis**:
```bash
# SSH to instance
aws ssm start-session --target i-xxxxxxxxx

# Test connectivity
telnet <rds-endpoint> 5432

# Check security group
aws ec2 describe-security-groups \
  --group-ids $(terraform output -raw ec2_security_group_id)

# Check RDS security group
aws ec2 describe-security-groups \
  --group-ids <rds-sg-id>
```

**Solutions**:

1. **EC2 security group missing outbound rule**:
   - Verify outbound rule for port 5432
   - Check CIDR blocks (should be 0.0.0.0/0 or RDS subnet)
   - Update security group if needed

2. **RDS security group not allowing inbound**:
   - Check RDS security group inbound rules
   - Verify EC2 security group is in allowed sources
   - Add rule: Port 5432 from EC2 SG

3. **RDS endpoint incorrect**:
   - Verify RDS endpoint in terraform.tfvars
   - Check RDS is running: `aws rds describe-db-instances`
   - Verify endpoint format (should include .rds.amazonaws.com)

4. **Network connectivity issue**:
   - Verify NAT Gateway is running (for private subnets)
   - Check route tables for private subnets
   - Verify RDS is in same VPC
   - Check network ACLs

### Issue: Cannot Connect to Redis

**Symptoms**:
- Cache connection errors
- "Connection refused" errors
- Application cannot store/retrieve cache data

**Diagnosis**:
```bash
# SSH to instance
aws ssm start-session --target i-xxxxxxxxx

# Test connectivity
telnet <redis-endpoint> 6379

# Check security group
aws ec2 describe-security-groups \
  --group-ids $(terraform output -raw ec2_security_group_id)
```

**Solutions**:
- Same as RDS troubleshooting, but for port 6379
- Verify Redis cluster is running
- Check Redis security group allows inbound from EC2 SG

### Issue: Cannot Access S3 Bucket

**Symptoms**:
- "Access Denied" errors
- Application cannot read/write to S3
- IAM permission errors

**Diagnosis**:
```bash
# SSH to instance
aws ssm start-session --target i-xxxxxxxxx

# Test S3 access
aws s3 ls s3://bucket-name

# Check IAM role
aws iam get-role --role-name <role-name>

# Check role policies
aws iam list-role-policies --role-name <role-name>
```

**Solutions**:

1. **IAM policy missing S3 permissions**:
   - Verify S3 policy in iam.tf
   - Check bucket name matches terraform.tfvars
   - Ensure policy includes GetObject, PutObject, DeleteObject, ListBucket

2. **Bucket name incorrect**:
   - Verify s3_bucket_name in terraform.tfvars
   - Check bucket exists: `aws s3 ls`
   - Verify bucket name spelling

3. **Bucket policy blocking access**:
   - Check bucket policy: `aws s3api get-bucket-policy --bucket bucket-name`
   - Verify IAM role is allowed
   - Remove any deny statements

## CloudWatch Issues

### Issue: CloudWatch Alarms Not Triggering

**Symptoms**:
- Alarms stuck in "INSUFFICIENT_DATA"
- No metrics being published
- Alarms not triggering on high CPU/memory

**Diagnosis**:
```bash
# Check alarm status
aws cloudwatch describe-alarms \
  --alarm-name-prefix nova-rewards

# Check metrics
aws cloudwatch list-metrics \
  --namespace AWS/EC2

# Check custom metrics
aws cloudwatch list-metrics \
  --namespace NovaRewards
```

**Solutions**:

1. **CloudWatch agent not running**:
   - SSH to instance
   - Check agent status: `systemctl status amazon-cloudwatch-agent`
   - Check agent logs: `/opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log`
   - Restart agent: `systemctl restart amazon-cloudwatch-agent`

2. **IAM role missing CloudWatch permissions**:
   - Verify CloudWatch Metrics policy in iam.tf
   - Check policy allows cloudwatch:PutMetricData
   - Verify namespace is "NovaRewards"

3. **Metrics not being published**:
   - Check application is publishing metrics
   - Verify metric names match alarm configuration
   - Check CloudWatch agent configuration

4. **Alarm configuration incorrect**:
   - Verify alarm threshold values
   - Check evaluation periods (should be 2)
   - Verify statistic (Average, Sum, etc.)
   - Check dimensions match resources

### Issue: CloudWatch Logs Not Appearing

**Symptoms**:
- Log group exists but no logs
- Application logs not visible
- Cannot find error messages

**Diagnosis**:
```bash
# Check log group
aws logs describe-log-groups \
  --log-group-name-prefix /nova-rewards

# Check log streams
aws logs describe-log-streams \
  --log-group-name /nova-rewards/prod/app

# Check recent logs
aws logs tail /nova-rewards/prod/app --follow
```

**Solutions**:

1. **CloudWatch agent not configured**:
   - Check agent config: `/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json`
   - Verify log file paths are correct
   - Restart agent: `systemctl restart amazon-cloudwatch-agent`

2. **IAM role missing log permissions**:
   - Verify CloudWatch Logs policy in iam.tf
   - Check policy allows logs:CreateLogGroup, CreateLogStream, PutLogEvents
   - Verify log group name matches policy

3. **Application not writing logs**:
   - Check application is running
   - Verify log output is configured
   - Check Docker logs: `docker logs <container-id>`
   - Verify log file paths in agent config

4. **Log retention expired**:
   - Check log retention setting (30 days prod, 7 days dev)
   - Old logs may have been deleted
   - Verify retention policy in cloudwatch.tf

## Auto Scaling Issues

### Issue: Instances Not Scaling Up

**Symptoms**:
- CPU high but no new instances launching
- Stuck at min_size
- Cannot handle increased traffic

**Diagnosis**:
```bash
# Check ASG status
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names $(terraform output -raw asg_name)

# Check scaling activities
aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name $(terraform output -raw asg_name)

# Check alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix nova-rewards-cpu
```

**Solutions**:

1. **CPU alarm not triggering**:
   - Check CPU metrics in CloudWatch
   - Verify alarm threshold (should be 70%)
   - Check evaluation periods (should be 2 x 5 minutes = 10 minutes)
   - Verify alarm is in ALARM state

2. **Scaling policy not attached**:
   - Verify scale-up policy exists
   - Check policy is attached to ASG
   - Verify policy action is correct

3. **Max size reached**:
   - Check current desired capacity
   - Verify max_size in terraform.tfvars
   - Increase max_size if needed

4. **Cooldown period active**:
   - Check last scaling activity timestamp
   - Wait for cooldown period (5 minutes)
   - Verify cooldown is not too long

### Issue: Instances Not Scaling Down

**Symptoms**:
- CPU low but instances not terminating
- Stuck at higher capacity
- Unnecessary costs

**Diagnosis**:
```bash
# Check ASG status
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names $(terraform output -raw asg_name)

# Check CPU metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Average
```

**Solutions**:

1. **CPU not low enough**:
   - Check CPU threshold (should be 35% for scale-down)
   - Verify CPU is consistently below threshold
   - Wait for evaluation periods (10 minutes)

2. **Scale-down policy not attached**:
   - Verify scale-down policy exists
   - Check policy is attached to ASG
   - Verify policy action is correct

3. **Min size reached**:
   - Check min_size (should be 2)
   - Cannot scale below min_size
   - Verify min_size is appropriate

4. **Cooldown period active**:
   - Check last scaling activity
   - Wait for cooldown period (5 minutes)

## Security Group Issues

### Issue: Traffic Not Reaching Application

**Symptoms**:
- Cannot connect to ALB
- Cannot reach application
- Connection timeout

**Diagnosis**:
```bash
# Check ALB security group
aws ec2 describe-security-groups \
  --group-ids $(terraform output -raw alb_security_group_id)

# Check EC2 security group
aws ec2 describe-security-groups \
  --group-ids $(terraform output -raw ec2_security_group_id)

# Test connectivity
curl -v https://alb-dns-name/health
```

**Solutions**:

1. **ALB security group missing inbound rule**:
   - Verify inbound rule for port 443 (HTTPS)
   - Verify inbound rule for port 80 (HTTP)
   - Check CIDR blocks (should be 0.0.0.0/0)

2. **EC2 security group missing inbound rule**:
   - Verify inbound rule for port 4000
   - Check source is ALB security group
   - Verify rule is not restricted to specific IPs

3. **Network ACLs blocking traffic**:
   - Check subnet network ACLs
   - Verify inbound/outbound rules allow traffic
   - Check ephemeral port range (1024-65535)

4. **ALB not routing to targets**:
   - Check target group health
   - Verify targets are registered
   - Check listener configuration

## Certificate Issues

### Issue: HTTPS Not Working

**Symptoms**:
- SSL certificate error
- "Certificate not found" error
- HTTPS connection refused

**Diagnosis**:
```bash
# Check certificate
aws acm describe-certificate \
  --certificate-arn <certificate-arn>

# Check ALB listener
aws elbv2 describe-listeners \
  --load-balancer-arn $(terraform output -raw alb_arn)
```

**Solutions**:

1. **Certificate ARN incorrect**:
   - Verify certificate_arn in terraform.tfvars
   - Check certificate exists: `aws acm list-certificates`
   - Verify certificate is in same region

2. **Certificate expired**:
   - Check certificate expiration date
   - Renew certificate in ACM
   - Update certificate_arn if needed

3. **Certificate domain mismatch**:
   - Verify certificate covers your domain
   - Check certificate subject alternative names
   - Request new certificate if needed

4. **HTTPS listener not configured**:
   - Verify HTTPS listener exists
   - Check listener port (should be 443)
   - Verify certificate is attached

## Performance Issues

### Issue: High Latency/Slow Response Times

**Symptoms**:
- Response time > 1 second
- Application feels slow
- Users reporting delays

**Diagnosis**:
```bash
# Check response time metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Average

# Check CPU/Memory
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Average
```

**Solutions**:

1. **High CPU/Memory usage**:
   - Check application logs for errors
   - Optimize application code
   - Scale up instance type (t3.large)
   - Increase desired capacity

2. **Database connection issues**:
   - Check RDS performance
   - Verify connection pooling
   - Check query performance
   - Monitor RDS metrics

3. **Network latency**:
   - Check ALB response time
   - Verify instances are in same AZ as ALB
   - Check network performance
   - Consider using placement groups

4. **Application bottleneck**:
   - Profile application code
   - Check for memory leaks
   - Optimize database queries
   - Implement caching

## Cost Issues

### Issue: Unexpected High Costs

**Symptoms**:
- AWS bill higher than expected
- Costs increasing rapidly
- Unexpected charges

**Diagnosis**:
```bash
# Check running instances
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running"

# Check ASG desired capacity
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names $(terraform output -raw asg_name)

# Check data transfer
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name ProcessedBytes \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 86400 \
  --statistics Sum
```

**Solutions**:

1. **Too many instances running**:
   - Check desired capacity
   - Reduce max_size if not needed
   - Implement better scaling policies
   - Use Reserved Instances for baseline

2. **High data transfer costs**:
   - Check data transfer metrics
   - Optimize application to reduce data
   - Use CloudFront for static content
   - Implement compression

3. **Unused resources**:
   - Check for stopped instances
   - Remove unused security groups
   - Delete unused volumes
   - Clean up old snapshots

4. **Inefficient instance type**:
   - Consider t3.small for dev/staging
   - Use Spot Instances for non-critical workloads
   - Implement auto-scaling more aggressively

## Getting Help

### Resources
- Terraform Documentation: https://www.terraform.io/docs
- AWS Documentation: https://docs.aws.amazon.com
- AWS Support: https://console.aws.amazon.com/support

### Debug Commands
```bash
# Enable debug logging
export TF_LOG=DEBUG
terraform plan

# Check Terraform state
terraform state list
terraform state show aws_lb.main

# Validate configuration
terraform validate
terraform fmt -check

# Check AWS resources
aws ec2 describe-instances
aws elbv2 describe-load-balancers
aws autoscaling describe-auto-scaling-groups
aws cloudwatch describe-alarms
```

### Common Log Locations
- Terraform: `TF_LOG=DEBUG terraform plan`
- User data: `/var/log/user-data.log`
- CloudWatch agent: `/opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log`
- Docker: `docker logs <container-id>`
- Application: CloudWatch Logs `/nova-rewards/{environment}/app`
