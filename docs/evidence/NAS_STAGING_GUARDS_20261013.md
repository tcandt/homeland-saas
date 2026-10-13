# NAS staging runtime guards - 2026-10-13

Status: immutable candidate built and source archive uploaded; NAS activation
awaits owner approval to transmit replacement staging credentials. HTTPS A-Z OPEN.

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

Candidate source commit: `31000686b89d1313f57835823c235dc5e523bdb8`.
API Node22 and Web Node20 built from a clean Git archive of this commit.
API image: `sha256:8593f9eed4f822ea004068faa4adb8f5ebfbedff4c6d85a137e1805cf2eda545`.
Web image: `sha256:308492bd9bb86b406607f1a818d61d3c3481baf252490c8a8bf67ab6ee672669`.
Archive `/volume1/docker/homeland/source-31000686.zip` uploaded and verified
visible in DSM File Station (39.7 MB), without overwriting/extracting old source.
Local archive SHA256:
`9264381ce48e1ce366d804e59f4b5190c4dae40f9addfa44b8669b7f02fed169`.
NAS-side archive checksum has not been independently verified.

Immutable local API/Web/worker run with restart-count0; API build-info matches
candidate commit/version/buildId, Web login and same-origin ready proxy HTTP200.
ADMIN/MANAGER/SALES/FINANCE synthetic logins pass via the same-origin Web proxy.
Local candidate: `http://127.0.0.1:25259/login`. This is not NAS acceptance.

NAS activation/restart/readiness/identity, credential replacement before public
admission, isolated Cloudflare binding, remote exact-SHA CI and actual
desktop/mobile A-Z acceptance remain OPEN. Owner approval requested before
uploading new DB/test-user/JWT/internal secrets to the confirmed NAS source path;
no secret has been put in this evidence, Git or the source archive.
Same-NAS RAID/backup does not satisfy off-host recovery; LIVE remains NO-GO.
