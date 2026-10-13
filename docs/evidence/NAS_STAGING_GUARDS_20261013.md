# NAS staging runtime guards - 2026-10-13

Status: candidate `3.0.2-31000686` is built and running on NAS; dedicated
Cloudflare tunnel is connected and `homeland.ductinh.one` is routed to it.
HTTPS smoke/UAT and full DB-backed CORE1004 remain OPEN; LIVE is NO-GO.

## Observed NAS state

- Candidate source archive SHA256 matched local approved archive:
  `9264381ce48e1ce366d804e59f4b5190c4dae40f9addfa44b8669b7f02fed169`.
- API/Web images `3.0.2-31000686` built successfully. API and Web are Healthy;
  bootstrap exited successfully; worker and API use the staging runtime volume.
- Protected probes: readiness `200 READY`; unauthenticated build-info `401`;
  internal build-info `200` with commit `31000686b89d1313f57835823c235dc5e523bdb8`,
  version `3.0.2-31000686`, build ID `nas-staging-20261013-31000686`.
- Staging diagnostics `200`: database `homeland_staging`, migration count `34`,
  fingerprint `fd9d42c90e48aae98cc51e745989c7797a04c709ed16dd97c0c0a61d5e7739ca`.
- Seed marker and Web login probe passed. Provider delivery guards were verified:
  scheduled jobs, deposit outbox, immediate and external communication are disabled.
- Dedicated container `homeland_nas_staging_cloudflared` is connected (Cloudflare
  connector version `2026.3.0`). DNS CNAME `homeland.ductinh.one` now targets
  `homeland-nas-staging`; unrelated tunnels/hostnames were not changed.
- HTTPS smoke through `https://homeland.ductinh.one` passed: `/login` 200,
  `/api/v1/health/ready` 200, protected build-info/diagnostics 200 and missing
  internal token 401. Synthetic staging login passed for admin, manager, sales
  and finance accounts using the shared staging seed password; no real provider
  delivery or payment was performed.
- UI smoke passed through the tunnel: dashboard loaded, Finance displayed
  report period `10/2026`, and Reports displayed `2026-10` (current GMT+7
  month on 13/10/2026), confirming the latest-period default bug fix in the
  deployed candidate.

- Pre-refresh data baseline captured: staging contained 1 tenant, 4 users and
  34 rooms; Customer, Contract, Deposit, Invoice, Payment, Occupancy and
  DepositLedgerEntry were empty. The refreshed Compose was byte-for-byte
  equivalent after newline normalization, retained `db_v3`, and bootstrap
  exited successfully without a volume-delete action. A post-restart row/hash
  comparison is still open because DSM's Stop action reported an intermittent
  UI failure during this pass.

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

## Deployment evidence — 14/10/2026

- The active NAS project `/volume1/docker/homeland/source` was recreated from a
  deploy-only Compose with pinned images `homeland-api:3.0.2-11a4f3c1` and
  `homeland-web:3.0.2-11a4f3c1`. The previous compose was copied to the
  preserved source tree before replacement; no database/storage volume was
  removed.
- Container Manager build/recreate exited `0`; bootstrap exited normally, API
  readiness is `200`, and the running API build-info reports commit
  `11a4f3c12b629e8287277517c03ad7a813166328`, version `3.0.2-11a4f3c1`,
  deployment environment `staging`, and runtime role `api`.
- HTTPS smoke through `https://homeland.ductinh.one` passed: readiness `200`,
  staging diagnostics `200`, notifications `200`, SePay admin config `200`,
  auth activity `201`; Zalo connect/test endpoints fail closed with
  `503 EXTERNAL_PROVIDER_DISABLED_IN_STAGING`. No provider delivery occurred.
- The private NAS `.env` was used only locally for the smoke request; no
  credential value is recorded here. Finance/Reports UI, four-role browser
  acceptance, backup/restore drill, remote exact-SHA CI and production rollout
  remain open. LIVE remains NO-GO.

Candidate source commit: `31000686b89d1313f57835823c235dc5e523bdb8`.
API Node22 and Web Node20 built from a clean Git archive of this commit.
API image: `sha256:8593f9eed4f822ea004068faa4adb8f5ebfbedff4c6d85a137e1805cf2eda545`.
Web image: `sha256:308492bd9bb86b406607f1a818d61d3c3481baf252490c8a8bf67ab6ee672669`.
Archive `/volume1/docker/homeland/source-31000686.zip` uploaded and verified
visible in DSM File Station (39.7 MB), without overwriting/extracting old source.
Local archive SHA256:
`9264381ce48e1ce366d804e59f4b5190c4dae40f9addfa44b8669b7f02fed169`.
Downloaded the archive back from DSM File Station to verify the NAS copy:
41,608,305 bytes and SHA256 match the approved local archive exactly.

Owner approved replacement staging credentials on 13/10/2026. Generated fresh
DB, shared seed-password, JWT and internal-token values locally; the seed applies
the new shared password to all four synthetic accounts. The private `.env` is
Git-ignored and uploaded successfully to `/volume1/docker/homeland/source`.
No credential value is recorded here or committed. Old source was preserved as
`source-preserved-20261013-70dd5055`; old volumes and data were not deleted.
Extracted the verified clean archive as the new `source` directory.

Container Manager actually reads root `docker-compose.yml`, not the separately
uploaded `docker-compose.nas-staging.yml`. Uploaded the exact reviewed NAS-root
artifact under the active filename and reloaded DSM. Whole-editor verification
confirmed staging DB v3, worker storage, loopback Web and NAS_STAGING bootstrap.
Build/start triggered once. API build/tag `homeland-api:3.0.2-31000686` succeeded;
Web runtime-image build is still in progress. Runtime acceptance is not yet PASS.

Cloudflare inspection: Homeland DNS currently points to
`e0469c05-4f30-4f85-ab4d-f3ede91a6fd5.cfargotunnel.com`, whose tunnel is absent
from the current account's three-tunnel list. The running NAS `cloudflared`
serves only MediaSlution hostnames. No shared tunnel or DNS record was changed.
Prepared `homeland-nas-staging` creation form, without submitting it; requested
owner confirmation at the persistent connector-token creation step and before
transmission to `/volume1/docker/homeland/cloudflared/.env`.

Immutable local API/Web/worker run with restart-count0; API build-info matches
candidate commit/version/buildId, Web login and same-origin ready proxy HTTP200.
ADMIN/MANAGER/SALES/FINANCE synthetic logins pass via the same-origin Web proxy.
Local candidate: `http://127.0.0.1:25259/login`. This is not NAS acceptance.

NAS activation/restart/readiness/identity, isolated Cloudflare binding, remote
exact-SHA CI and actual desktop/mobile A-Z acceptance remain OPEN.
No secret has been put in this evidence, Git or the source archive.
Same-NAS RAID/backup does not satisfy off-host recovery; LIVE remains NO-GO.
