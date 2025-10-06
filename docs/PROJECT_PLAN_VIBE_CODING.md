# RCRT Vibe Coding Platform - Project Plan

**Owner**: Product Team  
**Last Updated**: October 6, 2025  
**Status**: VALIDATION PHASE - No active development until PMF confirmed

---

## Current State (October 2025)

### What's Operational
- ✅ RCRT backend (breadcrumbs, semantic search, events)
- ✅ Agent system (AI agents respond to events)
- ✅ Tool system (12 working tools)
- ✅ Context-builder (assembles relevant context)
- ✅ Dashboard (visualization and admin)
- ✅ Browser extension (chat interface)

### What's Not Built
- ❌ Code editor interface
- ❌ File system integration
- ❌ VS Code Web integration
- ❌ Project management
- ❌ Deployment pipeline

### The Reality
**We can chat with AI about code, but we cannot actually write or edit code through the system.**

---

## Phase 0: Product-Market Fit Validation (CURRENT PHASE)

### Timeline: 2-4 weeks
### Budget: <$10,000
### Team: 1 product person + 1 engineer (part-time)

### Objective
**Prove that RCRT's context management creates measurable value BEFORE building expensive frontend.**

### Experiments

#### Experiment 1: Developer Time Savings
**Hypothesis**: Semantic search saves developers 30+ minutes/day

**Test**:
1. Recruit 10 developers from partner companies
2. Give access to dashboard + browser extension
3. Track: Time to find relevant code (before vs. after)
4. Measure: Manual search time vs. RCRT semantic search time

**Success Criteria**: 50%+ time reduction  
**Timeline**: 1 week setup, 2 weeks data collection

#### Experiment 2: Non-Technical User Guardrails
**Hypothesis**: Guardrails let PMs generate safe code without technical knowledge

**Test**:
1. Create restricted agent (UI components only, no backend access)
2. Give 5 PMs access
3. Track: % of AI-generated code that's acceptable vs. dangerous
4. Measure: Security violations, architectural breaks

**Success Criteria**: 80%+ acceptable code, 0 security violations  
**Timeline**: 1 week setup, 2 weeks testing

#### Experiment 3: Enterprise Compliance Value
**Hypothesis**: Built-in audit features save compliance teams weeks of work

**Test**:
1. Simulate breadcrumb activity (create, update, access patterns)
2. Security team generates compliance report
3. Measure: Time to generate report (manual vs. RCRT)
4. Compare: Manual audit (weeks) vs. RCRT query (minutes)

**Success Criteria**: 95%+ time reduction  
**Timeline**: 1 week

#### Experiment 4: Multi-Agent Collaboration
**Hypothesis**: Specialized agents can deliver features end-to-end

**Test**:
1. Create 3 agents: UI specialist, backend specialist, tester
2. Request simple feature: "Add forgot password link"
3. Measure: Can agents collaborate without human intervention?
4. Track: Handoffs, context quality, final output

**Success Criteria**: Complete feature with <3 human interventions  
**Timeline**: 2 weeks

### Decision Point (End of Week 4)

**If experiments succeed (3+ pass)**:
- ✅ Proceed to Phase 1: Build minimal frontend
- ✅ Raise seed funding ($500K-1M)
- ✅ Hire 2 additional engineers

**If experiments fail (2+ fail)**:
- ⚠️ Pivot to Option C (Context API for existing tools)
- ⚠️ OR reconsider product strategy
- ⚠️ OR shut down

---

## Phase 1: Minimal Vibe Coding MVP (PENDING VALIDATION)

### Timeline: 6 weeks (starts after Phase 0 validates)
### Budget: $60,000 (2 engineers)
### Team: 1 frontend, 1 backend

### Goal
**Non-technical users can describe features and see generated code in a web editor.**

### Features

#### Week 1-2: Basic Editor Setup
- Embed Monaco editor (VS Code's editor component)
- Simple file tree (read-only)
- Syntax highlighting (TypeScript, JavaScript, Python)
- Single-file editing

**Deliverable**: Can view and edit one file at a time

#### Week 3-4: AI Integration
- AI response displays in editor
- "Generate Code" button
- Simple diff view (show before/after)
- Accept/reject changes

**Deliverable**: User asks for code, AI generates, user sees in editor

#### Week 5-6: Basic Project Support
- Create new project (templates: React, Next.js, FastAPI)
- Install dependencies (npm install)
- Save files to server storage
- Export as ZIP

**Deliverable**: End-to-end: idea → generated code → downloadable project

### Success Metrics
- **User can generate working React component**: Yes/No
- **Time from idea to code**: <2 minutes
- **User satisfaction**: 7+/10

### What's Still Missing After Phase 1
- No git integration
- No deployment
- No terminal
- No debugging
- Single-user only (no collaboration)

---

## Phase 2: Professional IDE Experience (PENDING PHASE 1)

### Timeline: 8 weeks
### Budget: $120,000 (3 engineers)
### Team: 2 frontend, 1 backend

### Goal
**Provide VS Code-quality experience with RCRT's superior context.**

### Features

#### Week 1-3: VS Code Web Integration
- Clone and customize VS Code Web (open source)
- Integrate RCRT authentication
- Add RCRT context panel (sidebar)
- Connect to breadcrumb API

**Deliverable**: VS Code Web running with RCRT backend

#### Week 4-5: Inline AI Suggestions
- Trigger: User types comment "// Add login button"
- AI generates code
- Inline diff view (like Copilot)
- Accept with Tab key

**Deliverable**: Copilot-like experience with RCRT context

#### Week 6-7: Multi-File & Git
- Edit multiple files simultaneously
- Git integration (commit, push, pull)
- Branch management
- Merge conflict resolution (AI-assisted)

**Deliverable**: Full source control workflow

#### Week 8: Polish
- Performance optimization
- Keyboard shortcuts
- User onboarding
- Error handling

**Deliverable**: Production-ready MVP

### Success Metrics
- **Professional developers adopt**: 20+ daily active users
- **Feature velocity**: 2x faster than without RCRT
- **Code quality**: No regression in review pass rate

---

## Phase 3: Enterprise Scale (PENDING PHASE 2)

### Timeline: Ongoing (3-6 months)
### Budget: $200,000 (2 engineers long-term)
### Team: 1 frontend, 1 backend, 1 DevOps

### Features

#### Enterprise Admin
- Multi-tenant management dashboard
- User role configuration UI
- Cost tracking per team
- Usage analytics

#### Security & Compliance
- SSO integration (Okta, Azure AD)
- SAML support
- Compliance export tools
- Security audit logs dashboard

#### Collaboration
- Real-time co-editing
- Code review workflows
- Approval gates
- Team breadcrumb sharing

#### Advanced Features
- Local LLM support (air-gapped deployments)
- Custom tool creation UI
- Agent marketplace
- Workflow templates

---

## Alternative Path: Context API Strategy

### If Frontend Seems Too Expensive/Risky

### Timeline: 4-6 weeks
### Budget: $50,000 (1 engineer)

### Goal
**Position RCRT as context backend for ANY coding tool.**

### Deliverables

1. **VS Code Extension** (not full IDE)
   - Sidebar showing relevant breadcrumbs
   - Semantic search from editor
   - Inject context into Copilot
   - Works alongside existing tools

2. **Cursor Integration**
   - RCRT context replaces Cursor's context
   - Better semantic search
   - Event updates

3. **JetBrains Plugin**
   - Same as VS Code extension
   - Reach Java/Kotlin developers

4. **API Documentation**
   - Public API docs
   - Integration guides
   - SDKs (TypeScript, Python)

### Business Model
- **Free tier**: 1K breadcrumbs, 100 searches/day
- **Pro**: $20/user/month - unlimited breadcrumbs, priority support
- **Enterprise**: Custom pricing - on-premise, SSO, SLA

### Advantages
- **Faster to market**: 6 weeks vs. 6 months
- **Lower risk**: Leverage existing IDE user bases
- **Cheaper**: $50K vs. $200K+ development
- **Focused**: Sell what we're good at (context), not IDE (where we're weak)

---

## Resource Requirements

### Phase 0 (Validation)
- **Team**: 1 product person (20 hours/week), 1 engineer (10 hours/week)
- **Duration**: 2-4 weeks
- **Cost**: <$10K
- **Infrastructure**: Current Docker setup (no new costs)

### Phase 1 (Minimal Frontend)
- **Team**: 1 frontend engineer, 1 backend engineer (full-time)
- **Duration**: 6 weeks
- **Cost**: $60K salary + $5K infrastructure = $65K
- **Infrastructure**: Add file storage, increase DB capacity

### Phase 2 (Full IDE)
- **Team**: 2 frontend engineers, 1 backend engineer (full-time)
- **Duration**: 8 weeks
- **Cost**: $120K salary + $10K infrastructure = $130K
- **Infrastructure**: CDN for static assets, more compute

### Phase 3 (Enterprise)
- **Team**: 2 engineers long-term (6+ months)
- **Duration**: Ongoing
- **Cost**: $200K salary + $20K infrastructure annually
- **Infrastructure**: Multi-region deployment, monitoring

### Alternative Path (API)
- **Team**: 1 engineer (full-time)
- **Duration**: 4-6 weeks
- **Cost**: $50K salary + $5K marketing materials = $55K
- **Infrastructure**: API gateway, documentation site

---

## Risks & Mitigation

### Risk 1: PMF Doesn't Validate
**Probability**: 30%  
**Impact**: High (wastes frontend investment)  
**Mitigation**: Run Phase 0 experiments FIRST  
**Fallback**: Pivot to API strategy or shut down

### Risk 2: VS Code Web Integration Harder Than Expected
**Probability**: 40%  
**Impact**: Medium (delays timeline 2-4 weeks)  
**Mitigation**: Start with Monaco editor (simpler), upgrade to VS Code later  
**Fallback**: Ship minimal editor, iterate

### Risk 3: Enterprises Want On-Premise Only
**Probability**: 50%  
**Impact**: Medium (need to package for easy deployment)  
**Mitigation**: Already Docker-based, add Kubernetes helm charts  
**Fallback**: Offer deployment support service

### Risk 4: Competition Ships Similar Features
**Probability**: 60% (GitHub will add semantic search eventually)  
**Impact**: High (erodes competitive advantage)  
**Mitigation**: Speed to market + enterprise features (they're B2C-focused)  
**Fallback**: Emphasize compliance and security (harder for them to add)

---

## Success Metrics by Phase

### Phase 0 (Validation)
- ✅ 10 beta users recruited
- ✅ 3+ experiments show positive results
- ✅ 2+ letters of intent from enterprise customers
- ✅ Validated willingness to pay for context quality

### Phase 1 (MVP)
- ✅ User can generate working code in web editor
- ✅ 20+ daily active users
- ✅ 7+/10 user satisfaction
- ✅ 1+ paying customer

### Phase 2 (Full IDE)
- ✅ 100+ daily active users
- ✅ 2x feature velocity vs. baseline
- ✅ 5+ paying enterprise customers
- ✅ $50K+ MRR

### Phase 3 (Enterprise Scale)
- ✅ 1000+ daily active users
- ✅ 20+ enterprise customers
- ✅ $500K+ MRR
- ✅ Series A fundraise ($5M+)

---

## Timeline Summary

### Conservative Path (Validate First)
```
Oct 2025: Phase 0 - PMF Validation (4 weeks)
Nov 2025: Decision point
Dec 2025 - Jan 2026: Phase 1 - Minimal Frontend (6 weeks) IF validated
Feb - Mar 2026: Phase 2 - Full IDE (8 weeks)
Apr - Sep 2026: Phase 3 - Enterprise features (6 months)

First revenue: January 2026 (3 months)
Series A ready: September 2026 (12 months)
```

### Aggressive Path (Build Now)
```
Oct - Nov 2025: Phase 1 - Minimal Frontend (6 weeks)
Dec 2025 - Jan 2026: Phase 2 - Full IDE (8 weeks)
Feb - Jul 2026: Phase 3 - Enterprise features (6 months)

First revenue: December 2025 (2 months) - RISKY if no PMF
Series A ready: July 2026 (9 months)
```

### API-First Path (Hedge Bets)
```
Oct - Nov 2025: Build VS Code extension + API docs (6 weeks)
Dec 2025: Beta launch with existing IDE users
Jan - Feb 2026: Iterate based on feedback
Mar 2026: Decision - Full IDE or stay API-focused

First revenue: December 2025 (2 months)
Series A ready: June 2026 (8 months) OR pivot to profitable API business
```

---

## Recommendation to Leadership

### Immediate Action (This Week)
1. ✅ **Stop new feature development** (as requested)
2. ✅ **Document current state** (this document)
3. 📋 **Define validation experiments** (detailed above)
4. 📋 **Recruit 10 beta testers** (target: enterprises with 100+ devs)
5. 📋 **Create measurement framework** (what metrics prove value?)

### Next 4 Weeks
1. 🧪 **Run experiments** (with beta testers)
2. 📊 **Collect data** (time savings, accuracy, satisfaction)
3. 🗣️ **Customer discovery** (willingness to pay, feature requests)
4. 💰 **Pricing validation** ($20/user/month? $5K/company/year? API access?)

### Week 5: Decision Point
**Three possible outcomes**:

#### Outcome A: Strong PMF Signal (3+ experiments succeed, 5+ customers interested)
**Action**: Greenlight Phase 1 (minimal frontend)  
**Budget**: $65K for 6 weeks  
**Team**: Hire 1 frontend engineer immediately  
**Timeline**: Ship MVP by mid-December

#### Outcome B: Weak PMF Signal (1-2 experiments succeed)
**Action**: Pivot to API strategy  
**Budget**: $55K for 6 weeks  
**Team**: Current team  
**Timeline**: Ship VS Code extension by mid-December

#### Outcome C: No PMF Signal (experiments fail)
**Action**: Pivot or wind down  
**Options**:
- Pivot to different market (internal tools vs. developer tools)
- Sell technology to competitor
- Wind down gracefully

### Week 6+: Execution
Based on decision, execute Phase 1, Alternative Path, or pivot.

---

## Critical Success Factors

### For Validation to Succeed
1. **Recruit right beta testers**: Enterprises with complex codebases (100K+ LOC)
2. **Measure objectively**: Don't rely on "feels faster" - actual time measurements
3. **Get budget commitment**: "Would you pay $X?" vs. "This is cool"
4. **Test with non-technical users**: PMs, designers, not just developers

### For Frontend Build to Succeed
1. **Scope discipline**: Ship minimal working product, not feature-complete IDE
2. **Weekly demos**: Show progress every Friday, get feedback
3. **Dogfood immediately**: Use RCRT to build RCRT frontend
4. **Performance budget**: <1s from question to code displayed

### For Enterprise Sales to Succeed
1. **Security first**: Pass pen test before any enterprise demo
2. **Compliance documentation**: SOC 2 readiness checklist
3. **Professional services**: Offer deployment support (high margin)
4. **Reference customers**: Get 2-3 logos early for credibility

---

## Investment Required

### Phase 0: Validation Only
**Cash Outlay**: <$10,000
- $5K for beta tester incentives
- $3K for infrastructure (higher usage during testing)
- $2K for customer discovery (travel, meals)

**Burn Rate**: ~$40K/month (current team salaries)  
**Runway**: 6-9 months at current burn

### If Validated: Phase 1 Build
**Cash Outlay**: $65,000
- $50K for 2 engineers (6 weeks)
- $10K infrastructure scaling
- $5K design and UX

**New Burn Rate**: ~$80K/month (2 additional engineers)  
**Runway**: 4-6 months (need fundraising soon)

### If Validated: Full Build to Series A
**Total Investment**: $500K-800K
- $400K salaries (team of 4-5 for 12 months)
- $50K infrastructure
- $50K marketing and sales
- $50K legal and compliance
- $100K buffer

**Required Fundraising**: Seed round ($1M-2M) by Q1 2026

---

## Key Milestones

### Validation Phase (Oct-Nov 2025)
- [ ] Week 1: Recruit 10 beta testers
- [ ] Week 2: Run Experiment 1 (developer time savings)
- [ ] Week 3: Run Experiments 2-3 (guardrails, compliance)
- [ ] Week 4: Run Experiment 4 (multi-agent), compile results
- [ ] **Decision**: Go/No-Go on frontend build

### If Validated: Build Phase (Dec 2025 - Mar 2026)
- [ ] Week 1-2: Monaco editor + file tree
- [ ] Week 3-4: AI integration (generate → display)
- [ ] Week 5-6: Basic project management
- [ ] **Milestone**: MVP demo-able to investors
- [ ] Week 7-10: VS Code Web integration
- [ ] Week 11-12: Git integration
- [ ] **Milestone**: Beta launch to early customers
- [ ] Week 13-16: Enterprise features (SSO, admin dashboard)
- [ ] **Milestone**: First paid enterprise customer

### Revenue Milestones
- **Month 3**: First paying customer ($5K-10K annual contract)
- **Month 6**: $50K ARR (5-10 customers)
- **Month 9**: $200K ARR (15-20 customers)
- **Month 12**: $500K+ ARR → Series A ready

---

## Contingency Plans

### Scenario 1: PMF Validates but Can't Raise Funds
**Action**: Bootstrap with API strategy
- Focus on profitable integrations (vs. building full IDE)
- Charge for API access ($0.01 per 1K breadcrumbs)
- Profitable at 100 customers × $500/month = $50K MRR
- Grow organically

### Scenario 2: Frontend Takes Longer (Common in Software)
**Action**: Ship in stages
- Week 6: Ship minimal editor even if incomplete
- Week 8: Add features based on user feedback
- Week 12: "Full" launch
- Stay flexible, iterate based on usage

### Scenario 3: Enterprise Sales Cycle Too Long
**Action**: Add B2B SMB segment
- Target companies with 20-50 developers (faster sales cycle)
- Lower pricing ($2K-5K per year)
- Build volume before moving upmarket

### Scenario 4: Competition Launches Similar Features
**Action**: Emphasize differentiators
- Enterprise-first (compliance, security)
- Multi-model (not locked to GitHub's models)
- Agent architecture (specialization)
- Price competitively (undercut by 30%)

---

## Questions for Leadership

### Strategic
1. **Are we building a full IDE or a context backend?**
   - Full IDE = 12-18 months, compete with GitHub/Cursor directly
   - Context backend = 3-6 months, integrate with existing tools

2. **What's our primary market?**
   - Enterprises with 100+ developers (high ACV, long sales cycle)
   - SMBs with 10-50 developers (lower ACV, faster sales)
   - Individual developers (low ACV, needs freemium model)

3. **What's our risk tolerance?**
   - High: Build full IDE, raise big round, go big or go home
   - Medium: Build minimal frontend, validate, then decide
   - Low: API-only, profitable quickly, grow organically

### Tactical
1. **Who approves Phase 0 validation experiments?**
   - Budget: <$10K
   - Timeline: Starts immediately

2. **What metrics trigger go/no-go for Phase 1?**
   - How many experiments must succeed? (3 of 4?)
   - What user satisfaction score? (7+/10?)
   - How many letters of intent? (2-3?)

3. **When do we make the Phase 1 decision?**
   - After 4 weeks of validation?
   - After first paying customer?
   - After competitor moves?

---

## Appendix: What Competitors Are Doing

### GitHub Copilot
- **Oct 2024**: Added workspace context (crude file crawling)
- **Weakness**: No semantic search, keyword-based
- **Opportunity**: We're 10x better at context quality

### Cursor
- **Sep 2024**: Added @codebase feature
- **Weakness**: Slow indexing, no event-driven updates
- **Opportunity**: We're faster and more accurate

### Replit Agent
- **Aug 2024**: Launched AI coding for beginners
- **Weakness**: Limited to Replit environment, no enterprise features
- **Opportunity**: We target enterprises, not hobbyists

### Assessment
**We're not behind** on context technology (we're ahead). **We're behind** on user experience (they have working editors, we don't).

**Strategic choice**: Do we catch up on UX (expensive, slow) OR do we double down on context superiority (our strength) and integrate with existing UX (fast, cheap)?

---

**Next Review**: After Phase 0 validation (4 weeks)  
**Owner**: CEO + Product Lead  
**Status**: ⏸️ PAUSED - Awaiting validation results before proceeding
