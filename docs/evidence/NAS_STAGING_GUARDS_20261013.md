# NAS staging runtime guards - 2026-10-13

Status: reviewed local candidate; NAS replacement and HTTPS A-Z gate OPEN.

## Observed NAS state

- Candidate label `3.0.2-70dd5055` built and project start exited 0.
- Worker subsequently restarted repeatedly: missing production `STORAGE_DIR`.
- Stopped only `homeland_nas_staging`; stop exited 0. No volume deletion.
- Shared/other-app Cloudflare Tunnel unchanged. No production cutover.

## Reviewed changes

- Explicit `NAS_STAGING` mode requires confirmed internal staging database.
- Empty DB initializes approved baseline + 34 migrations, audits fingerprint,
  seeds once and records completion in AuditLog. Seed subprocess PATH fixed.
- Existing DB audits exact migration names/checksums, schema fingerprint and
  seed-completion marker. No SQL apply, migration resolve/deploy or reseed.
- New staging DB volume v3 preserves previous volumes, including v2.
- Staging external providers fail closed before settings/network/SMTP access,
  including direct sends, photos and Zalo provider management. In-app preserved.
- Build metadata requires internal token. API healthcheck uses readiness.
- API/DB/Redis ports not published; Web binds NAS loopback port 3000.
- Worker uses the API storage configuration and shared storage volume.
- Canonical/root Compose parity and safety contract added to CI checks.
- Independent Sol High review `nas_gate_review_sol61`: PASS, no findings.
- Independent gate tester `nas_gate_test_luna`: Node22 script suite42/42 and
  API health/provider/internal-token suite19/19 PASS; no real provider/DB writes.

## Local evidence

- Focused bootstrap/Compose/runtime-audit/CI safety: 36/36 PASS.
- Focused API provider/readiness/build-info: 16/16 PASS; API typecheck PASS.
- Fresh isolated PostgreSQL16: 34/34, seed and completion marker PASS.
- Two actual bootstrap container restarts: VERIFIED_EXISTING; complete public
  table data and migration history digests unchanged.
- Migrated but failed-seed DB restart: rejected, no automatic reseed.
- Compose config and diff whitespace checks PASS.
- Current-source API image `homeland-api:nas-guard-preview` built on Node22.
  Preview metadata deliberately says unknown/local-preview, not release SHA.
- Isolated API/worker run without published ports and with restart-count0.
  Readiness HTTP200, build-info without token401/with internal token200,
  staging diagnostics200 (staging, DB homeland_staging, 34 migrations,
  approved fingerprint); compiled provider guard rejects before settings/network.

## Open gates

Exact-source candidate packaging/build, NAS restart/readiness/identity,
credential replacement before public admission, isolated Cloudflare binding,
remote exact-SHA CI and actual desktop/mobile A-Z acceptance remain OPEN.
Same-NAS RAID/backup does not satisfy off-host recovery; LIVE remains NO-GO.
