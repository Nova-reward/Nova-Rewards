# Nova Rewards — Threat Model

**Version:** 1.0  
**Last Updated:** 2026-03-30  
**Status:** Active

---

## Overview

This document identifies threats to the Nova Rewards platform across its three layers: Soroban smart contracts on Stellar, the Node.js backend API, and the Next.js frontend. It follows the STRIDE methodology and maps threats to mitigations.

---

## System Components & Trust Boundaries

```
[User Browser] ──HTTPS──> [Next.js Frontend / Vercel]
                                    │
                               [REST API]
                                    │
                          [Node.js Backend / AWS]
                           │              │
                    [PostgreSQL DB]   [Stellar Network]
                                           │
                                  [Soroban Contracts]
                                  - nova_token
                                  - reward_pool
                                  - vesting
                                  - referral
                                  - admin_roles
```

Trust boundaries:
- **TB-1:** Public internet → Frontend
- **TB-2:** Frontend → Backend API
- **TB-3:** Backend → Database
- **TB-4:** Backend → Stellar/Soroban

---

## Threat Actors

| Actor | Motivation | Capability |
|-------|-----------|------------|
| External attacker | Financial gain, disruption | Medium–High |
| Malicious merchant | Fraudulent reward issuance | Low–Medium |
| Compromised user account | Token theft | Low |
| Insider threat | Data exfiltration, sabotage | Medium |
| Automated bot | Reward farming, referral abuse | Medium |

---

## STRIDE Threat Analysis

### Smart Contracts (Soroban)

| ID | Threat | STRIDE | Impact | Likelihood | Mitigation |
|----|--------|--------|--------|------------|------------|
| SC-01 | Unauthorized token minting via admin_roles bypass | Elevation of Privilege | Critical | Low | Role-based access control enforced on-chain; multi-sig admin keys |
| SC-02 | Reentrancy attack on reward_pool withdrawal | Tampering | Critical | Low | Soroban's execution model prevents reentrancy; checks-effects-interactions pattern |
| SC-03 | Integer overflow in token arithmetic | Tampering | High | Low | Rust's overflow checks; use of checked arithmetic |
| SC-04 | Vesting schedule manipulation | Tampering | High | Low | Immutable schedule set at contract init; only admin can modify with multi-sig |
| SC-05 | Referral self-referral / circular referral abuse | Tampering | Medium | Medium | On-chain validation rejects self-referral and cycles |
| SC-06 | Contract upgrade introducing malicious logic | Tampering | Critical | Low | Upgrade requires multi-sig; time-lock delay before activation |
| SC-07 | Front-running reward claims | Information Disclosure | Medium | Low | Stellar's deterministic ordering reduces front-running risk |

### Backend API

| ID | Threat | STRIDE | Impact | Likelihood | Mitigation |
|----|--------|--------|--------|------------|------------|
| API-01 | JWT token forgery / replay | Spoofing | High | Low | Short-lived JWTs; token rotation; revocation list |
| API-02 | SQL injection via campaign/user inputs | Tampering | High | Low | Parameterized queries; ORM usage |
| API-03 | Mass assignment on user/merchant objects | Tampering | Medium | Medium | Strict DTO validation (whitelist fields) |
| API-04 | Reward endpoint abuse (double-spend) | Tampering | High | Medium | Idempotency keys; DB-level unique constraints |
| API-05 | Webhook payload spoofing | Spoofing | High | Medium | HMAC signature verification on all inbound webhooks |
| API-06 | Sensitive data exposure in API responses | Information Disclosure | Medium | Medium | Response filtering; no PII in logs |
| API-07 | Brute-force on auth endpoints | Denial of Service | Medium | High | Rate limiting (per IP + per account); account lockout |
| API-08 | SSRF via merchant-supplied URLs | Tampering | High | Low | URL allowlist; block internal IP ranges |
| API-09 | Privilege escalation (user → merchant → admin) | Elevation of Privilege | High | Low | Role checks on every protected route; least-privilege DB roles |

### Frontend

| ID | Threat | STRIDE | Impact | Likelihood | Mitigation |
|----|--------|--------|--------|------------|------------|
| FE-01 | XSS via user-supplied content | Tampering | High | Medium | React's default escaping; strict CSP header |
| FE-02 | Wallet private key exposure | Information Disclosure | Critical | Low | Keys never leave the browser; Freighter wallet handles signing |
| FE-03 | Clickjacking on transaction approval UI | Tampering | Medium | Low | `X-Frame-Options: DENY`; CSP `frame-ancestors 'none'` |
| FE-04 | Malicious redirect after wallet connect | Spoofing | Medium | Low | Validate redirect URLs against allowlist |
| FE-05 | Supply chain attack via npm dependency | Tampering | High | Low | Dependency pinning; `npm audit` in CI; Dependabot alerts |

### Infrastructure

| ID | Threat | STRIDE | Impact | Likelihood | Mitigation |
|----|--------|--------|--------|------------|------------|
| INF-01 | Exposed secrets in environment variables / repo | Information Disclosure | Critical | Medium | Secrets in AWS Secrets Manager / Vault; `.gitignore` enforced |
| INF-02 | Unpatched OS / container vulnerabilities | Tampering | High | Medium | Automated patching; container image scanning in CI |
| INF-03 | Database credential compromise | Information Disclosure | High | Low | Rotated credentials; DB not publicly accessible; VPC isolation |
| INF-04 | DDoS against API or frontend | Denial of Service | High | Medium | Cloudflare WAF + rate limiting; AWS ALB with auto-scaling |
| INF-05 | Unauthorized AWS console access | Elevation of Privilege | Critical | Low | MFA enforced; least-privilege IAM; CloudTrail logging |

---

## Risk Matrix

```
         Likelihood
         Low    Medium   High
Impact
Critical  SC-01  INF-01   —
          SC-06
          FE-02
High      SC-03  API-03   API-07
          API-01 API-04
          API-08 FE-05
          API-09 INF-02
Medium    SC-04  API-06   —
          FE-03  FE-01
          INF-03
Low       SC-07  SC-05    —
```

---

## Assumptions & Out of Scope

**Assumptions:**
- Stellar network itself is trusted and operates correctly
- Freighter wallet is a trusted signing environment
- AWS infrastructure is configured per the Terraform definitions in `/terraform`

**Out of scope:**
- Physical security of developer workstations
- Stellar validator-level attacks
- Social engineering of end users

---

*Reviewed by: Security Team*  
*Next review due: 2026-09-30*
