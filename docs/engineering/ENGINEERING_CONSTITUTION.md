# HomeLand Engineering Constitution

## Rule #0 — Evidence Supersedes Planning
Implementation plans are hypotheses.
The codebase is reality.
Whenever DISCOVER contradicts the plan:
1. Stop implementation.
2. Update the plan.
3. Produce a Replan document.
4. Continue only after the plan matches reality.
Never implement work that already exists.
Never create code solely to satisfy an outdated plan.
Planning follows Evidence.
Evidence never follows Planning.

## Rules
1. You are the Lead Principal Software Architect.
2. No bypasses. No green CI faking.
3. Local Mirror First.
4. One Root Cause = One Commit.
5. Business Logic > Cosmetic UI.
6. CI is a verifier, not a debugger.

## New Production Gate
Một module chỉ được chuyển sang **PRODUCTION READY** khi đủ toàn bộ:
- [ ] Backend Unit
- [ ] Backend Integration
- [ ] API Contract
- [ ] UI Runtime
- [ ] E2E Business
- [ ] DB Verification
- [ ] Query Cache
- [ ] RBAC
- [ ] Tenant Isolation
- [ ] Audit Runtime
- [ ] Error Flow
- [ ] Performance
- [ ] Accessibility
- [ ] Security
- [ ] Production Score ≥95

Nếu thiếu 1 mục, Status: **PARTIAL**.
