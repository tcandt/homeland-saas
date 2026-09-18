# CORE-10.02 — Rehearsal Import (staging only)

`homeland_staging_authoritative_v2` is the only permitted target. The legacy
database is never an import source directly: restore the frozen dump into a new
isolated database whose name contains `core1002` and `restore`, then use that
database URL as `--source-url`. The runner accepts only `SELECT` activity on
the source and checks the frozen source SHA-256 before planning.

```powershell
# DB names shown are examples only. Never run against localhost:5430/homeland.
pg_restore --no-owner --no-acl --dbname postgresql://.../homeland_core1002_source_restore .codex-backups/legacy-source-core1002/2026-09-13T03-28-20-992Z/database.dump

node scripts/core1002-rehearsal.js --mode DRY_RUN --run-id core1002-20260913-a `
  --source-dump .codex-backups/legacy-source-core1002/2026-09-13T03-28-20-992Z/database.dump `
  --source-url postgresql://.../homeland_core1002_source_restore `
  --target-url postgresql://.../homeland_staging_authoritative_v2
```

Run the exact DRY_RUN a second time and compare its immutable plan/totals
artifact. Only then run `--mode APPLY` with the same `run-id`; `--mode RESUME`
continues only from an immutable committed batch checkpoint. Evidence is stored
under `.codex-runtime/core1002-evidence/` and is intentionally ignored by Git.
The runner computes the SHA-256 of `--source-dump` itself and requires its
neighbouring manifest; a caller-supplied checksum is never accepted as proof.

For the focused fault test only, set `CORE1002_TEST_FAULTS=1` and pass
`--fault-after-commit 1`; it interrupts after the first committed target batch
but before its filesystem checkpoint. `RESUME` must recover the signed batch
from `AuditLog`, then reach the same totals without a duplicate row. This flag
is rejected unless the explicit test environment variable is present.

The allow-list is limited to core tenancy, property, occupancy, contract,
deposit, billing/payment, expense, bank route, and Hunonic meter records.
`BillingSnapshot`, `MonthlySettlementRun`, and `DepositLedgerEntry` are never
fabricated: they remain BACKFILL/REVIEW_REQUIRED and must use their reviewed
domain scripts after the import evidence is approved. Customer duplicate
identity groups and duplicate non-empty payment provider references are placed
in the review queue; dependents without a resolvable imported parent are not
inserted.
