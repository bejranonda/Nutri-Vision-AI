# Pre-Design Validation Plan

**Last Updated:** November 18, 2025
**Purpose:** Testing methodology and validation framework for NutriVision AI UX/UI

---

## Table of Contents

1. [Validation Strategy](#validation-strategy)
2. [Phase 1: Wireframe Testing](#phase-1-wireframe-testing)
3. [Phase 2: Prototype Testing](#phase-2-prototype-testing)
4. [Phase 3: Beta Testing](#phase-3-beta-testing)
5. [A/B Testing Plan](#ab-testing-plan)
6. [Success Metrics & KPIs](#success-metrics--kpis)

---

## Validation Strategy

### Overall Approach

**Principle**: Test early, test often, iterate based on data

**Testing Pyramid**:
```
        /\
       /  \      Beta Testing (100 users)
      /    \     ↑ Real usage, analytics
     /______\
    /        \   Prototype Testing (20 users)
   /          \  ↑ Interactive prototype
  /____________\
 /              \
/________________\ Wireframe Testing (10 users)
                   ↑ Low-fidelity validation
```

**Timeline**: 12 weeks from wireframes to beta launch

---

## Phase 1: Wireframe Testing

**Goal**: Validate core flows and information architecture before high-fidelity design

### Timing
- **Week 1-2**: Create wireframes
- **Week 3**: Recruit participants and test
- **Week 4**: Analyze and iterate

### Participants
- **Number**: 10 users
- **Segments**:
  - 4 Health-conscious Millennials (like Ploy)
  - 3 Tech-savvy Gen Z (like Tan)
  - 2 Wellness Moms (like Ning)
  - 1 Corporate decision-maker
- **Recruitment**: Social media, fitness centers, university

### Materials
- Low-fidelity wireframes (Figma or Balsamiq)
- Clickable prototype (basic navigation only)
- Test script with tasks

### Test Tasks

**Task 1: Onboarding** (5 min)
- "Imagine you just downloaded this app. Walk me through signing up."
- Observe: Confusion points, time to complete, skip rate

**Task 2: First Food Scan** (5 min)
- "You just ate Pad Thai for lunch. Show me how you would log it."
- Observe: Can they find camera, understand flow

**Task 3: Recipe Discovery** (5 min)
- "Find a healthy Thai recipe for dinner tonight."
- Observe: Navigation, filter usage, decision criteria

**Task 4: Dashboard Comprehension** (5 min)
- "Check your nutrition progress for today."
- Observe: Can they understand charts and scores

**Task 5: Upgrade Flow** (3 min)
- "You want unlimited scans. Show me how you'd upgrade."
- Observe: Can they find pricing, understand options

### Success Criteria
- ✅ Task completion rate: >70%
- ✅ Time to first scan: <90 seconds (target <60 in final)
- ✅ Understanding of 8-dimension scores: >60%
- ✅ Willingness to download: >50%

### Key Questions
1. "What was most confusing?"
2. "What did you like most?"
3. "Is anything missing?"
4. "Would you use this app daily?"
5. "How much would you pay for this?"

### Analysis
- **Heatmap**: Where do users click most?
- **Confusion Matrix**: Which screens cause most confusion?
- **Time Analysis**: Where do users spend most time?
- **Qualitative Themes**: Common pain points and praise

### Deliverables
- Test report with findings
- Prioritized list of issues to fix
- Revised wireframes (v2)

---

## Phase 2: Prototype Testing

**Goal**: Validate UI design, interactions, and content before development

### Timing
- **Week 5-7**: Create high-fidelity prototype
- **Week 8**: Recruit and test
- **Week 9**: Analyze and iterate

### Participants
- **Number**: 20 users
- **Segments**: Same distribution as Phase 1, but new participants
- **Include**: 5 users who tested wireframes (to see improvement)

### Materials
- High-fidelity interactive prototype (Figma)
- Real content and copy
- Actual color scheme and branding
- Realistic data and charts

### Test Methodology

**Moderated Remote Testing** (10 users):
- 60-minute sessions via Zoom
- Screen recording + think-aloud
- Facilitator guides but doesn't lead

**Unmoderated Remote Testing** (10 users):
- Self-guided using UserTesting.com or Maze
- 30-minute session
- Pre-recorded instructions

### Test Tasks

**Task 1: Realistic Onboarding** (5 min)
- Complete full onboarding with personal info
- Observe: Drop-off points, confusion, time

**Task 2: Multiple Scans** (10 min)
- Scan 3 different Thai foods (Pad Thai, Som Tam, Kao Pad)
- Observe: Repeated behavior, learning curve, satisfaction

**Task 3: Recipe Interaction** (7 min)
- Find a diabetic-friendly Thai recipe
- Save to favorites
- Add to meal plan (if enabled)
- Observe: Navigation, satisfaction with content

**Task 4: AI Chat** (7 min)
- Ask 3 nutrition questions via AI chat
- Evaluate responses
- Observe: Chat UX, AI quality perception

**Task 5: Dashboard Deep Dive** (5 min)
- Interpret 8-dimension radar chart
- Understand blood sugar trend
- Explain what macro pie chart shows
- Observe: Chart comprehension, data literacy

**Task 6: Settings & Customization** (5 min)
- Change language to English
- Toggle dark mode
- Adjust notification settings
- Observe: Findability, ease of use

**Task 7: Social Features** (3 min)
- Share a recipe to LINE (simulated)
- View achievements
- Observe: Social engagement, privacy comfort

**Task 8: Conversion** (8 min)
- Trigger paywall (after 3 scans)
- Review pricing options
- Select a plan (don't actually pay)
- Observe: Pricing reaction, willingness to pay

### Quantitative Metrics
- **System Usability Scale (SUS)**: Standardized 10-question survey
  - Target: >75 (Good), Ideal: >80 (Excellent)
- **Task Completion Rate**: % who complete each task
  - Target: >85%
- **Time on Task**: Average time per task
  - Compare to benchmarks from Phase 1
- **Error Rate**: Number of errors per task
  - Target: <2 errors per task
- **Net Promoter Score (NPS)**: "How likely to recommend?"
  - Target: >50 (Good), Ideal: >70 (Excellent)

### Qualitative Metrics
- **Satisfaction Ratings**: 1-5 stars per feature
  - Target: >4.0 average
- **Open Feedback**: Themes from written responses
- **Preference Testing**: A vs. B comparisons for key decisions

### Success Criteria
- ✅ SUS score: >75
- ✅ Task completion: >85%
- ✅ Time to first scan: <60 seconds
- ✅ Understanding of scores: >75%
- ✅ NPS: >50
- ✅ Willingness to pay: >40%

### Analysis Framework

**Heuristic Evaluation**:
Use Nielsen's 10 Usability Heuristics:
1. Visibility of system status
2. Match between system and real world
3. User control and freedom
4. Consistency and standards
5. Error prevention
6. Recognition rather than recall
7. Flexibility and efficiency of use
8. Aesthetic and minimalist design
9. Help users recognize, diagnose, and recover from errors
10. Help and documentation

**Accessibility Audit**:
- WCAG 2.1 Level AA compliance check
- Screen reader testing (VoiceOver, TalkBack)
- Keyboard navigation testing
- Color contrast validation

**Performance Testing**:
- Prototype load time (should be instant)
- Animation smoothness (60 FPS)
- Interaction responsiveness (<100ms)

### Deliverables
- Comprehensive test report
- Usability issues prioritized (P0/P1/P2/P3)
- Design iteration plan
- Final prototype (v3) ready for development

---

## Phase 3: Beta Testing

**Goal**: Validate with real users, real data, real usage patterns

### Timing
- **Week 10-11**: Build MVP
- **Week 12**: Closed beta with 100 users
- **Week 13-16**: Analyze, iterate, prepare for public launch

### Participants
- **Number**: 100 beta testers
- **Recruitment**:
  - 50 from user research participants (engaged and gave feedback)
  - 30 from social media (Instagram, LINE influencers)
  - 20 from referrals (friends of team, early supporters)
- **Diversity**: Age, gender, location, tech comfort, health goals

### Beta Structure

**Closed Beta (Invite-Only)**:
- Email invitation with beta access code
- Private TestFlight (iOS) or Beta APK (Android) if native
- Private PWA URL if web-based
- Dedicated Slack/LINE group for feedback

**Beta Phases**:

**Week 1: Onboarding & First Use**
- Focus: Onboarding experience, first scans
- Ask: Daily check-in surveys (very short)
- Track: Onboarding completion, time to first scan

**Week 2: Feature Exploration**
- Focus: Recipe discovery, AI chat, dashboard
- Ask: Feature usage feedback
- Track: Feature adoption rates, time spent

**Week 3: Habit Formation**
- Focus: Daily usage, retention, notifications
- Ask: What motivates continued use?
- Track: DAU, WAU, D7 retention

**Week 4: Monetization Test**
- Focus: Paywall, pricing, conversion
- Ask: Would you pay? How much?
- Track: Free-to-trial conversion (if enabled)

### Data Collection

**Analytics** (via Mixpanel, Amplitude, or similar):

**Onboarding Funnel**:
- Welcome screen view
- Language selected
- Login method chosen
- Onboarding completion
- First scan initiated
- First scan completed

**Engagement Metrics**:
- Daily Active Users (DAU)
- Weekly Active Users (WAU)
- Monthly Active Users (MAU)
- DAU/MAU ratio (stickiness)
- Session length
- Sessions per day
- Features used per session

**Retention Metrics**:
- D1 retention (next day)
- D7 retention (7 days later)
- D30 retention (30 days later)
- Churn rate

**Food Scanning Metrics**:
- Scans per user per day
- Scan success rate (AI accuracy)
- Scan time (photo to results)
- Portion adjustment rate
- Foods most scanned

**Recipe Metrics**:
- Recipes viewed
- Recipes saved to favorites
- Recipe searches
- Top searched keywords

**AI Chat Metrics**:
- Chat sessions initiated
- Messages per session
- User satisfaction (thumbs up/down)
- Response time

**Conversion Metrics** (if paywall enabled):
- Paywall views
- Free-to-trial conversion
- Trial-to-paid conversion
- Revenue (if charging)

**Feedback Collection**:

**In-App Surveys** (triggered contextually):
- After onboarding: "How was your experience? (1-5 stars)"
- After 3rd scan: "How helpful are the nutrition scores? (1-5)"
- After 7 days: "What feature do you use most? (open text)"
- After paywall view: "What's preventing you from upgrading? (multiple choice)"

**Weekly Feedback Form**:
- Email link to Google Form
- 10 questions, 5 minutes
- Incentive: Entry to win premium subscription

**Bug Reporting**:
- In-app bug report button
- Screenshot + description
- Automatically includes device info, app version

### Success Criteria

**Engagement**:
- ✅ Onboarding completion: >60%
- ✅ Time to first scan: <60 seconds
- ✅ D1 retention: >65%
- ✅ D7 retention: >45%
- ✅ D30 retention: >25%
- ✅ Scans per user per day: >1.5

**Satisfaction**:
- ✅ SUS score: >75 (Good)
- ✅ NPS: >50
- ✅ App store rating: >4.2 (when public)

**Conversion** (if tested):
- ✅ Free-to-trial: >30%
- ✅ Trial-to-paid: >60%

**Technical**:
- ✅ Crash rate: <1%
- ✅ AI scan success: >90% for Thai dishes
- ✅ API response time: <500ms (p95)

### Analysis & Iteration

**Weekly Beta Reviews**:
- Review analytics dashboard
- Read qualitative feedback
- Prioritize bugs and issues
- Plan sprint for fixes

**Cohort Analysis**:
- Compare early vs. late adopters
- Segment by persona (Millennials vs. Gen Z)
- Identify power users vs. churned users
- Understand what drives retention

**Funnel Analysis**:
- Where do users drop off?
- Which features drive retention?
- What causes churn?

**A/B Tests** (if enough users):
- Test variations of key screens
- Paywall copy variants
- Onboarding flow variations

### Deliverables
- Beta test report
- Analytics dashboard
- Bug list (prioritized)
- Feature request backlog
- User testimonials (for marketing)
- Launch readiness checklist

---

## A/B Testing Plan

**Goal**: Optimize conversion and retention through experimentation

### Post-Launch A/B Tests

**Test 1: Onboarding Flow**

**Hypothesis**: Shorter onboarding (skip goal setting) increases completion rate

**Variants**:
- A (Control): Full onboarding (4 screens + goal setting)
- B (Test): Minimal onboarding (2 screens, skip goal setting)

**Metric**: Onboarding completion rate
**Expected Impact**: +15% completion for variant B
**Sample Size**: 500 users per variant
**Duration**: 1 week

---

**Test 2: Paywall Timing**

**Hypothesis**: Showing paywall after 1st scan (not 3rd) increases trial signups

**Variants**:
- A (Control): Paywall after 3rd scan
- B (Test): Soft paywall after 1st successful scan

**Metric**: Free-to-trial conversion
**Expected Impact**: +10% trial signups for variant B (but may annoy users)
**Sample Size**: 1,000 users per variant
**Duration**: 2 weeks

---

**Test 3: Paywall Copy**

**Hypothesis**: Emphasizing "7-day free trial" over "unlimited scans" increases conversions

**Variants**:
- A (Control): "Unlock Unlimited Scans"
- B (Test): "Try Premium FREE for 7 Days"

**Metric**: Paywall → Trial conversion
**Expected Impact**: +20% trial signups for variant B
**Sample Size**: 500 users per variant
**Duration**: 1 week

---

**Test 4: Dashboard Layout**

**Hypothesis**: Showing streak first (not overall score) increases daily engagement

**Variants**:
- A (Control): Overall score at top, streak below
- B (Test): Streak at top, overall score below

**Metric**: D7 retention
**Expected Impact**: +5% D7 retention for variant B
**Sample Size**: 1,000 users per variant
**Duration**: 2 weeks

---

**Test 5: Push Notification Copy**

**Hypothesis**: Friendly, personal tone performs better than generic reminders

**Variants**:
- A (Control): "Track your nutrition today"
- B (Test): "สวัสดี Ploy! Don't break your 5-day streak 🔥"

**Metric**: Notification click-through rate, D1 retention
**Expected Impact**: +30% CTR for variant B
**Sample Size**: 500 users per variant
**Duration**: 1 week

---

### A/B Testing Best Practices

**Statistical Rigor**:
- Calculate required sample size (power analysis)
- Run tests for minimum 1 week (account for day-of-week effects)
- Ensure 95% confidence, 80% power
- Use tools: Optimizely, VWO, or custom implementation

**Avoiding Pitfalls**:
- Don't peek at results early (wait for statistical significance)
- Test one variable at a time
- Ensure variants are truly random
- Account for seasonality and external events

---

## Success Metrics & KPIs

### Product-Market Fit Indicators

**Qualitative**:
- **NPS > 50**: Users would recommend to friends
- **40% "Very Disappointed" Rule**: If 40%+ users would be "very disappointed" if product went away (Sean Ellis test)

**Quantitative**:
- **25% D30 Retention**: Users stick around for a month
- **>1.5 Scans/User/Day**: Daily engagement
- **<THB 400 CAC**: Customer acquisition cost is sustainable

---

### North Star Metric

**"Weekly Active Thai Food Scans"**
- Combines engagement (scans) with value delivery (Thai food specificity)
- Leading indicator of retention and monetization
- Aligns team around core value proposition

---

### OKRs (Objectives & Key Results)

**Objective 1: Achieve Product-Market Fit**

**Key Results**:
- KR1: 25% D30 retention
- KR2: NPS > 50
- KR3: 10,000 MAU (Month 6)

**Objective 2: Deliver Delightful UX**

**Key Results**:
- KR1: SUS score > 80
- KR2: 90%+ AI scan accuracy for Thai food
- KR3: <60 seconds to first scan

**Objective 3: Build Sustainable Business**

**Key Results**:
- KR1: 4% free-to-paid conversion
- KR2: THB 9.3M revenue (Year 1)
- KR3: LTV:CAC ratio > 3:1

---

## Conclusion

This pre-design validation plan provides a comprehensive framework for testing and validating NutriVision AI's UX before, during, and after launch.

**3-Phase Approach**:
1. **Wireframes**: Validate IA and flows
2. **Prototypes**: Validate UI and interactions
3. **Beta**: Validate with real usage

**Success Criteria**:
- Usability: SUS > 75, NPS > 50
- Engagement: D30 retention > 25%
- Conversion: Free-to-paid > 4%

**Next Steps**:
1. Create wireframes (Week 1-2)
2. Recruit Phase 1 participants (Week 2)
3. Conduct wireframe tests (Week 3)
4. Iterate and move to prototypes (Week 4+)

---

**With this validation plan, we'll build a product users love, not just a product we think they'll love. Let's test early and often! 🧪✅**
