# Contract Schema Impact Review

> **Objective:** Assess the impact of changing the `ContractStatus` enum in Prisma on existing systems, tests, UI, and data.
> **Date:** 2026-07-08

## 1. Current State vs Proposed State

**Current Prisma Enum:**
```prisma
enum ContractStatus {
  DRAFT
  ACTIVE
  EXPIRING
  ENDED
  CANCELLED
}
```

**Proposed Prisma Enum (from FSM):**
```prisma
enum ContractStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  ACTIVE
  EXPIRING
  EXPIRED
  TERMINATED
  CANCELLED
}
```

**Current Shared DTO Enum (Mismatched!):**
```typescript
export const ContractStatusEnum = z.enum(['ACTIVE', 'EXPIRED', 'TERMINATED']);
```

## 2. Affected Files

1. `packages/database/prisma/schema.prisma` (Definition)
2. `packages/database/prisma/seed.ts` (Uses `ContractStatus.ACTIVE` and `ContractStatus.EXPIRING`)
3. `packages/shared/src/contracts/contracts.dto.ts` (Mismatched DTO needs alignment)
4. `apps/api/src/contracts/contracts.controller.ts` (Uses `input.status as any` and direct assignments)
5. `apps/api/src/contracts/contracts.service.ts` (Status filtering in `listContracts`)
6. `apps/web/components/contracts/OperationsContractRow.tsx` (Frontend currently uses Vietnamese hardcoded strings like `"Đang hiệu lực" | "Sắp hết hạn" | "Chờ ký" | "Có công nợ" | "Đã chấm dứt" | "Chờ gia hạn"`)

*Note: Invoices Service does not directly query `ContractStatus` currently, it queries `contractId`.*

## 3. Breaking Risks

- **Seed Data Breakage:** The `seed.ts` file relies on existing enums (`ACTIVE`, `EXPIRING`). The new enums include these, so existing seed scripts *might* not break syntax-wise, but they will bypass `PENDING_APPROVAL` and `APPROVED`.
- **Database Migration:** Changing an ENUM type in PostgreSQL can be tricky. Prisma handles it by casting or recreating the ENUM. Existing rows with `ENDED` will fail to migrate unless explicitly mapped to `EXPIRED` or `TERMINATED` beforehand.
- **API Breakage:** The frontend or third-party consumers using the API might be sending mismatched string values. The controller casts `input.status as any`, bypassing type safety.
- **UI Breakage:** Frontend components matching on hardcoded strings will lose parity with the backend.

## 4. Migration Strategy

To safely deploy this change:

1. **Phase 1 (Code Prep):**
   - Update `ContractStatusEnum` in `@homeland/shared` to perfectly match the proposed Prisma enum.
   - Update `OperationsContractRow.tsx` and related UI components to map the new enum values to localized Vietnamese labels.
2. **Phase 2 (Data Migration - Pre-Schema):**
   - We must handle existing `ENDED` records. Create a Prisma migration script to `UPDATE "Contract" SET "status" = 'TERMINATED' WHERE "status" = 'ENDED'`.
3. **Phase 3 (Schema Migration):**
   - Update `schema.prisma`.
   - Run `npx prisma migrate dev --name update_contract_status_enum` to apply the enum changes at the DB level.
4. **Phase 4 (Validation):**
   - Run `seed.ts` to ensure seeding works.
   - Run `npm run verify:prod` to ensure no cascading failures on Customer or Property E2E.

## 5. Compatibility Adapter Plan

Since the DTOs and Prisma enums are currently out of sync, the `ContractsController` uses an unsafe `as any` cast. 
**Plan:** Remove `as any`. Use strict Zod parsing with `.nativeEnum(ContractStatus)` or a 1-to-1 Zod enum. Ensure any frontend payload exactly matches the new Prisma enum.

## 6. Rollback Plan

If the migration fails in staging:
1. Revert the Git commit.
2. Run `npx prisma migrate resolve --rolled-back ...` or apply a down-migration that maps `TERMINATED`/`EXPIRED` back to `ENDED`, and drops `PENDING_APPROVAL`/`APPROVED`.

## 7. Test Impact

- Existing tests (Customer, Property) do NOT heavily rely on Contract creation yet, as the UI for it is not built.
- `seed.ts` is the primary test victim. It will need to be verified locally.

## 8. Recommended First Safe Commit

**Target Commit:** `chore(db): update ContractStatus enum and align DTOs`

**Contents:**
- `schema.prisma` enum updates.
- `contracts.dto.ts` updates.
- `Prisma Migration` generated files (with manual SQL to migrate `ENDED` to `TERMINATED`).
- `seed.ts` adjustments if necessary.

---
**Status:** Ready for implementation of the Schema changes.
