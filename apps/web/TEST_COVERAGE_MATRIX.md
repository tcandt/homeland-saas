# Test Coverage Matrix (Sprint 3.10.5)

## 1. Viewports & Devices
All tests are executed against the following 7 standard Playwright viewports configured in `playwright.config.ts`:
- Desktop Chrome (1920x1080)
- Laptop Chrome (1440x900)
- Tablet Safari (1024x768)
- iPad Mini (768x1024)
- Mobile Chrome (430x932)
- Mobile Safari (390x844)
- Mobile Safari Small (375x667)

*Coverage*: 100% of defined viewports passed for the vertical slice.

## 2. Test Modules (Level 1: Smoke)
| Module | Spec File | Status | Notes |
|--------|-----------|--------|-------|
| **Auth & Dashboard** | `auth-dashboard.smoke.spec.ts` | ✅ PASS | Admin Login, session caching, skeleton, KPI loading, 500 error mock, layout visibility, logout. |
| **Buildings** | `buildings.smoke.spec.ts` | ✅ PASS | Desktop/Mobile renders, Empty State, Error State, Axe Checks. |
| **Sales (Customers)** | `customers.smoke.spec.ts` | ✅ PASS | Viewports, Axe, Drawer, Lists. |
| **Sales (Contracts)** | `contracts.smoke.spec.ts` | ✅ PASS | Drawer, KPI, Empty, Error states. |
| **Sales (Deposits)** | `deposits.smoke.spec.ts` | ✅ PASS | Mobile Flow, Mobile/Desktop unified layout. |
| **Sales (Invoices)** | `invoices.smoke.spec.ts` | ✅ PASS | Safe drawer clicks, hidden right panel logic. |
| **Finance** | `finance.smoke.spec.ts` | ✅ PASS | Ledger Virtualization scroll, Drawer, Dashboard Mock. **LEVEL 1 SMOKE COMPLETE**. |
| **Documents** | `documents.smoke.spec.ts` | ⏳ PENDING | Level 2 Core Regression |
| **AI** | `ai.smoke.spec.ts` | ⏳ PENDING | Level 2 Core Regression |

## 3. Playwright Core Standards
| Standard | Implemented | Status |
|----------|-------------|--------|
| **0 Console Errors** | Yes (`global-handler.ts`) | ✅ PASS |
| **Axe Accessibility**| Yes (with minor exclusions) | ✅ PASS |
| **Visual Regression**| Yes (`toHaveScreenshot`) | ✅ PASS |
| **Data-TestId POM** | Yes (`DashboardPage.ts` etc)| ✅ PASS |
| **Session Fixtures** | Yes (`admin.fixture.ts`) | ✅ PASS |
