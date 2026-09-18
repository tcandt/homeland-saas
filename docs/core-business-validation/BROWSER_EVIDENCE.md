# Browser Evidence

No business scenario has been marked PASS yet. Browser baseline was opened at `1366×720`; login page rendered. Legacy account was disabled; the configured `admin@homeland.vn` account is ACTIVE in the local database. No secret is recorded here.

## 2026-09-13 local run

- `CBV-P0-002`: authenticated dashboard rendered at 1366×720 with KPIs, buildings and recent activity.
- `CBV-P1-002`: `/deposits` rendered 7 deposit records, status filters and totals at 1366×720.
- No mutation was performed; financial values are observed seed data only.

## 2026-09-13 whole-unit setup

- `CBV-P1-001` setup executed in Chrome at **1366×720**.
- Room `PN 31-04` was configured as `Thuê nguyên căn` and saved successfully.
- Synthetic tenant `CBV Full Unit 20260913` (`0900000041`) was created through the room profile.
- Contract was created with rent **6,000,000 VND/month**, term **13/09/2026–13/09/2027**, and contract deposit **12,000,000 VND**.
- UI shows room status `Đang thuê`; deposit `DC-HD-PN 31-04-5810` is `Chờ thu cọc hợp đồng` with `ĐÃ THU 0đ`.
- Next UI action is `Thu tiền cọc`; no financial collection has been confirmed yet.
