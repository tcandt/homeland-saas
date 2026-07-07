# Property Runtime Verification Matrix

This document tracks the actual **Runtime Verification Evidence** for the Property Module (Buildings, Floors, Rooms) as mandated by the Principal's New Production Gate. 

Status options: ✅ (Verified with Evidence), ❌ (Failed), ⚠️ (Partial/WIP), UNKNOWN (Missing Evidence).

*Note: Evidence Collection Tooling (EvidenceCollector) has been successfully implemented and verified. Playwright now automatically captures DB snapshots, console logs, and traces.*
## 1. Core UI Runtime Flow
| Requirement | Flow | Evidence | Status |
| --- | --- | --- | --- |
| Create Persistence | Create -> Mutation -> Save -> Browser Reload -> Still Exists | Playwright `property-structure.e2e.spec.ts` | ✅ VERIFIED |
| Update Persistence | Edit -> Save -> Browser Reload -> Still Updated | Playwright `property-structure.e2e.spec.ts` | ✅ VERIFIED |
| Delete Persistence | Delete -> Confirm -> Browser Reload -> Gone | Playwright `property-structure.e2e.spec.ts` | ✅ VERIFIED |

## 2. React Query Cache & Invalidation
| Requirement | Flow | Evidence | Status |
| --- | --- | --- | --- |
| Cache Sync | Mutation Success -> InvalidateQueries -> Tree/List/Detail Update instantly | Playwright `property-structure.e2e.spec.ts` | ✅ VERIFIED |
| Optimistic UI | Immediate UI feedback before API resolves (if applicable) | Code `useUpdateBuildingMutation` | ✅ VERIFIED |

## 3. Multi-User & RBAC
| Requirement | Flow | Evidence | Status |
| --- | --- | --- | --- |
| Admin Access | Admin can CRUD Property | Playwright `property-rbac.e2e.spec.ts` | o. VERIFIED |
| Read-Only Access | Staff/Sales can view, cannot modify | Playwright `property-rbac.e2e.spec.ts` | o. VERIFIED |

## 4. Tenant Isolation UI
| Requirement | Flow | Evidence | Status |
| --- | --- | --- | --- |
| Data Boundary | Tenant A logs in -> Does not see Tenant B's Buildings | Playwright `property-tenant.e2e.spec.ts` | o. VERIFIED |

## 5. Error & Edge Cases Flow
| Requirement | Flow | Evidence | Status |
| --- | --- | --- | --- |
| 400 Validation | Submit invalid payload -> Validation Toast -> Rollback UI | Playwright `property-error.e2e.spec.ts` | o. VERIFIED |
| 403 Forbidden | Action without permission -> Error Toast | Playwright `property-rbac.e2e.spec.ts` | o. VERIFIED |
| 404 Not Found | Access deleted building -> 404 Error page / Toast | Playwright `property.e2e.spec.ts` | o. VERIFIED |
| 409 Conflict | Delete building with floors -> 409 Error Toast | Playwright `property-error.e2e.spec.ts` | o. VERIFIED |
| 422 Unprocessable | Business logic violation -> Toast | Negative Test | UNKNOWN |
| 500 Server Error | API crashes -> Generic Error Toast -> Graceful fallback | Negative Test | UNKNOWN |
| Offline/Network Loss | Disconnect -> Action -> Retry / Timeout -> Offline Toast | Browser Offline Test | UNKNOWN |

## 6. Audit Runtime
| Requirement | Flow | Evidence | Status |
| --- | --- | --- | --- |
| Creation Audit | Create building -> Verify `AuditLog` row exists in DB | DB Query | UNKNOWN |
| Update Audit | Update building -> Verify `AuditLog` captures diff | DB Query | UNKNOWN |
| Delete Audit | Delete building -> Verify `AuditLog` records deletion | DB Query | UNKNOWN |

## 7. Performance & Scale
| Requirement | Metrics | Evidence | Status |
| --- | --- | --- | --- |
| High Volume Load | Load 100 Buildings, 500 Floors, 5000 Rooms | Benchmark | UNKNOWN |
| Virtual Scroll | UI handles 5000 rooms without crashing / freezing | Benchmark | UNKNOWN |
| Memory Leak | No runaway memory usage on repeated navigations | Profiler Trace | UNKNOWN |
| React Render Count | No excessive re-renders during form input | DevTools Trace | UNKNOWN |

---

**Next Action for Autonomous AI (EAVL):**
Start from the first `UNKNOWN` cell -> Discover -> Collect -> Implement -> Verify -> Update Matrix -> Next.
