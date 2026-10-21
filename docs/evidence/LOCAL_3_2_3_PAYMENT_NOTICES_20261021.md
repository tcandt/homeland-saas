# Local 3.2.3 Payment Notices - 2026-10-21

Status: LOCAL VERIFIED; no commit, push, NAS deployment or production migration in this task.

## Changes

- Booking agreement/conversion requires full confirmed collection; partial cash remains pending. QR creation and actual delivery are distinct, and fully paid cash does not falsely show a QR sent.
- Invoice history uses confirmed payment allocations with actual amount, method and payment time. Zalo send failures remain errors rather than clipboard-success messages.
- Cash payment post-commit processing drains only its event and same-invoice prerequisites, without replaying unrelated backlog. Client failure does not suppress Admin dispatch.
- Durable notification identity prevents duplicate event/recipient queues on retries. Request fingerprint and claim guards prevent stale sends/completions from marking a changed QR delivered; in-flight/stale requests return 409.
- Admin/client payloads include customer, room/building, collection method and booking hold expiry where applicable.
- Canvas readback contexts request willReadFrequently, including the isolated legacy scanner iframe. Vendor bundle unchanged.
- Invoice dialog stacks above mobile navigation so footer controls remain accessible.

## Verification

- Independent Sol High review: PASS, including explicit reuse of the dispatch transaction after real PostgreSQL testing exposed an unsupported nested transaction.
- Isolated PostgreSQL 16: 13/13 passed across two files. Verified scoped concurrent outbox claims, untouched unrelated/foreign/stale rows, issue-before-payment ordering, unrelated unsent QR independence, fingerprint concurrency, FAILED queue reuse and tenant isolation. Dedicated disposable container removed; existing local/NAS databases untouched.
- Affected API suite: 242 passed, 11 opt-in tests skipped across eight files. API typecheck passed. PostgreSQL tests were separately enabled as above; counts are not summed with overlapping suites.
- Focused Web helper tests: 10/10 passed; Web typecheck passed before the final CSS-only stacking change.
- Actual local browser fixtures at 1440px and 390px: unpaid, partial cash and full cash booking states passed; actual allocation receipt history passed. Scanner HTMLCanvas/OffscreenCanvas readbacks and actual local image correction canvas produced no readback warning. APIs mocked; no real customer payment/message sent.
- Reproducible browser scripts: `testing/payment-notice.browser.cjs`, `testing/payment-receipt.browser.cjs`. Screenshots: `test-results/payment-notice-323/`.

## Limits / Next Release Checks

- Original production send-zalo 400 Response was no longer retained in the inspected browser. Exact historical cause is not established; no real resend was attempted.
- Actual Zalo client/Admin delivery is not end-to-end verified. Durable queue creation is not a delivery guarantee.
- Before any authorized NAS rollout, verify API COMMUNICATION_IMMEDIATE_DELIVERY=true. Existing disabled worker/outbox scheduling means failed provider queues still require an enabled retry mechanism or scoped manual retry.
- Existing historical release/backup/financial gates remain unchanged and open/deferred. No production database repair or migration authorized here.
- Local Web: http://localhost:3015.
