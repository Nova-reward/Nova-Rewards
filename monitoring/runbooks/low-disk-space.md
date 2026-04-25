# Runbook: Low Disk Space

## Alert Details
- **Alert Name**: DiskSpaceLow
- **Severity**: Warning
- **Threshold**: Disk space < 15% for 5 minutes

## Symptoms
- Disk write errors
- Application crashes
- Database failures
- Log rotation issues
- Container failures

## Investigation Steps

### 1. Check Disk Usage
```bash
# Overall disk usage
df -h

# Specific mount points
df -h /
df -h /var/lib/docker

# Disk usage by directory
du -sh /* | sort -h

# Find large directories
du -h / | sort -h | tail -20
```

### 2. Check Docker Usage
```bash
# Docker disk usage
docker system df

# Detailed breakdown
docker system df -v

# Images
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# Containers
docker ps -a --format "table {{.Names}}\t{{.Size}}"

# Volumes
docker volume ls
```

### 3. Check Log Files
```bash
# Large log files
find /var/log -type f -size +100M -exec ls -lh {} \;

# Docker logs
docker ps -q | xargs -I {} sh -c 'echo "Container: {}"; docker logs {} 2>&1 | wc -l'

# Application logs
du -sh /var/log/*
```

### 4. Check Database Size
```bash
# PostgreSQL database size
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT pg_size_pretty(pg_database_size('nova_rewards'));"

# Table sizes
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;"
```

## Common Causes & Solutions

### Docker Images and Containers
**Symptoms**: Many unused images and stopped containers

**Solution**:
```bash
# Remove unused images
docker image prune -a -f

# Remove stopped containers
docker container prune -f

# Remove unused volumes
docker volume prune -f

# Complete cleanup
docker system prune -a --volumes -f

# Remove specific old images
docker images | grep "months ago" | awk '{print $3}' | xargs docker rmi
```

### Log Files Growing
**Symptoms**: Large log files in /var/log

**Solution**:
```bash
# Truncate large logs
find /var/log -type f -size +100M -exec truncate -s 0 {} \;

# Remove old logs
find /var/log -type f -name "*.log" -mtime +30 -delete

# Configure log rotation
cat > /etc/logrotate.d/nova-rewards << EOF
/var/log/nova-rewards/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
EOF

# Docker log rotation
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
```

### Database Growth
**Symptoms**: PostgreSQL database consuming large space

**Solution**:
```bash
# Vacuum database
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "VACUUM FULL;"

# Analyze tables
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "ANALYZE;"

# Remove old data (if applicable)
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
DELETE FROM logs WHERE created_at < NOW() - INTERVAL '90 days';"

# Archive old data
pg_dump -U nova -t old_table nova_rewards > archive.sql
# Then drop the table
```

### Prometheus Data
**Symptoms**: Prometheus time-series database growing

**Solution**:
```bash
# Check Prometheus data size
du -sh /var/lib/docker/volumes/*prometheus*

# Reduce retention period
# Edit prometheus.yml:
# --storage.tsdb.retention.time=15d  # Reduce from 30d

# Restart Prometheus
docker restart nova-prometheus

# Delete old data manually
docker exec -it nova-prometheus rm -rf /prometheus/01*
```

### Temporary Files
**Symptoms**: /tmp directory full

**Solution**:
```bash
# Clean /tmp
find /tmp -type f -atime +7 -delete

# Clean /var/tmp
find /var/tmp -type f -atime +7 -delete

# Clean package manager cache
apt-get clean  # Debian/Ubuntu
yum clean all  # CentOS/RHEL
```

## Immediate Actions

### 1. Free Up Space Quickly
```bash
# Quick cleanup script
#!/bin/bash
echo "Starting cleanup..."

# Docker cleanup
docker system prune -a -f --volumes

# Log cleanup
find /var/log -type f -name "*.log" -mtime +7 -delete
find /var/log -type f -size +100M -exec truncate -s 0 {} \;

# Temp cleanup
find /tmp -type f -atime +3 -delete

# Package cache
apt-get clean

echo "Cleanup complete"
df -h
```

### 2. Identify Space Hogs
```bash
# Find largest directories
du -h / 2>/dev/null | sort -h | tail -20

# Find largest files
find / -type f -size +100M -exec ls -lh {} \; 2>/dev/null
```

### 3. Emergency Space Recovery
```bash
# If critically low, stop non-essential services
docker stop nova-grafana
docker stop nova-prometheus

# Clean up
docker system prune -a -f --volumes

# Restart services
docker start nova-prometheus
docker start nova-grafana
```

## Prevention

### 1. Automated Cleanup
```bash
# Create cleanup cron job
cat > /etc/cron.daily/docker-cleanup << 'EOF'
#!/bin/bash
docker system prune -f --volumes
find /var/log -type f -name "*.log" -mtime +30 -delete
EOF

chmod +x /etc/cron.daily/docker-cleanup
```

### 2. Log Rotation
```bash
# Configure Docker log rotation
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

systemctl restart docker
```

### 3. Monitoring
```bash
# Add disk space monitoring
# Alert when < 20% free
# Warning when < 30% free
```

### 4. Capacity Planning
```bash
# Monitor growth trends
# Plan for disk expansion
# Consider moving data to separate volumes
```

## Disk Expansion (AWS)

### Expand EBS Volume
```bash
# Increase volume size
aws ec2 modify-volume --volume-id vol-xxx --size 100

# Wait for modification to complete
aws ec2 describe-volumes-modifications --volume-id vol-xxx

# Extend partition
sudo growpart /dev/xvda 1

# Resize filesystem
sudo resize2fs /dev/xvda1

# Verify
df -h
```

## Escalation

### When to Escalate
- Disk space < 5%
- Unable to free sufficient space
- Critical services failing
- Data loss risk

### Escalation Contacts
- **DevOps Team**: [Contact info]
- **Infrastructure Team**: [Contact info]
- **Database Administrator**: [Contact info]

## Post-Incident

### 1. Root Cause Analysis
- What filled the disk?
- Why wasn't it caught earlier?
- What can prevent recurrence?

### 2. Implement Fixes
- Set up automated cleanup
- Configure log rotation
- Implement data archival
- Plan capacity expansion

### 3. Improve Monitoring
- Lower alert threshold
- Add trend analysis
- Monitor growth rate
- Predict capacity needs

## Related Runbooks
- [PostgreSQL Down](./postgres-down.md)
- [Service Down](./service-down.md)
- [High Memory Usage](./high-memory.md)
