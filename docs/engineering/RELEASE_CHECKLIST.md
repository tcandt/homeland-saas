# Production Release Checklist

> Must be 100% complete before any module advances to PRODUCTION READY.
> Version: 2.0 | Effective: 2026-07-08

---

## Section 1: Business Verification

- [ ] BUSINESS_VERIFICATION_MATRIX: all flows for this module = 100%
- [ ] All gates verified: UI, API, DB, Audit, Tenant, RBAC, Console, Runtime, Persist, E2E, Prod
- [ ] No ⏳ gates remaining for module's flows
- [ ] Business flow run against PRODUCTION_DATASET v[current version]

## Section 2: Quality Gates

- [ ] Backend Unit Tests: PASS
- [ ] Backend Integration Tests: PASS
- [ ] E2E Suite on production build: PASS (0 failures)
- [ ] Smoke Suite: PASS
- [ ] Regression Suite: PASS
- [ ] Concurrency Tests: PASS (no race conditions detected)
- [ ] Performance baseline: response time ≤ 500ms (p95) on all CRUD endpoints
- [ ] Accessibility: WCAG 2.1 AA for all forms in this module

## Section 3: Security

- [ ] OWASP Top 10 scan: PASS
- [ ] SQL injection: PASS (all inputs validated via Zod schema)
- [ ] RBAC enforcement: all endpoints return 403 for unauthorized roles
- [ ] Tenant isolation: no cross-tenant data leak confirmed
- [ ] JWT expiry handling: confirmed (401 → redirect to login)
- [ ] CORS policy: only allowed origins can call API
- [ ] Sensitive data not logged (passwords, tokens, PII redacted in logs)

## Section 4: Database

- [ ] All migrations run cleanly: `prisma migrate deploy`
- [ ] No nullable field added without default in production migration
- [ ] Soft-delete pattern applied: deletedAt field present and filtered in queries
- [ ] Indexes present on: all FK fields, frequently filtered columns
- [ ] DB snapshot before/after major operations: CAPTURED in evidence

## Section 5: Observability

- [ ] Structured logging (JSON) active on all API routes
- [ ] `x-correlation-id` propagated through request chain
- [ ] Error logging: all unhandled exceptions logged with stack trace
- [ ] Audit log: CREATE/UPDATE/DELETE events present in `AuditLog` table
- [ ] Health endpoint `/api/health` returns 200

## Section 6: Operations

- [ ] Backup procedure documented and tested: `docs/operations/BACKUP.md`
- [ ] Restore procedure tested: `docs/operations/RESTORE.md`
- [ ] Rollback plan documented: `docs/runbooks/ROLLBACK.md`
- [ ] Deployment runbook executed dry-run: `docs/runbooks/DEPLOY.md`
- [ ] Disaster recovery scenario tested: `docs/operations/DISASTER_RECOVERY.md`

## Section 7: Root Cause Hygiene

- [ ] All P0/P1 RCAs for this module: CLOSED
- [ ] All P2 RCAs for this module: CLOSED or documented with workaround
- [ ] ROOT_CAUSE_DATABASE.md updated with all findings from this release cycle
- [ ] KNOWN_ISSUES.md lists any accepted P3 deferrals with justification

## Section 8: Documentation

- [ ] API documentation (Swagger): up-to-date for all endpoints in module
- [ ] Product spec updated: `docs/product/FEATURE_SPEC.md`
- [ ] Data dictionary updated: `docs/product/DATA_DICTIONARY.md`
- [ ] BUSINESS_VERIFICATION_MATRIX: all entries final
- [ ] PRODUCTION_SCORE: reflects final verified state
- [ ] MODULE_STATUS: correct level set (PRODUCTION READY)
- [ ] EOS_OPERATOR_DASHBOARD: regenerated

## Section 9: Sign-Off

- [ ] Technical lead approval
- [ ] Business owner approval (if applicable)
- [ ] All checklist items above: CHECKED

---

## Release Readiness Score

| Section | Items | Checked | % |
|---------|-------|---------|---|
| 1. Business Verification | 4 | 0 | 0% |
| 2. Quality Gates | 8 | 0 | 0% |
| 3. Security | 7 | 0 | 0% |
| 4. Database | 5 | 0 | 0% |
| 5. Observability | 5 | 0 | 0% |
| 6. Operations | 5 | 0 | 0% |
| 7. Root Cause Hygiene | 4 | 0 | 0% |
| 8. Documentation | 8 | 0 | 0% |
| 9. Sign-Off | 3 | 0 | 0% |
| **TOTAL** | **49** | **0** | **0%** |

**Current Release Readiness: 0% — System is NOT PRODUCTION READY**
