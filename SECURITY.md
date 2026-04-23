# Security Policy

Nova Rewards welcomes responsible disclosure of security vulnerabilities that could affect the platform, its smart contracts, backend services, APIs, or supporting infrastructure.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately and do not open a public GitHub issue for active security findings.

- Primary contact: `security@novarewards.example`
- Secondary contact: repository maintainers via private security advisory or direct maintainer outreach
- Preferred language: English

When reporting, include as much detail as possible:

- Affected component or repository path
- Vulnerability type and impact
- Reproduction steps or proof of concept
- Preconditions or required privileges
- Suggested mitigation, if known

We will acknowledge receipt within 72 hours and will keep the reporter informed during triage and remediation.

## Scope

### In scope

The following assets are eligible for responsible disclosure review:

- Smart contracts under `contracts/`
- Backend APIs and services under `backend/` and `novaRewards/backend/`
- Frontend application code under `src/`, `frontend/`, and `novaRewards/frontend/`
- Infrastructure as code under `infra/`, `terraform/`, `infrastructure/`, `k8s/`, and `helm/`
- Authentication, authorization, payout, and wallet-related flows
- Misconfiguration that exposes sensitive data or privileged actions

### Out of scope

The following are generally out of scope unless chained with a meaningful security impact:

- Best-practice suggestions without a demonstrated exploit path
- Missing HTTP headers on non-sensitive pages without exploitability
- Social engineering, phishing, or physical attacks
- Denial of service requiring unrealistic traffic volume or cost
- Spam, rate-limit bypass attempts without privilege impact
- Vulnerabilities only affecting outdated local development environments
- Issues in third-party services outside Nova Rewards control
- Publicly known vulnerabilities without a project-specific exploit path

## Severity and Reward Tiers

| Severity | Example impact | Reward range |
| --- | --- | --- |
| Critical | Theft of funds, contract takeover, admin compromise, remote code execution, auth bypass on privileged actions | $2,500 to $10,000 |
| High | Unauthorized payout manipulation, sensitive data exposure, permanent denial of critical service, major privilege escalation | $750 to $2,500 |
| Medium | User account impact, limited privilege escalation, significant business logic flaw, exploitable misconfiguration | $250 to $750 |
| Low | Minor information disclosure, low-impact misconfiguration, defense-in-depth issue with clear security relevance | $50 to $250 |

Final reward decisions depend on exploitability, impact, report quality, and whether the issue is novel and within scope.

## Disclosure Timeline

Nova Rewards follows a coordinated disclosure process with a target timeline of up to 90 days:

1. **Acknowledgement:** within 72 hours of receiving a report
2. **Triage:** initial severity and scope assessment within 7 days
3. **Remediation:** fix development and validation based on severity
4. **Coordinated disclosure:** public disclosure after the fix is available, or after 90 days, whichever is agreed with the reporter

If a vulnerability is being actively exploited, we may accelerate remediation and disclosure steps.

## Safe Harbor

If you act in good faith, avoid privacy violations and service disruption, and give us reasonable time to respond before public disclosure, Nova Rewards will treat your research as authorized.

Please do not:

- Access, modify, or delete data that does not belong to you
- Exfiltrate secrets, tokens, or private keys
- Disrupt production availability or degrade service for real users
- Use automated testing that creates excessive load

## Bug Bounty Program

Nova Rewards operates a public bug bounty program to reward security researchers who responsibly disclose vulnerabilities.

### Program Listings

| Platform | URL | Status |
| --- | --- | --- |
| Immunefi | https://immunefi.com/bug-bounty/nova-rewards | Active |
| HackerOne | https://hackerone.com/nova-rewards | Active |

Submissions made through either platform are triaged under the same policy and reward tiers defined in this document. Direct email reports to `security@novarewards.example` are also accepted and treated equivalently.

### Eligibility

- You must be the first to report the vulnerability.
- The vulnerability must be reproducible and within scope.
- You must not have exploited the vulnerability beyond what is necessary to demonstrate impact.
- Employees, contractors, and immediate family members of Nova Rewards are not eligible.

### Reward Payment

Rewards are paid in USDC or NOVA tokens at the reporter's preference, within 30 days of patch release. Reward amounts are determined at Nova Rewards' sole discretion based on severity, exploitability, and report quality.
