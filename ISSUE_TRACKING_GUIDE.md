# Issue Tracking & Team Collaboration Guide

A comprehensive guide for managing project issues, tracking progress, and collaborating as a team using GitHub Issues and project management best practices.

---

## Table of Contents

1. [Overview](#overview)
2. [How to Use This Document](#how-to-use-this-document)
3. [Issue Categories & Labels](#issue-categories--labels)
4. [Workflow](#workflow)
5. [Team Assignment](#team-assignment)
6. [Progress Tracking](#progress-tracking)
7. [Sprint Planning](#sprint-planning)
8. [Best Practices](#best-practices)

---

## Overview

This document serves as a central reference for the Nova Rewards team to:
- Organize and prioritize work items
- Assign responsibilities clearly
- Track project progress
- Coordinate team efforts
- Plan sprints effectively
- Maintain communication consistency

### Key Goals
- **Visibility**: Everyone knows what's being worked on
- **Accountability**: Clear ownership of issues
- **Traceability**: Track decisions and progress
- **Efficiency**: Reduce duplicate work and miscommunication
- **Quality**: Systematic approach to issue resolution

---

## How to Use This Document

### For Project Managers
**Prioritize** → Assign → Track → Update

1. **Prioritize Issues**
   - Review the GitHub Issues board weekly
   - Align issues with project roadmap
   - Set priority labels (P0-Critical, P1-High, P2-Medium, P3-Low)
   - Identify blocked issues and dependencies
   - Create epics for major features

2. **Review Roadmap Alignment**
   - Check if issues align with quarterly goals
   - Identify missing issues that should be tracked
   - Close outdated or superseded issues
   - Update milestones for releases

3. **Set Priorities**
   - P0-Critical: Blocks other work or affects production
   - P1-High: Planned for current sprint
   - P2-Medium: Important but can wait
   - P3-Low: Nice-to-have or future consideration

### For Team Leads
**Assign** → Review → Unblock → Support

1. **Assign Issues**
   - Review priority labels
   - Understand requirements and acceptance criteria
   - Match with team member expertise
   - Ensure clear communication about expectations
   - Set realistic deadlines

2. **Consider Expertise**
   - Backend specialists: API, database, server issues
   - Frontend specialists: UI/UX, component, style issues
   - DevOps/Infra: Deployment, environment, CI/CD issues
   - QA: Testing, quality, bug validation issues
   - Full-stack: Cross-cutting, integration issues

3. **Track Blockers**
   - Identify issues blocking other work
   - Note external dependencies
   - Escalate critical blockers immediately
   - Update team on impediments

### For Team Members
**Track** → Update → Collaborate → Close

1. **Track Your Issues**
   - Check assigned issues daily
   - Review labels and priority
   - Understand acceptance criteria
   - Ask questions early if unclear

2. **Update Progress**
   - Move issues through workflow stages
   - Add comments with daily updates
   - Attach relevant code/PR links
   - Flag blockers immediately

3. **Collaborate**
   - Comment on related issues
   - Share knowledge and solutions
   - Help unblock teammates
   - Participate in sprint planning

### For All Team Members
**Collaborate** → Discuss → Learn → Improve

1. **Use as Reference**
   - Check labels before creating new issues
   - Follow existing patterns and conventions
   - Link related issues
   - Reference decisions in comments

2. **Sprint Planning**
   - Review high-priority issues
   - Estimate effort required
   - Identify dependencies
   - Plan sprint capacity

3. **Team Discussions**
   - Use issue comments for async communication
   - Schedule sync calls for complex decisions
   - Document decisions in issue descriptions
   - Share learnings with team

---

## Issue Categories & Labels

### Priority Labels
Use these to indicate importance and urgency.

```
P0-Critical  🔴
  - Production down or critical path blocked
  - Security vulnerabilities
  - Data loss risks
  - Customer-impacting outages
  Example: "User authentication completely broken"

P1-High  🟠
  - Sprint-focused work
  - Important features for release
  - Significant bugs
  - Planned improvements
  Example: "Add token expiry warning modal"

P2-Medium  🟡
  - Good-to-have features
  - Nice-to-have improvements
  - Non-urgent fixes
  Example: "Optimize database query performance"

P3-Low  🔵
  - Future enhancements
  - Documentation improvements
  - Code cleanup
  Example: "Add code comments to auth module"
```

### Type Labels
Categorize what kind of work the issue represents.

```
type/bug 🐛
  - Something isn't working as expected
  - Unexpected behavior or error
  - Regression or defect
  Example: "Login form doesn't submit on mobile"

type/feature 🎉
  - New functionality
  - Enhancement or addition
  - Feature request
  Example: "Add dark mode support"

type/improvement 🔧
  - Non-breaking enhancement
  - Optimization
  - Refactoring
  Example: "Reduce bundle size by lazy loading"

type/docs 📚
  - Documentation
  - Guides and tutorials
  - Comments and clarification
  Example: "Document API authentication flow"

type/test 🧪
  - Testing and quality
  - Test coverage
  - Automation
  Example: "Add integration tests for payment flow"

type/infrastructure 🏗️
  - DevOps and deployment
  - CI/CD pipelines
  - Environment setup
  Example: "Setup staging environment"
```

### Area Labels
Indicate which part of the codebase is affected.

```
area/frontend 🎨
  - UI/UX components
  - React/Next.js
  - Styling and layouts
  - Browser compatibility

area/backend 🔌
  - API endpoints
  - Database
  - Business logic
  - Server configuration

area/smart-contracts 🔗
  - Solidity code
  - Contract logic
  - Blockchain integration

area/devops 🚀
  - Deployment
  - Infrastructure
  - Monitoring
  - CI/CD pipelines

area/mobile 📱
  - Mobile app
  - Responsive design
  - Mobile-specific features

area/security 🔐
  - Authentication
  - Authorization
  - Encryption
  - Vulnerability fixes

area/performance ⚡
  - Speed optimization
  - Caching
  - Resource efficiency
  - Load testing
```

### Status Labels
Track the state of an issue.

```
status/backlog 📋
  - Not yet started
  - Waiting for prioritization
  - No team member assigned

status/ready 🎯
  - Ready to be worked on
  - Requirements clear
  - Dependencies resolved
  - Waiting for assignment

status/in-progress 🔄
  - Currently being worked on
  - Has assignee
  - May have PR in review

status/in-review 👀
  - Code/work submitted for review
  - Awaiting feedback
  - PR opened or design review pending

status/blocked 🚫
  - Waiting for external dependency
  - Blocked by another issue
  - Missing information or resources
  - Waiting for decision

status/testing 🧪
  - In QA testing phase
  - Ready for user testing
  - Waiting for test results

status/done ✅
  - Completed and merged
  - Deployed to production (if applicable)
  - Ready for close
```

### Team Labels
Optional - for team-specific categorization.

```
team/frontend 👥
team/backend 👥
team/devops 👥
team/mobile 👥
```

---

## Workflow

### Issue Lifecycle

```
1. CREATION (Backlog)
   ├─ Create issue with clear title
   ├─ Add description and acceptance criteria
   ├─ Add initial labels (type, area, priority)
   └─ Add to project milestone

2. PRIORITIZATION (Ready)
   ├─ Project manager reviews
   ├─ Set priority (P0-P3)
   ├─ Estimate story points (if using)
   ├─ Add to sprint (if planned)
   └─ Update status → ready

3. ASSIGNMENT
   ├─ Team lead assigns to member
   ├─ Team member reviews and clarifies
   ├─ Ask questions if requirements unclear
   ├─ Update status → in-progress
   └─ Create draft PR if applicable

4. DEVELOPMENT
   ├─ Work on implementation
   ├─ Push code to feature branch
   ├─ Comment with progress updates
   ├─ Link PR to issue
   └─ Flag blockers immediately

5. REVIEW
   ├─ Update status → in-review
   ├─ Submit PR for code review
   ├─ Address review feedback
   ├─ Update with changes
   └─ Get approvals

6. TESTING
   ├─ Update status → testing
   ├─ Deploy to staging (if needed)
   ├─ QA testing begins
   ├─ Document test results
   └─ Fix bugs if found

7. COMPLETION
   ├─ Merge PR to main
   ├─ Deploy to production (if applicable)
   ├─ Add comment with deployment info
   ├─ Update status → done
   └─ Close issue

8. CLOSURE
   ├─ Verify in production
   ├─ Update documentation
   ├─ Remove from sprint
   └─ Archive if complete
```

### State Transitions

```
Backlog → Ready → In-Progress → In-Review → Testing → Done

Alternative Paths:
- Ready → Blocked (wait for dependency)
- In-Progress → Blocked (hit obstacle)
- In-Review → In-Progress (changes needed)
- Testing → In-Progress (bugs found)
```

---

## Team Assignment

### Assignment Best Practices

1. **Clear Ownership**
   - One primary assignee per issue
   - Secondary assignees optional for collaboration
   - Clear communication of responsibilities

2. **Expertise Matching**
   ```
   Issue Type          →  Best Team Members
   ─────────────────────────────────────────
   Frontend bug        →  Frontend specialists
   Backend feature     →  Backend specialists
   Integration         →  Full-stack developers
   DevOps/Infra        →  DevOps engineers
   Security           →  Security-focused engineers
   Database           →  Backend + DBA
   Smart contracts    →  Blockchain specialists
   ```

3. **Load Balancing**
   - Check team member workload
   - Distribute work fairly
   - Avoid overloading one person
   - Consider skill development

4. **Communication**
   - Tag assignee when assigning: `@username assigned to this issue`
   - Provide context and requirements
   - Link to related issues
   - Set clear expectations and deadlines

### Assignment Template

```markdown
**Assigned to:** @team-member

**Expected by:** [Date]

**Context:**
[Brief background and why this is important]

**Key Points:**
- [ ] Understand requirements
- [ ] Review acceptance criteria
- [ ] Check for blockers/dependencies
- [ ] Ask questions if unclear
```

---

## Progress Tracking

### Daily Updates

Team members should update assigned issues daily:

```markdown
**Status:** In-Progress
**Progress:** 60% complete

**Today's Work:**
- Implemented token refresh logic
- Added countdown timer component
- Fixed modal styling on mobile

**Blockers:**
- None currently

**Next Steps:**
- Add inactivity detection
- Write unit tests
- Submit PR for review

**Last Updated:** [Date Time]
```

### Weekly Review

Every Friday, the team should:

1. **Review open issues**
   - Check for stale issues (no updates > 1 week)
   - Identify blocked issues
   - Rescope if needed

2. **Update priorities**
   - Adjust based on business needs
   - Move high-priority items forward
   - Deprioritize if needed

3. **Communicate changes**
   - Notify affected team members
   - Update sprint plan if needed
   - Document reasons for changes

### GitHub Project Board

Use GitHub Projects to visualize progress:

**Columns:**
```
📋 Backlog      (Not ready yet)
🎯 Ready        (Ready to work)
🔄 In Progress  (Currently working)
👀 In Review    (PR/review stage)
🧪 Testing      (QA testing)
✅ Done         (Complete)
🚫 Blocked      (Waiting)
```

**Tips:**
- Drag cards as status changes
- Use project filters for views
- Create saved views per sprint
- Share with stakeholders

### Sprint Tracking

For sprint-based workflow:

```markdown
## Sprint 12 (Jan 15 - Jan 29)

**Sprint Goal:** Implement token expiry warning and improve auth flow

**Capacity:** 40 story points

**Issues:**
- [ ] JWT token expiry warning modal (8 SP) - In Review
- [ ] Add refresh token rotation (5 SP) - In Progress
- [ ] Improve error handling (3 SP) - Ready
- [ ] Update auth documentation (2 SP) - Backlog

**Completed:** 8 SP
**In-Progress:** 5 SP
**Remaining:** 27 SP

**Velocity:** On track / At risk / Ahead

**Notes:**
- One blocker on refresh endpoint testing
- May need to scope down docs if auth work extends
```

---

## Sprint Planning

### Sprint Planning Meeting

**Duration:** 1-2 hours (depending on team size)

**Agenda:**
1. Review completed issues from last sprint
2. Review backlog and prioritized items
3. Discuss and estimate effort
4. Identify dependencies and risks
5. Commit to sprint goals
6. Assign team members

### Estimation

Use story points or t-shirt sizes:

```
Story Points:     1    2    3    5    8   13   21
T-Shirt Sizes:    XS   S    M    L    XL  XXL  XXXL

Estimation Guide:
1-2 points:   A few hours, well-understood
3-5 points:   1-2 days, some complexity
8 points:     2-3 days, significant complexity
13+ points:   Multiple days, break it down
```

### Sprint Goal Template

```markdown
## Sprint 12 - Sprint Goal

**Goal:** Implement JWT token expiry warning to prevent user sessions from ending silently

**Why:** Users lose work when tokens expire silently, causing 401 errors

**Key Results:**
- Modal displays 2 minutes before expiry
- Token refresh works without data loss
- Auto-logout functions properly

**Success Metrics:**
- All acceptance criteria met
- No critical bugs in QA
- Deployed to production by sprint end

**Team Members:** @dev1, @dev2, @dev3
```

### Dependency Management

Identify and track dependencies:

```
Issue A depends on Issue B
  ├─ Block Issue A if Issue B blocked
  ├─ Ensure Issue B starts first
  └─ Link issues: "depends on #123"

External Dependencies
  ├─ Third-party API ready?
  ├─ Infrastructure provisioned?
  ├─ Design approved?
  └─ Document expected completion dates
```

---

## Best Practices

### Creating Issues

✅ **Do:**
- Use clear, descriptive titles
- Include acceptance criteria
- Add relevant labels
- Link to related issues
- Provide context and background
- Include reproduction steps (for bugs)

❌ **Don't:**
- Use vague titles: "Fix stuff" or "Update things"
- Leave description empty
- Add too many labels (3-5 is good)
- Create duplicate issues
- Forget to assign a project/milestone

### Issue Title Format

```
[Label] Brief description of the issue

Examples:
✅ [Frontend] Add dark mode toggle to settings
✅ [Bug] Login form fails on Safari mobile
✅ [Docs] Document API authentication flow
✅ [Perf] Reduce home page load time below 2s

❌ Fix bug
❌ Update frontend
❌ Need to do this
```

### Issue Description Template

```markdown
## Description
[What is this issue about? Why does it matter?]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Steps to Reproduce (if bug)
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
[What should happen?]

## Actual Behavior
[What's happening instead?]

## Environment
- Browser: [e.g., Chrome 120]
- OS: [e.g., macOS Sonoma]
- Version: [e.g., v1.2.3]

## Related Issues
- Closes #123
- Related to #456
- Depends on #789

## Additional Context
[Screenshots, logs, research links, etc.]
```

### Commenting Best Practices

✅ **Do:**
- Use clear language
- Include code snippets with markdown
- Reference other issues/PRs
- Provide context for decisions
- Ask clarifying questions

❌ **Don't:**
- Just say "looks good"
- Leave vague feedback
- Use multiple comments when one will do
- Forget to mention blocking items

### Closing Issues

When closing an issue:

```markdown
## Resolution

**Solution:** Brief description of solution

**PR:** #1234 - Link to merged PR

**Deployed:** 2024-01-29 to production

**Verification:**
- ✅ Tested in staging
- ✅ Verified with stakeholder
- ✅ Monitored for 24 hours

**Notes:** Any additional context or learnings
```

---

## Common Workflows

### Bug Fix Workflow

```
1. Bug reported in issue #123
2. Assign to engineer
3. Engineer creates branch: bugfix/issue-123
4. Engineer reproduces issue locally
5. Engineer fixes bug
6. Engineer submits PR with tests
7. Code review and approval
8. Deploy to staging for QA
9. QA verifies fix
10. Deploy to production
11. Comment with deployment info
12. Close issue
```

### Feature Development Workflow

```
1. Feature request created in issue #456
2. Product manager prioritizes
3. Sprint planning includes feature
4. Assign to engineer(s)
5. Engineer designs implementation
6. Engineer creates feature branch
7. Engineer builds feature incrementally
8. Engineer links PR to issue
9. Code review and approval
10. Deploy to staging
11. QA testing and approval
12. Deploy to production
13. Update documentation
14. Close issue
```

### Documentation Workflow

```
1. Documentation issue created
2. Assign to engineer or tech writer
3. Research and plan documentation
4. Draft content
5. Submit as PR
6. Review for accuracy and clarity
7. Merge to main
8. Update link in relevant issues
9. Close issue
```

---

## Tools & Commands

### GitHub Issue Search

```bash
# Find open bugs assigned to you
is:open label:type/bug assignee:@me

# Find blocked issues in current sprint
is:open label:status/blocked milestone:"Sprint 12"

# Find high-priority unassigned issues
is:open label:P0-Critical -assignee:*

# Find issues updated in last week
is:open updated:>2024-01-22

# Find issues by area
is:open label:area/frontend label:P1-High
```

### GitHub CLI Commands

```bash
# List assigned issues
gh issue list --assignee @me --state open

# Create new issue
gh issue create --title "Title" --body "Description" --label "P1-High" --label "type/bug"

# Comment on issue
gh issue comment 123 --body "Great progress! Ready for review?"

# Close issue
gh issue close 123 --comment "Fixed in PR #456"

# Link issues
gh issue comment 123 --body "Closes #456"

# View issue details
gh issue view 123
```

---

## Communication Templates

### Assignment Communication

```
@team-member, I've assigned you issue #123: "JWT token expiry warning modal"

**Why you:** This aligns with your frontend expertise and the auth flow work you've been doing.

**Context:** We need to prevent user sessions from ending silently when tokens expire.

**Acceptance Criteria:**
- Modal appears 2 minutes before expiry
- "Stay Logged In" refreshes token
- "Log Out" clears session
- Auto-logout if ignored

**Timeline:** Expected by Friday, Feb 2

Let me know if you have questions!
```

### Blocker Communication

```
🚫 Blocker Alert - Issue #456

**Issue:** Cannot proceed with token refresh implementation

**Reason:** Waiting for backend team to expose refresh token endpoint

**Dependency:** Issue #789 (Backend: Implement token refresh endpoint)

**Impact:** Blocks 2 other features totaling ~13 story points

**ETA for Resolution:** Backend team says by Wednesday

**Workaround:** We could mock the endpoint for now if needed

@backend-lead, can we prioritize this endpoint?
```

### Status Update

```
📊 Sprint Status - Mid-Week Update (Sprint 12)

**Progress:** 40% complete

**On Track:** 
- Token expiry modal UI complete ✅
- Inactivity detection implemented ✅

**At Risk:**
- Auto-logout testing revealing edge cases
- May need 1 extra day

**Blockers:**
- None currently

**Next Week:**
- Finish testing and QA
- Deploy to production
- Update documentation

**Velocity:** On pace for sprint goal
```

---

## Review Checklist

### Before Assigning an Issue

- [ ] Title clearly describes work
- [ ] Description has acceptance criteria
- [ ] Related issues linked
- [ ] Appropriate labels added
- [ ] Priority set correctly
- [ ] Requirements are clear
- [ ] No external blockers

### Before Starting Work

- [ ] Understand acceptance criteria
- [ ] Know expected timeline
- [ ] Identified any blockers
- [ ] Read related issues
- [ ] Clarified ambiguities with PM

### Before Submitting PR

- [ ] Issue title links in PR description
- [ ] All acceptance criteria met
- [ ] Code review checklist complete
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] No merge conflicts

### Before Closing Issue

- [ ] PR merged to main
- [ ] Code deployed (staging or production)
- [ ] Acceptance criteria verified
- [ ] Related documentation updated
- [ ] No follow-up issues identified
- [ ] Stakeholder approval received

---

## FAQ

**Q: How often should I update my issues?**
A: Daily if in progress, at minimum on sprint planning and end of sprint.

**Q: What if I have a blocker?**
A: Add `status/blocked` label immediately, comment with details, and notify team lead.

**Q: How many labels should I add?**
A: 3-5 labels is ideal. Priority + Type + Area is minimum.

**Q: Can issues be in multiple sprints?**
A: No, an issue should only be in one sprint. If it spans sprints, break it into smaller issues.

**Q: What's the difference between assigned and in-progress?**
A: Assigned = team member claimed it. In-Progress = actively working right now.

**Q: How do I estimate story points?**
A: Compare to similar past issues. Discuss in planning. Estimate the effort, not calendar time.

**Q: What if requirements change mid-sprint?**
A: Update the issue description, comment with changes, re-estimate if needed, notify team.

**Q: Should closed issues ever be reopened?**
A: Rarely. If related work needed, create a new issue and link it.

---

## Resources

- **GitHub Help:** https://docs.github.com/en/issues
- **GitHub Projects:** https://docs.github.com/en/issues/planning-and-tracking-with-projects
- **Agile Estimation:** https://www.atlassian.com/agile/estimation
- **Scrum Guide:** https://scrumguides.org/
- **Team Collaboration:** https://asana.com/team-collaboration

---

## Document Control

**Version:** 1.0
**Last Updated:** January 2024
**Author:** Nova Rewards Team
**Next Review:** April 2024

### Change History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2024 | Team | Initial version |

---

## Feedback

Have suggestions to improve this guide?

- Create an issue: `[Docs] Improve issue tracking guide`
- Comment on existing issues with improvements
- Bring feedback to sprint retrospectives
- Update this document as processes evolve

---

**Last Updated:** January 2024  
**Next Review:** April 2024  
**Questions?** Reach out to your team lead or project manager.
