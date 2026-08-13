# Production Release Checklist

> Version: 3.0 | Cập nhật: 2026-08-13
>
> Trạng thái hiện tại: **LOCAL RELEASE CANDIDATE PASS / LIVE NO-GO**.
> Không đánh dấu PRODUCTION READY hoặc LIVE khi thiếu bằng chứng staging, security, backup, monitoring và nghiệm thu tích hợp thật.

Backlog chi tiết và trạng thái P0/P1 được quản lý tại [GO_LIVE_TODO.md](../operations/GO_LIVE_TODO.md). File này chỉ là bản tóm tắt release gate.

## 1. Code và nghiệp vụ

- [x] Encoding/mojibake gate PASS.
- [x] Prisma schema hợp lệ; database release-gate baseline đủ `7/7` migration.
- [x] API typecheck và unit PASS `195/195`.
- [x] Web typecheck và unit PASS `49/49`.
- [x] Production build API/Next cô lập PASS.
- [x] Health và readiness PASS trên `3101`.
- [x] Desktop Playwright PASS `47/47`.
- [x] Vòng đời stateful từ cọc đến trả phòng PASS.
- [x] Giữ/khấu trừ/hoàn cọc, chi phí, SePay, credit hóa đơn và trạng thái phòng PASS.

## 2. Persona và giao diện

- [x] Credential preflight PASS cho `admin`, `adminA`, `adminB`, `manager` trên database release-gate riêng.
- [x] RBAC Settings: manager bị chặn; owner A/B sửa được integration secret; admin vận hành chỉ đọc secret.
- [x] Desktop light/dark: 28 route mỗi theme, không overflow, redirect sai, console/page error hoặc HTTP 5xx.
- [x] Desktop responsive: 6 workspace x 4 viewport x 2 theme, tổng 48 phép đo.
- [x] Chromium mobile light/dark: `430/390/375`, `18/18` nhóm, tổng 168 lượt render route.
- [ ] UAT Safari/WebKit và thiết bị Android/iOS thật có biên bản.

## 3. Database và an toàn kiểm thử

- [x] `verify:prod` yêu cầu `RELEASE_GATE_DATABASE_URL` có tên test/staging/release-gate/ci.
- [x] Login audit và refresh-token metadata chỉ ghi vào database release-gate trong lượt test cuối.
- [x] Business write regression dùng mock; destructive E2E chỉ mở với `RUN_DESTRUCTIVE_E2E=true` trên database dùng một lần.
- [x] Không reset, truncate, seed hoặc migrate deploy database vận hành trong release gate.
- [x] Runbook baseline database rỗng có guard, checksum, SQL review, migration resolve/status và quy tắc không seed/reset: `docs/operations/DATABASE_BASELINE.md`.
- [ ] Backup PostgreSQL và attachment ngoài máy chủ; kiểm tra manifest và restore drill có biên bản.

## 4. Supply chain và security

- [x] Production/supply-chain safety tests PASS `21/21`.
- [x] Gitleaks PASS ở pipeline gần nhất quan sát được; Hunonic signing secret đã loại khỏi source.
- [x] CycloneDX SBOM từ lockfile có validate/reproducible; runtime audit gate vẫn chặn high/critical.
- [ ] GitHub Actions mới đạt toàn bộ job bắt buộc sau commit sửa SBOM.
- [ ] Xử lý runtime audit gần nhất: `17 high`, `23 moderate`, `3 low`.
- [ ] Phê duyệt Node runtime thống nhất; CI/Docker hiện Node 20 trong khi dependency có engine cao hơn.
- [ ] Rotate Hunonic mobile signing key đã từng xuất hiện trong lịch sử Git.

## 5. Hạ tầng và tích hợp LIVE

- [ ] Domain HTTPS thật cho web/API và CORS allowlist production.
- [ ] Secret production PostgreSQL, Redis, JWT, SePay, Hunonic, Zalo, Telegram và SMTP nằm ngoài Git.
- [ ] Deploy staging từ immutable image của đúng commit release candidate.
- [ ] SePay giao dịch giá trị nhỏ PASS cho cả hai bank/owner, không ghi trùng webhook.
- [ ] Hunonic sync PASS, không trùng dữ liệu và không ghi đè kỳ đã khóa.
- [ ] Zalo/Telegram/SMTP gửi, retry và log PASS với credential production.
- [ ] Dashboard tổng thu/chi/còn lại khớp owner và sao kê bank.
- [ ] Monitoring/alerting hoạt động; có người trực chính/dự phòng và test alert resolved.

## 6. Bàn giao và GO/NO-GO

- [ ] Bốn persona nhận credential riêng qua kênh bảo mật và đổi mật khẩu lần đầu.
- [ ] Ghi commit SHA, image tag, migration, backup ID và rollback owner.
- [ ] Technical lead, owner A, owner B và người vận hành ký biên bản staging acceptance.
- [ ] Mọi mục chưa hoàn thành ở phần 3-6 đã có bằng chứng đính kèm.

## Kết luận hiện tại

| Phạm vi | Trạng thái |
|---|---|
| Code, unit, production bundle, desktop/mobile Chromium | PASS |
| Persona/RBAC và rental lifecycle trên release-gate DB | PASS |
| GitHub security pipeline mới | CHƯA XÁC NHẬN / runtime audit còn BLOCKED |
| Staging, HTTPS, tích hợp thật, backup/restore, monitoring | CHƯA NGHIỆM THU |
| Quyết định LIVE | **NO-GO** |
