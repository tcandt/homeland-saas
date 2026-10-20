# Hunonic NAS Connection - 20 October 2026

## Scope and Result

Owner authorized configuring the supplied Hunonic mobile signing keys on the live NAS.
Configuration-only activation and bounded read-only HTTPS acceptance PASS.
No application source/image change, database migration, meter synchronization,
electricity rate application, device control or historical financial repair performed.

## Root Cause

- Saved tenant configuration had mobile mode, username and password.
- Running API lacked both Hunonic mobile signing environment variables.
- Existing release environment and Compose also lacked the two variable mappings.
- The rates service propagated the non-HTTP HunonicApiError as generic HTTP500.
  Correcting runtime configuration removes this trigger; generic exception handling
  has NOT been changed and remains a separate code-hardening item.

## Applied Configuration

- Private environment: `/root/homeland-release-320/connections-eb3ca602.env`, mode 600.
- Added only `HUNONIC_MOBILE_ACCESS_KEY` and `HUNONIC_MOBILE_SECRET_KEY`.
  Values entered via hidden prompts and encrypted SSH stdin, not local script,
  command arguments, Git, chat output or rendered-config files.
- Added override, mode 600:
  `/volume1/docker/homeland/release-4fc77db1/connections-20261020-eb3ca602/compose.hunonic.yml`.
- Exact rendered Compose comparison against the existing baseline allowed ONLY the
  two environment variables on `api` and `notification_worker`; everything else equal.
- Existing base Compose and communication override remain part of the invocation:

```sh
sudo /usr/local/bin/docker compose \
  --env-file /root/homeland-release-320/connections-eb3ca602.env \
  -f /volume1/docker/homeland/release-4fc77db1/v3.2.0-836d0af2/compose.yml \
  -f /volume1/docker/homeland/release-4fc77db1/connections-20261020-eb3ca602/compose.connections.yml \
  -f /volume1/docker/homeland/release-4fc77db1/connections-20261020-eb3ca602/compose.hunonic.yml \
  up -d --no-deps api notification_worker
```

- API/worker run unchanged image
  `sha256:dc8f5e6f71cdf8eb13e9fae7ce7986aea7dd50c824384ab6468345292184cf50`;
  both running/restart0, API healthy, keys present in both.
- Scheduled jobs and deposit outbox remain disabled; migrations remain disabled.
  No Web/database/volume or unrelated tunnel/application changes.

## Verification

- Pinned NAS SSH host key; official mobile Hunonic host preflight before any key write.
  Acceptance repeats exact official-host/mobile-mode admission and normal owner login
  with tenant match before provider endpoints. No authentication bypass.
- Independent operational security review PASS after adding host admission.
- Independent mocked SSH helper gate 3/3 and static acceptance gate 2/2 PASS.
- Compose auditor: 0 heuristic findings; Python/Node syntax checks PASS.
- Actual HTTPS POST `/api/v1/hunonic/test`: HTTP201, 39 discovered electric meters,
  no missing-signing-key error.
- Actual HTTPS GET `/api/v1/hunonic/rates`: HTTP200, totalMeters 0, errorMeters 0.
  This is an empty mapping result, NOT acceptance of per-meter pricing or sync.
- Full saved Hunonic setting hash unchanged across acceptance.
- Final public readiness HTTP200/READY.
- No new full CI/image scan claimed: application source/images are unchanged from
  the eb3ca602 connection release and its recorded CI453 acceptance.

## Remaining Limits

No sync/backfill or mapping creation was authorized/performed in this change.
Device control, per-meter rate correctness, consumption persistence and billing UAT
are not established by a successful provider connection. Generic provider-error
classification still needs a separate scoped code fix. Existing owner-deferred
backup/update and historical reconciliation limits are unchanged.
