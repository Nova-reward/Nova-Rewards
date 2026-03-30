# Nova Rewards — Incident Response Plan

**Version:** 1.0  
**Last Updated:** 2026-03-30  
**Status:** Active

---

## Purpose

This plan defines how the Nova Rewards team detects, responds to, and recovers from security incidents. Given the on-chain nature of the platform, some incidents (e.g., token theft) may be irreversible, making rapid detection and containment the top priority.

---

## Severity Classification

| Severity | Definition | Response SLA |
|----------|-----------|--------------|
| P0 — Critical | Active exploit, funds at risk, contract compromised, data breach in progress | Immediate (< 15 min) |
| P1 — High | Confirmed vulnerability being exploited, service down, credentials compromised | < 1 hour |
| P2 — Medium | Suspected attack, anomalous behavior, non-critical data exposure | < 4 hours |
| P3 — Low | Policy violation, minor misconfiguration, failed attack attempt | < 24 hours |

---

## Roles & Responsibilities

| Role | Responsibility |
|------|---------------|
| Incident Commander (IC) | Coordinates response, makes escalation decisions, owns communication |
| Security Lead | Technical investigation, containment actions |
| Backend Engineer | API/DB investigation and remediation |
| Smart Contract Engineer | On-chain analysis, contract pause/upgrade if needed |
| DevOps Engineer | Infrastructure isolation, log retrieval, service restoration |
| Communications Lead | User/merchant notifications, public statements |

The on-call engineer who detects the incident assumes IC until a senior team member takes over.

---

## Incident Response Phases

### Phase 1 — Detection & Triage (0–15 min for P0/P1)

**Detection sources:**
- Prometheus/Grafana alerts (see `/infrastructure/logging/alert_rules.yml`)
- Cloudflare WAF anomaly alerts
- AWS CloudTrail unusual activity
- Stellar network monitoring (unusual token flows)
- User/merchant reports
- Bug bounty submissions

**Triage steps:**
1. Confirm the incident is real (not a false positive)
2. Assign severity (P0–P3)
3. Page the Incident Commander
4. Open an incident channel (`#incident-YYYY-MM-DD`)
5. Start an incident log (timestamp every action)

---

### Phase 2 — Containment

Act fast to limit damage. Choose the appropriate containment action:

**Smart contract incidents:**
```
# Pause the affected contract (requires admin multi-sig)
stellar contract invoke --id <CONTRACT_ID> -- pause

# Revoke compromised admin key
stellar contract invoke --id <admin_roles_CONTRACT_ID> -- revoke_admin --address <COMPROMISED_KEY>
```

**API / backend incidents:**
```bash
# Block a specific IP at the load balancer
aws wafv2 update-ip-set --name BlockedIPs --scope REGIONAL --id <ID> \
  --addresses <ATTACKER_IP>/32 --lock-token <TOKEN>

# Rotate JWT signing secret (forces all sessions to re-authenticate)
# Update JWT_SECRET in AWS Secrets Manager, then restart backend
aws secretsmanager put-secret-value --secret-id nova/jwt-secret --secret-string "<NEW_SECRET>"

# Scale down to zero if full API shutdown needed
aws autoscaling set-desired-capacity --auto-scaling-group-name nova-backend-asg --desired-capacity 0
```

**Database incidents:**
```bash
# Revoke compromised DB credentials immediately
psql -c "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM <COMPROMISED_ROLE>;"
psql -c "ALTER ROLE <COMPROMISED_ROLE> NOLOGIN;"
```

**Infrastructure incidents:**
```bash
# Isolate a compromised EC2 instance
aws ec2 modify-instance-attribute --instance-id <ID> --groups <QUARANTINE_SG_ID>
```

---

### Phase 3 — Investigation

1. **Preserve evidence** — snapshot DB, export logs before any remediation that could overwrite them
2. **Establish timeline** — when did the incident start? What was the attack vector?
3. **Determine scope** — which users/merchants/contracts are affected?
4. **Identify root cause** — which vulnerability was exploited?

Key log sources:
- Application logs: Loki (`/infrastructure/logging/loki-config.yml`)
- Infrastructure logs: AWS CloudTrail, VPC Flow Logs
- On-chain: Stellar Horizon API transaction history
- Access logs: Nginx (`/deployment/nginx/nginx.conf`)

---

### Phase 4 — Eradication & Recovery

1. Patch the vulnerability (code fix, config change, or contract upgrade)
2. For contract upgrades: deploy fix → test on testnet → multi-sig approval → deploy to mainnet
3. Rotate all potentially compromised credentials
4. Restore service from last known-good state if needed
5. Re-enable paused contracts only after fix is verified
6. Gradually restore traffic (canary → 10% → 50% → 100%)

---

### Phase 5 — Communication

**Internal:** Keep `#incident-YYYY-MM-DD` updated with every action taken.

**User/merchant notification** (P0/P1 — within 2 hours of confirmation):
- What happened (without disclosing exploit details)
- What data or funds may be affected
- What actions users should take (e.g., disconnect wallet, change password)
- What Nova Rewards is doing to fix it

**Public status page:** Update status.novarewards.io for any service degradation.

**Regulatory:** If personal data is breached, notify relevant authorities within 72 hours per applicable data protection law.

---

### Phase 6 — Post-Incident Review

Within 5 business days of resolution:

1. Write a post-mortem (blameless)
2. Document: timeline, root cause, impact, what worked, what didn't
3. Create action items with owners and due dates
4. Update threat model if a new threat class was discovered
5. Add detection rule if the attack would have been caught earlier with better monitoring
6. Store post-mortem in `/docs/security/post-mortems/YYYY-MM-DD-<title>.md`

---

## Specific Playbooks

### Playbook: Smart Contract Exploit

1. Pause affected contract immediately
2. Alert Stellar community / Soroban security channels if exploit is novel
3. Assess on-chain damage (token amounts, affected addresses)
4. Determine if contract upgrade can fix or if redeployment is needed
5. Communicate with affected users about compensation/recovery plan
6. Do not unpause until independent review confirms fix

### Playbook: API Key / Secret Compromise

1. Immediately rotate the compromised secret in AWS Secrets Manager
2. Audit access logs for the period the key was valid
3. Identify all actions taken with the compromised key
4. Notify affected parties if their data was accessed
5. Review how the key was exposed (logs, repo, env file)

### Playbook: Database Breach

1. Revoke compromised credentials
2. Snapshot DB for forensics
3. Identify which tables/rows were accessed
4. Assess PII exposure (users table, merchant data)
5. Initiate regulatory notification process if PII was accessed
6. Force password resets for affected users

### Playbook: Referral / Reward Fraud

1. Identify fraudulent accounts via anomaly detection
2. Freeze affected accounts pending investigation
3. Reverse fraudulent on-chain transactions if possible (contact Stellar if needed)
4. Adjust smart contract validation logic to prevent recurrence
5. Update fraud detection rules

---

## Contact & Escalation

| Escalation Level | Contact |
|-----------------|---------|
| On-call engineer | PagerDuty rotation |
| Security Lead | Direct message + phone |
| CTO | Phone (P0 only) |
| Legal / Compliance | Email (data breach only) |
| Stellar Foundation | security@stellar.org (contract-level issues) |
| Bug bounty reporter | Acknowledge within 24h, update within 7 days |

---

*Reviewed by: Security Team*  
*Next review due: 2026-09-30*
