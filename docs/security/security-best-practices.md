# Nova Rewards — Security Best Practices

**Version:** 1.0  
**Last Updated:** 2026-03-30

---

## Smart Contracts (Soroban / Rust)

**Access control**
- All privileged functions must check caller against `admin_roles` contract before executing
- Use multi-signature for any admin action that moves funds or modifies contract state
- Apply a time-lock (minimum 48h) on contract upgrades to allow community review

**Arithmetic**
- Always use Rust's checked arithmetic (`checked_add`, `checked_mul`, etc.) for token amounts
- Never cast between integer types without explicit bounds checking

**State management**
- Follow checks-effects-interactions: validate inputs → update state → make external calls
- Avoid storing unbounded data in contract storage (use pagination or off-chain indexing)
- Emit events for every state-changing operation to support auditability

**Testing**
- Maintain ≥ 80% test coverage on all contract logic
- Include fuzz tests for arithmetic-heavy functions
- Test all access control paths (both authorized and unauthorized callers)
- Run tests against Stellar testnet before any mainnet deployment

**Deployment**
- Never deploy directly to mainnet from a developer machine; use CI/CD pipeline with multi-sig approval
- Keep contract WASM artifacts in version control with checksums
- Document every deployed contract address and version in `/docs/security/contract-registry.md`

---

## Backend API (Node.js)

**Authentication & authorization**
- JWTs must be short-lived (≤ 15 minutes access token, ≤ 7 days refresh token)
- Validate JWT signature and expiry on every protected request
- Enforce role checks at the route level, not just in middleware (defense in depth)
- Never trust user-supplied role or ID fields in request bodies

**Input validation**
- Validate and sanitize all inputs using a schema library (e.g., Zod, Joi) at the DTO layer
- Use parameterized queries for all database operations — no string concatenation in SQL
- Reject requests with unexpected fields (strict mode on DTOs)

**Secrets management**
- All secrets (DB passwords, JWT keys, Stellar signing keys) must live in AWS Secrets Manager or Vault
- Never hardcode secrets or commit them to the repository
- Rotate secrets on a schedule (quarterly minimum) and immediately after any suspected compromise
- Use separate secrets per environment (dev / staging / production)

**Rate limiting & abuse prevention**
- Apply rate limits on all public endpoints: authentication (5 req/min), reward claims (10 req/min), general API (100 req/min per IP)
- Use idempotency keys on reward issuance endpoints to prevent double-spend
- Log and alert on repeated 401/403 responses from the same IP

**Logging**
- Log all authentication events (success and failure), privilege escalations, and reward transactions
- Never log passwords, tokens, private keys, or full card/wallet numbers
- Ensure logs are shipped to a tamper-evident store (Loki + S3 archival)

**Dependencies**
- Run `npm audit` in CI and fail the build on high/critical vulnerabilities
- Pin dependency versions; review Dependabot PRs within 7 days
- Minimize the dependency surface — prefer well-maintained, widely-used packages

---

## Frontend (Next.js)

**Wallet & key handling**
- Private keys must never leave the user's browser; all signing is delegated to Freighter
- Never request or store wallet seed phrases
- Display transaction details clearly before requesting wallet signature

**Content security**
- Set a strict Content Security Policy (CSP) header — restrict `script-src` to self and known CDNs
- Set `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`
- Use `Referrer-Policy: strict-origin-when-cross-origin`

**Data handling**
- Never store sensitive data (tokens, wallet addresses beyond display) in `localStorage` — use `sessionStorage` or in-memory state
- Sanitize any user-generated content before rendering, even though React escapes by default

**API communication**
- All API calls must go over HTTPS; reject HTTP
- Validate API responses before rendering — don't assume shape
- Handle 401 responses by clearing session and redirecting to login (see `/kiro/specs/api-401-interceptor`)

---

## Infrastructure

**Network**
- Backend and database must not be publicly accessible; place behind VPC with security groups
- Only the ALB should accept inbound traffic on ports 80/443
- Use Cloudflare WAF in front of all public endpoints

**Secrets & credentials**
- Enforce MFA on all AWS IAM users and the root account
- Use IAM roles (not long-lived access keys) for EC2 and Lambda workloads
- Audit IAM permissions quarterly; remove unused roles and policies

**Patching**
- Apply OS security patches within 7 days of release for critical/high CVEs
- Rebuild container images weekly to pick up base image updates
- Scan container images in CI using a tool like Trivy or Snyk

**Backups**
- Database: automated daily snapshots with 30-day retention; test restore monthly
- Contract state is on-chain and immutable, but keep deployment artifacts and ABIs in version control
- Store backups in a separate AWS account or region

**Monitoring & alerting**
- Alert on: failed login spikes, unusual token transfer volumes, contract errors, API error rate > 1%, DB connection failures
- Review CloudTrail logs weekly for unexpected API calls
- Set up billing alerts to detect unexpected AWS cost spikes (potential crypto-mining abuse)

---

## Development Workflow

**Code review**
- All changes require at least one peer review before merge
- Security-sensitive changes (auth, contracts, secrets handling) require review by the Security Lead
- No direct pushes to `main` or `production` branches

**Secrets in development**
- Use `.env.example` files with placeholder values; never commit `.env` files
- Use separate Stellar testnet accounts for local development
- Rotate any secret that was accidentally committed immediately, even if the commit is reverted

**CI/CD**
- Run `npm audit`, linting, and tests on every PR
- Contract builds must be reproducible (same WASM output for same source)
- Production deployments require manual approval in the pipeline

**Bug bounty**
- Maintain a responsible disclosure policy (see `SECURITY.md` in repo root)
- Acknowledge reports within 24 hours
- Reward valid findings according to the severity scale in the threat model

---

## Compliance Checklist (Pre-Launch)

- [ ] Smart contracts audited by independent third party
- [ ] Penetration test completed on backend API
- [ ] All P0/P1 audit findings remediated and verified
- [ ] Secrets rotation procedure documented and tested
- [ ] Incident response plan reviewed by full team
- [ ] Monitoring and alerting verified end-to-end
- [ ] Bug bounty program live
- [ ] SECURITY.md published in repository root

---

*Reviewed by: Security Team*  
*Next review due: 2026-09-30*
