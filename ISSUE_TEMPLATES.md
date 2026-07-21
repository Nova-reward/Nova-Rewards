# Issue Templates & Examples

Ready-to-use templates for creating consistent, high-quality GitHub issues.

---

## Quick Reference: Label Combinations

### Frontend Bug Fix
```
type/bug
area/frontend
P1-High
status/ready
```

### Backend Feature
```
type/feature
area/backend
P1-High
status/backlog
```

### Security Issue
```
type/bug
area/security
P0-Critical
status/ready
```

### Documentation
```
type/docs
P2-Medium
status/backlog
```

---

## Template 1: Bug Report

```markdown
**Title:** [Bug] Modal doesn't appear on mobile devices

---

## Description
The JWT token expiry warning modal is not displaying on mobile devices (iOS/Android), though it works correctly on desktop.

## Steps to Reproduce
1. Open app on iPhone Safari
2. Login with valid credentials
3. Wait 13 minutes
4. Expected modal appears on desktop, but not on mobile

## Expected Behavior
The modal should appear 2 minutes before token expiry on all devices, including mobile.

## Actual Behavior
Modal does not appear on mobile devices. Token expires silently at 15 minutes.

## Environment
- **Browser:** Safari on iOS 17.2
- **Device:** iPhone 14
- **Version:** v1.2.3
- **Backend:** Production

## Screenshots
[Attach screenshots showing the issue]

## Logs
```
No errors in console
```

## Impact
Users on mobile devices don't get warning before token expires, causing sudden logout.

## Related Issues
- Related to #456 (JWT token expiry feature)
- Depends on #789 (Responsive modal improvements)

## Possible Solutions
- Check media queries in TokenExpiryWarning component
- Verify touch events are detected on mobile
- Test viewport settings

**Labels:** `type/bug` `area/frontend` `P1-High` `status/ready`
**Assignee:** @frontend-dev
```

---

## Template 2: Feature Request

```markdown
**Title:** [Feature] Add user session activity log

---

## Description
Users should be able to view a log of their login sessions and activities for security purposes. This helps them identify unauthorized access attempts.

## Motivation
- Improves security awareness
- Helps users detect compromised accounts
- Builds trust in the platform
- Standard feature in modern apps

## Acceptance Criteria
- [ ] Create activity log database schema
- [ ] Implement session activity tracking
- [ ] Build activity log UI page
- [ ] Display login time, IP, device, browser
- [ ] Show logout time and session duration
- [ ] Add ability to revoke active sessions
- [ ] Write tests for activity tracking
- [ ] Update user documentation

## Design Mockups
[Link to design mockups or attach screenshots]

## Technical Considerations
- Use existing audit logging infrastructure
- Store sessions in database with TTL
- Implement pagination for large logs
- Add search/filter capabilities

## Acceptance Criteria Validation
- [ ] Can view last 30 days of activity
- [ ] Sessions update in real-time
- [ ] Can revoke active sessions
- [ ] Performance acceptable with 1000+ sessions

## Related Issues
- Related to #123 (Auth improvements)
- Similar to #456 (Security audit trail)

## Effort Estimate
8 story points

**Labels:** `type/feature` `area/backend` `area/frontend` `P1-High` `status/backlog`
**Milestone:** Sprint 14
```

---

## Template 3: Infrastructure / DevOps

```markdown
**Title:** [Infrastructure] Setup staging environment for new payment provider

---

## Description
We need to setup a staging environment to test integration with the new payment provider (Stripe) before going live.

## Scope
- Provision new EC2 instance for staging
- Configure environment variables
- Setup database (staging replica)
- Configure SSL certificate
- Setup monitoring and logging
- Document access procedures

## Acceptance Criteria
- [ ] Staging server running and accessible
- [ ] Environment variables configured
- [ ] Database synced from production (anonymized)
- [ ] SSL certificate installed and valid
- [ ] Monitoring dashboards setup
- [ ] Team members have access documentation
- [ ] Automated backup configured
- [ ] DR tested

## Technical Details
- Instance type: t3.large
- OS: Ubuntu 22.04 LTS
- Database: PostgreSQL 15
- Monitoring: CloudWatch
- Backups: Daily snapshots

## Related Issues
- Depends on #789 (Stripe integration code)
- Related to #456 (API authentication)

## Timeline
Expected by: Friday, February 9

**Labels:** `type/infrastructure` `P1-High` `status/ready`
**Assignee:** @devops-engineer
**Milestone:** Sprint 12
```

---

## Template 4: Performance Improvement

```markdown
**Title:** [Improvement] Reduce homepage load time from 3.2s to <2s

---

## Description
Current homepage load time is 3.2 seconds. Target is <2 seconds for better user experience and SEO ranking.

## Current Performance
- First Contentful Paint (FCP): 1.8s ✓
- Largest Contentful Paint (LCP): 2.8s ✗
- Cumulative Layout Shift (CLS): 0.05 ✓
- Total Blocking Time (TBT): 0.2s ✓

## Acceptance Criteria
- [ ] LCP < 2s on Lighthouse
- [ ] Bundle size reduced by 15%
- [ ] Images optimized and lazy-loaded
- [ ] Unused CSS removed
- [ ] Fonts optimized
- [ ] API calls parallelized
- [ ] Performance monitoring added

## Investigation Notes
- Homepage loads all products immediately (10k+ items)
- Unoptimized images taking 1.2MB
- Font files not optimized (450KB)
- API calls sequential instead of parallel

## Proposed Solutions
1. Implement product pagination (show 24 initially)
2. Optimize images with WebP and compression
3. Use system fonts or optimize font loading
4. Parallelize API requests
5. Enable gzip compression

## Estimated Effort
5 story points

## Related Issues
- Related to #234 (SEO improvements)
- Depends on #567 (API optimization)

**Labels:** `type/improvement` `area/frontend` `P2-Medium` `status/ready`
**Assignee:** @performance-dev
```

---

## Template 5: Documentation

```markdown
**Title:** [Docs] Document API authentication and token refresh flow

---

## Description
The API authentication process and token refresh flow need to be documented for developers integrating with our API. Currently, there's no clear guide.

## Scope
- Document JWT token structure
- Explain token refresh flow
- Document error codes and handling
- Provide code examples (cURL, Python, JavaScript)
- Document rate limits and best practices

## Acceptance Criteria
- [ ] JWT payload documented
- [ ] Token refresh process explained
- [ ] Error handling documented
- [ ] Code examples provided (3 languages)
- [ ] Security best practices included
- [ ] Documentation added to /docs folder
- [ ] Added to README and API docs

## Outline
1. Authentication Overview
2. Obtaining Tokens
3. Using Tokens (Bearer header)
4. Token Refresh Process
5. Handling Expiry and Errors
6. Best Practices
7. Troubleshooting
8. Code Examples

## Reference Materials
- JWT Standard: https://tools.ietf.org/html/rfc7519
- Existing code: `/api/auth` endpoints
- Issue #456: JWT token expiry feature

## Related Issues
- Related to #456 (JWT expiry implementation)
- Related to #789 (API documentation)

**Labels:** `type/docs` `P2-Medium` `status/ready`
**Assignee:** @tech-writer
```

---

## Template 6: Spike / Investigation

```markdown
**Title:** [Research] Evaluate authentication libraries for improved security

---

## Description
Before implementing the next phase of authentication improvements, we should research and compare different authentication libraries to ensure we're using best practices.

## Objective
Evaluate 3-4 authentication libraries and provide recommendations for our tech stack (Node.js/Next.js).

## Scope
- Compare Passport.js, Supertokens, Auth0, Ory
- Evaluate features: MFA, OAuth, SAML, passwordless
- Assess security practices and vulnerabilities
- Check community support and maintenance
- Estimate integration effort
- Create comparison matrix

## Deliverables
- [ ] Comparison spreadsheet (features, cost, support)
- [ ] Pros/cons for each option
- [ ] Security audit summary
- [ ] Recommendation with justification
- [ ] Effort estimate for integration
- [ ] Presentation to team

## Timeline
Spike Duration: 1-2 days
Expected by: Wednesday, February 7

## Related Issues
- Related to #456 (Auth improvements)
- Informs #789 (Multi-factor authentication)

**Labels:** `type/research` `area/security` `P2-Medium` `status/ready`
**Assignee:** @security-lead
```

---

## Template 7: Task (Subtask / Checklist)

```markdown
**Title:** [Task] JWT token expiry feature - QA testing checklist

---

## Description
QA testing checklist for the JWT token expiry warning feature before release to production.

## Test Cases
- [ ] **Happy Path: Extended Session**
  - [ ] Login successfully
  - [ ] Wait 13 minutes
  - [ ] Modal appears
  - [ ] Click "Stay Logged In"
  - [ ] Modal dismisses
  - [ ] Session continues
  - [ ] API calls still work

- [ ] **Happy Path: User Logout**
  - [ ] Login successfully
  - [ ] Wait 13 minutes
  - [ ] Modal appears
  - [ ] Click "Log Out"
  - [ ] Logged out, redirected to login
  - [ ] Cannot access protected pages

- [ ] **Auto-Logout**
  - [ ] Login successfully
  - [ ] Wait 15 minutes without action
  - [ ] Auto-logged out
  - [ ] Redirected to login page

- [ ] **Inactivity Detection**
  - [ ] Login, don't interact for 5+ minutes
  - [ ] Modal doesn't appear
  - [ ] Interact (click/type)
  - [ ] Modal appears if within 2-min window

- [ ] **Mobile Testing**
  - [ ] Test on iOS Safari
  - [ ] Test on Android Chrome
  - [ ] Test on tablet
  - [ ] Verify responsive layout

- [ ] **Browser Testing**
  - [ ] Chrome latest
  - [ ] Firefox latest
  - [ ] Safari latest
  - [ ] Edge latest

- [ ] **Error Scenarios**
  - [ ] Network error during refresh
  - [ ] Invalid refresh token
  - [ ] Server error (500)
  - [ ] Verify error handling

## Environment
- Testing in: Staging
- Test data: Available in QA database
- Test account: qa@example.com

## Bug Report Template
If bugs found:
```
**Issue:** [Description]
**Steps:** [How to reproduce]
**Expected:** [What should happen]
**Actual:** [What happened]
**Environment:** [Browser/device]
```

## Related Issues
- Closes #456 (JWT expiry feature)
- Tested on PR #1234

**Labels:** `type/test` `area/frontend` `status/ready`
**Assignee:** @qa-engineer
```

---

## Template 8: Blocking/Dependency Issue

```markdown
**Title:** [Blocker] Backend: Token refresh endpoint required by frontend

---

## Description
The frontend team is blocked waiting for the `/auth/refresh` endpoint to be implemented. This endpoint is required for the JWT token expiry warning feature (issue #456).

## What's Needed
```
POST /api/auth/refresh

Request:
{
  "refreshToken": "eyJhbGc..."
}

Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": { ... }
  }
}

Error:
{
  "success": false,
  "error": "invalid_token",
  "message": "Refresh token expired or invalid"
}
```

## Blocked Issues
- #456: JWT token expiry warning modal (Frontend)
- #789: Add token refresh rotation (Backend)
- Total blocked: ~13 story points

## Impact
Without this endpoint, cannot proceed with token refresh functionality for production release planned for Sprint 12.

## Timeline
- Needed by: Friday, February 2
- Production release: Friday, February 9

## Contact
@backend-lead for details and clarification

**Labels:** `status/blocked` `P0-Critical` `area/backend` `area/frontend`
**Assignee:** @backend-engineer
```

---

## Communication Examples

### Great Issue Comment (Good)
```markdown
✅ I've implemented the countdown timer logic. The modal now updates every second and displays time remaining in MM:SS format.

**Changes:**
- Added `useCountdown` hook
- Modal updates via setInterval
- Added visual countdown display

**Testing:**
- Verified timer updates correctly
- Tested on mobile viewport
- No memory leaks with cleanup

**Next Steps:**
I'll add inactivity detection next. Aiming to submit PR by tomorrow.

Related: #456, PR #1234
```

### Poor Issue Comment (Bad)
```
done
```

### Helpful Question (Good)
```markdown
❓ Quick clarification on acceptance criteria #2:

"Users not actively using app" - does this mean:
1. No mouse/keyboard events for 5 minutes?
2. Page in background?
3. Both?

I want to implement this correctly. Looking at similar features in the codebase...

cc: @product-manager
```

### Poor Question (Bad)
```
What do you want me to do?
```

---

## Before/After Examples

### Issue Title

❌ **Before (Bad):**
- "Fix bug"
- "Update auth"
- "Urgent!"

✅ **After (Good):**
- "[Bug] Login form fails on Safari mobile"
- "[Feature] Add JWT token expiry warning"
- "[Improvement] Reduce homepage load time to <2s"

### Issue Description

❌ **Before (Bad):**
```markdown
The login doesn't work. Please fix ASAP.
```

✅ **After (Good):**
```markdown
## Description
Users on Safari (iOS 17+) cannot submit the login form. The form appears to freeze when clicking the submit button.

## Steps to Reproduce
1. Open Safari on iPhone
2. Navigate to /login
3. Enter valid email and password
4. Click "Sign In"
5. Form doesn't submit

## Expected Behavior
Form submits and user is redirected to dashboard after successful authentication.

## Actual Behavior
Form freezes, no error message, page doesn't change.

## Environment
- Browser: Safari on iOS 17.2
- Device: iPhone 14
- Version: v1.2.3

## Impact
iOS users cannot login to app at all.

## Related Issues
- Related to #789 (Auth form refactor)
```

### Status Update

❌ **Before (Bad):**
```
working on it
```

✅ **After (Good):**
```markdown
**Status Update:** 75% complete

**Completed Today:**
- ✅ Implemented countdown timer
- ✅ Added inactivity detection
- ✅ Mobile testing passed

**In Progress:**
- 🔄 Writing unit tests (50% done)
- 🔄 Adding error handling

**Blockers:**
None currently

**Next:**
- Complete unit tests
- Code review submission
- Target: PR ready by EOD Thursday

**Last Updated:** 2024-02-01 14:30 UTC
```

---

## Label Combinations by Issue Type

### Feature Development
```
type/feature
area/[frontend|backend|contracts]
P[0-3]
status/[backlog|ready|in-progress|in-review|testing|done]
```
Example: `type/feature` `area/frontend` `P1-High` `status/in-progress`

### Bug Fix
```
type/bug
area/[frontend|backend|contracts]
P[0-2]  (usually high priority)
status/[backlog|ready|in-progress|in-review|testing|done]
```
Example: `type/bug` `area/backend` `P0-Critical` `status/in-review`

### Security Issue
```
type/bug
area/security
P0-Critical  (always critical)
status/[backlog|ready|in-progress]
```
Example: `type/bug` `area/security` `P0-Critical` `status/ready`

### Performance Task
```
type/improvement
area/[frontend|backend]
P[1-2]
status/[backlog|ready|in-progress]
```
Example: `type/improvement` `area/frontend` `P1-High` `status/ready`

### Documentation
```
type/docs
P[2-3]
status/[backlog|ready|in-progress|in-review|done]
```
Example: `type/docs` `P2-Medium` `status/ready`

### Infrastructure
```
type/infrastructure
P[1-2]
status/[backlog|ready|in-progress|done]
```
Example: `type/infrastructure` `P1-High` `status/in-progress`

---

## Markdown Formatting Tips

```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*
`code snippet`

- Bullet point
  - Nested bullet
- [ ] Checkbox item
- [x] Completed checkbox

| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |

[Link text](https://example.com)

> Blockquote

`inline code`

Code block:
```
code here
```

@mention someone
```

---

## Copy & Paste Ready

### Bug Report (Empty Template)
```markdown
## Description
[Description here]

## Steps to Reproduce
1. 
2. 
3. 

## Expected Behavior
[What should happen]

## Actual Behavior
[What's happening]

## Environment
- Browser: 
- OS: 
- Version: 

## Screenshots
[If applicable]

## Related Issues
- Related to #[number]

**Labels:** type/bug
```

### Feature Request (Empty Template)
```markdown
## Description
[Description]

## Motivation
[Why this is important]

## Acceptance Criteria
- [ ] 
- [ ] 
- [ ] 

## Related Issues
- Related to #[number]

**Labels:** type/feature
```

---

## Quick Reference

| Element | Format |
|---------|--------|
| Link | `[text](url)` |
| Mention | `@username` |
| Code | `` `code` `` |
| Bold | `**text**` |
| List | `- item` |
| Checkbox | `- [ ] item` |
| Table | See markdown formatting |

---

**Last Updated:** January 2024  
**Version:** 1.0

Use these templates to create clear, consistent issues that help your team stay organized and productive!
