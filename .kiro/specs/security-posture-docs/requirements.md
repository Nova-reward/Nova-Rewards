# Requirements Document

## Introduction

The Nova Rewards platform requires a set of public-facing security documents to build trust with merchants, users, and enterprise partners. While internal security documentation already exists (threat model, incident response plan, internal best practices), the platform currently lacks the outward-facing artifacts that enterprise integrators and security-conscious merchants expect before adopting a platform: a responsible disclosure policy, published audit findings, a merchant-facing security guide, and a transparent account of known limitations.

This feature covers the creation of four missing documents:

1. **`SECURITY.md`** — repo-root responsible disclosure policy and security contact
2. **`docs/audits/findings-summary.md`** — public-facing audit status and findings summary
3. **`docs/security/merchant-security-guide.md`** — security best practices for merchants integrating the Nova Rewards API
4. **`docs/security/known-limitations.md`** — transparent disclosure of known limitations and their mitigations

All documents must be reviewed and approved by the lead security engineer before being considered complete.

---

## Glossary

- **Nova_Rewards_Platform**: The full Nova Rewards system, comprising Soroban smart contracts on Stellar, the Node.js backend API, and the Next.js frontend.
- **SECURITY_md**: The `SECURITY.md` file at the repository root, serving as the canonical responsible disclosure policy.
- **Merchant**: A business or developer integrating the Nova Rewards API to issue or manage rewards for their customers.
- **Integrator**: Any external party (merchant, partner, or developer) consuming the Nova Rewards API or SDK.
- **Responsible_Disclosure_Policy**: The documented process by which external security researchers report vulnerabilities to the Nova Rewards team.
- **Audit_Report**: A formal document produced by an independent third-party security firm assessing a smart contract for vulnerabilities.
- **Findings_Summary**: A human-readable summary of audit scope, status, and findings published in `docs/audits/findings-summary.md`.
- **Merchant_Security_Guide**: The document at `docs/security/merchant-security-guide.md` providing security guidance for merchants.
- **Known_Limitations_Document**: The document at `docs/security/known-limitations.md` disclosing platform limitations and mitigations.
- **Security_Lead**: The designated lead security engineer responsible for reviewing and approving security documentation.
- **API_Key**: A credential issued to a merchant to authenticate requests to the Nova Rewards API.
- **Webhook_Secret**: An HMAC signing key used to verify the authenticity of webhook payloads delivered to a merchant's endpoint.
- **CVE**: Common Vulnerabilities and Exposures — a public identifier for a known security vulnerability.
- **PGP**: Pretty Good Privacy — an encryption standard used to secure sensitive communications such as vulnerability reports.

---

## Requirements

### Requirement 1: Responsible Disclosure Policy (SECURITY.md)

**User Story:** As a security researcher, I want a clear responsible disclosure policy at the repository root, so that I know how to report vulnerabilities to the Nova Rewards team safely and what to expect in return.

#### Acceptance Criteria

1. THE Nova_Rewards_Platform SHALL provide a `SECURITY.md` file at the repository root.
2. THE SECURITY_md SHALL specify the security contact email address for receiving vulnerability reports.
3. THE SECURITY_md SHALL specify a PGP public key or a link to one, enabling researchers to submit encrypted reports.
4. THE SECURITY_md SHALL define the response timeline: acknowledgement within 24 hours of receipt and a status update within 7 calendar days.
5. THE SECURITY_md SHALL define the disclosure timeline: a coordinated disclosure window of 90 days from acknowledgement before public disclosure.
6. THE SECURITY_md SHALL specify the scope of the bug bounty program, listing which components (smart contracts, backend API, frontend) are in scope and which are out of scope.
7. THE SECURITY_md SHALL specify the severity-based reward scale, referencing the severity classifications defined in the threat model (P0–P3).
8. THE SECURITY_md SHALL state that the Nova Rewards team commits to not pursuing legal action against researchers who follow the responsible disclosure policy.
9. WHEN a researcher submits a report, THE SECURITY_md SHALL instruct the researcher to include a proof-of-concept, affected component, and reproduction steps.
10. THE SECURITY_md SHALL link to the internal `docs/security/` directory for additional security context available to the public.

---

### Requirement 2: Audit Findings Summary

**User Story:** As a merchant evaluating Nova Rewards for enterprise adoption, I want to see the status and findings of smart contract audits, so that I can assess the security maturity of the platform before integrating.

#### Acceptance Criteria

1. THE Nova_Rewards_Platform SHALL provide a `docs/audits/findings-summary.md` file.
2. THE Findings_Summary SHALL include a table listing every smart contract, its version, the assigned auditor (or "Scheduled" if not yet assigned), the audit status (`Scheduled`, `In Progress`, or `Complete`), and the scheduled or completed date.
3. WHEN an audit is complete, THE Findings_Summary SHALL include a findings breakdown by severity (Critical, High, Medium, Low, Informational) for that contract.
4. WHEN an audit is complete, THE Findings_Summary SHALL include the remediation status for each finding (Open, Fixed, Accepted Risk).
5. WHEN an audit is complete and a PDF report exists, THE Findings_Summary SHALL link to the report in `docs/audits/reports/`.
6. WHILE audits are scheduled but not yet started, THE Findings_Summary SHALL state that all contracts are pre-production and audits are scheduled prior to mainnet deployment.
7. THE Findings_Summary SHALL include a section describing the audit process: how auditors are selected, what the scope covers, and how findings are remediated.
8. THE Findings_Summary SHALL be updated within 5 business days of an audit completing or a finding's remediation status changing.

---

### Requirement 3: Merchant Security Best Practices Guide

**User Story:** As a merchant integrating the Nova Rewards API, I want a dedicated security guide, so that I can configure my integration securely and protect my customers' data and my own credentials.

#### Acceptance Criteria

1. THE Nova_Rewards_Platform SHALL provide a `docs/security/merchant-security-guide.md` file.
2. THE Merchant_Security_Guide SHALL include a section on API key handling, covering: secure storage (environment variables or secrets managers, never in source code), rotation procedures, and the principle of least privilege when scoping keys.
3. THE Merchant_Security_Guide SHALL include a section on webhook security, covering: HMAC-SHA256 signature verification using the `Webhook_Secret`, replay attack prevention using the `X-Nova-Timestamp` header, and the requirement to reject payloads older than 5 minutes.
4. THE Merchant_Security_Guide SHALL include a section on HTTPS requirements, stating that all API calls MUST use TLS 1.2 or higher and that HTTP requests will be rejected.
5. THE Merchant_Security_Guide SHALL include a section on idempotency, explaining the use of idempotency keys on reward issuance endpoints to prevent duplicate reward grants.
6. THE Merchant_Security_Guide SHALL include a section on rate limits, listing the per-endpoint rate limits (authentication: 5 req/min, reward claims: 10 req/min, general API: 100 req/min per IP) and the expected HTTP 429 response when limits are exceeded.
7. THE Merchant_Security_Guide SHALL include a section on error handling, instructing merchants to log API errors without including full request payloads that may contain PII, and to treat 401 responses as a signal to rotate credentials.
8. THE Merchant_Security_Guide SHALL include a section on dependency security, recommending that merchants using the Nova Rewards SDK pin the SDK version and review the changelog before upgrading.
9. WHEN a merchant's API key is suspected to be compromised, THE Merchant_Security_Guide SHALL provide step-by-step instructions for revoking the key and issuing a replacement via the merchant dashboard.
10. THE Merchant_Security_Guide SHALL include a reference to the `SECURITY.md` responsible disclosure policy for reporting vulnerabilities discovered during integration.

---

### Requirement 4: Known Limitations and Mitigations

**User Story:** As an enterprise merchant or security auditor, I want a transparent account of the platform's known limitations, so that I can make an informed risk assessment and implement appropriate compensating controls.

#### Acceptance Criteria

1. THE Nova_Rewards_Platform SHALL provide a `docs/security/known-limitations.md` file.
2. THE Known_Limitations_Document SHALL document the email search limitation: because user emails are encrypted with AES-256-GCM using a random IV, wildcard or ILIKE searches on encrypted email fields are not possible, and the mitigation (encrypt the search term before lookup) SHALL be described.
3. THE Known_Limitations_Document SHALL document the audit status limitation: all smart contracts are pre-production and have not yet been audited by an independent third party, and the mitigation (scheduled audits prior to mainnet deployment) SHALL be described.
4. THE Known_Limitations_Document SHALL document the on-chain irreversibility limitation: token transfers on Stellar are irreversible once confirmed, and the mitigation (idempotency keys, pre-issuance validation, and the referral fraud playbook) SHALL be described.
5. THE Known_Limitations_Document SHALL document the Freighter wallet dependency: the frontend relies on the Freighter browser extension for transaction signing, and the mitigation (clear user-facing messaging when Freighter is not installed) SHALL be described.
6. THE Known_Limitations_Document SHALL document the rate limiting scope: current rate limits apply per IP address and do not account for distributed attacks from multiple IPs, and the mitigation (Cloudflare WAF rules for volumetric attacks) SHALL be described.
7. THE Known_Limitations_Document SHALL document the key rotation window: during AES-256-GCM key rotation, both the old and new keys are simultaneously active, and the mitigation (the two-phase rotation procedure in `docs/security/encryption.md`) SHALL be described.
8. WHEN a new known limitation is identified, THE Known_Limitations_Document SHALL be updated within 10 business days of identification and approval by the Security_Lead.
9. THE Known_Limitations_Document SHALL include a severity classification for each limitation (using the P0–P3 scale from the threat model) and the current remediation status (Mitigated, Accepted Risk, In Progress).

---

### Requirement 5: Security Documentation Review and Approval

**User Story:** As the lead security engineer, I want a formal review gate before any security documentation is published, so that inaccurate or incomplete information does not reach merchants and create false confidence.

#### Acceptance Criteria

1. THE Nova_Rewards_Platform SHALL require Security_Lead approval before any of the four security documents (SECURITY_md, Findings_Summary, Merchant_Security_Guide, Known_Limitations_Document) is merged to the main branch.
2. THE Nova_Rewards_Platform SHALL record the reviewer's name, approval date, and document version in a review log section within each document.
3. WHEN a security document is updated after initial approval, THE Nova_Rewards_Platform SHALL require a new Security_Lead review before the update is merged.
4. THE Nova_Rewards_Platform SHALL link all four new documents from the existing `docs/security/README.md` index so that they are discoverable from the security documentation hub.
5. THE Nova_Rewards_Platform SHALL link the `SECURITY.md` from the repository's `README.md` so that it is visible to anyone visiting the repository.
