# Production Communication Connections - 20 October 2026

## Scope and Current Status

Owner authorized reopening external connections securely. API/worker hotfix only;
Web, database schema, existing volumes and financial records are outside the change.
Current status: CI PASS; production API/worker activation and scoped HTTPS acceptance PASS.
Cron, deposit outbox, backup and update automation remain disabled.

## Reviewed Source

- Source commit: `eb3ca6025ef6f597a4db5082b86c4b8fbcc72c1c`; version remains 3.2.0.
- Removed unauthenticated Zalo secret auto-healing and rejected-payload persistence.
- Byte-length-safe secret comparison; exactly one tenant must match.
- External delivery requires explicit `true`; staging always denies external access.
- Independent Sol security/tenant review PASS; focused independent Vitest gate 56/56 PASS.
- Latest affected ESLint, API typecheck and diff whitespace checks PASS.
- CI453: https://github.com/tcandt/homeland-saas/actions/runs/39351813182
  Exact SHA above. All eight actual lint/type/unit/integration/API+Web build/security/E2E
  jobs SUCCESS; smoke, regression and acceptance steps SUCCESS. Publication/deployment
  jobs SKIPPED, not PASS. NAS deployment below was performed separately.

## Actual NAS Artifact

- Clean Git archive SHA256: `c64452f749b4c94362808d978919912b9d3fd272c27764108aca080a86c2b789`.
- New API image: `sha256:dc8f5e6f71cdf8eb13e9fae7ce7986aea7dd50c824384ab6468345292184cf50`.
- Web preserved: `sha256:f486ad8f8bd2980bb2ddb28dac86c33a4898f6bbcf3cf004ddc6bbb420b4224d`.
- Normal API Dockerfile build PASS; compiled image runtime gate 11/11 PASS,
  including default/malformed/staging denial and invalid/ambiguous webhook no-write/no-dispatch.
- Pinned Trivy actual image OS/library/secret scan: 0 CRITICAL, 0 HIGH,
  22 MEDIUM, 1 LOW, 0 UNKNOWN, 0 detected secrets. DB updated 19 October 13:35 UTC.
- Scanner reports Alpine 3.24.2; its EOL-list warning remains a coverage limitation.
- Sequential durable build completed exit 0; no duplicate build launched.

## Connection and Deployment Controls

- Preflight Zalo official-host getMe PASS (read-only child process; live flags unchanged).
- Exactly one saved Zalo provider; no saved Email or Telegram provider configuration.
- Notification queue empty at read-only preflight; public readiness HTTP200/READY.
- Scoped override enables external delivery for API/worker and new immediate delivery
  for API only. Scheduled jobs/deposit outbox remain stopped; no old queue drain.
- Compose validation streams secrets only through process stdin, not a rendered file.
- Test admin-group send requires a durable exclusive reservation before the request;
  an uncertain attempt is not retried automatically.
- Authentication acceptance uses normal owner login, not locally signed test JWTs.
  Credentials remain memory-only; never printed or committed.
- Deployment helpers and final private login helper received independent review PASS.
- Independent helper gates: Python 3/3 and Node 4/4 PASS. A copied 65-hex image pin
  initially stopped acceptance before any provider write/send; corrected to the actual
  Docker-observed 64-hex identity above, with malformed-pin fail-closed coverage.

## Actual Activation and HTTPS Acceptance

- API and notification worker now run the exact new API image above, source eb3ca602;
  both running with restart count 0. Web image unchanged, healthy/restart count 0.
- API external delivery and immediate delivery are `true`; worker external delivery
  is `true` and immediate delivery `false`. Both retain scheduled-jobs/outbox kill switches.
- Public readiness HTTP200/READY after activation; database retains 36 completed
  migrations. No migration, volume deletion or financial repair was performed.
- Anonymous connect-webhook/admin-group management requests HTTP401 PASS.
- Missing/random webhook secret HTTP400/ZALO_WEBHOOK_SECRET_INVALID PASS;
  full saved provider setting hash unchanged for both rejected requests.
- Real official Zalo getMe PASS; normal owner HTTPS login PASS (no auth bypass).
- Authenticated webhook connect HTTP201/success; provider getWebhookInfo confirms
  exact public HTTPS webhook target. Existing webhook secret preserved.
- One authenticated admin-group test HTTP201/success; durable attempt marker CONFIRMED.
  This confirms provider acceptance, not an independent recipient read receipt.
- Final direct NAS flags/image identities/readiness verified after acceptance.
- Secrets were not printed or committed; private environment remains mode 600.

## Acceptance and Limits

Production activation and targeted HTTPS connect/admin-group acceptance are PASS.
Only targeted connection authorization/webhook checks are in scope, not a complete
penetration test or financial UAT. No email/Telegram delivery can be claimed without
configuration. Historic backup/recovery and deposit reconciliation limitations remain
as recorded in the 3.2.0 release evidence.
