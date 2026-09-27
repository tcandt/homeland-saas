# P17/P18 Staging Gate Pack

This pack is an execution contract, not evidence that either phase has passed. A phase remains open until every required artifact below is complete and independently reviewed.

## Phase Ordering

`P17 -> P18` is the release-validation path. `P19` is a separate supplementary operational workstream: it may run in parallel and is not a prerequisite for beginning or closing P17/P18. P19 must still pass before the P20 GO/NO-GO decision.

## P17: E2E Release Gate

### Staging Handover

- Deploy a clean, immutable release commit to staging. Record the complete 40-character SHA, deployment timestamp, and environment URL.
- Use an isolated, disposable database migrated by the release's checked-in migrations. Record the database identifier, migration inventory, schema fingerprint, fixture ID, and cleanup owner. Do not use `prisma db push`, historical migration edits, or a production database.
- Inject the following through the secret store only: `E2E_ENVIRONMENT=staging`, staging web/API URLs, `E2E_DATABASE_URL`, personas, internal health token, expected SHA, database ID, run ID, `E2E_DISPOSABLE_DATABASE=true`, and `RUN_DESTRUCTIVE_E2E=true`. For fixture provisioning, also inject `DEPLOY_ENV=staging`, `ALLOW_UAT_FIXTURE_PROVISION=true`, `STAGING_DB_ID` (equal to `E2E_TARGET_DB_ID`), `CORE1004_SCHEMA_FINGERPRINT`, and `FIXTURE_ID`.
- Before any fixture write, run `npm run e2e:preflight:staging`. A non-`READY` result blocks the run. The command must not be copied with secret values into tickets, chat, logs, or Git.

### Execution And Evidence

- Provision only the synthetic, masked fixture namespace using `npm run e2e:provision:core1004`; preserve its JSON output as a masked artifact.
- Run `CORE-10.04` with the same run ID using `npx cross-env VERIFY_PROD=1 npm run test:e2e:core1004 --workspace=web`. The suite must cover tenant intake, booking deposit, contract, first/monthly invoice and QR, signed payment/replay, refund/settlement, renewal, transfer/move-out, reports, and the P2/P15 regressions.
- For every happy-path and exception case, retain assertions for API response, database state, outbox delivery state, and ledger/journal effect. UI screenshots alone do not pass P17.
- Store masked Playwright traces/logs, a run manifest, cleanup record, and exactly these 11 operational images: room/customer context; booking deposit; contract; invoice/QR; successful payment; duplicate/wrong-code payment; refund/settlement; shared-room finance isolation; monthly utility snapshot; renewal/expiry; report drill-down.
- Fix every P0/P1 finding, rerun the affected case, and attach the successful rerun to the same run manifest.

### P17 Exit Record

Record `release SHA`, `run ID`, `fixture ID`, `target database ID`, migration/schema evidence, test totals (pass/fail/skip), artifact locations, cleanup result, P0/P1 findings, and reviewer decision. Local-only runs are technical evidence but do not close P17.

## P18: Staging UAT

### Three-Month Anonymized Load

- OPS selects three completed monthly periods and records the source scope before loading: tenant/building/room set, source record counts by entity, financial totals by currency, and mapping version.
- Remove or tokenize names, phone numbers, email, national IDs, bank references, Zalo identifiers, and document URLs. Keep deterministic masked IDs so every source row can be traced without exposing PII.
- After loading, reconcile source-to-staging counts and totals by period/entity. Any dropped, merged, or quarantined record requires a reason and owner; silent exclusions are forbidden.

### Provider UAT And Reconciliation

- Run Hunonic on staging with a real provider response for the selected rooms. Verify source period, meter identifiers, raw and normalized readings, snapshot lock, monthly invoice result, and error handling.
- Run SePay sandbox with real payment-code matching for each required payment branch. Include one valid match, duplicate provider transaction, duplicate payment-code transaction, wrong/missing code, insufficient amount, excess amount, and replay/idempotency behavior.
- The reconciliation denominator is every in-scope provider transaction or meter reading. `accounted = matched + documented mismatch`; coverage must equal 100%. `match rate = correctly matched / accounted` and must be at least 99%. A zero-row provider sample fails UAT; `IGNORED` does not count as a correct match.
- Keep a masked mismatch register with: evidence ID, provider reference/tokenized meter ID, period, amount/reading, mismatch class, impact, owner, remediation, due date, status, and retest result. No P0/P1 mismatch may remain open.

### Acceptance

OPS, FIN, SALES, and Owner each sign the same staging acceptance record containing the run date, release SHA, scope, evidence links, reconciliation metrics, open risks, and explicit PASS/NO-GO decision. A missing signature, an open P0/P1, or an unexplained mismatch blocks P18.

## Isolated Database Cleanup

After artifacts are archived and reviewed, DBA/CI decommissions the disposable E2E database and provisions a new empty target through the approved `BASELINE-V2` FRESH bootstrap in `docs/operations/DATABASE_BASELINE.md`. It validates the immutable historical 18-migration baseline, applies only forward migrations, then verifies `migrate status` before the next seed/provision run. Do not use `prisma migrate reset`, `db push`, manual schema edits, or row-level deletion for append-only financial evidence. A bootstrap failure is a blocker and must not be bypassed.
