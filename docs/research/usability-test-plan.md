# Usability Testing Plan — Nova Rewards

**Test Date:** TBD  
**Methodology:** Moderated remote testing + unmoderated tasks  
**Sample Size:** 8-12 participants  
**Duration:** 45 minutes per session

---

## Objectives

1. Validate onboarding flow completion rate
2. Identify blockers in the wallet connection process
3. Test dashboard comprehension (KPIs, transactions)
4. Measure task completion time for "Earn first reward"
5. Evaluate mobile navigation usability

---

## Participant Criteria

### Primary Persona: Crypto-Curious Consumer

| Criterion | Requirement |
|-----------|-------------|
| Age | 25-45 |
| Crypto experience | Beginner to intermediate (owns < 3 wallets) |
| Loyalty program usage | Uses 2+ loyalty programs monthly |
| Tech literacy | Comfortable with mobile apps + browser extensions |
| Device | Own smartphone (iOS or Android) |
| Browser | Chrome, Firefox, or Brave |

### Recruit Mix

- 6 participants: no prior Stellar experience
- 3 participants: have used Stellar before
- 3 participants: crypto-native (use DeFi regularly)

### Screener Survey

See `docs/research/screener-survey.md`.

---

## Test Scenarios

### Scenario 1 — Onboarding (15 min)

**Task:** "Sign up for Nova Rewards and connect your wallet."

**Steps:**
1. Navigate to homepage
2. Click "Get Started"
3. Complete sign-up form
4. Set up profile
5. Install Freighter (if needed)
6. Connect wallet
7. View success screen

**Success Metrics:**
- Completion rate (target: ≥80%)
- Time to complete (target: ≤5 minutes)
- Number of errors / back clicks

**Think-Aloud Prompts:**
- "What do you expect to happen when you click 'Get Started'?"
- "Is the password strength indicator helpful?"
- "Do you understand why we're asking you to connect a wallet?"

---

### Scenario 2 — Earn First Reward (10 min)

**Task:** "Find a campaign and earn your first NOVA tokens."

**Steps:**
1. Browse campaigns
2. Select a campaign
3. Understand how to earn
4. Complete the action (mock: click "Redeem Code")
5. See confirmation

**Success Metrics:**
- Can find campaigns page (yes/no)
- Understands how to earn (subjective rating 1-5)
- Time to first "earn" action (target: ≤2 minutes)

---

### Scenario 3 — Dashboard Comprehension (10 min)

**Task:** "Tell me what you see on your dashboard."

**Questions:**
- "What is your current NOVA balance?"
- "How many rewards have you earned this week?"
- "What does the chart show?"
- "Where would you go to see all your transactions?"

**Success Metrics:**
- Correctly identifies balance (yes/no)
- Understands trend indicators (yes/no)
- Can navigate to transaction history (yes/no)

---

### Scenario 4 — Mobile Navigation (5 min)

**Task (mobile only):** "Find your profile settings and change your display name."

**Steps:**
1. Locate profile tab (bottom nav)
2. Tap profile
3. Tap settings
4. Change display name
5. Save

**Success Metrics:**
- Finds profile tab without help (yes/no)
- Time to settings (target: ≤30 seconds)
- Understands bottom nav icons (rating 1-5)

---

## Data Collection

### Quantitative
- Task completion rate (%)
- Time on task (seconds)
- Number of errors
- SUS (System Usability Scale) score

### Qualitative
- Think-aloud transcripts
- Confusion points (timestamps)
- Delight moments
- Feature requests

### Tools
- Zoom (recording + screen share)
- UserTesting.com (unmoderated tasks)
- Optimal Workshop (card sorting for nav labels)
- Google Forms (post-test survey)

---

## Post-Test Survey

1. Overall, how easy was it to complete the tasks? (1-5 scale)
2. Would you use Nova Rewards for your purchases? (Yes / Maybe / No)
3. What was the most confusing part?
4. What did you like most?
5. Any features you expected but didn't see?

---

## Analysis Plan

1. **Tag all pain points** (timestamps) in transcripts
2. **Cluster issues** by severity (blocker / major / minor)
3. **Prioritize fixes** by impact × frequency
4. **Create annotated journey map** showing drop-off points
5. **Report findings** with video clips + quotes

---

## Success Criteria

| Metric | Target | Threshold |
|--------|--------|-----------|
| Onboarding completion | ≥80% | 70% |
| Earn first reward | ≥90% | 80% |
| Dashboard comprehension | ≥75% correct answers | 65% |
| SUS score | ≥75 (good) | 68 (acceptable) |
| Mobile nav usability | ≥4/5 rating | 3.5/5 |

If **any threshold is not met**, redesign and re-test affected flow.

---

## Timeline

| Phase | Duration |
|-------|----------|
| Recruit participants | 1 week |
| Conduct sessions | 1 week (2-3/day) |
| Analysis | 3 days |
| Report + recommendations | 2 days |
| **Total** | **2.5 weeks** |

---

## Deliverables

1. **Usability test report** (this template filled out)
2. **Annotated journey map** with pain points
3. **Video highlight reel** (3-5 min) showing key issues
4. **Prioritized remediation backlog** (tickets in GitHub)

---

See also:
- `docs/research/screener-survey.md`
- `docs/research/test-script.md`
- `docs/research/research-report-template.md`
