# NAS v4 HTTPS route and browser smoke — 17/10/2026

Status: bounded staging smoke PASS; CORE-10.04/.06/.07 and GATE-10 remain OPEN.

## Authorized route change

- Owner approved switching only `homeland.ductinh.one` to the isolated v4 staging origin.
- In Cloudflare tunnel `homeland-nas-staging`, the sole published application was changed from `http://127.0.0.1:3001` to `http://127.0.0.1:3002`. Cloudflare displayed `Route updated successfully`; the route table then showed port3002. The tunnel ID and hostname were preserved.
- Recovery route is the previous `http://127.0.0.1:3001`; the old application/DB volumes were not modified by this change. That older staging schema remains unsuitable for current-release admission.
- Container Manager showed v4 API and Web Healthy, using `homeland-api:e1decc81` and `homeland-web:e1decc81`. Web port3000 maps to NAS port3002; Web runtime is Node20.20.2.
- Public `GET /api/v1/health/ready` returned HTTP200/READY at `2026-10-17T03:55:31Z`, database UP and schema UP. Public login/footer identifies `3.1.1-rc.e1decc81`.

## Interactive browser observations

- ADMIN login reached the dashboard. Finance defaulted to `10/2026 → 10/2026`; Reports defaulted to `2026-10`, matching the current GMT+7 month.
- The following nine routes rendered their expected main headings after navigation: summary, buildings, tenants, contracts, deposits, invoices, expenses, transactions and activities. This verifies page rendering, not every record/mutation or complete data loading on each screen.
- Settings integrations displayed the SePay configuration panel and unconfigured/disabled provider states. The notification menu opened with an empty notification state. No provider delivery or configuration save was performed.
- ADMIN logout returned to login. MANAGER login reached the dashboard; Settings was absent from navigation and direct `/settings` access displayed `Không có quyền truy cập cài đặt` / `setting.read` required. MANAGER logout returned to login.
- FINANCE login reached the dashboard; Settings was absent from navigation and Reports displayed period `2026-10`.
- Captured browser error logs were empty at the observed checkpoints. This is not a complete network-status trace or proof that all prior 401/400/500 incidents are resolved under every scenario.

## Remaining gate work

- v4 financial dataset remains empty; a nonzero booking/deposit/contract/invoice/payment/settlement journey and its recovery drill have not been run by this smoke.
- OWNER personas, complete RBAC, physical-device/WebKit checks, provider acceptance, off-host backup, operational monitoring and owner GO sign-off remain open.
- The CORE-10.04 runner requires a guarded fixture namespace, database access and OWNER-A/B accounts; it was not launched against the default seed dataset.
- CI run38856526235 passed SHA213ea229; deployed application images still identify e1decc81. Do not relabel these images or claim deployed-image exact-SHA SAST coverage from the later CI source alone.

Production remains NO-GO.
