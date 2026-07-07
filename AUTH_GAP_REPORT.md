# Auth Foundation Gap Analysis Report

## 1. Existing Capabilities
### Backend Endpoints
- `POST /auth/login` (email/phone login)
- `POST /auth/logout` (revokes refresh token)
- `POST /auth/refresh` (token rotation)
- `GET /auth/me` (get profile/permissions)
- `POST /auth/change-password`

### Database Fields (Prisma Schema)
The `User` model currently supports:
- `refreshTokenHash`
- `lastLoginAt`, `lastLoginIp`, `lastUserAgent`
- `passwordResetHash`, `passwordResetExpires`
- `emailVerifiedAt`, `emailVerificationHash`, `emailVerificationExpires`
- `status` enum (`ACTIVE`, `PENDING_VERIFICATION`, `DISABLED`, `LOCKED`)

The `AuditLog` model supports Auth events (`REGISTER`, `LOGIN`, `LOGIN_FAILED`, etc.).

---

## 2. Identified Gaps

### Missing Backend Endpoints
- `POST /auth/register` (Missing entirely)
- `POST /auth/forgot-password` (Missing entirely)
- `POST /auth/reset-password` (Missing entirely)
- `POST /auth/verify-email` (Missing entirely)

### Fake / Mock Implementations (Production Blockers)
- **Frontend Mocks**: The UI flows for Register (`register/page.tsx`), Forgot Password (`forgot-password/page.tsx`), and Reset Password (`reset-password/page.tsx`) are purely mocked using `setTimeout`. They do not connect to any actual backend API.
- **Backend TODOs**: ~~The `auth.service.ts` contains `TODO` comments indicating that `refreshTokenHash` and `lastLoginAt` are not actually being saved or verified, despite the DB schema supporting it.~~ *(Fixed in Commit #1)*

### Security & Business Logic Gaps
- **Account Locking**: Missing brute-force protection (no tracking of failed login attempts to transition status to `LOCKED`).
- **Audit Logging**: Need to ensure every auth action (login, logout, refresh, password change) actually writes to `AuditLog`.
- **RBAC Impact**: User creation during registration must automatically link to a default Tenant and assign a default Role.

### Test Gaps
- Unit/Integration/E2E tests for the complete Auth flow are either missing or bypassing the database.

---

## 3. Recommended First Implementation Commit

**Commit #1: Auth Database Implementation**
- Modify `auth.service.ts` to actually utilize `refreshTokenHash`, `lastLoginAt`, `lastLoginIp`, and `lastUserAgent`.
- Implement writes to `AuditLog` for all Auth actions.
- Ensure the database constraints and default values align with these changes.
- (Note: No prisma schema migration is strictly required right now since the fields exist, but the code must be updated to use them.)

*(Subsequent commits will add the missing API endpoints, and finally replace the frontend `setTimeout` mocks with real API calls.)*
