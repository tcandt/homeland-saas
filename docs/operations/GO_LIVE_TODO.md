# HomeLand Go-Live TODO

- `RELEASE3.2.8 PREPARED / DEPLOYMENT PENDING` 24/10/2026: scoped operational-reset and terminal booking-status fixes prepared; preserve Hunonic mappings/payment routes and fixed building/room data, optional backup when unconfigured and explicit confirmation safeguards. Earlier focused API35/35, Web93/93, mocked reset4/4 and booking6/6, API/Web typechecks PASS. Exact staged candidate CI and NAS acceptance pending. No production reset/migration; PostgreSQL reset FK/trigger/rollback acceptance unverified. CORE10/GATE10 and provider/payment gates remain OPEN. Evidence: `docs/evidence/RELEASE_3_2_8_PREPARED_20261024.md`.

- `RELEASE3.2.6 LIVE / SCOPED FIXES ACCEPTED` 21/10/2026: exact8f527035 deployed; CI39553244085 all8 required jobs SUCCESS including security/E2E after exact public-SSH-key false-positive correction. NAS actual image/runtime and redacted Compose audit PASS; final synthetic DOB1PN/2PN rendering and public desktop/mobile login v3.2.6 PASS. Protected full-row hashes unchanged;4 buildings/34 rooms/37 migrations and DB/settings/volumes retained, no production migration/reset/backlog replay. Temporary SSH key revoked and fresh login denied. Real payment/refund/Zalo delivery and historical deferred gates remain unverified/open. Evidence: `docs/evidence/RELEASE_3_2_6_NAS_20261021.md`.

- `LOCAL3.2.6 CONTRACT DOB / NO DEPLOYMENT` 21/10/2026: preview/download/dossier use strict calendar DOB formatting and primary-customer/exact-ID fallback; placeholders no longer mask valid DOB, matching snapshot only, missing/invalid DOB prompts profile update before export. Independent review PASS after confirmed snapshot-precedence correction; focused Web44/44 and typecheck PASS, local3015 HTTP200. Actual PDF visual acceptance remains unverified (LibreOffice unavailable; converter mocked). No production DOB repair, signed-PDF modification, commit/push or NAS deployment. Evidence: `docs/evidence/LOCAL_3_2_6_CONTRACT_BIRTH_DATE_20261021.md`.

- `LOCAL3.2.5 ZALO QR SCOPE / NO DEPLOYMENT` 21/10/2026: QR-triggered outbox processing restricted to exact tenant/invoice issue/payment event IDs, no global fallback on empty/error lookup; prevents unrelated historical room receipts being released by QR sends. Admin room-only labels, same-day booking-date dedupe and pending-deposit wording updated. Independent Sol High review PASS; focused API121/121 across5 suites, API typecheck/scoped diff check PASS. No production/provider call, financial mutation, backlog replay, commit/push or NAS deployment. Evidence: `docs/evidence/LOCAL_3_2_5_ZALO_QR_SCOPE_20261021.md`.

- `LOCAL3.2.4 BOOKING CANCELLATION / NO DEPLOYMENT` 21/10/2026: connected booking-contract cancel action to existing CORE API; explicit cancellation reasons and none/partial/full Admin decision, canonical ledger balance and automatic retained remainder, proof/idempotent retry guards. Independent Sol High review PASS; focused Web78/78, API deposit59/59, browser6/6 desktop/mobile with error/proof/retry checks, API/Web typechecks PASS. No real cancellation/refund/provider call, commit/push or NAS deployment. Existing permissive UI permission hook not changed; server guards remain authority. Evidence: `docs/evidence/LOCAL_3_2_4_BOOKING_CANCELLATION_20261021.md`.

- `RELEASE3.2.3 LIVE / PAYMENT NOTICE FIXES ACCEPTED` 21/10/2026: exact33b77b38 deployed and main/tag v3.2.3 pushed; CI39540875735 all8 required jobs SUCCESS including E2E. Actual NAS image security/runtime and redacted Compose audit PASS; private/public exact identity/readiness and hydrated desktop/mobile UI PASS (financial APIs mocked). Protected full-row hashes unchanged;4 buildings/34 rooms/37 migrations and DB/settings/volumes retained; no production migration/reset/backlog replay. Temporary SSH key revoked and fresh login denied. Historical Zalo400 Response unavailable, live provider delivery and historical deferred gates remain unverified/open. Evidence: `docs/evidence/RELEASE_3_2_3_NAS_20261021.md`.

- `RELEASE3.2.2 LIVE / SCOPED FIXES ACCEPTED` 21/10/2026: deployed exact2dfd076f; CI39529494436 all8 required jobs SUCCESS including E2E. Actual NAS API/Web security/runtime and redacted Compose audit PASS. Public hydrated login v3.2.2; desktop/mobile legacy-import and finance UI PASS with mocked feature APIs. Private/public health200 and exact source identity PASS;4 buildings/34 rooms/37 migrations retained, protected full-row hashes unchanged, DB/settings/volumes preserved, no production migration/reset. Pre-switch private pg_dump catalog valid (not a restore drill). Public learning GET200; disposable non-root POST202. Temporary SSH key revoked and fresh key-only login denied. Real Hunonic checkout/customer financial mutations and historical deferred gates remain unverified/open. Evidence: `docs/evidence/RELEASE_3_2_2_NAS_20261021.md`.

- `RELEASE3.2.1 LIVE / LEGACY CUSTOMER IMPORT ACCEPTED` 21/10/2026: exact99c6b11c source CI39515475639 all8 required jobs SUCCESS; actual NAS API/Web image/runtime/security and redacted Compose audit PASS. Public hydrated login displays v3.2.1; actual Web legacy card/form/import command desktop/mobile PASS with mocked feature APIs only. Private/public corrected acceptance PASS;4 buildings/34 rooms/37 migrations retained, DB/settings/volumes preserved, no production migration/reset. Original activation harness failure remains recorded (raw SSR version assertion); independently reviewed hydration-aware verifier passed separately with the SAME new images/restart0, no data/image rollback. Version bump policy defaults to next patch. Historical deferred backup/restore/reconciliation gates remain unchanged. Evidence: `docs/evidence/RELEASE_3_2_1_NAS_20261021.md`.

- `BOOKING REGRESSION FIX REVIEWED / NEW CI REQUIRED` 17/10/2026: initial Sol High fixture review BLOCK found signed/past-start rental response drift and incorrect BOOKING_HOLD invoice shape. Confirmed findings corrected in the test only: requested conversion dates/money preserved, new rental unsigned, existing UI contract upload/signature PATCH exercised, unsigned activation rejected, booking period/usagePeriod/item aligned with API. Independent affected re-review PASS. Spec ESLint, configured Node22 Playwright collection24 cases/3 desktop projects and diff check PASS; collection is not browser execution. Ready for scoped commit/push and new exact-SHA CI; no release gate or NAS change. CI447 remains FAILURE as recorded below.

- `PARTIAL BOOKING CI447 REGRESSION BLOCKER` 17/10/2026: exact source `6bd3fd2d665c6f7aa445932b64b9d3e2c6c4fd7c`, run39010965549 completed FAILURE. Lint/type/unit/integration/API+Web builds and Security & Supply Chain SUCCESS; mandatory CodeQL initialize/analysis actually SUCCESS. E2E smoke SUCCESS, regression83 passed/1 failed at the outdated legacy deposit conversion journey; acceptance and publish/deploy jobs SKIPPED, not PASS. Test-only correction now models BOOKING_HOLD invoice payment -> active linked hold -> canonical contract conversion -> ENTRY payment/move-in/settlement/turnover, plus legacy unsafe conversion refusal. Affected ESLint/diff check and Node22 Playwright collection8 tests PASS; browser execution and independent fixture review pending. Local Web launch was tool-policy blocked; do not bypass or claim local E2E PASS. New exact-SHA CI required before NAS candidate deployment. Existing local image/recovery evidence remains bounded to6bd3fd2d; NAS unchanged e1decc81 and all release/owner GO gates remain OPEN. Evidence: `docs/evidence/NAS_V4_BOOKING_UAT_20261017.md` (CI447 regression follow-up).

- `PARTIAL BOOKING LOCAL IMAGE / RECOVERY CHECKPOINT` 17/10/2026: exact source `6bd3fd2d` API/Web Docker builds PASS (Web retains14 unchanged PDF tracing warnings). Production-pruned API initializes36 reviewed migrations and two audit-only bootstrap restarts preserve dumped data. API recovery is pinned to image ID `sha256:1cf6c3bedef22e39a3317644b77b423e006b052dc51d4145b7d04ae89afe5715`; guarded PG16 restore14/14, all75 table hashes/schema equality before synthetic auth reset, and restored authenticated HTTP17/17 PASS including2 PDF checksums/tenant denial; financial data/schema unchanged after HTTP. Independent identity re-review Sol High PASS. Local Web login/asset/identity smoke5/5 PASS, not browser UAT. Exact-SHA CI447 Integration SUCCESS: migrated booking21/21, notification8/8 and API E2E13/13; lint/type/unit/API+Web builds SUCCESS. Security scan remains IN_PROGRESS; remaining browser E2E/publication/deployment are not PASS evidence. NAS still unchanged e1decc81. NAS UAT/recovery/rollback, legacy inventory/old-worker quiescence, off-host/operational policy and owner GO remain OPEN; LIVE NO-GO. Evidence: `docs/evidence/NAS_V4_BOOKING_UAT_20261017.md` (immutable local runtime continuation).

- `PARTIAL BOOKING EXACT-SHA CI RUNNING` 17/10/2026: checkpoint `6bd3fd2d665c6f7aa445932b64b9d3e2c6c4fd7c` committed/pushed; GitHub push CI447/run39010965549 observed IN_PROGRESS on that exact SHA (`https://github.com/tcandt/homeland-saas/actions/runs/39010965549`). GitHub combined-status/PR-run wrappers returned empty lists; these are not success evidence. Actual push-run lookup confirms the run. Local API Docker candidate build from Git-only archive in progress; no NAS/production action or gate closure. Post-push evidence notes remain local to avoid cancelling the current CI run.

- `PARTIAL BOOKING LOCAL ACCEPTANCE / RECOVERY CHECKPOINT` 17/10/2026: corrected forward migration36/bootstrap independently reviewed Sol High PASS. Fresh local5437 audit matches36/36 migration checksums and schema fingerprint `df7b33d969caeec88c0288ace847308cb3479635614761b319537656f5d2e587`; actual release audit and bootstrap13/13 PASS. Failed cancellation rerun2/2, extended migrated-PG targeted9/9, then funded-expiry/journal-order focused2/2 PASS (overlapping selectors; not21/21 or full regression). Positive400k survives expiry; further payment/renew/convert reject, explicit pending refund remains available; installment/ordinary/disposition journal retry and migration item guards verified. Node22 API build/typecheck and affected lint PASS. Separate isolated recovery: backup bundle10/10, guarded PostgreSQL16 restore14/14,2 synthetic files/checksums, all75 table row hashes/schema and compiled financial-summary/deposit-projection hashes match; source unchanged during that drill. This is local service-level recovery, not immutable-image/HTTP/NAS recovery or off-host proof. Original5436 first-candidate checksum/volume retained for diagnostics only. Exact-SHA CI/immutable image bootstrap, NAS redeploy/UAT, legacy inventory/old-worker quiescence, operational/off-host backup and owner GO remain OPEN. No NAS/production migration, repair or traffic switch. Evidence: `docs/evidence/NAS_V4_BOOKING_UAT_20261017.md`.

- `PARTIAL BOOKING MIGRATED-SCHEMA CORRECTION / ACCEPTANCE OPEN` 17/10/2026: Sol High re-review PASS for pending KEEP/DEDUCT disposition, fail-closed secondary accounting suppression and strict ledger-event identity; workflow42/42 and API typecheck PASS. Independent migrated-PG acceptance10/12 exposed two real cancellation failures: the historical adjustment trigger excludes BOOKING_HOLD, and nested ISSUED item insertion is forbidden. Reviewed root-cause correction adds forward migration36 and DRAFT+item -> ISSUED atomically; applied only to isolated local5436, historical35 checksums unchanged, schema36 fingerprint measured. Core/health54/54 and bootstrap12/12 PASS; actual SQL/bootstrap review and failed-PG reruns remain OPEN. Notification migrated-PG8/8 PASS. Node22 API/Web builds PASS, Web retains14 export-PDF tracing warnings; Web router lint/typecheck PASS. New exact-SHA CI/image verification, legacy inventory/old-worker quiescence, NAS UAT and nonzero financial/file application recovery remain OPEN. NAS still serves e1decc81; no NAS/production migration, financial repair, traffic switch or GO approval. Evidence: `docs/evidence/NAS_V4_BOOKING_UAT_20261017.md`.

- `PARTIAL BOOKING LOCAL IN PROGRESS` 17/10/2026: completed backend writer scope for per-payment CASH_IN, partial PENDING cancellation with unpaid credit closure, PostgreSQL-time hold validation, payment-key journal replay and authoritative deposit projections. Focused API143/143, Node22 API typecheck and diff check PASS; independent financial/concurrency implementation review and real-PG acceptance remain OPEN. Separate local PostgreSQL16 target `127.0.0.1:5436/homeland_booking_invoice_test` prepared from canonical BASELINE-V2 plus forward migrations35/35, checksums35/35; no db push, shared DB or NAS changes. Frontend/recovery/immutable release gates remain OPEN; LIVE NO-GO.

- `CANDIDATE CI BLOCKED` 17/10/2026: fix checkpoint `3af97789c6ce1266d5033ce1ea31c38826c50aba` committed/pushed; exact-SHA CI39003386384 Integration Test FAILED at booking fixture `Invoice_billing_kind_shape_check` (missing `baseInvoiceKey`). Lint/Type Check/Unit Test SUCCESS; notification gate and downstream build/security/E2E/publish/deploy SKIPPED, not PASS (`https://github.com/tcandt/homeland-saas/actions/runs/39003386384`). Fix test fixture against migrated schema without removing constraints, then rerun on a new exact SHA. No publish/deploy, NAS remains e1decc81. Partial-booking accounting/legacy inventory and release UAT/recovery/owner approval remain OPEN; LIVE NO-GO.

- `V4 FINANCIAL UAT BLOCKER` 17/10/2026: synthetic PN31-04 booking invoice1,000,000 was collected as400,000+600,000; over-collection600,001 rejected and invoicePAID/remaining0 PASS, but linked Deposit remainsPENDING/received0 with direct collection enabled. No second collection or data repair attempted. Local canonical full-settlement transaction and UI corrections: Node22 API126/126, independent Web25/25, typechecks and real-PG9/9 PASS; Sol re-review PASS_WITH_FINDINGS (legacy inventory/recovery decision open). Notification dual-writer identity fix: Sol re-review PASS, canonical59/59 and independent real-PG8/8 PASS, affected API lint PASS. CI booking/notification gates wired against dedicated migrated-schema clone; workflow safety23/23 PASS, remote current-patch CI pending. Incremental partial-cash accounting design BLOCK: requires payment-key journal idempotency, atomic partial cancellation/invoice closure and funded-hold expiry reconciliation; not implemented. Serving images remaine1decc81; no new deploy claimed. Evidence: `docs/evidence/NAS_V4_BOOKING_UAT_20261017.md`. CORE-10/GATE-10/LIVE NO-GO.

- `V4 HTTPS CHECKPOINT` 17/10/2026: owner-approved route `homeland.ductinh.one` now points through the existing dedicated staging tunnel to NAS loopback3002/v4. API/Web Healthy; public readiness200/READY (DB/schema UP), Web version3.1.1-rc.e1decc81. Interactive ADMIN/MANAGER/FINANCE login, admin Finance/Reports current GMT+7 period, Manager Settings denial, nine page-render checks and observed console-error checkpoints PASS. Financial dataset remains empty; full lifecycle/OWNER/device/provider UAT and recovery gates remain OPEN. CI38856526235 PASS on213ea229 is distinct from deployed image sourcee1decc81. Evidence: `docs/evidence/NAS_V4_HTTPS_SMOKE_20261017.md`. LIVE NO-GO.

- `V4 PREVIEW CHECKPOINT` 16/10/2026: e1decc81 CI441 SUCCESS (eight build/test/security jobs; deploy/publish jobs SKIPPED). CodeQL itself was SKIPPED by an unreliable capability probe, not a SAST PASS; mandatory fail-closed fix and independent safety21/21 prepared for next CI. NAS API e1/worker/Web now run in separate v4 project, bootstrap VERIFIED_EXISTING/exit0, independent35-checksum/schema/seed-marker audit PASS, API/worker restart0 and Web health/login HTML PASS. In-container API smoke41/41 PASS for3 roles/auth/RBAC/provider guards; explicit namespace/origin guard added3/3 PASS. Synthetic PDF upload/download checksum PASS; backup with1 file precheck9/9 PASS. Isolated DB restore13/13 plus manual storage checksum/metadata/audit35 PASS; restored API HTTP verification7/7 PASS. SSH direct-tcpip preview was blocked by NAS policy; no public/tunnel switch. Public tunnel still3001/old primary34; preview is loopback3002 only. No STG/BKP/UAT gate closed; LIVE NO-GO. Evidence: `docs/evidence/NAS_STAGING_RELEASE_0FA87A71_20261016.md` (v4 preview).

- `FRESH NAS PREPARATION` 16/10/2026: new isolated volume `homeland_nas_staging_v4_db_20261016`, network none/no ports; old volumes preserved. Correct0fa bootstrap emitted INITIALIZED/exit0; separate read-only audit35/35 checksums/schema/seed marker PASS, roles ADMIN/MANAGER/FINANCE. Candidate fix `e1decc81` pushed; local API/Web Docker builds PASS, exact-SHA CI441 in progress. Clean archive local/NAS SHA256 matched; NAS candidate build in progress. Public route remains unchanged on old primary34; no STG/BKP/UAT gate closed. Evidence: `docs/evidence/NAS_STAGING_RELEASE_0FA87A71_20261016.md` (fresh preparation).

- `RELEASE SCHEMA BLOCKER` 16/10/2026: read-only NAS audit proves primary staging is34/35; missing retire-sales migration, SalesLead exists, SALES has1 assignment, seed marker not verified. Old bootstrap exit0 is not current release proof. Local readiness fix reviewed Sol High PASS; Node22 health7/7 and isolated PG16 fresh-bootstrap/negative-schema8/8 PASS; new predicate rejects current NAS schema. Existing backup checksum/archive precheck8/8 PASS but files0, no restore/off-host proof. Actual public login/logout201/201 now verified. Preserve current volume; next create fresh approved staging-only target with correct bootstrap35/35 and repeat diagnostics/UAT. Image-only rollback is insufficient across destructive Sales retirement. STG/BKP/UAT remain OPEN; LIVE NO-GO. Evidence: `docs/evidence/NAS_STAGING_RELEASE_0FA87A71_20261016.md` (follow-up section).

- `BOUNDED NAS RELEASE CHECKPOINT` 16/10/2026: candidate source `0fa87a71`, version3.1.0, API/Web healthy and public readiness200; protected origin build identity matched. Internal admin login201 followed by authenticated public read smoke; public login POST and release-specific GMT+7 UI default not verified. Public routing moved from e9 to a different primary staging database (34 migrations, Building4/Room34/Customer0/Invoice0), requiring identity/checksum reconciliation. Manual backup listed1; READY/archive/checksums not yet verified. Empty worker heartbeat observed; schedules restored disabled. Rollback/forward health smoke only; four counts matched after rollback and after forward, pre-rollback query failed. No STG/BKP/UAT gate closed. Owner chose same-NAS backup only; RAID is not off-host protection and no off-host waiver is recorded. LIVE NO-GO. Qualified evidence: `docs/evidence/NAS_STAGING_RELEASE_0FA87A71_20261016.md`.

- `ISOLATED PARALLEL TESTS` 15/10/2026: root NAS / separate local financial-test lane, one writer at a time. NAS Webe9 -> Web11a -> Webe9 HTTP114/114 PASS, full-row hashes unchanged across image switches; not interactive browser UAT. Actual worker cron exposed NULL-error queue starvation; fix verified via compiled read-only module: checked3/recovered1, six fixture cases, only notification tables changed, no external delivery. Missing seed-password preflight fixed; Sol review + independent Node22/Compose gate19/19 PASS. Cancellation/retry/worker-claim fixes: affected29/29 + API emit + final Sol review PASS; real-DB race gate pending. Isolated local PG16 nonzero financial recovery13/13 + attachment checksum/manual storage replay PASS, including229 enum labels/2 extensions/consumed sequence state; source unchanged and final Sol review PASS. Not application storage restore/API UAT/off-host proof. Fix commitf98206ed pushed; exact-SHA CI in progress (lint/type/unit/integration/API+Web builds PASS). NAS disposable containers removed, application/backup volumes preserved, staging readiness200 and live images unchanged. Immutable rebuild/final CI/SAST/off-host/full UAT remain OPEN; LIVE NO-GO. Evidence: `docs/evidence/NAS_PARALLEL_RECOVERY_20261015.md`.

- `CI433 / UI CHECKPOINT` 15/10/2026 (latest): fix78061068 pushed; exact-SHA CI433 SUCCESS, E2E smoke22/22, regression84/84, acceptance37/37; Compose6/6 and config validation PASS. CodeQL remains BLOCKED (private repo without GHAS); release/publish/deploy/staging production gate jobs SKIPPED. Bounded admin HTTPS UI: current GMT+7 Finance/Reports period, desktop/settled390px, Finance light/dark, login/logout/route guard, console errors0 PASS; not full UAT. All five disposable drill containers removed, application/backup volumes preserved, public readiness200. Source images on NAS unchanged API573/Webe9. Independent re-review, SAST, nonzero financial/file recovery, worker/Web rollback/unified release and off-host gates OPEN; LIVE NO-GO. Evidence: `docs/evidence/NAS_BOOTSTRAP_RUNTIME_20261015.md`, local UI follow-up `docs/evidence/NAS_UI_SMOKE_20261015.md`.

- `NAS RECOVERY CONTINUATION` 15/10/2026 (supersedes recovery status in the earlier checkpoint below): isolated PostgreSQL16 restore12/12 PASS,35 migrations,75 tables348 rows with exact snapshot-source full-row hash and matching column/constraint/index/function schema hash. Live staging source hash unchanged before/after all drills. API573 -> APIe9 -> API573 smoke23/23 per phase; no data/schema change at image switches, rollback validation61s. No public switch, provider delivery or migration apply. Storage empty and financial fixture absent, so nonempty storage/financial recovery, Web rollback, worker, unified release, full A-Z UAT and off-host gates remain OPEN; BKP-03/STG-05 NOT closed. Independent review found tracked deploy-only still pinned brokene9; corrected API/bootstrap/worker+API metadata to573 and Compose tests6/6 PASS. Final re-review unavailable (capacity); new-commit CI pending. LIVE NO-GO. Evidence: `docs/evidence/NAS_BOOTSTRAP_RUNTIME_20261015.md`.

- `NAS BOOTSTRAP RUNTIME` 15/10/2026: fixed `tsx ENOENT` after35 migrations; focused16/16 and production-pruned image fresh PostgreSQL bootstrap + two unchanged-data restarts PASS. Commit573bc663 pushed; API/worker573bc663 now run on NAS staging with owner-approved NEW DB volume; failed DB/old volumes preserved. Bootstrap exit0, API/Web healthy, restart0, HTTPS readiness200; six preflight requests and affected authenticated smoke32 requests PASS (three roles, notifications/activity, SePay, finance/reports, removed Sales404, guarded Zalo503). Web remains e9, not relabeled. Staging env permission narrowed777→600. CI432 completed SUCCESS: image regression/security/build/unit/integration PASS, E2E smoke22/22 + regression84/84 + acceptance37/37 PASS; publish/deploy/production jobs SKIPPED. Manual backup via NAS HTTPS API READY (273251 bytes), not a restore/off-host PASS. Worker schedules intentionally disabled: queue processing not verified. Independent review (model capacity), unified release, full NAS A-Z UAT, restore/rollback and off-host gates remain OPEN. LIVE NO-GO. Evidence: `docs/evidence/NAS_BOOTSTRAP_RUNTIME_20261015.md`.

# `NAS STAGING DEPLOYMENT` 14/10/2026: staging project has been recreated from the pinned deploy-only Compose using API/Web images `3.0.2-11a4f3c1`; bootstrap exited 0 and HTTPS API smoke passed through `homeland.ductinh.one` (readiness/build identity/diagnostics/notifications/SePay/auth activity; Zalo is correctly blocked with `EXTERNAL_PROVIDER_DISABLED_IN_STAGING`). Finance/Reports browser A–Z acceptance, off-host backup/restore, exact-SHA CI and production rollout remain OPEN. LIVE NO-GO. Evidence: `docs/evidence/NAS_STAGING_GUARDS_20261013.md`.

- `NAS CANDIDATE ACTIVATION` 13/10/2026: source31000686 immutable local API22/Web20/runtime gates PASS. NAS ZIP downloaded back with exact SHA256 PASS. Fresh staging-only credentials were uploaded privately; old source was recoverably renamed and old volumes preserved. Active DSM Compose is verified; API/Web images built and running, bootstrap exited successfully, readiness/build identity/staging diagnostics/seed/Web probes PASS, and provider delivery guards are disabled. Dedicated Cloudflare tunnel `homeland-nas-staging` is connected; only `homeland.ductinh.one` was recreated/routed to it. HTTPS smoke and synthetic four-role login passed; Finance defaults to `10/2026` and Reports to `2026-10` on GMT+7. Full DB-backed CORE1004 runner, remote exact-SHA CI and off-host recovery remain OPEN. LIVE NO-GO. Evidence: `docs/evidence/NAS_STAGING_GUARDS_20261013.md`.

- `NAS STAGING GUARD GATE` 13/10/2026: old staging candidate built/start exited0 but worker restart loop exposed missing STORAGE_DIR; stopped only staging project without deleting volumes. Local fixes add confirmed NAS_STAGING fresh initialization + audit-only restart (34 checksums/fingerprint/seed completion marker), real external provider kill switch, protected build-info, readiness healthcheck, internal-only API/DB/Redis and worker shared storage. Sol High review PASS; independent Node22 gate scripts42/42 and API19/19 PASS. API typecheck/current-source Node22 preview image build, real PostgreSQL16 fresh seed + two unchanged-data restarts + failed-seed negative check PASS. Preview API/worker run with restart-count0, readiness200, unauthorized build-info401/internal-token200 and staging diagnostics identity34/34 PASS. NAS replacement, credential replacement, tunnel admission, exact-SHA remote CI and A-Z acceptance remain OPEN; LIVE NO-GO. Evidence: `docs/evidence/NAS_STAGING_GUARDS_20261013.md`.

Ngày cập nhật: 2026-09-26
Trạng thái: **BIG UPDATE ĐANG TRIỂN KHAI / LIVE NO-GO**

<!-- LOCAL RELEASE CANDIDATE PASS / LIVE NO-GO: target label for local evidence gate before production traffic. -->

Đây là nguồn theo dõi duy nhất cho các việc còn lại trước LIVE. Các checklist khác phải dẫn chiếu về file này; không tự đánh dấu LIVE ở tài liệu khác nếu P0 trong file này chưa hoàn thành.

Đặc tả chốt của Big Update: [Kế hoạch triển khai chính thức vòng đời thuê](../reviews/2026-09-08-official-core-lifecycle-implementation-plan.md). Hồ sơ bằng chứng chi tiết nằm tại [kiểm định tổng thể 07/09](../reviews/2026-09-07-final-figjam-logic-audit.md) và [đối chiếu 11 ảnh vận hành](../reviews/2026-09-08-operational-screenshots-addendum.md).

## 1. Quy ước theo dõi

| Giá trị | Ý nghĩa |
|---|---|
| `[x]` | Hoàn thành và đã có bằng chứng kiểm tra được |
| `[ ]` | Chưa hoàn thành |
| `IN PROGRESS` | Đang được triển khai; chưa đủ Definition of Done để đánh dấu hoàn thành |
| `BLOCKED` | Chưa thể làm do thiếu phê duyệt, credential, hạ tầng hoặc bên thứ ba |
| `DEFERRED (OWNER)` | Owner tạm hoãn phạm vi sang đợt sau; không phải PASS, không được tick `[x]` và phải mở lại theo điều kiện đã ghi |
| `P0` | Bắt buộc hoàn thành trước khi mở traffic production |
| `P1` | Bắt buộc hoàn thành trước khi kết thúc hypercare hoặc vận hành ổn định |

Owner trong file là vai trò chịu trách nhiệm đề xuất, không phải xác nhận người đã nhận việc:

- `TL`: technical lead/release owner.
- `SEC`: security owner.
- `DEV`: đội phát triển.
- `CORE/DEV1`: chủ sở hữu duy nhất của Big Update, gồm schema, migration, API nghiệp vụ, web UI, adapter và E2E. Từ 09/09/2026, phạm vi DEV2 cũ đã được nhập lại vào DEV1.
- `DEV2`: tên lịch sử của nhánh công việc giao diện trước 09/09/2026; không còn vùng code độc lập hoặc quyền tự xác nhận hoàn thành.
- `CI`: người duy trì kiểm tra tự động và quy tắc bảo vệ PR.
- `INFRA`: hạ tầng/DevOps.
- `DBA`: người chịu trách nhiệm PostgreSQL/Redis/backup.
- `INT`: người chịu trách nhiệm SePay/Hunonic/Zalo/Telegram/SMTP.
- `OPS`: quản lý vận hành.
- `FIN`: kế toán/đối soát.
- `OWNER-A`, `OWNER-B`: hai chủ sở hữu.

Mỗi mục chỉ được đổi sang `[x]` khi đủ `Definition of Done` và đường dẫn/ID bằng chứng. Không đưa password, token, cookie, private key, CCCD, thông tin bank đầy đủ hoặc dữ liệu khách hàng vào Git hay ảnh chụp công khai.

### Quyết định phạm vi owner — 26/09/2026

| ID | Trạng thái | Phạm vi đợt hiện tại | Điều kiện mở lại / giới hạn |
|---|---|---|---|
| `SCP-01` | `DEFERRED (OWNER)` | P11/P12 dùng fixture Hunonic mock có provenance để kiểm thử phần mềm. Không thực hiện UAT provider Hunonic trong đợt này. | Owner sẽ kiểm chứng Hunonic thủ công sau. Khi mở lại phải chạy `HUN-01..07` với provider thật; mock không được ghi là bằng chứng provider, giá điện thực tế hoặc production billing. |
| `SCP-02` | `DEFERRED (OWNER)` | Không triển khai/nghiệm thu upload ảnh hoặc chứng từ khách chuyển khoản để FIN xác nhận thủ công trong đợt này. | Owner sẽ upload và kiểm thử thủ công sau. Không được bypass automatic SePay matching, `NEEDS_REVIEW`, tenant scope, ledger, allocation, idempotency hoặc audit. |
| `SCP-03` | `REOPENED (OWNER) — LOCAL IN PROGRESS` | Owner xác nhận ngày 10/10/2026: phát triển Backup/Restore/Rollback và sửa lỗi deploy trên local với Docker Desktop; hoàn tất mới commit phiên bản ứng dụng mới và kiểm chứng CI/CD. Target phát hành là NAS Synology Container Manager qua QuickConnect. | Mở lại `BKP-*`, `STG-05`, `CORE-10.07` cho đợt sửa này. Không tác động NAS/production, không apply migration/data repair production; phát hành phải qua gate và duyệt riêng. Không tự nâng Node/dependency/platform (`SEC-02` vẫn giữ giới hạn). `LIVE NO-GO` giữ nguyên. |

## Big Update — TODO triển khai vòng đời thuê cốt lõi

Các mốc `CORE-*` là dependency mới bắt buộc trước `UAT-*` và `REL-*`. Baseline cũ chỉ chứng minh happy path tại thời điểm chạy; không được dùng để bỏ qua lỗi đã tái hiện trong báo cáo 07–08/09.

### Điều phối sau khi hợp nhất DEV2 vào DEV1

Tài liệu bàn giao và ranh giới file chính thức: [DEV2 — phát triển song song không xung đột CORE-04/05](./PARALLEL_DEV2_HANDOFF.md).

| ID | Trạng thái | Owner | Việc cần làm | Điều kiện hoàn thành |
|---|---|---|---|---|
| `TEAM-01` | [x] | TL | Hợp nhất vùng làm việc DEV2 cũ vào working tree DEV1 | DEV1 kiểm kê toàn bộ thay đổi; không tạo nhánh triển khai song song mới |
| `TEAM-02` | [x] | TL, DEV | Chốt một chủ sở hữu | DEV1 chịu trách nhiệm xuyên suốt backend → adapter → UI → test → tài liệu |
| `TEAM-03` | [x] | DEV1 | Chạy baseline sau hợp nhất | API 389/389 (15 skipped có chủ đích), web unit 106/106, typecheck API/web và build API/web đạt ngày 09/09/2026 |
| `TEAM-04` | [x] | DEV1 | Khóa API contract CORE-04/05 trước khi nối mutation thật | Path, payload, error code, RBAC, idempotency và invalidation đã công bố; web không còn fallback endpoint/ID giả |
| `TEAM-05` | `N/A` | TL | Guard file ownership hai PR | Không còn hai chủ sở hữu song song; thay bằng review scope theo từng mốc CORE |
| `TEAM-06` | `IN PROGRESS` | DEV1 | Nghiệm thu lại toàn bộ phần DEV2 cũ | Không dùng báo cáo DEV2 làm bằng chứng; mỗi lỗi phải có test chạy trên mã hợp nhất |
| `TEAM-07` | `IN PROGRESS` | DEV1 | Hoàn thành lần lượt `CORE-04` → `CORE-10` | Chỉ chuyển mốc khi đầy đủ unit, integration, E2E và evidence; production vẫn NO-GO |

Quy tắc bắt buộc sau hợp nhất: mọi kết quả DEV2 cũ được xem là đầu vào cần kiểm chứng, không phải bằng chứng nghiệm thu. DEV1 chỉ đánh dấu hoàn thành sau khi đọc mã nguồn thực tế và chạy gate trên head hợp nhất. Production không được migration/apply ngoài maintenance window và runbook đã phê duyệt.

### Bảng điều phối 1–10

| ID | Trạng thái | Owner | Phạm vi | Điều kiện hoàn thành |
|---|---|---|---|---|
| `CORE-01` | `IN PROGRESS` | TL, DEV, SEC, DBA | Gate 0: baseline, dữ liệu, tenant, token, SePay và idempotency nền | Regression probes được khóa; backup/restore DB riêng; cross-tenant và retry tiền đạt |
| `CORE-02` | `IN PROGRESS` | DEV, DBA, OPS | Customer + RentalCycle + Occupancy | Khách quay lại dùng hồ sơ cũ; không phòng ma; backfill có dry-run |
| `CORE-03` | `IN PROGRESS` | DEV, FIN | Payment/Receipt/Allocation/Credit/Refund và sổ nguồn | Thu đồng thời không mất tiền; retry không nhân đôi; Nợ = Có |
| `CORE-04` | `IN PROGRESS — CORE/DEV1` | DEV, OPS | Booking deposit và giữ chỗ | WHOLE/SHARED/capacity/hết hạn nhất quán; không giữ trùng |
| `CORE-05` | `IN PROGRESS — CORE/DEV1` | DEV, FIN, OPS | Chuyển/hủy/hoàn cọc | B<C/B=C/B>C đúng; không ghi đè tiền gốc; không hoàn vượt dư |
| `CORE-06` | [x] | DEV, OPS | Hợp đồng và nhận phòng | Một activation command; Contract–Occupancy–Room nhất quán; không hiển thị trùng |
| `CORE-07` | `IN PROGRESS — CORE/DEV1` | DEV, INT, FIN, OPS | Hóa đơn đầu kỳ/tháng, Hunonic và chia điện nước | Không lập trùng; snapshot kỳ khóa; tổng chia bằng tổng phòng |
| `CORE-08` | `IN PROGRESS` | DEV, FIN | Thanh toán và tab Tài chính | API/UI đúng room/customer/contract/kỳ thuê; truy vết đủ chứng từ |
| `CORE-09` | [x] | DEV, FIN, OPS | Gia hạn/chuyển/trả phòng/settlement và báo cáo đối soát | GATE-09 PASS; kỳ cũ bất biến; cọc/nợ/điện cuối, trạng thái phòng và đối soát nhất quán |
| `CORE-10` | [ ] | TL, DEV, DBA, OPS, FIN | Migration, E2E 11 ảnh, UAT và rollout | Toàn bộ acceptance gate đạt; UAT ký duyệt; rollout có rollback và evidence |

### `CORE-01` — Gate 0

- [x] `CORE-01.01` Chốt báo cáo hợp nhất, phạm vi cốt lõi, lộ trình 1–10 và acceptance gate.
- [x] `CORE-01.02` Đã chuyển đủ 7 audit probe vào suite chính: bảo toàn cọc gốc, tenant scope invoice, CAS thanh toán, không suy cọc từ hóa đơn, token type, logout revoke và SePay tenant binding; API 331/331 đạt 08/09/2026.
- [x] `CORE-01.03` Đã tạo `npm run audit:core-lifecycle -- --env-file .env` chỉ đọc và test 3/3. Baseline 08/09/2026: 31 finding = 15 critical + 6 high + 10 medium; gồm 10 Occupancy mở với hợp đồng terminal, 5 khách nhiều Occupancy mở, 3 phòng AVAILABLE còn binding, 1 nhóm trùng điện thoại và 2 nhóm trùng CCCD; chưa thấy lệch cọc hoặc invoice/allocation.
- [x] `CORE-01.04` Access/refresh có `tokenType` riêng; access strategy từ chối refresh token; logout bắt buộc access token và thu hồi refresh hash, API 331/331 + typecheck đạt 08/09/2026. Thay đổi này buộc các phiên token cũ đăng nhập lại.
- `IN PROGRESS` `CORE-01.05` Tenant scope đã bao phủ `findUniqueOrThrow`, `findFirstOrThrow`, aggregate/groupBy và upsert; SePay credential chỉ tra payment request thuộc tenant đã xác thực; còn kiểm tra file/source ID.
- `IN PROGRESS` `CORE-01.06` Thanh toán hóa đơn đã dùng CAS trên `paidAmount + creditAmount + status`, xung đột rollback trước khi tạo Payment/Allocation; còn chuẩn hóa idempotency key cho mọi command tiền.
- [x] `CORE-01.07` Backup DB `2026-09-08T02-59-51-364Z` SUCCESS; restore vào `homeland_core_restore_drill_20260908` PASS 10/10 rồi đã xóa DB drill. Nguồn/restore khớp: tenant 25, room 51, customer 22, contract 15, deposit 24, invoice 10, payment 6, occupancy 11; invoice total 59.400.000đ, invoice paid 32.500.000đ, deposit 123.000.000đ, confirmed payment 38.100.000đ. Đây là drill DB cục bộ; off-host/storage vẫn theo checklist BKP riêng.

### `CORE-02` — Customer, RentalCycle và Occupancy

- [x] `CORE-02.01` Đã thêm migration additive `RentalCycle` và FK nullable tới Contract, Deposit, Occupancy, Invoice, Payment, Settlement; tenant scope đã bao phủ model mới. Migration test trên DB cô lập PASS, backup hậu-cleanup `2026-09-08T07-16-03-711Z` SUCCESS và schema dev `db push` thành công 08/09/2026.
- [x] `CORE-02.02` Cleanup 10 Occupancy terminal hoàn tất. Ba finding khách trùng được gom thành 2 cụm, review và merge mềm có AuditLog; 15 RentalCycle đã backfill cùng 22 cọc, 11 Occupancy, 9 hóa đơn, 5 thanh toán. Hậu kiểm: 0 khách trùng, 0 candidate/skip/orphan và detector 0 finding. Backup trước merge `2026-09-08T07-30-23-920Z`, sau merge/trước backfill `2026-09-08T07-31-27-774Z`, sau backfill `2026-09-08T07-43-09-118Z`.
- [ ] `CORE-02.03` API duplicate phone/CCCD trả chính xác hồ sơ cũ để giao diện chọn lại.
- [ ] `CORE-02.04` Dùng Occupancy chưa kết thúc làm nguồn sự thật người đang ở; `Customer.roomId` chỉ là cache tương thích.
- `IN PROGRESS` `CORE-02.05` Command kết thúc đã đóng Occupancy đúng tenant trong cùng transaction và có regression; 10 Occupancy terminal lịch sử đã đóng bằng cleanup có audit ngày 08/09/2026. Còn rà soát toàn bộ nhánh di chuyển/phòng ghép.
- `IN PROGRESS` `CORE-02.06` Chặn WHOLE room có roommate thiếu hợp đồng chính; SHARED room không vượt capacity. Rerun PostgreSQL cô lập ngày 26/09/2026 với schema up-to-date 30 migrations: P8 `test:p8` 5/5 PASS; P9 `test:p9` 2/2 PASS cho race activate và race tạo `RoomHold`/cọc ở suất cuối, có kiểm tra capacity invariant và cleanup. Current rerun gate đang `BLOCKED`: `homeland_ci_repair_test` không còn tồn tại, `homeland_test` có 0 migration; P8 unit vẫn PASS 4/4 nhưng integration bị skip fail-closed. Không dùng database chung, không chạy P9/P17 integration cho đến khi DBA provision lại DB test đã migrate từ release/baseline được duyệt. Chưa đánh dấu hoàn thành: còn FIN xác nhận phân bổ từng hợp đồng và OPS UAT roommate.
- [x] `CORE-02.07` API trả open Occupancy + phòng, bộ lọc ACTIVE/INACTIVE xét cả Occupancy và UI hiển thị “Ở ghép”; API 326/326 và typecheck đạt 08/09/2026.

### `CORE-03` — Lõi tiền và sổ phân bổ

- [ ] `CORE-03.01` Tách nghĩa vụ phải thu khỏi tiền đã thu; số dư được tính từ giao dịch hiệu lực.
- [x] `CORE-03.02` Thanh toán hóa đơn dùng CAS; request dùng snapshot cũ bị trả `INVOICE_PAYMENT_CONCURRENT_UPDATE` trước khi tạo Payment/Allocation, API 331/331 đạt 08/09/2026.
- [x] `CORE-03.03` Đã loại bỏ cập nhật cọc khỏi luồng `invoice.paid`; regression xác nhận hóa đơn thuê PAID không đổi cọc PENDING, API 331/331 đạt 08/09/2026.
- [ ] `CORE-03.04` Chuẩn hóa Credit/Refund/Receipt và bút toán reversal không sửa giao dịch gốc.
- [ ] `CORE-03.05` Đưa audit/event tài chính sang cùng transaction + outbox/retry idempotent.
- [ ] `CORE-03.06` Test invariant bảo toàn tiền và Nợ = Có cho success/failure/retry/concurrency.

### `CORE-04` — Booking deposit và giữ chỗ

- **Owner code độc quyền:** CORE/DEV1. DEV2 chỉ dựng UI bằng fixture và chờ API contract khóa.
- [x] `CORE-04.01` Hold đã có tenant, RentalCycle chủ sở hữu, deposit, room/resource WHOLE hoặc SHARED slot, hạn hiệu lực, trạng thái và active resource key duy nhất.
- `IN PROGRESS` `CORE-04.02` Command thu cọc đã ghi CASH_IN, khóa hold và chuyển RentalCycle RESERVED trong một serializable transaction; security deposit chỉ thu phần còn thiếu. Integration PostgreSQL thật đã đạt; còn đối soát hold/dữ liệu lịch sử trên staging.
- [x] `CORE-04.03` Đã có quét hết hạn, gia hạn, giải phóng/no-show qua command hủy, thu muộn kiểm tra lại capacity và chuyển phòng/chỗ trong transaction; chuyển khi đã có contract bị chặn sang CORE-06.
- [x] `CORE-04.04` Khóa dòng Room + SERIALIZABLE + active resource key + capacity WHOLE/SHARED đã đạt kiểm thử nhiều connection PostgreSQL thật.
- [x] `CORE-04.05` Hủy chỉ giải phóng hold cùng tenant + RentalCycle + deposit; kiểm thử phòng ghép có Occupancy và nhiều hold xác nhận không ảnh hưởng khách còn lại.
- [x] `CORE-04.06` Operation idempotency, request hash, advisory lock, CAS và retry đúng cả Prisma `P2034` lẫn PostgreSQL `40001` bọc trong `P2010`; cùng key đồng thời chỉ ghi một CASH_IN trên DB thật.
- [x] `CORE-04.07` Đã công bố [API contract CORE-04/05](./CORE_04_05_API_CONTRACT.md): path, payload/response, error code, RBAC hiện hữu, idempotency và query invalidation.

### `CORE-05` — Chuyển, hủy và hoàn cọc

- **Owner code độc quyền:** CORE/DEV1. DEV2 không tạo chuỗi API legacy để mô phỏng command chuyển cọc.
- `IN PROGRESS` `CORE-05.01` Migration additive, ledger append-only/check/trigger và balance từ tổng effect đã có. Script opening balance mặc định dry-run, chỉ apply file FIN duyệt có evidence; migration DB cô lập đạt. Còn FIN đối soát và ký file staging/production.
- `IN PROGRESS` `CORE-05.02` Một command chuyển booking sang security với ma trận B<C, B=C, B>C đã đạt 23 unit tests và toàn bộ nhánh trên PostgreSQL thật; còn UAT nghiệp vụ/FIN trên staging.
- [x] `CORE-05.03` Command giữ nguyên `Deposit.amount` nguồn; tạo TRANSFER_OUT/IN, chỉ thu thêm phần thiếu, tạo CreditNote hoặc Receipt phần thừa; pending refund không ghi cash-out. Ma trận bảo toàn số dư đạt integration DB thật.
- [x] `CORE-05.04` Command hủy bắt buộc phân bổ đủ balance thành REFUND/KEEP/DEDUCT; PENDING/COMPLETED tách riêng và complete dùng CAS. Chứng từ, audit và event outbox được ghi cùng transaction; dispatcher có claim chống tranh chấp, retry/backoff, phục hồi claim kẹt và `outboxEventId` cho consumer khử trùng. Canary downstream vẫn thuộc gate staging `CORE-05.08`.
- [x] `CORE-05.05` Idempotency key + request hash + row/advisory lock + unique key chặn retry; hai complete refund đồng thời trên PostgreSQL thật chỉ một cash-out và không hoàn vượt balance.
- [x] `CORE-05.06` Khách quay lại chỉ tái sử dụng RentalCycle PLANNED/RESERVED chưa có contract hoặc tạo kỳ mới; RentalCycle và phiếu cọc terminal của kỳ cũ không bị nối lại/sửa đổi.
- [x] `CORE-05.07` Collect/refund/complete concurrency và reversal append-only đã có unit + integration; reversal đảo toàn operation, giữ dòng gốc và chặn workflow Receipt/CreditNote chưa được đảo chứng từ.
- `IN PROGRESS` `CORE-05.08` Policy B<C/B=C/B>C, full/partial/over-allocation, rollback giữa transaction và cross-tenant đã đạt; còn fault-injection timeout/network ở staging.
- [x] `CORE-05.09` Đã công bố `GET /deposits/rental-cycles/:rentalCycleId/finance-summary`; DEV2 nhận balance/ledger/invoice/payment/pending operation theo tenant và không tự tính từ status.
- [x] `CORE-05.10` Web đã bỏ `window.prompt`/endpoint fallback/ID hoàn tiền giả; mọi command tiền bắt buộc idempotency key, cancel phân bổ đúng toàn bộ số dư ledger và hoàn pending chỉ hoàn tất bằng `operationId`. API 364/364, web unit 103/103; E2E cọc đạt 7/7 trên Desktop 1920 và 7/7 trên Laptop 1440 ngày 09/09/2026. Playwright còn rò tiến trình webServer sau khi in đủ kết quả và được theo dõi như lỗi harness, không đổi kết quả assertion.

### `CORE-06` — Hợp đồng và nhận phòng

- [x] `CORE-06.01` Backend chỉ cho tạo DRAFT, chặn đổi status qua PATCH; luồng tải hồ sơ chỉ trình duyệt và quick-create tạo DRAFT. API 326/326, shared 3/3 và typecheck đạt 08/09/2026.
- [x] `CORE-06.02` Activation kiểm tra đúng tenant, trạng thái APPROVED, `signedAt` hợp lệ, ngày bắt đầu không ở tương lai, số dư thực thu từ ledger, cọc PAID/CONVERTED, hold còn hiệu lực, trạng thái phòng và capacity phòng ghép; command bắt buộc `Idempotency-Key` 8–128 ký tự và chặn khóa đã thuộc hợp đồng khác.
- [x] `CORE-06.03` Một transaction khóa dòng Room, claim trạng thái bằng CAS, lưu snapshot nhận phòng/đồng hồ, kích hoạt RentalCycle, tạo ContractParty + Occupancy, cập nhật Room/cọc và lập hóa đơn kỳ đầu. PostgreSQL cô lập xác nhận hai activation tranh chấp chỉ có một lệnh thắng, một hóa đơn, một Occupancy, một ContractParty; retry cùng khóa không nhân đôi.
- [x] `CORE-06.04` Loại hợp đồng hiển thị trùng trong modal theo `contractId`/mã hợp đồng ổn định; web typecheck đạt 08/09/2026.
- [x] `CORE-06.05` Đồng bộ lịch sử hợp đồng dùng ID Occupancy xác định + upsert; CAS activation, khóa dòng Room và capacity phòng ghép nằm trong transaction. PostgreSQL integration xác nhận hai hợp đồng khác nhau tranh chỗ cuối chỉ một hợp đồng ACTIVE, tổng Occupancy không vượt capacity và chỉ tạo một hóa đơn.
- [x] `CORE-06.06` Đã kiểm thử ngày 1 của tháng, giữa tháng năm nhuận, ngày vào tương lai, chữ ký thiếu, retry cùng khóa, khóa bị tái sử dụng, tranh chấp khác khóa, thiếu ledger/hold, vượt capacity và rollback khi tạo hóa đơn lỗi. Focused contract 66/66 và PostgreSQL integration 3/3 đạt ngày 09/09/2026.

### `CORE-07` — Hóa đơn, Hunonic và điện nước

- [x] `CORE-07.01` Invoice đầu kỳ/tháng dùng `billingKind` + `baseInvoiceKey` canonical duy nhất; adjustment debit/credit là chứng từ append-only liên kết root base, bắt buộc tenant + `Idempotency-Key`, request hash/replay, khóa transaction và bảo toàn nghĩa vụ so với tiền đã phân bổ. Base/items không bị ghi đè; lifecycle dùng AuditLog + semantic Outbox nguyên tử, không emit trực tiếp; chốt tháng chỉ replay exact `MONTHLY_BASE`. Focused 52/52, full API 428 pass/0 fail/31 conditional skip, PostgreSQL cô lập 16/16 và API typecheck/build đạt ngày 10/09/2026. Finance và release review `PASS_WITH_WARNINGS`; Journal/account mapping vẫn là gate CORE-03/05/09, không production migration.
- [x] `CORE-07.02` Chốt tháng tạo/update `InvoiceItem` và tổng hóa đơn trong cùng transaction; không còn khoảng trống giữa xóa item và tạo lại. API 367/367 và focused settlement 15/15 đạt 09/09/2026.
- [x] `CORE-07.03` Chuẩn hóa kỳ `YYYY-MM`, từ chối tháng 00/13/định dạng sai; invoice đầu kỳ dùng `firstPaymentDate`, prorate theo số ngày thực 28–31 và năm nhuận với policy `ACTUAL_DAYS_V1`. Test đầu tháng/giữa tháng/năm nhuận/kỳ sai đạt.
- `IN PROGRESS` `CORE-07.04` Code gate đạt `PASS_WITH_WARNINGS` ngày 10/09/2026, không còn P0/P1 sau finance audit và release review độc lập. `BillingSnapshot` chỉ cho phép trạng thái `LOCKED`, bất biến sau tạo, bắt buộc hash/provenance; `InvoiceItem` điện/nước của `MONTHLY_BASE` bắt buộc liên kết snapshot đúng tenant + kỳ; reading Hunonic append-only theo payload hash, không ghi đè mapping đã dùng, cho phép hai observation khác payload cùng timestamp và exact retry idempotent bằng `createMany(skipDuplicates)` + kiểm tra exact hash; settlement khóa chung evidence, CAS nguồn, đối soát đúng meter/kỳ và dùng biên thời gian UTC+7. Migration additive được bọc `BEGIN/COMMIT`, bỏ unique timestamp cũ và giữ unique payload identity. Bằng chứng: focused 40/40, PostgreSQL cô lập 4/4 gọi service thật, full API 442 pass/35 conditional skip, E2E 1 pass/12 conditional skip, API typecheck/build, Prisma validate và `git diff --check` đều PASS; DB/tệp kiểm thử tạm đã xóa. Theo `SCP-01`, mock có provenance được chấp nhận cho software verification đợt này; UAT payload Hunonic thật (`MONTHLY_AGGREGATE_V1`, đơn vị/scale, source period, meter identity, semantics chỉ số) được `DEFERRED (OWNER)`. Mock không cho phép đổi sang `[x]` hoặc apply production.
- `IN PROGRESS` `CORE-07.05` Code gate đạt finance `PASS` và release `PASS_WITH_WARNINGS` ngày 11/09/2026, không còn P0/P1. `Occupancy` là nguồn headcount duy nhất theo biên nửa mở UTC+7; payer hợp đồng được tách khỏi người thực ở và mọi liên kết tenant/customer/contract đều fail-closed. Phòng ghép chia điện/kWh bảo toàn tổng theo số người đủ điều kiện và nước đúng 100.000đ/người; WHOLE/SHARED, terminal, occupancy không gắn hợp đồng và terminal soft-delete đều có guard chống gán nhầm/double charge. Overview Hunonic dùng chế độ read-only, chặn evidence live/legacy chưa xác minh trên toàn scope trước financial write, phát hiện observation mới nhất room-wide kể cả thay công tơ; snapshot dùng create-only `createMany(skipDuplicates) + findUnique`, xác minh concurrent winner và retry snapshot khóa mà không `UPDATE` trigger bất biến. MONTHLY_BASE đã khóa phải khớp đầy đủ payer, rental cycle, kỳ, đúng một dòng RENT, SERVICE/điện/nước, snapshot link và tổng tiền. Bằng chứng: focused 88/88, full API 491 pass/37 conditional skip, API typecheck/build và `git diff --check` PASS; PostgreSQL cô lập 7/7 gồm immutable trigger, create-only conflict, settlement-run concurrency và phòng ghép hai hợp đồng bị ngắt sau hóa đơn đầu rồi retry cùng snapshot. Database kiểm thử tạm đã xóa. Theo `SCP-01`, UAT provider Hunonic thật được `DEFERRED (OWNER)`; vẫn giữ `IN PROGRESS` cho tới khi backfill/đối soát `actual joinedAt` + tenant/contract binding trên dữ liệu legacy và maintenance-window gate hoàn tất; không production migration/apply.
- `EVIDENCE UPDATE` 26/09/2026: cùng database PostgreSQL cô lập đã migrate 30 migrations, rerun snapshot/provenance P11 PASS 14/14 và immutable snapshot/monthly invoice replay P12 PASS 40/40. Đây là regression database thật. Theo `SCP-01`, fixture Hunonic mock thay thế provider UAT trong phạm vi software đợt này; expected bill có FIN ký, QR/SePay UAT và maintenance-window gate vẫn không được bỏ qua. Trạng thái `IN PROGRESS` giữ nguyên.
- [x] `CORE-07.06` Phân bổ phần lẻ xác định theo đơn vị nhỏ nhất, ưu tiên thứ tự ổn định; tổng kWh (3 số lẻ) và tiền (2 số lẻ) các hợp đồng luôn bằng đúng tổng phòng. Có test 1/3, hợp đồng không đủ điều kiện và phòng ghép.
- [x] `CORE-07.07` `MonthlySettlementRun` khóa duy nhất theo tenant + kỳ + phạm vi, lưu request hash/result và trạng thái RUNNING/COMPLETED/FAILED; lệnh đang chạy bị chặn, lệnh hoàn tất được replay, payload khác bị từ chối và run FAILED được claim lại bằng CAS. Snapshot dùng upsert `update: {}` nên sync Hunonic mới không ghi đè kỳ đã khóa. Unit 20/20 và PostgreSQL concurrency integration 1/1 đạt ngày 09/09/2026.
- `IN PROGRESS` `CORE-07.08` Code gate đạt release review `PASS_WITH_WARNINGS` ngày 12/09/2026, không còn P0/P1. Tab Tổng hợp phân biệt `Snapshot đã khóa`/`Dữ liệu chưa khóa`, hiển thị trực tiếp mã snapshot + kỳ kể cả 0đ; số Hunonic mới chỉ thành reconciliation delta màu đỏ. Query hóa đơn fail-closed khi thiếu kỳ; modal dùng đúng contract detail và gửi đủ phòng/khách/hợp đồng/kỳ. API bảo toàn compatibility khi thiếu `rentalCycleId`, nhưng xác minh tenant + phòng + khách + hợp đồng + kỳ trước khi lưu authoritative cycle. Bằng chứng: API 505 pass/37 conditional skip, Web 115/115, hai typecheck và `git diff --check` PASS. Còn P2: validate và insert chưa cùng transaction nên có cửa sổ TOCTOU hẹp; thiếu mounted integration `RoomPremiumModal → contract detail → InvoiceCreateModal`. E2E Tổng hợp 1/1 trước đó dùng overview mock; vẫn cần DB-backed E2E, UAT Hunonic thật và maintenance-window gate nên chưa đổi `[x]`.

### `CORE-08` — Thanh toán và Tài chính phòng

- [x] `CORE-08.01` API danh sách hóa đơn áp bộ lọc `roomId`; có unit regression test, API suite 326/326 đạt 08/09/2026.
- [x] `CORE-08.02` Modal phòng đọc đúng mảng hóa đơn từ query; web typecheck đạt 08/09/2026.
- [x] `CORE-08.03` API và Web đã truyền đủ scope `roomId + customerId + contractId + rentalCycleId`; modal phòng ưu tiên kỳ có hợp đồng ACTIVE/EXPIRING rồi mới tới kỳ chuẩn bị/terminal, mặc định đúng khách đang chọn. Invoice unit 13/13, web unit 106/106 và typecheck/build đạt ngày 09/09/2026.
- [x] `CORE-08.04` Chế độ “Tổng phòng” tách riêng và mỗi dòng mở được chứng từ nguồn.
  - Dependency phát hiện khi đọc mã: `getRentalCycleFinanceSummary` đang cộng mọi hóa đơn chưa xóa, chưa tách DRAFT/CANCELLED và dấu của CREDIT_ADJUSTMENT; cần finance audit quy tắc nghĩa vụ theo nhóm hóa đơn gốc/điều chỉnh, tiền đã phân bổ và credit trước khi tổng hợp phòng. Không bù chéo nợ giữa khách/kỳ thuê bằng cách lấy `max` trên tổng phòng.
  - Triển khai endpoint tổng phòng authoritative theo tenant + room, trả từng kỳ/khách/hợp đồng và ID chứng từ; UI có lựa chọn riêng, không tự cộng summary các khách. Nghiệm thu gồm hai khách phòng ghép, cùng khách hai kỳ, chuyển lựa chọn A/B/tổng phòng, từ chối nguồn ngoài tenant/phòng và mở đúng chứng từ.
  - Finance policy đã duyệt 12/09/2026: tính riêng từng họ hóa đơn gốc + debit - credit; DRAFT/CANCELLED có hiệu lực tiền bằng 0; WRITTEN_OFF giữ lịch sử tiền đã thu nhưng phần dư không còn là outstanding; tiền đã thu chỉ lấy `PaymentAllocation` có payment `CONFIRMED` và chưa xóa; credit/overpayment chưa áp dụng không giảm nợ; outstanding clamp theo từng họ rồi mới cộng kỳ/phòng; cọc bằng tổng `DepositLedgerEntry.balanceEffect`; pending refund chỉ là operation chờ. Mọi dòng phải trả `source.entity + source.id`.
  - GATE-08 PASS ngày 12/09/2026: relation con đã tenant-scope, ledger/source metadata đầy đủ, orphan adjustment bị loại/báo riêng; source invoice/payment/deposit/ledger mở đúng context và fail-closed khi đổi phòng/khách/hợp đồng/kỳ. Focused deep-link 11/11 và milestone review không còn P0/P1.
- [x] `CORE-08.05` Modal Tài chính dùng summary authoritative theo RentalCycle; hiển thị giá thuê, cọc/ledger, hóa đơn, payment, credit và dư nợ; query và deep-link khóa đúng `roomId + customerId + contractId + rentalCycleId`. Focused frontend GATE-08 đạt 18/18 ngày 12/09/2026.
- [x] `CORE-08.06` SePay/manual payment đã tenant-bind đúng bank/owner/source; thiếu/thừa/sai nội dung/sai bank vào `NEEDS_REVIEW`; stable idempotency/provider reference, advisory lock, CAS và replay chặn trùng Payment/Allocation/CreditNote/refund. Retry sau financial commit hoàn tất request/log mà không ghi tiền lần hai. PostgreSQL focused retry/partial/concurrency đạt 3/3, refund CAS 1/1 và milestone review PASS ngày 12/09/2026.
- [x] `CORE-08.07` E2E PostgreSQL cô lập phòng SHARED A/B đạt 1/1 ngày 12/09/2026: Invoice/Payment/Deposit/Ledger/Credit/outstanding tách theo Customer/Contract/RentalCycle; tổng phòng giữ hai kỳ riêng và cross-tenant bị chặn.
- [x] `CORE-08.08` Email khách là tùy chọn; chuỗi rỗng chuẩn hóa thành null và shared tests 3/3 đạt 08/09/2026.

### `CORE-09` — Cuối vòng đời và báo cáo đối soát

- [x] `CORE-09.01` Settlement authoritative đã xử lý nợ cũ, điện nước cuối, cấn/hoàn cọc append-only và chống retry/concurrency; cấn cọc phân bổ đúng toàn bộ invoice family, không double-count credit/reversal.
- [x] `CORE-09.02` Finalize đóng đúng Occupancy mục tiêu, giữ ContractParty/lịch sử và roommate SHARED; `expireContract` fail-closed hoặc replay lifecycle canonical, không bypass settlement.
- [x] `CORE-09.03` Renewal tạo Contract/RentalCycle mới, giữ bất biến kỳ và chứng từ cũ; retry/concurrency chỉ tạo một kết quả canonical.
- [x] `CORE-09.04` Chuyển/rời phòng tenant-scope, khóa capacity hai phòng, không duplicate Occupancy và không giải phóng roommate; primary transfer chủ động fail-closed khi chưa đủ settlement/deposit.
- [x] `CORE-09.05` Ledger/cashflow/P&L/owner report dùng chung journal-effect authoritative với semantics POSTED/REVERSED, source mapping và tenant/owner isolation.
- [x] `CORE-09.06` Reconciliation dùng một JournalLine-first dataset cho tenant/owner/building/room/customer/contract/RentalCycle/kỳ; totals/groups/drill-down/source trace cùng financial truth.
- [x] `GATE-09` ngày 13/09/2026: Sol High review PASS sau khi đóng 3 finding; 10 focused spec files đạt 42/42, gồm settlement/lifecycle/renewal/transfer/journal/reporting/reconciliation. Không chạy full regression hoặc CORE-10 tests.

### `CORE-10` — Migration, kiểm thử và rollout

> Gate schema CORE-10.01 đã PASS bằng kiến trúc tách biệt: `homeland_staging_authoritative_v2` là schema authority dựng từ BASELINE-V2; `localhost:5430/homeland` chỉ là legacy data source cho audit/backfill. 18 migration lịch sử và checksum được giữ nguyên; production chưa được apply.

- [x] `CORE-10.01` BASELINE-V2 và manifest 18/18 đã được Sol High review PASS ngày 13/09/2026; không sửa migration/checksum lịch sử. Schema authority `homeland_staging_authoritative_v2` đạt fingerprint `41d9b9c2ce5892f4da23688e2c26ca6dc15fcc3f270ec3b51d5795a227ab0e66`, đủ 72 bảng, 875 cột, 167 constraint, 257 index, 10 function, 10 trigger và migration state sạch 18/18. Backup server-v16 `2026-09-13T03-09-24-779Z` có SHA-256 `903a2927108cb5d69f0d3cad8b299bd3c76615adb9bbe3dd9f5064881830fbaf`; restore cô lập khớp fingerprint/history và DB tạm đã xóa. Legacy `localhost:5430/homeland` không bị sửa, chỉ dùng làm nguồn dữ liệu CORE-10.02. Production apply chưa chạy và vẫn bắt buộc maintenance-window approval.
- `BLOCKED` 26/09/2026: fresh deploy trên PostgreSQL cô lập có `pgvector` tới database tạm `homeland_deposit_integration_tmp` dừng tại `20260708042302_expand_contract_status` với `P3018` / `SQLSTATE 42710`: enum label `PENDING_APPROVAL` đã tồn tại. Migration list hiện tại có 24 migration; vì vậy evidence manifest 18/18 lịch sử không đủ để xác nhận fresh-migration gate cho revision hiện tại. Database tạm lỗi đã được xóa, không sửa migration/checksum lịch sử và không apply production. Cần DBA/release owner chốt baseline hoặc remediation được review trước khi rerun bất kỳ integration suite fresh-DB, provider sandbox hoặc CORE-10 gate.
- [x] `CORE-10.02` Rehearsal dữ liệu trên schema authority đạt Sol High review PASS ngày 13/09/2026 với RUN_ID `core1002-20260913-authority-d`. Source là dump legacy read-only SHA-256 `02b090bbbfdfbaa72137ee7e015f3e78a2ec1db93d5bfc4cb2dab63ec7184c8c`; full-row fingerprint `324c8e0a3e263702646c6eb34904cbace593f9cefe59138b158b6530a1529b97` khóa cả timestamp. Hai dry-run deterministic: 449 nguồn, 400 eligible/insert, 44 reject, 6 review, 2 backfill, 0 conflict/orphan. Keyset batch 25, transaction từng batch, fault sau commit rồi resume và replay cùng RUN_ID đều không duplicate; failed APPLY ghi `TOTAL_FAILED=1`, RESUME thành công ghi `0`. Financial source → expected = target: cọc 128.000.000đ → 100.000.000đ, hóa đơn 65.000.000đ → 44.800.000đ, thu/allocation 38.100.000đ → 28.000.000đ, outstanding 26.900.000đ → 16.800.000đ; delta nằm trong quarantine có ID/lý do. Detector target 0 finding; legacy gốc không bị mutate. DepositLedger/credit/refund và snapshot/run vẫn là review/backfill, không được tự tạo. Production apply chưa chạy.
- [x] `CORE-10.03` Acceptance matrix CORE-04→09 đã được hợp nhất theo current working tree ngày 13/09/2026. Focused rerun các vùng bị invalidated đạt 108/108 (Contracts/Workflow/Payments/Finance), API typecheck PASS và `git diff --check` PASS; fixture chỉ căn theo tenant-scope, ledger, bank và canonical lifecycle, không sửa production. CORE-04/05 đạt 43 PASS + 11 conditional skip; CORE-07 đạt 88 PASS + 7 conditional skip; Web focused đạt 23/23. CORE-08/09 tái sử dụng evidence gate độc lập còn hợp lệ (GATE-08 42/42 + SHARED E2E, GATE-09 42/42) vì production path không đổi sau gate; CORE-08.07 E2E hiện không rerun do thiếu credential/API và được ghi là carry-forward evidence. Không còn P0/P1 test gap trong phạm vi acceptance; `payments.service.spec.ts:1512` không còn chặn typecheck. DepositLedger/credit/refund/BillingSnapshot/MonthlySettlementRun vẫn `BACKFILL_APPROVAL_REQUIRED`, không tự phê duyệt. CORE-10.04 chưa bắt đầu.
- [ ] `CORE-10.04` E2E happy path + mọi ngoại lệ cọc/hợp đồng/hóa đơn/tiền và 11 ảnh vận hành.
  - Rà soát `maps/index.html` ngày 19/09/2026: P3 đã có code fix cục bộ cho tạo cọc nguyên tử/idempotent — `POST /deposits` nhận `idempotency-key`, tạo deposit + `RentalCycle` + `DepositOperation` + outbox/audit trong serializable transaction và replay cùng request hash. Luồng cọc BOOKING/RESERVATION nay tạo `RoomHold`, chuyển phòng `RESERVED`, gắn khách vào phòng và tạo task admin cập nhật hợp đồng/thông tin khách; INSERT `DepositOperation` đã chỉ rõ `sourceDepositId` bắt buộc và `targetDepositId` null. P24 đã có distributed scheduler lock cho `syncEnabledTenantsEvery15Minutes` và retry/backoff khi fetch Hunonic provider. Bằng chứng: `deposit-core.service.spec.ts` 17/17, `hunonic.service.spec.ts` 21/21, API typecheck và web typecheck PASS. Vẫn chưa đóng CORE-10.04 vì E2E/staging/ảnh vận hành, quan sát nhiều worker trên staging và UAT provider thật chưa chạy.
  - P13 đã chuyển từ blocker chính sách sang cấu hình Admin Settings: `notifications.reminderDays` gồm hóa đơn sắp đến hạn, hóa đơn quá hạn và hợp đồng sắp hết hạn; scheduler đọc AppSetting theo tenant. Rerun focused ngày 26/09/2026: scheduler/rule/workflow/communication/Zalo registration PASS 64/64, gồm duplicate, retry và delivery failure trace; API typecheck PASS. Đây không phải bằng chứng gửi thật. Còn UAT gửi thật qua kênh Zalo/Telegram/Email đã bật với message ID, delivery status và timezone UTC+7.
  - P14 code evidence ngày 26/09/2026: renewal immutable, tenant-backed task và document controller/service PASS 25/25. Còn staging UAT người xử lý/deadline, tệp tạm trú server-backed và continuity hợp đồng/cọc/occupancy; không dùng local/browser marker làm evidence.
  - P18 đã được owner chốt phạm vi UAT ngày 19/09/2026: được chọn bất kỳ tòa/phòng trong 4 căn, đối chiếu 3 tháng gần nhất, Hunonic credential nằm trong Settings, được sync thật vào DB staging, SePay dùng sandbox/Speaker API, người ký là chủ nhà và tiêu chí đối soát >=99%. Đã sửa UI Settings SePay để Admin/setting.update nhập được Webhook API Key/HMAC Secret lần đầu và sửa modal sửa/thêm bank không còn chìm dưới modal owner; DB xác nhận HMAC mode, 2 VA BIDV active, webhook health qua tunnel 200, valid HMAC probe trả 200, invalid trả 401. SePay sandbox đã bắn 3 webhook thật qua cả 2 VA BIDV và app xác thực thành công; status `IGNORED` đúng kỳ vọng vì nội dung chưa có payment code. Luồng cọc giữ phòng hiện dùng deposit QR, hiển thị QR/paymentCode ngay trong modal, không gửi enum `HELD` không tồn tại, đồng bộ phòng/khách về Buildings/Customers và tạo task admin cập nhật hợp đồng. `deposit-core.service.spec.ts` 17/17, `payments.service.spec.ts` 25/25, API/web typecheck PASS. Còn cần test sandbox có payment code để match invoice/deposit thật, lưu evidence đối soát và ảnh/sign-off.
  - `SCOPE UPDATE` 26/09/2026: `SCP-01` thay thế riêng phần Hunonic của phạm vi P18 nêu trên. E2E/software UAT hiện dùng fixture mock có provenance; không chạy hoặc ghi nhận Hunonic provider thật là PASS trong đợt này. SePay sandbox/payment-code, Zalo/SSE, money controls, staging đúng SHA, dữ liệu mask, cleanup, 11 ảnh vận hành và các sign-off còn lại vẫn là điều kiện P17/P18; `SCP-02` chỉ hoãn upload chứng từ khách chuyển khoản, không hoãn các controls này.
  - `BLOCKED` 26/09/2026: runtime `localhost:3001` liveness `/health` vẫn `200`, nhưng sau login admin hợp lệ, truy vấn read-only `GET /api/v1/customers?limit=1` trả `500`. API hiện dùng schema có `Customer.phoneNormalized`, trong khi database dùng chung chưa có cột này và chưa ở trạng thái migration tương thích. Readiness đã được harden để kiểm tra migration floor/tables/columns runtime và trả `503` với database lệch; focused readiness `3/3` và API typecheck PASS. Vì vậy không được gửi giao dịch sandbox có payment code, không đánh dấu Zalo/admin/SSE E2E PASS và không cập nhật `maps/index.html` thành hoàn thành. Cần DBA provision database staging/test đã migration đúng release SHA, xác minh customer query PASS, rồi mới chạy SePay sandbox matched-payment + Zalo customer/admin + SSE + replay-idempotency. Code-level cho fan-out đã PASS: invoice payment chờ `publishAsync`; workflow tạo queue retry Zalo và event IN_APP cho SSE; focused `62/62` payment/automation + `33/33` workflow/communication. Đây không phải evidence provider/UAT.
  - `LOCAL UAT UPDATE` 29/09/2026: schema mismatch của database local hiện tại không còn tái hiện; API, CRM proxy và tunnel đều `200 READY`, database/schema `UP`. Regression trực tiếp LK01.32 đạt hai nhánh: cọc giữ phòng → chuyển thuê tại PN 32-02 và thuê ở ngay tại PN 32-04; cả hai kết thúc contract/cycle/occupancy `ACTIVE`, payment/allocation không trùng. Zalo Client thật nhận hai xác nhận tiền mặt `266.667đ` và `8.000.000đ` với queue `DELIVERED`; nhóm admin cũng nhận. Legacy PN 31-02 đã quarantine có audit và detector database hiện tại trả `0 finding`. Focused API `212/212`, resolver web `13/13`, detector `4/4`, API typecheck PASS. CORE-10.04 vẫn mở: đây là local/current-DB UAT, chưa thay thế staging release-SHA bất biến, SePay matched-payment thật, cleanup record, đủ bộ ảnh và sign-off đa vai trò.
  - `ENTRY BILLING UPDATE` 29/09/2026: thanh toán lần đầu của cả thuê ở ngay và chuyển từ cọc giữ phòng dùng đúng một ENTRY/payment request cho tiền phòng kỳ đầu + phần cọc còn phải thu. Thu cọc rời qua QR hoặc tiền mặt bị chặn khi đã thuộc ENTRY; khi thanh toán đủ, invoice/payment/allocation và CASH_IN cọc commit cùng transaction. Bảng Hóa đơn chiếu thành hai dòng liên kết (tiền phòng/cọc hợp đồng), cùng một STT và không cộng trùng KPI/cashflow. Focused API 205/205, web 13/13, API/Web typecheck và diff check PASS. Chưa thay thế provider/staging UAT và finance milestone review.
  - `LOCAL EVIDENCE` 26/09/2026: isolated stack đã chạy `CORE-10.04` với RUN_ID `core1004-20260926-2020`, database `homeland_e2e_test`, migration `24/24` và release source SHA `7bed941e12c65d9bfd586919bfe8d89b84cecda2`: 31/31 Playwright PASS, 0 failed, 0 skipped; lưu 31 trace, 32 screenshot, snapshot trạng thái DB và không có `error-context.md`. Các case gồm lifecycle hợp đồng/hóa đơn, SePay signed replay/idempotency, duplicate provider transaction `NEEDS_REVIEW`, refund/settlement, monthly snapshot, report và shared-room tenant isolation. Đây chỉ là evidence kỹ thuật local; `CORE-10.04` vẫn mở cho đến khi staging chạy SHA bất biến với DB cô lập, persona/fixture masked, cleanup record và 11 ảnh vận hành. Chi tiết: `docs/evidence/P17_CORE1004_LOCAL_RUN_20260926.md`.
  - Thay đổi nghiệp vụ UI ngày 19/09/2026: popup đầu tiên sau nút Thêm khách thuê là “Cọc giữ phòng / Thuê ở ngay”; chỉ sau khi chọn intent mới mở “Khách có sẵn / Khách mới”. Sau khi lưu hồ sơ khách, hệ thống tự sinh đúng một nhánh: cọc giữ phòng tạo hợp đồng cọc DRAFT + deposit/RoomHold + invoice + PaymentRequest QR; thuê ở ngay tạo contract DRAFT + invoice đầu kỳ + PaymentRequest QR và gửi Zalo nếu khách đã đăng ký, chờ thanh toán/activation theo lifecycle. Không tạo hóa đơn/cọc/hoàn cọc từ popup Hóa đơn; tab Hóa đơn chỉ hiển thị danh sách/chi tiết/QR. Đã sửa lỗi phòng hiển thị “Trống” dù tab Tài chính có RentalCycle/hợp đồng: Room API trả hợp đồng DRAFT/PENDING/APPROVED cho hồ sơ phòng, UI hiển thị khách và trạng thái đặt cọc/chờ HĐ nhưng không tính là đang ở trước activation. Web focused 122/122, API focused PASS, Web/API typecheck PASS.
- [ ] `CORE-10.05` Dual-read/reconciliation và feature flag theo tenant/tòa nhà trước khi đổi source of truth.
- [ ] `CORE-10.06` Staging UAT OPS/FIN/OWNER ký duyệt; không còn P0/P1 cốt lõi.
- [ ] `CORE-10.07` Backup pre-cutover, immutable release, smoke, monitoring, GO/NO-GO và rollback drill.
  - `OWNER REOPEN` 10/10/2026: phát triển và diễn tập Backup/Restore/Rollback trên local Docker Desktop đã được duyệt; sửa B01–B12 với kỳ mặc định là tháng hiện tại GMT+7. NAS Synology/Container Manager là target phát hành, chưa được phép thao tác trong đợt local. Giữ dirty working tree; commit/bump phiên bản chỉ sau khi phạm vi hoàn chỉnh và qua review/test gate. CI/CD phải chặn deploy tự động không được duyệt; evidence local không thay thế production GO.
  - `LOCAL DEPENDENCY CHECKPOINT — FINAL GATE OPEN` 10/10/2026: owner đã duyệt và triển khai local Nodemailer10.0.6, QR0.1.5/0.21.3 và Web ESLint9; CI22/API Docker22/Web Docker20 giữ nguyên. Runtime audit từ high17/critical3 về high0/critical0, còn low1/moderate28 được báo nguyên trạng; dev-inclusive audit còn high16 cần triage cuối. Cài sạch và affected checks trong Docker PASS; riêng test giờ hóa đơn từng fail dưới UTC đã sửa GMT+7 và rerun PASS. Đây không phải release image/full regression sign-off. Chi tiết lock-resolution, một lần writer dùng force đã bị dừng và evidence: `VPS_REPAIR_LOCAL_2026-10-10.md`. Không bump/commit phát hành khi toàn bộ gate chưa đạt.
  - Booking hold frontend đã dùng command canonical + durable intent scoped tenant/user/room/customer, fail-closed khi payload/storage/coordination bất thường, không optimistic `deposited`, invalidate liên quan và không claim QR khi payment request lỗi. Legacy online JSON restore đã khóa fail-closed sau validate snapshot; full PostgreSQL+storage backup/checksum, isolated restore và rollback drill vẫn mở.
  - `LOCAL CONTINUATION — GATE OPEN` 10/10/2026: actual Web20 Docker build/login smoke PASS; backup safety review sau hai finding đã PASS cho isolated drill; bounded script/CI suite59/59 và PostgreSQL16 restore rehearsal76 tables/32 migrations/0 tenants PASS, storage chỉ một fixture synthetic, chưa off-host thật/app rollback. Booking aggregate đã gom contract/cycle/deposit/hold/customer projection vào một transaction; unit20/20 và real PostgreSQL13/13 PASS gồm full/unavailable rollback, khác phòng cùng khách hàng, legacy recovery và cancellation race trước invoice. Migration BOOKING_HOLD đã deploy/status33/33 trên DB repair. Independent booking review PASS; final release regression/E2E và production-like rollback vẫn mở; checkpoint local `0707b9ef`, chưa push/NAS.
  - `B07 PROJECTION FIX` 10/10/2026: customer list now returns room-visible pending contracts without treating them as active occupancy; TenantGrid explicitly selects ACTIVE/EXPIRING for rental-room fields. Customer service145/145, Web typecheck and focused Web88/88 PASS. B08–B12 and final release gates remain open.
  - `B08/B10 LOCAL CHECKPOINT` 11/10/2026: removed mock conversion history/identities/amounts and false 6/6 completion; distinct consistent source/target links and live progress only. Upload never records a signature; booking/rental signatures require explicit valid nonfuture dates. Payment confirmation never implies Zalo delivery or a cash/bank provenance. Independent bounded review PASS after correcting the cash-delivery finding; Node20 Docker focused29/29 (4 exact files), host Web typecheck PASS and affected ESLint0 errors/4 existing warnings. This is not browser/NAS or milestone sign-off; B07 remainder, B11/B12, backup/rollback and release gates remain open.
  - `B11 LOCAL CHECKPOINT` 11/10/2026: compiled PDF now accepts only tenant-resolved internal storage references, denies external/redirect asset URLs and forwards auth only to the internal document endpoint; bounds fetches at20MB/20s. Exactly two distinct CCCD refs and all mandatory static assets are preflighted. Missing/corrupt assets, converter/PDF failures and missing signed attachments return named errors instead of a successful incomplete PDF. Node20 Docker synthetic export/helper18/18 PASS; B12 scan-side recognition and real storage restart/redeploy remain open.
  - `B12 LOCAL IMPLEMENTATION` 11/10/2026: added additive `Customer.idImageProvenance`, tenant-checked approval/revoke endpoints, server-stamped reviewer/time, explicit front/back selection in the contract drawer, and optimistic `updatedAt` writes to prevent concurrent side loss. Legacy `idImages` records remain intentionally blocked until an operator re-approves both sides; rollout steps are in `docs/operations/B12_IDENTITY_IMAGE_ROLLOUT.md`. Focused API/web typechecks and provenance/PDF tests pass; staging/NAS acceptance and restart/redeploy evidence remain open.
  - `B12 STORAGE REHEARSAL` 11/10/2026: added separate original/scan persistence, explicit scan approval preview, PostgreSQL row-lock + atomic audit transaction, and an opt-in integration drill. Node22 Docker isolated DB/storage prepare passed 20/20; after DB restart and recreated API container, persistence/checksum/audit verification passed 3/3. Node20 Web Docker PDF/storage gate passed 21/21. Fresh migration remains blocked by the previously recorded historical enum conflict; no historical migration was changed and no production migration was applied.
  - `B12 ACTIVE PROJECTION + ATOMIC UPLOAD FOLLOW-UP` 11/10/2026: approval replacement and revoke now rebuild legacy `idImages` strictly from the remaining approved provenance, removing stale/unapproved URLs. New upload endpoint persists original, scan, document records, approval and audit atomically; rollback compensates only unpersisted staged files and preserves committed files on ambiguous responses. Host identity/controller/document tests 31/31, Docker Node22 identity/storage/controller 28/28 (one conditional integration skip), compiled-PDF 17/17, API/Web typechecks and `git diff --check` PASS. Staging/NAS acceptance and production-like storage/version rollback remain open.
  - `B12 AUDIT HISTORY FOLLOW-UP` 11/10/2026: replacement/revoke audit events now include the complete prior provenance and active-image projection in `before`; active `idImageProvenance` remains the current approved set while old URL/original/reviewer/time remain recoverable in immutable AuditLog history. Focused replacement/revoke assertions and Docker identity/storage gate remain PASS. No staging/NAS or production-like rollback evidence yet.
  - `LOCAL FINAL REGRESSION` 11/10/2026: full workspace tests PASS (API 955 passed/63 conditional integration skips; Web 161/161; shared/database included), preflight/backup/restore/CI safety 109/109, full lint 0 errors (91 existing Web warnings), API/Web typechecks, source build and `git diff --check` PASS in the initial checkpoint. CI Playwright now sets explicit loopback `E2E_WEB_BASE_URL`/`E2E_API_BASE_URL`; workflow safety 37/37 PASS. API Node22 release image built. Follow-up rerun: workspace tests, preflight109/109 and typecheck PASS; Web Node20 Docker compile/typecheck/static generation PASS but image export fails with containerd `input/output error`; host build fails with `ENOSPC`. Read-only disk check confirms C: free=0 bytes (D: ~202 GB free). Host uses Node24.15.0/Next16.2.10 while lockfile requires Next16.3.8 and CI uses Node22; host checks are not reproducible release evidence until clean locked dependencies/runtime are verified. Do not prune/reset Docker or delete user data automatically. These blockers plus staging E2E, fresh migration, off-host backup/restore, app rollback and NAS acceptance keep GATE-10 open.
  - `DISK RECOVERY + REAL LOCAL RESTORE` 11/10/2026: owner freed C; clean locked install/Prisma generation and host build/forced workspace regression PASS; Next now matches lockfile16.3.8. Web Node20 image export and real Chromium login/closed-registration/correlation smoke PASS. Node22 UTC reporting fixture corrected (30/30); auth/buildings parallel on initially empty ADMIN fixture PASS12/12. Explicit isolated PostgreSQL money/concurrency suites achieve deduplicated56/56 across ten files after canonical PAID ENTRY fixture repairs and a dedicated outbox database; B12 prepare6/6 plus restart3/3 (phase-only skips intentional). Reviewed BASELINE-V2 bootstrap reaches current34/34 migrations without replaying broken history; the earlier raw P3018 incident remains historical, not an unresolved blocker for this approved bootstrap path. Actual compiled backup service exposed PostgreSQL client18/DB16 restore incompatibility; Docker now installs postgresql16-client. New image built; **new** client16 backup READY, empty-target restore19/19 including migration status, restored Customer/Document/AuditLog equality, approved provenance and all7 file checksums/tenant-owned downloads PASS. Independent Sol High checkpoint review PASS; affected script47/47, current API typecheck and diff check PASS; full locked lint0 errors/100 warnings. Evidence: `docs/evidence/LOCAL_RELEASE_RECOVERY_20261011.md`. Production HTTP smoke not yet PASS (first launch lacked APP_URL/CORS_ORIGINS; corrected container launch denied by tool policy). Authenticated browser E2E, off-host destination/retention, application version rollback, immutable-SHA GitHub CI, staging/NAS/UAT and GATE-10 remain OPEN; no release bump, push or NAS operation.
  - `B07 FOLLOW-UP CHECKPOINT` 11/10/2026: authenticated tenant scopes customer root/status/count and bounded nested contract/occupancy projections; foreign or soft-deleted room/building candidates fail closed. Active rental wins over pending; pending-only customers retain room/building display without active rental fields. APPROVED is pending in both tenant and room status adapters. Independent Sol High re-review PASS; exact Node22 Docker API44/44 and Node20 Docker Web37/37 (three files each), both typechecks PASS. This checkpoint does not close CORE-10.07/GATE-10; B12 persisted scan provenance, full backup UI/runtime and storage/version rollback remain open.
  - `BACKUP RUNTIME CHECKPOINT` 11/10/2026: web manual/scheduled backup now invokes the full PostgreSQL/local-storage runner and real restore precheck instead of seven-table JSON/fabricated READY. Explicit local-provider opt-in, matched storage cwd, nonoverlapping nonsymlink roots, system-admin metadata access and atomic latest index are enforced; failed pre-wipe backup is not swallowed, online restore remains disabled. Independent Sol High re-review PASS; exact Node22 Docker API40/40 + five script suites45/45 and Node20 Web1/1, both typechecks PASS (fixtures/mocks only, no DB/network). Actual API-to-runner storage/DB rehearsal, persistent volume/restart, monitoring manifest-path alignment, full storage restore and version rollback remain open. No version bump, push, NAS/production operation or milestone closure.
  - `REGRESSION/MONITORING CHECKPOINT` 11/10/2026: repaired all eight previously exposed API failures without weakening production money/security guards. Three payment templates now have explicit preview-only receipt samples; payment-promise clocks are deterministic; login has a realistic settings mock; contract fixtures require a scoped paid ENTRY and test occupancy-write rollback plus missing/unpaid/underfunded/foreign ENTRY rejection. Backup monitoring now follows the producer root from API cwd, supports explicit overrides and clears stale success/age on malformed or future evidence. Independent Sol High review PASS after correcting the future-age finding; Node22.23.3 Docker deduplicated137/137 across7 exact files and API typecheck PASS (initial136/137, affected communication-only rerun16/16). Network none/no mounts/no DB; container retained/stopped. B12 persisted scan provenance, real API-to-runner backup/storage/version rollback, security/CI/regression/E2E and CORE-10.07/GATE-10 remain open; no release bump, push or NAS operation.
  - `LOCAL EVIDENCE` 26/09/2026: guardrail suite cho preflight/backup/restore/rollback PASS 82/82. Rehearsal PostgreSQL cô lập tạo dump có checksum từ database test và restore sang target test được xác nhận tên; `pg_restore --list`, restore và Prisma migration status PASS 10/10. Windows launcher đã chạy Prisma entrypoint trực tiếp, không dùng shell. Storage bị skip, không có off-host copy, rollback/alert/on-call production-like chưa diễn tập.
  - Quyết định lịch sử 26/09/2026: P19/`CORE-10.07` từng được `DEFERRED (OWNER)`. Quyết định 10/10/2026 ở trên mở lại phần phát triển local; evidence cũ vẫn không được dùng làm production evidence hoặc nâng trạng thái release. P20 tiếp tục `LIVE NO-GO`.
  - `HTTP/CI CONTINUATION — RUNTIME BLOCKED` 11/10/2026: fixed real scheduler opt-out bug (cron disabled but interval/timeouts remained enabled); independent review PASS, Node22 Nest registry7/7 and API typecheck PASS; commit `e5ab9360`. E2E target routing no longer forces3000/3001; commit `5b398c38`, bounded discovery10/6 PASS. Clean Git archive full SHA `5b398c380c191a8ebf356ca1ec9b15dcaaeb883c` builds/exports API22 and Web20 images PASS with immutable source metadata, not final release HEAD. Dedicated synthetic browser DB has34/34 history; new API HTTP container creation was rejected by tool policy, target does not exist and no alternate launch attempted. CI acceptance missing four DB isolation variables fixed, scheduled/background delivery disabled, closed-registration smoke added; independent review PASS, post-review workflow safety19/19 and discovery acceptance38/8 + smoke22/8 PASS (not runtime tests). Owner proposed staging `homeland.ductinh.one` via Container Manager/Cloudflare Tunnel; current domain binding unverified. Evidence: `docs/evidence/LOCAL_RELEASE_HTTP_CI_20261011.md`. Real runtime E2E, HTTP backup/UI, automated storage restore, image rollback, off-host/security/GitHub CI/NAS/UAT/historical reconciliation remain OPEN; no push, release bump or remote operation, GATE-10/LIVE NO-GO unchanged.
  - `REAL RUNTIME CONTINUATION` 12/10/2026: isolated immutable-source API/Web now healthy at loopback43194/43195 with synthetic browser DB34/34. Six unique registration/Settings/shared-room cases PASS across initial5/6 and affected1/1; theme6/6, real backup UI1/1, compiled offline restore12/12 (empty storage) and13/13 (synthetic PDF) PASS; exit-checked full-row financial/document equality verified at snapshot time. Preflight envelope correction focused5/5 and independent review PASS, but real staging diagnostics403 remains because API lacks staging flag; environment replacement denied by tool policy, no workaround. Initial CI smoke9/20 PASS. Lifecycle root-cause run with exact disposable credential now passes2/2 (contract and invoice); earlier 401 artifacts were caused by an incorrectly supplied short password, not runtime invalidity. Screenshot reveals real negative-profit Dashboard chart overflow; bounded signed-axis correction focused Node20 tests6/6, nonincremental Web TypeScript and Sol High review PASS; new-image UI pending. Running images are source5b398c38, not final release HEAD. Complete serving-app storage restore, persistent/off-host backups, image rollback, security/remote CI, NAS/UAT/historical reconciliation and GATE-10 remain OPEN. Evidence: `docs/evidence/LOCAL_RELEASE_RUNTIME_20261012.md`; no push, release bump or NAS change.
  - `SMOKE DRIFT FOLLOW-UP` 12/10/2026: current local authenticated smoke selectors were aligned for finance, invoices, buildings, contracts and tenants. Full local Desktop1366 smoke run passes20/20 with exact synthetic credentials and the rebuilt Node20 Web image from the current working tree; snapshots were intentionally ignored for this functional check and no baselines were overwritten. Accessibility markup fixes remove the prior invoice select-name, nested-interactive contract card and duplicate main landmark findings in the tested pages. Full CI smoke, visual baseline review, staging/NAS/UAT, backup durability and rollback remain OPEN; no push or NAS change.
  - `STAGING GATE HARDENING` 12/10/2026: staging diagnostics now fail closed unless the API reports `environment=staging`, exact current checked-in migration count, approved schema fingerprint, expected immutable commit and target DB identity. Preflight requires owner-approved exact HTTPS origins, rejects path/userinfo/query/fragment/unapproved ports and redirects, and never sends the internal token before these guards pass. Local staging-mode API diagnostics returned HTTP200 with synthetic DB and 34/34 migrations; authenticated HTTPS preflight remains pending on an approved public TLS staging endpoint. Guard/preflight/workflow tests33/33 and production preflight/backup/restore/rollback safety112/112 PASS. Current-working-tree Node20 Web image full smoke20/20 PASS; registry compose parses. No NAS, production or remote GitHub write.
  - `STAGING DOMAIN CHECK` 12/10/2026: read-only `https://homeland.ductinh.one/api/v1/health` returns Cloudflare HTTP530/error1033, so the Cloudflare Tunnel/origin is unavailable or not bound to the isolated staging stack. No token, write, Container Manager action or NAS access was attempted. Remote HTTPS preflight and staging UAT remain blocked until the owner confirms the tunnel route and staging origin health.
- `STAGING RUNTIME CONTINUATION` 12/10/2026: immutable runtime08de2dca now has real HTTPS persona5/5, contract/invoice2/2, signed SePay1/1 and backup UI1/1 evidence; previous Quick Tunnel is stopped, not a working handoff. Initial CORE-10.04 run26/32 exposed fixture drift plus missing guarded cleaning action; refund/report/finance fixes pass focused reruns, but canonical full journey and visual baseline remain open. Actual UI backup restored into a confirmed empty isolated DB13/13, history34/34, storage checksum/owned download/login/readiness and current-image restored Web smoke1/1 PASS. Old-image rollback and forward preserve19 finance/lifecycle table digests, but old Web keyboard smoke remains open; do not close STG-05. Additional desktop audit initially20/24; affected invoice credit1/1 and unchanged-limiter paced route audits3/3 PASS, covering24 distinct cases across initial/affected runs, not a full batch rerun. Safety scripts52/52, host Web typecheck/encoding and diff check PASS. Owner chose second NAS/server for off-host backup; endpoint/path/protocol/secure credentials still needed. Independent reviews were unavailable due model capacity. CORE-10/GATE-10/LIVE remain NO-GO; no NAS/production/provider mutation, version bump or push. Evidence: `docs/evidence/STAGING_RUNTIME_CONTINUATION_20261012.md`.

- [ ] `CORE-10.08` Hypercare đối soát tiền/điện/phòng trong 24 giờ, 7 ngày và đóng Big Update.

### Phase tiếp theo — chưa nằm trên critical path Big Update

- [ ] `NEXT-01` Xác minh email, token family/reuse detection, IP lock phân tán và chính sách mật khẩu nâng cao.
- [ ] `NEXT-02` Thay luồng backup/restore JSON UI, storage S3/R2 runtime và retention/off-site nâng cao.
- [ ] `NEXT-03` Tài liệu/phiên bản/chữ ký số và tenant ownership của file đầy đủ.
- [ ] `NEXT-04` Expense/reimbursement/chia lợi nhuận/P&L/dashboard và export nâng cao.
- [ ] `NEXT-05` Zalo/notification nâng cao, CRM, AI/automation, accessibility và tối ưu hạ tầng nhiều instance.

## 2. Baseline đã hoàn thành

| ID | Trạng thái | Kết quả |
|---|---|---|
| `DONE-01` | [x] | API typecheck/unit PASS `195/195`; Web typecheck/unit PASS `49/49` |
| `DONE-02` | [x] | Production bundle, health và readiness local PASS |
| `DONE-03` | [x] | Desktop Playwright PASS `47/47` |
| `DONE-04` | [x] | Chromium mobile `430/390/375` PASS `18/18`, tổng 168 lượt render light/dark |
| `DONE-05` | [x] | Persona/RBAC PASS cho `admin`, `adminA`, `adminB`, `manager` trên release-gate DB |
| `DONE-06` | [x] | Happy path vòng đời cũ từng PASS; **không phải** acceptance cho Big Update vì audit 07–08/09 đã phát hiện lỗi tiền, tenant, snapshot và trạng thái |
| `DONE-07` | [x] | Safety/preflight tests PASS `21/21` sau khi liên kết central go-live TODO |
| `DONE-08` | [x] | Runbook baseline database rỗng và 7 checksum migration đã review |
| `DONE-09` | [x] | SBOM workflow, Gitleaks guard và runtime audit policy đã có trong CI |
| `DONE-10` | [x] | Các mốc `d6e392c`, `04f7cdd`, `e3633b1` đã push lên `origin/main` |

Các kết quả trên chứng minh release candidate local. Chúng không thay thế staging, credential thật, giao dịch thật, backup/restore và phê duyệt GO.

### Tổng quan phần còn lại

Không xem toàn bộ dòng chưa hoàn thành là lỗi code. Baseline local đã hoàn tất 10 mốc; phần còn lại chủ yếu là cấp hạ tầng/credential, nghiệm thu với dữ liệu thật, diễn tập vận hành và ký duyệt. Trạng thái chỉ được cập nhật khi có evidence tương ứng.

| Workstream | P0 còn mở | Đang BLOCKED | Kết luận hiện tại |
|---|---:|---:|---|
| Governance/phạm vi phát hành | 5 | 0 | Chưa gán người thật và lịch go-live |
| Security/runtime/supply chain | 6 | 2 | Chờ GitHub và triage audit; `SEC-02` nâng phiên bản được `DEFERRED (OWNER)` |
| Hạ tầng production/staging | 14 | 0 | Chưa có production topology và staging immutable |
| Dữ liệu/backup/restore | 9 | 0 | Chưa có inventory, off-host backup và restore drill |
| SePay/hai ngân hàng | 7 | 0 | Chưa nghiệm thu giao dịch thật và đối soát hai owner |
| Hunonic/điện/giá điện | 7 | 0 | Chưa nghiệm thu key mới, mapping, sync và giá bằng dữ liệu thật |
| Zalo/Telegram/SMTP | 5 | 0 | Chưa nghiệm thu gửi, retry và escalation trên môi trường thật |
| UAT nghiệp vụ/kế toán/persona/thiết bị | 10 | 0 | Chưa ký staging acceptance và chưa test thiết bị thật |
| Account/bàn giao/audit | 5 | 0 | Chưa cấp credential production riêng cho từng người |
| Monitoring/incident readiness | 6 | 0 | Chưa có dashboard, on-call và diễn tập cảnh báo |
| Cutover/mở traffic | 10 | 0 | Chỉ thực hiện sau khi mọi P0 phía trên PASS |
| **Tổng P0** | **84** | **2 blocked + 1 deferred** | **87 mục chưa hoàn thành; LIVE NO-GO** |

Sau LIVE còn 10 mục P1 hypercare từ T+1 giờ đến T+30 ngày/định kỳ. Những mục này không thay thế bất kỳ P0 nào trước khi mở traffic.

## 3. Critical path bắt buộc

Thực hiện theo thứ tự. Một phase không được coi là đạt nếu dependency ở phase trước chưa hoàn thành.

1. Governance và security/runtime.
2. Hạ tầng production và staging.
3. Dữ liệu ban đầu, backup và restore drill.
4. Nghiệm thu SePay, Hunonic và notification.
5. UAT nghiệp vụ/kế toán/persona trên staging.
6. Cutover, smoke production và quyết định GO/NO-GO.
7. Hypercare 24 giờ và ổn định 7 ngày.

## 4. P0 - Governance và phạm vi phát hành

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `GOV-01` | [ ] | TL, OWNER-A, OWNER-B | Không | Chỉ định release owner, security owner, DBA, integration owner, người GO/NO-GO và người rollback | Biên bản có tên, số liên hệ, vai trò chính/dự phòng; mọi vai trò đã xác nhận nhận việc |
| `GOV-02` | [ ] | TL, OPS | `GOV-01` | Chọn ngày/giờ go-live, change-freeze, thời lượng maintenance và cửa sổ rollback | Lịch phát hành đã được hai owner và vận hành chấp thuận; có múi giờ và deadline quyết định NO-GO |
| `GOV-03` | [ ] | TL | Security + staging PASS | Chốt release SHA/version/image tag immutable sau cùng | SHA trên Git bằng SHA build-info; API/Web image digest được ghi vào release record |
| `GOV-04` | [ ] | TL | `GOV-03` | Mở evidence package ngoài Git cho release | Có thư mục/record chứa CI, security, backup, staging, UAT, integration, GO/NO-GO; không chứa secret/PII |
| `GOV-05` | [ ] | TL, FIN, OPS | Toàn bộ P0 | Tổ chức cuộc họp GO/NO-GO | Checklist P0 100%, rủi ro còn lại được chấp nhận bằng văn bản, có chữ ký TL/FIN/OPS/OWNER-A/OWNER-B |

## 5. P0 - Security, runtime và supply chain

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `SEC-01` | `BLOCKED` | TL, SEC | Quyền GitHub | Mở GitHub Actions mới nhất của HEAD và xác nhận mọi required job | Lưu run ID/URL; lint, typecheck, unit, integration, build API/Web, Gitleaks, SBOM, Trivy và E2E đều PASS; không suy ra xanh từ local |
| `SEC-02` | `DEFERRED (OWNER)` | TL, SEC, DEV | Tạm hoãn nâng phiên bản | Không đổi Node/dependency/platform version trong đợt này | Mở lại theo `SCP-03`: ADR ghi phiên bản được phê duyệt, tương thích Next/Nest/Prisma/Puppeteer/ZXing; Docker/CI dùng cùng major; không tự nâng khi chưa duyệt |
| `SEC-03` | `BLOCKED` | SEC, DEV | `SEC-02` | Triage `17 high`, `23 moderate`, `3 low` từ runtime audit gần nhất | Danh sách direct/transitive, đường khai thác, package owner, bản vá/mitigation và deadline; không bỏ qua high/critical bằng allowlist chung |
| `SEC-04` | [ ] | SEC, DEV | `SEC-03` | Sửa toàn bộ high/critical runtime advisory trên branch riêng | `npm audit --omit=dev` có `0 critical`, `0 high`; full regression PASS; lockfile được review; không đổi framework ngoài phạm vi phê duyệt |
| `SEC-05` | [ ] | SEC, INT | Credential Hunonic mới | Rotate Hunonic mobile signing key đã từng xuất hiện trong lịch sử Git | Key cũ bị revoke tại provider; key mới nằm trong secret manager; login/sync PASS; Gitleaks không phát hiện key mới |
| `SEC-06` | [ ] | SEC, INFRA | Secret manager | Lập inventory và rotate toàn bộ secret production | PostgreSQL, Redis, JWT, SePay, Hunonic, Zalo, Telegram, SMTP có owner, created/expiry/rotation date; không dùng giá trị example/local |
| `SEC-07` | [ ] | SEC, INFRA | `SEC-06` | Cấu hình least privilege và network access cho secret/service account | DB app user không có quyền tạo/drop database; integration token đúng scope; secret chỉ được đọc bởi service cần dùng |
| `SEC-08` | [ ] | SEC | `SEC-01` | Xử lý trạng thái CodeQL/GHAS hoặc scanner thay thế đã phê duyệt | Có kết quả SAST cho đúng SHA; P0/P1 security finding đã đóng hoặc có risk acceptance có thời hạn |
| `SEC-09` | [ ] | SEC, TL | `SEC-04..08` | Chạy security gate cuối | Gitleaks, SBOM validate, license scan, SAST, Trivy FS/image, runtime audit đều có artifact; policy job PASS |

## 6. P0 - Hạ tầng production và staging

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `INF-01` | [ ] | INFRA, TL | `GOV-01` | Chốt topology production/staging, sizing và failure domain | Sơ đồ web/API/PostgreSQL/Redis/storage/reverse proxy; CPU/RAM/disk/IOPS; staging tách credential và database production |
| `INF-02` | [ ] | INFRA | Domain được chọn | Cấu hình DNS và HTTPS cho web/API | Certificate hợp lệ, auto-renew test, TLS policy đạt, HTTP redirect HTTPS, domain hiển thị đúng build |
| `INF-03` | [ ] | DBA, INFRA | `INF-01` | Provision PostgreSQL production có extension `vector` | Database identity ghi nhận; `vector` available; app user least privilege; timezone/encoding đúng; connection limit đủ |
| `INF-04` | [ ] | DBA, INFRA | `INF-01` | Provision Redis production có auth và giới hạn mạng | Redis không public, password/TLS/VPN theo kiến trúc, persistence/eviction policy được duyệt, health PASS |
| `INF-05` | [ ] | INFRA, OPS | `INF-01` | Provision attachment/object storage | Storage root bền vững, không nằm trong container ephemeral; quota/retention/checksum/access policy được kiểm tra |
| `INF-06` | [ ] | INFRA, SEC | `INF-02..05`, `SEC-06` | Tạo production env trong secret manager | `NODE_ENV=production`, registration/Swagger tắt, HTTPS/CORS đúng, scheduler chủ động, không có secret trong repo/compose output |
| `INF-07` | [ ] | INFRA | `INF-06` | Chạy production preflight chỉ đọc | `npm.cmd run preflight:prod -- --env-file <secure-file-outside-git>` trả `Configuration: PASS`; report không in secret |
| `INF-08` | [ ] | INFRA | `INF-01` | Cấu hình firewall/reverse proxy/rate limit/body limit | Chỉ port bắt buộc được mở; webhook route hoạt động; upload hợp lệ; header correlation/proxy IP đúng; không lộ internal port |
| `INF-09` | [ ] | INFRA | `INF-01` | Đồng bộ thời gian và timezone | NTP active; timestamp DB/API/log/SePay/Hunonic cùng chuẩn; kiểm tra lệch thời gian dưới ngưỡng đã duyệt |
| `STG-01` | [ ] | INFRA, TL | `SEC-09`, `INF-01..09` | Build và deploy immutable API/Web images lên staging | Image digest gắn đúng SHA; `/health`, `/health/ready`, `/health/build-info` PASS; không dùng `latest` để nghiệm thu |
| `STG-02` | [ ] | DBA, TL | `STG-01` | Baseline/migrate staging theo runbook | Database identity đúng; baseline chỉ khi DB rỗng; `7/7` migration up to date; SQL/checksum/reviewer lưu trong evidence |
| `STG-03` | [ ] | TL, OPS | `STG-02` | Tạo account/dataset staging riêng, không seed production | Có bốn persona staging và dữ liệu UAT không chứa PII thật; password chuyển qua kênh bảo mật |
| `STG-04` | [ ] | DEV, TL | `STG-03` | Chạy toàn bộ `verify:prod` trên staging/release-gate DB | Encoding, safety, typecheck, unit, health, persona preflight, desktop `47/47`, mobile `18/18` PASS cho đúng SHA |
| `STG-05` | [ ] | INFRA, TL | `STG-04` | Diễn tập rollback application trên staging | Rollback về immutable tag trước không sửa schema dữ liệu; health/smoke PASS; thời gian rollback và owner được ghi nhận |

## 7. P0 - Dữ liệu, backup và restore

> `SCP-03` cập nhật 10/10/2026: owner đã mở lại phát triển/diễn tập local `BKP-01..04`, `DAT-05` phụ thuộc backup và `STG-05`. Checklist vẫn mở; không dùng local drill làm production evidence, không tác động NAS/production hoặc mở traffic khi chưa đạt gate và có duyệt cutover riêng.

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `DAT-01` | [ ] | OPS, FIN, DBA | Staging sẵn sàng | Lập inventory dữ liệu mở đầu | Chốt owner/building/room/customer/contract/deposit/invoice/expense/meter/bank cần đưa vào production; có tổng số kỳ vọng |
| `DAT-02` | [ ] | OWNER-A, OWNER-B, OPS | `DAT-01` | Xác nhận owner-building mapping | Tính: LK01-31/LK08-25; Thể: LK01-32/LK08-24 hoặc giá trị Settings mới; hai owner ký xác nhận |
| `DAT-03` | [ ] | FIN, OWNER-A, OWNER-B | `DAT-01` | Chốt số dư đầu kỳ và công nợ | Tiền cọc đang giữ, hóa đơn chưa thu, khoản hoàn chờ, chi phí ứng hộ, tiền cần khấu trừ lợi nhuận có chứng từ và tổng kiểm soát |
| `DAT-04` | [ ] | FIN, DBA | `DAT-03` | Đối chiếu dữ liệu nguồn và dữ liệu nạp | Tổng cọc/công nợ/thu/chi theo owner và bank khớp; bản ghi trùng/thiếu được xử lý bằng script review, không sửa tay không log |
| `BKP-01` | [ ] | DBA, INFRA | Storage off-host | Chọn off-host backup destination và retention | Có encryption, immutable/version policy, quyền restore tách biệt, retention tối thiểu theo BACKUP.md |
| `BKP-02` | [ ] | DBA | `BKP-01`, staging | Tạo PostgreSQL dump và attachment manifest | Dump custom format theo timestamp; `pg_restore --list` PASS; SHA-256 và object manifest được lưu; không ghi đè backup trước |
| `BKP-03` | [ ] | DBA, TL | `BKP-02` | Restore drill trên môi trường cô lập | Restore PASS, migration status/health/smoke PASS, record count và tài chính đối chiếu đúng, RPO/RTO đo được |
| `BKP-04` | [ ] | DBA, OPS | `BKP-03` | Chốt backup schedule và owner kiểm tra | Lịch tự động, cảnh báo backup stale/fail, người kiểm tra hằng ngày/tuần và thủ tục restore được ký nhận |
| `DAT-05` | [ ] | DBA, FIN, OPS | `DAT-04`, `BKP-03` | Dry-run cutover dữ liệu trên staging | Thời lượng nằm trong maintenance window; report before/after khớp; có rollback/forward-fix plan; không dùng reset/force |

## 8. P0 - Nghiệm thu SePay và hai tài khoản ngân hàng

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `SEP-01` | [ ] | INT, SEC, OWNER-A, OWNER-B | `SEC-06`, staging | Cấu hình hai bank account và SePay credential | Mỗi bank active có owner đúng, account label/mã nhận diện đúng, secret ngoài Git, admin vận hành không sửa token |
| `SEP-02` | [ ] | INT, INFRA | `SEP-01`, HTTPS staging | Cấu hình webhook và signature validation | HTTPS endpoint nhận đúng, reject signature sai, log correlation ID, retry không tạo giao dịch trùng |
| `SEP-03` | [ ] | FIN, INT | `SEP-02` | Test giao dịch giá trị nhỏ cho OWNER-A | QR/payment code đúng bank A; webhook match đúng invoice/deposit; cash/accounting/audit cập nhật một lần |
| `SEP-04` | [ ] | FIN, INT | `SEP-02` | Test giao dịch giá trị nhỏ cho OWNER-B | QR/payment code đúng bank B; webhook match đúng invoice/deposit; cash/accounting/audit cập nhật một lần |
| `SEP-05` | [ ] | FIN, INT | `SEP-03..04` | Test thiếu, thừa, sai bank, sai nội dung, outgoing và gán tay | Mỗi tình huống vào đúng hàng chờ/trạng thái; action availability đúng; không tự ghi nhận doanh thu sai owner |
| `SEP-06` | [ ] | FIN, INT | `SEP-05` | Test hoàn tiền thừa/chờ hoàn/hoàn tất | Refund amount/note/audit đúng; không tăng cash collected; pending -> completed đúng một lần |
| `SEP-07` | [ ] | FIN, OWNER-A, OWNER-B | `SEP-03..06` | Đối soát website với sao kê hai bank | Tổng thu theo bank/owner/payment code khớp; chênh lệch bằng 0 hoặc có ticket có owner/deadline |

## 9. P0 - Nghiệm thu Hunonic, điện và giá điện

> `SCP-01`: `HUN-01..07` tạm hoãn provider UAT sang owner kiểm chứng thủ công sau. Trong đợt này chỉ được dùng fixture mock có provenance cho software verification; các mục dưới đây không được tick `[x]` hay suy ra billing production đã đạt.

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `HUN-01` | [ ] | INT, SEC | `SEC-05`, staging | Cấu hình access/secret mới và login mobile API | Login/signed request PASS, không in token/cookie, key cũ bị revoke |
| `HUN-02` | [ ] | OPS, INT | `HUN-01`, `DAT-02` | Xác nhận mapping công tơ -> tòa/phòng | Toàn bộ meter LK01-31/LK01-32 map duy nhất; Văn Phòng LK01-32 đúng meter; orphan/duplicate bằng 0 |
| `HUN-03` | [ ] | INT, DBA | `HUN-02` | Chạy manual sync 6 tháng gần nhất | Đủ kỳ, không duplicate theo unique key, số bản ghi/room/month có report, retry idempotent |
| `HUN-04` | [ ] | INT, OPS | `HUN-03` | Chạy scheduler 1 giờ/lần tối thiểu 24 giờ staging | Không overlap job, không duplicate, last-sync/failed-sync hiển thị, lỗi provider retry có backoff/log |
| `HUN-05` | [ ] | DBA, OPS | `HUN-03` | Xác nhận retention/query 3 năm | Filter/search month/year/room/meter nhanh và đúng; backup bao phủ readings; khóa kỳ không bị sync ghi đè |
| `HUN-06` | [ ] | FIN, OPS | `HUN-02..05` | Nghiệm thu giá EVN/tự thiết lập theo một/nhiều công tơ | Mode lưu bền, giá custom không về 0, giá hiển thị toàn cột, invoice/room profile dùng cùng kết quả |
| `HUN-07` | [ ] | FIN, OPS | `HUN-06` | Đối chiếu ít nhất 3 phòng x 3 kỳ bằng tính tay | Chỉ số đầu/cuối, kWh, đơn giá, tiền điện và rounding khớp; có người kiểm và chữ ký |

## 10. P0 - Notification và kênh liên lạc

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `NOT-01` | [ ] | INT, SEC | `SEC-06`, staging | Cấu hình Zalo, Telegram và SMTP production/staging | Credential đúng môi trường, secret ngoài Git, recipient test được duyệt, không gửi PII tới nhóm công khai |
| `NOT-02` | [ ] | OPS, INT | `NOT-01` | Review template và trigger | Cọc, hóa đơn, đến hạn/quá hạn, hợp đồng sắp hết, thanh toán, hoàn tiền có nội dung tiếng Việt đúng và đúng đối tượng |
| `NOT-03` | [ ] | INT | `NOT-02` | Test gửi thành công trên cả ba kênh | Message ID/status/timestamp lưu; link/amount/customer mask đúng; không gửi trùng |
| `NOT-04` | [ ] | INT, OPS | `NOT-03` | Test provider timeout/failure/retry/dead-letter | Retry có giới hạn/backoff; lỗi hiển thị queue; operator có thể xử lý lại; audit không mất |
| `NOT-05` | [ ] | OPS, FIN | `NOT-03..04` | Xác nhận SLA và escalation notification | Có owner cho message fail/quá hạn; quy định không dùng notification thành bằng chứng thanh toán thay SePay/bank |

## 11. P0 - UAT nghiệp vụ, kế toán, persona và thiết bị

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `UAT-01` | [ ] | OPS, FIN | `STG-04`, integrations staging | Chạy luồng chuẩn end-to-end | Chọn phòng -> cọc -> SePay -> hợp đồng -> hóa đơn -> điện/nước -> thanh toán -> chi phí -> quyết toán -> vệ sinh -> trống; không sửa DB tay |
| `UAT-02` | [ ] | OPS, FIN | `UAT-01` | Chạy ngoại lệ cọc | Cọc chưa thu, hoàn toàn phần/một phần, giữ cọc, khấu trừ phí, pending refund/completed refund đúng chứng từ/audit |
| `UAT-03` | [ ] | OPS, FIN | `UAT-01` | Chạy trả phòng sớm và quyết toán | Tiền thuê theo ngày, hỗ trợ/hoàn tiền phòng, điện/nước sớm, công nợ/cọc, CLEANING/MAINTENANCE/AVAILABLE đúng |
| `UAT-04` | [ ] | FIN | `SEP-*`, `HUN-*`, `UAT-01..03` | Nghiệm thu kế toán và chia lợi nhuận | Tổng thu/chi/còn lại, người ứng tiền, owner chịu chi, hoàn ứng/khấu trừ, deposit held/refund/credit khớp sổ kiểm soát |
| `UAT-05` | [ ] | OWNER-A | `UAT-04` | Owner A nghiệm thu dashboard/tòa/bank/lợi nhuận | Chỉ thấy/quản lý đúng phạm vi đã duyệt; số liệu và audit đúng; ký acceptance |
| `UAT-06` | [ ] | OWNER-B | `UAT-04` | Owner B nghiệm thu dashboard/tòa/bank/lợi nhuận | Chỉ thấy/quản lý đúng phạm vi đã duyệt; số liệu và audit đúng; ký acceptance |
| `UAT-07` | [ ] | OPS, TL | `STG-03` | Nghiệm thu RBAC account thật | Admin vận hành không sửa token; owner A/B sửa token; manager không vào Settings; finance đúng quyền |
| `UAT-08` | [ ] | OPS | `STG-04` | UAT thiết bị Android/iOS thật | Chrome Android và Safari iOS: login, theme, Buildings 3D/2.5D, phòng, hợp đồng, chi phí, table/modal/toast không vỡ/overflow |
| `UAT-09` | [ ] | DEV, OPS | WebKit browser được phê duyệt/cài | Chạy Playwright WebKit hoặc BrowserStack/device farm | Public/auth route light/dark PASS; lỗi khác Chromium được đóng; artifact gắn đúng SHA |
| `UAT-10` | [ ] | OPS, FIN, TL | `UAT-01..09` | Ký staging acceptance | Danh sách testcase PASS, issue còn lại không có P0/P1, acceptance có TL/OPS/FIN/OWNER-A/OWNER-B |

## 12. P0 - Account, bàn giao và audit

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `ACC-01` | [ ] | TL, OPS, SEC | Production sẵn sàng | Tạo account production riêng | `admin`, `adminA`, `adminB`, `manager` và `finance`; không dùng chung account; email/role đúng |
| `ACC-02` | [ ] | SEC, OPS | `ACC-01` | Bàn giao mật khẩu tạm qua password manager | Mỗi account mật khẩu riêng, must-change bật, không gửi trong Git/chat/log; người nhận xác nhận |
| `ACC-03` | [ ] | Mỗi user | `ACC-02` | Đổi mật khẩu lần đầu và đăng nhập lại | Must-change tắt sau đổi; refresh token cũ bị thu hồi; audit có đúng user/IP/user-agent |
| `ACC-04` | [ ] | OPS, SEC | `ACC-03` | Test quy trình khóa/thu hồi account | Disable account trả 401/403; refresh token bị revoke; SOP nhân sự nghỉ/đổi vai trò được ghi nhận |
| `ACC-05` | [ ] | OPS, TL | `ACC-03..04` | Review audit log | Login success/fail, tiền, hợp đồng, phòng, owner, Settings/token truy được đúng actor/correlation ID; không chứa secret |

## 13. P0 - Monitoring, cảnh báo và incident readiness

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `OBS-01` | [ ] | INFRA | Production network | Prometheus scrape API metrics | Target UP qua private network; metric HTTP/latency/error có label hợp lệ; endpoint không public |
| `OBS-02` | [ ] | INFRA, SEC | `OBS-01` | Bảo vệ Grafana/Prometheus/Loki/Tempo/Alertmanager | TLS/auth/VPN, password mặc định đã đổi, secret trong secret manager |
| `OBS-03` | [ ] | INFRA, OPS | `OBS-01` | Cấu hình dashboard và alert thiết yếu | API down/5xx/latency, DB/Redis readiness, disk, backup stale, webhook unmatched/duplicate, Hunonic sync fail, notification queue |
| `OBS-04` | [ ] | OPS, INFRA | `OBS-03`, `GOV-01` | Cấu hình người trực và escalation | Primary/backup, kênh critical/warning, SLA acknowledge/resolve và quyền dừng reconciliation/write |
| `OBS-05` | [ ] | INFRA, OPS | `OBS-04` | Test alert fire và resolved | Critical alert tới ít nhất hai người/kênh; resolved tới đúng nơi; timestamp/correlation/evidence đầy đủ |
| `OBS-06` | [ ] | TL, OPS, FIN | `OBS-05` | Diễn tập incident tài chính | Tình huống payment duplicate/sai owner: dừng xử lý, giữ evidence, đối soát, forward-fix, thông báo owner; không sửa DB tay |

## 14. P0 - Cutover và mở LIVE

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `REL-01` | [ ] | TL | Mọi staging/UAT/security P0 PASS | Đóng change-freeze và chốt SHA/tag/digest | Working tree release sạch, CI đúng SHA xanh, release note/known issue/rollback tag có trong evidence |
| `REL-02` | [ ] | DBA, INFRA | `BKP-03`, `REL-01` | Tạo backup ngay trước cutover | Dump/attachment manifest/checksum/off-host upload PASS; backup ID và restore point ghi nhận |
| `REL-03` | [ ] | DBA, TL | `REL-02` | Kiểm tra migration trước deploy | `prisma migrate status`, database identity, disk capacity, maintenance/write policy được xác nhận; không dùng reset/db push |
| `REL-04` | [ ] | INFRA, TL | `REL-03` | Deploy immutable API/Web image | Đúng digest đã staging; env production; migration opt-in một lần nếu cần rồi trả `RUN_DB_MIGRATIONS=false` |
| `REL-05` | [ ] | INFRA, TL | `REL-04` | Chạy technical smoke | Health/readiness/build-info, login, CORS/TLS, route chính, log 5xx, DB/Redis/storage PASS |
| `REL-06` | [ ] | OPS, FIN | `REL-05` | Chạy production persona smoke | Bốn persona login/đổi mật khẩu/quyền đúng; chỉ tạo dữ liệu/giao dịch nhỏ đã phê duyệt |
| `REL-07` | [ ] | FIN, INT | `REL-06` | Chạy một giao dịch nhỏ mỗi owner | SePay bank A/B, invoice/payment/audit/dashboard khớp; không duplicate; hoàn test nếu quy trình yêu cầu |
| `REL-08` | [ ] | OPS, INT | `REL-06` | Chạy Hunonic + notification production smoke | Sync một phạm vi nhỏ không ghi đè kỳ khóa; gửi test Zalo/Telegram/SMTP tới recipient đã duyệt |
| `REL-09` | [ ] | TL, FIN, OPS, OWNER-A, OWNER-B | `REL-01..08`, `GOV-05` | Ký GO và mở traffic | Tất cả P0 `[x]`, dashboard/alerts xanh, backup dùng được; thời điểm GO và người phê duyệt ghi nhận |
| `REL-10` | [ ] | TL, INFRA | Bất kỳ smoke fail | Thực thi NO-GO/rollback | Dừng traffic/write liên quan, rollback image tag, giữ schema/evidence, health PASS; không reset/restore nếu chưa phê duyệt sự cố |

## 15. P1 - Hypercare và vận hành ổn định

| ID | Trạng thái | Owner | Deadline | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `HC-01` | [ ] | OPS, INFRA | T+1h | Theo dõi health/5xx/latency/DB/Redis/disk | Không critical alert chưa xử lý; baseline metric được lưu |
| `HC-02` | [ ] | FIN, INT | Mỗi giờ trong 24h | Kiểm tra SePay unmatched/duplicate/sai bank | Queue trong SLA; mọi chênh lệch có ticket/owner; không có tiền ghi trùng |
| `HC-03` | [ ] | OPS, INT | Mỗi giờ trong 24h | Kiểm tra Hunonic sync và notification queue | Job đúng lịch, không duplicate, failed queue trong SLA |
| `HC-04` | [ ] | DBA | T+24h | Xác nhận backup production đầu tiên | Dump/manifest/checksum/off-host PASS; backup freshness alert xanh |
| `HC-05` | [ ] | FIN, OWNER-A, OWNER-B | T+24h | Đối soát tổng thu/chi/còn lại theo owner/bank | Hai owner xác nhận; chênh lệch bằng 0 hoặc có RCA/ticket |
| `HC-06` | [ ] | OPS, TL | T+24h | Review audit/login/permission | Không shared account, không unauthorized Settings/token change, không secret trong log |
| `HC-07` | [ ] | OPS, TL | T+3 ngày | Đào tạo và bàn giao SOP | Sales/manager/finance/owner thực hiện được luồng chuẩn, ngoại lệ, incident và escalation |
| `HC-08` | [ ] | TL, OPS, FIN | T+7 ngày | Kết thúc hypercare | Không P0/P1 mở, SLO đạt, backup/alerts/integrations ổn định, ký biên bản chuyển BAU |
| `HC-09` | [ ] | SEC, TL | T+30 ngày | Review quyền và secret rotation | Account/role còn đúng; token hết hạn được rotate; offboard test PASS |
| `HC-10` | [ ] | DBA, INFRA | Theo quý | Restore drill định kỳ | RPO/RTO đo và đạt; đối chiếu dữ liệu/tài chính PASS; action item có owner |

## 16. Lịch thực hiện khuyến nghị

### T-14 đến T-7

- Hoàn thành `GOV-*`, `SEC-*`, `INF-*`.
- Dựng staging và chạy `STG-01..05`.
- Chốt inventory dữ liệu và mapping owner/bank/meter.

### T-7 đến T-3

- Hoàn thành backup/restore drill và dry-run dữ liệu.
- Nghiệm thu SePay, Hunonic, notification.
- Chạy UAT chuẩn/ngoại lệ/kế toán/thiết bị thật.
- Đóng mọi bug P0/P1 và chạy lại full gate.

### T-2 đến T-1

- Change-freeze, chốt release SHA/digest.
- Chạy CI/security cuối, backup pre-cutover rehearsal.
- Bàn giao credential và xác nhận on-call/rollback.
- Họp GO/NO-GO sơ bộ; còn P0 là NO-GO.

### T0

- Thực hiện `REL-01..08` theo maintenance window.
- Họp GO/NO-GO cuối; chỉ `REL-09` khi toàn bộ P0 `[x]`.
- Nếu có bất kỳ trigger NO-GO, thực hiện `REL-10`, không cố sửa dữ liệu trực tiếp.

### T+1 đến T+7

- Thực hiện `HC-01..08`.
- Chỉ kết thúc hypercare khi kế toán, owner, integration, backup và monitoring ổn định.

## 17. Trigger NO-GO bắt buộc

Không mở hoặc phải dừng LIVE khi có một trong các điều kiện:

- GitHub required job/security gate đỏ hoặc chưa xác nhận đúng SHA.
- Runtime audit còn critical/high chưa được risk acceptance có thời hạn và phê duyệt đúng thẩm quyền.
- Secret production dùng giá trị local/example, key Hunonic cũ chưa revoke hoặc phát hiện secret trong Git/log.
- Staging full gate không PASS, build-info khác release SHA hoặc image không immutable.
- Backup chưa off-host, `pg_restore --list` lỗi hoặc restore drill chưa PASS.
- SePay sai bank/owner, webhook duplicate, giao dịch nhỏ không đối soát được.
- Hunonic duplicate/thiếu dữ liệu, mapping meter sai, kỳ khóa bị ghi đè hoặc giá điện tính sai.
- Dashboard tổng thu/chi/còn lại không khớp kế toán/sao kê/owner.
- Bốn persona/RBAC/must-change/audit chưa PASS bằng credential thật.
- Health/readiness/DB/Redis/storage lỗi, critical alert không tới người trực hoặc không có rollback owner.
- Có bug P0/P1 nghiệp vụ, mất dữ liệu, sai tiền, sai cọc, sai hợp đồng hoặc sai trạng thái phòng chưa đóng.

## 18. Evidence package tối thiểu

| Nhóm | Bằng chứng bắt buộc |
|---|---|
| Release | SHA, version, API/Web image digest, build-info |
| CI/Security | Actions run URL/ID, audit JSON, SBOM checksum, Gitleaks/SAST/Trivy/license result |
| Database | Identity, migration status, baseline/migration review, backup ID/checksum, restore drill |
| Staging | Health, full production gate, desktop/mobile artifacts, rollback drill |
| SePay | Hai bank/owner test, webhook idempotency, exception/refund, reconciliation |
| Hunonic | Credential rotation, meter mapping, 6-month sync, hourly sync, pricing/retention/locked period |
| Notification | Zalo/Telegram/SMTP success/failure/retry logs |
| UAT | Standard/exception/accounting/persona/device test cases và chữ ký |
| Operations | Monitoring dashboard, fire/resolved alert, on-call/escalation, incident drill |
| Go-live | Pre-cutover backup, smoke, GO/NO-GO record, hypercare 24h/7d |

## 19. Việc cần làm ngay tiếp theo

1. Gán người thật cho `GOV-01` và chốt quyền truy cập GitHub Actions.
2. Giữ nguyên Node/runtime của Docker/NAS. Ngoại lệ owner duyệt 10/10/2026: CI chuyển Node20→22; API Docker22/Web Docker20 không đổi. Owner sau đó duyệt vá thư viện bảo mật/QR tối thiểu trên local; mọi thay đổi major cần xin duyệt riêng, không tự nâng framework/platform. Cần kiểm chứng riêng ảnh Web20 ở release gate, không coi CI22 là bằng chứng đồng nhất runtime.
3. Mở run CI mới nhất và lấy artifact audit để thực hiện `SEC-01`, `SEC-03`.
4. Không chạy Hunonic provider UAT trong đợt này theo `SCP-01`; duy trì fixture mock có provenance.
5. Chọn hạ tầng/domain/secret manager, thực hiện `INF-01..09`.
6. Deploy staging immutable, baseline DB và chạy full gate `STG-01..05`.
7. Backup/restore/rollback đã mở lại cho phát triển và diễn tập local theo `SCP-03` ngày 10/10/2026. SePay/notification/UAT production cần duyệt và môi trường riêng; Hunonic provider thật vẫn deferred theo `SCP-01`.

- `BACKUP DESTINATION CLARIFICATION` 12/10/2026: owner superseded the second-NAS/server choice with **existing NAS only** and authorized creating a backup folder. Empty `/docker/homeland-backups` created and verified through DSM File Station; screenshot `testing/staging-20261012/nas-backup-folder/created.jpg`. No backup upload, container/mount/tunnel/database or permission change. Same-NAS RAID storage is not an off-host copy; `BKP-01` remains OPEN, separate restore rights/encryption/snapshots/retention are not verified. This is not a production GO or a gate waiver.

## 20. B03 invoice payment presentation checkpoint — 11/10/2026 (local only)

- B03 bounded fix PASS: invoice/group/child rows, billing drawer, payment bundle, printable invoice, HTML PDF export và Operations KPI dùng số tiền authoritative thay vì lifecycle `PAID` đơn độc. `PAID` còn dư nợ không còn hiển thị/đếm là đã thu đủ; credit/mixed settlement hiển thị riêng; dữ liệu pending/invalid/terminal có nhãn trung tính.
- `RECONCILIATION_PENDING` kể cả khi không có pending amount được giữ là `Cần đối soát`, `canCollect=false`; Drawer/Bundle khóa thu thêm và đóng/không mở direct-scan overlay để tránh duplicate transfer.
- Node20 Web Docker focused gate: **34/34** tests PASS (invoice financials, grouping, deposit financials, CORE-07/08 billing snapshot); Web `tsc --noEmit` PASS. Independent B03 review PASS; `git diff --check` PASS.
- Phạm vi chỉ là presentation/guard UI và tests; không sửa backend payment/ledger, migration, dữ liệu hay NAS. B03 không thay thế release regression, staging/UAT, backup/storage restore hoặc các blocker B07/B11/B12.

## 21. B04 payment/deposit consistency checkpoint — 11/10/2026 (local only)

- B04 bounded local hardening PASS: payment settlement và linked-booking-deposit reconciliation không còn tin `status=PAID` đơn độc; phải có `total > 0` và `paidAmount + creditAmount >= total`. Regression `PAID`, total 2 triệu, paid/credit 0 không được gọi collect hoặc tạo DepositLedgerEntry. Không tạo khoản thu để sửa nhãn và không thu cọc rời lần hai cho ENTRY.
- Thu cọc thành công làm mới invoices, rental-cycle-finance-summary và room-finance-summary cùng deposit/finance cache. Invalidation được đặt đúng ở collect, không phải update. Existing Header PAYMENT_RECEIVED notification path đã có các finance-summary key; không đổi realtime architecture.
- Independent Sol High review ban đầu phát hiện sai vị trí invalidation; đã sửa, bổ sung hook regression và re-review PASS. Exact Docker focused gates: API Node22 **71/71** across payments/deposit-core; Web Node20 **20/20** across cross-tab invalidation/deposit invariants. API/Web TypeScript PASS và `git diff --check` PASS. Các container `homeland-b04-api22-gate-20261011b`, `homeland-b04-api22-tsc-20261011`, `homeland-b04-web20-gate-20261011`, `homeland-b04-web20-tsc-20261011` giữ lại/stopped, network none/no host mounts; không DB/provider thật. Không coi image nguồn ngoài phạm vi đã copy là full release evidence.
- B04 incident trên NAS vẫn OPEN FOR RECONCILIATION: chưa có timeline/provider/allocation/ledger và linkage của khoản 2 triệu trong ảnh. Local hardening không chứng minh dữ liệu lịch sử đã đúng; cần đối soát read-only trên môi trường được owner cho phép, rồi trình repair riêng nếu cần. Không migration, sửa dữ liệu, thu tiền thật, truy cập NAS, push hoặc nâng application version. CORE-10/staging/full release vẫn NO-GO.

## 22. B02 monthly close/send checkpoint — 11/10/2026 (local only)

- Lịch nghiệp vụ được tách thành hai pha theo GMT+7: lúc 23:59:59 ngày cuối tháng, hệ thống khóa kỳ sử dụng và tạo/chốt hóa đơn của kỳ tháng kế tiếp với `autoSend=false`; lúc 08:00 ngày 01, hệ thống chỉ gửi thông báo thu tiền cho hóa đơn đã chốt.
- Job ngày 01 dùng `sendNotifications` và vẫn có fallback `closeMonth` idempotent nếu job cuối tháng bị gián đoạn; không gửi sớm trong job chốt và không tạo hóa đơn mới nếu run đã `COMPLETED`.
- Docker Node22 gates: scheduler **4/4 PASS**, payment + scheduler **44/44 PASS**, monthly-settlement service **40/40 PASS** (**84/84** tổng); API TypeScript PASS; `git diff --check` PASS. Test bao phủ runtime worker, biên 23:59:59 GMT+7, kỳ `2026-09` → billing `2026-10`, không gửi sớm, gửi đúng ngày 01 và không gửi trùng notification đã có `zaloSentAt`/đang in-flight.
- Phạm vi chỉ local scheduler/test; chưa gửi Zalo/email thật, chưa gọi Hunonic/SePay thật, chưa truy cập NAS và chưa kiểm tra dữ liệu lịch sử. Kênh hiện hữu là Zalo payment notification; email/SMS chỉ được mở nếu cấu hình/provider riêng được owner duyệt. B02 chưa thay thế release regression, UAT, staging hay sign-off tài chính; LIVE NO-GO giữ nguyên.

## 23. Guarded room turnover checkpoint — 12/10/2026 (local only)

- Bàn giao phòng từ `CLEANING`/`MAINTENANCE` sang `AVAILABLE` đã chuyển sang
  command tenant-scoped có khóa dòng Room, transaction serializable, retry
  serialization/deadlock và audit Room nguyên tử. Occupancy mở, contract còn
  hiệu lực/hiển thị, RoomHold ACTIVE hoặc Customer còn gắn phòng đều bị từ
  chối fail-closed; không có partial write.
- Web dùng nút `btn-room-ready` không optimistic, chỉ cập nhật/invalidate sau
  API thành công. API unit/turnover **23/23**, Web mutation **2/2**, focused
  cleaning E2E **2/2**, PostgreSQL16 turnover-vs-booking **9/9**. Independent Sol
  High review: `PASS_WITH_FINDINGS` (chỉ còn finding chất lượng harness và chưa
  có activation-race evidence).
- Canonical local mocked journey đã PASS; staging/provider journey, visual/mobile/
  WebKit, backup off-host, NAS Homeland stack/tunnel binding, remote CI trên
  exact SHA và GATE-10 vẫn OPEN; không deploy NAS, push/tag hoặc mở LIVE từ
  checkpoint này.

- Bổ sung rerun Desktop1366 trên Web Node20 Docker hiện tại: **3/3 PASS** cho
  cleaning success, cleaning rejection và toàn bộ journey cọc → ENTRY invoice →
  duyệt → thanh toán → nhận phòng → quyết toán → AVAILABLE. Đây là evidence
  local với business API mock, không thay thế staging/provider/UAT; activation
  race, visual/mobile/WebKit, backup off-host, NAS binding, exact-SHA CI và
  GATE-10 vẫn mở.

## 24. CI exact-SHA release checkpoint — 16/10/2026

- GitHub Actions run **444** trên SHA `ea9edb3520323dbbc379bb1a4d8ec3a86187a7e4`
  đã hoàn tất **SUCCESS**: Lint, Type Check, Unit, Integration, Build Web,
  Build API, E2E smoke/regression/acceptance và Security & Supply Chain đều
  PASS. Security job đã thực sự chạy Gitleaks, CodeQL initialize/analysis,
  npm audit, license scan, SBOM, Trivy filesystem/image và runtime dependency
  policy; không có bước security bị skip.
- Các job publish/deploy/staging/production và rollback của workflow vẫn
  **SKIPPED** theo chủ ý vì các gate staging/UAT/backup/owner approval chưa
  đóng. Đây là CI evidence trên exact SHA, không phải GO-LIVE approval.
- Run URL: `https://github.com/tcandt/homeland-saas/actions/runs/38854184813`.
