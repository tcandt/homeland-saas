# HomeLand Production Readiness

Ngày cập nhật: 2026-08-13

Tài liệu này mô tả trạng thái và bằng chứng readiness. Backlog go-live trung tâm nằm tại [GO_LIVE_TODO.md](./GO_LIVE_TODO.md); tài liệu nghiệp vụ chi tiết nằm tại [rental-lifecycle-flow.md](../product/rental-lifecycle-flow.md).

## 1. Trạng thái hiện tại

### Đã hoàn thành trong code

- [x] Tách tài khoản `admin`, `adminA`, `adminB`, `manager`, `sales`, `finance` và lưu lịch sử đăng nhập/thay đổi.
- [x] Account owner A/B được chỉnh secret tích hợp; admin vận hành không được chỉnh secret.
- [x] Khóa public registration mặc định và bắt buộc đổi mật khẩu tạm.
- [x] Luồng cọc, hợp đồng, thanh toán, hóa đơn, SePay, quyết toán sớm, điện nước, hoàn/giữ/khấu trừ cọc và cập nhật trạng thái phòng.
- [x] Chi phí phát sinh có người chi, owner chịu chi, duyệt, thanh toán, hoàn ứng/khấu trừ lợi nhuận và audit log.
- [x] Build production cô lập; kiểm tra không dừng port dev, không xóa cache và không chạy CRUD trên DB thật.
- [x] E2E có tạo/sửa/xóa dữ liệu chỉ chạy khi đặt `RUN_DESTRUCTIVE_E2E=true` trên database dùng một lần.
- [x] Bộ regression production dùng API read-only hoặc mock cho các write flow.
- [x] Audit toàn bộ 28 route giao diện desktop ở light/dark, gồm route vận hành, public, maintenance được bảo vệ và bắt buộc đổi mật khẩu; kiểm tra lỗi console, overflow, màu nền/chữ và lưu ảnh bằng chứng.
- [x] Prisma có đủ 7 migration trên database vận hành hiện tại và database release-gate đã baseline.
- [x] Prisma dùng một provider global duy nhất; API không còn tạo connection pool lặp theo feature module.
- [x] Attachment chi phí dùng storage root ổn định ở dev/production, chặn path traversal và trả 404 khi file không tồn tại.
- [x] SSE thông báo dùng Bearer header; backend từ chối JWT trong query string để token không đi vào URL/log.
- [x] Production preflight chỉ đọc kiểm tra cấu trúc URL, CORS, JWT, public registration, Swagger và scheduler mà không in secret hoặc truy cập database.
- [x] Desktop shell và các màn Buildings, Contracts, Tenants, Finance, Invoices, Reports đã bỏ control báo thành công giả; thao tác chỉ hiển thị khi có route/mutation thật.
- [x] Responsive production audit cố định ở `1280x720`, `1440x900`, `1920x1080`, `2560x1440` cho sáu workspace chính ở cả light/dark; sidebar phân tích chỉ mở từ `1536px` để ưu tiên bảng và sơ đồ ở laptop.
- [x] Audit toàn bộ 28 route trên Chromium mobile ở `430x932`, `390x844`, `375x667` cho cả light/dark; kiểm tra overflow, redirect, màu nền/chữ, console/page error và HTTP 5xx.
- [x] Production gate bắt buộc database kiểm thử/staging riêng qua `RELEASE_GATE_DATABASE_URL`; từ chối database không có tên rõ `release_gate`, `staging`, `test` hoặc `ci` vì login có ghi audit và refresh-token metadata.

### Bằng chứng release candidate web gần nhất

Lần chạy: `2026-08-13 20:55` (Asia/Bangkok), local production bundle cô lập trên `3100/3101`, database release-gate riêng.

| Cổng kiểm tra | Kết quả |
|---|---|
| Mojibake/encoding | PASS |
| Production/supply-chain safety unit | PASS, `20/20`; kiểm tra database E2E cô lập, baseline checksum, Docker/deploy/SBOM workflow, không in secret và không tuyên bố LIVE thay cho nghiệm thu thủ công |
| Prisma schema | Hợp lệ |
| Migration hiện tại | `7/7`, up to date |
| API typecheck + unit | PASS, `195/195` |
| Web typecheck + unit | PASS, `49/49` |
| API + Next production build | PASS |
| Health/readiness | PASS |
| Production Playwright desktop | PASS, `47/47` |
| Production Playwright mobile | PASS, `18/18` nhóm trên Chromium `430/390/375`; tổng `168` lượt render route ở light/dark |
| Docker artifact | PASS build local cho API và Web; web context giảm từ gần `2 GB` xuống `56 MB`; image không được push hoặc chạy trong lần kiểm chứng |
| Runtime dependency audit | BLOCKED: GitHub CI gần nhất quan sát được có `17 high`, `23 moderate`, `3 low`; chưa tự đổi phiên bản dependency vì cần phê duyệt và regression riêng |
| Runtime engine | BLOCKED: image/CI đang dùng Node 20, trong khi Puppeteer 25 yêu cầu Node `>=22.12` và `@zxing/library` yêu cầu Node `>=24` |
| Light/dark | PASS trên toàn bộ `28/28` route giao diện ở mỗi theme (`56` lượt render); không redirect sai, overflow, page error, console error hoặc HTTP 5xx ngoài SSE 503 cố ý của fixture |
| Responsive desktop | PASS `6` workspace x `4` viewport x `2` theme (`48` lượt render/đo layout); không document overflow, root lệch viewport hoặc console/page error |
| Persona | PASS đăng nhập/RBAC cho `admin`, `adminA`, `adminB`, `manager`; admin vận hành có đủ 5 trường integration secret ở trạng thái chỉ đọc |
| Public registration | PASS: API `403`, UI hiển thị đăng ký đóng và không có nút tạo account |
| Vòng đời | PASS regression cọc, giữ/khấu trừ/hoàn cọc, quyết toán, hoàn tiền, trạng thái phòng, chi phí, SePay và credit hóa đơn; một hồ sơ stateful đi xuyên suốt từ thu cọc tới trả phòng |

Phạm vi bằng chứng:

- Auth, RBAC, các trang đọc và health của lượt cuối chạy với API production bundle và database release-gate cô lập.
- Lượt cuối chạy auth/RBAC trên database `release_gate` cô lập, không dùng database vận hành; login thành công vẫn tạo audit log và cập nhật refresh-token metadata trong database kiểm thử.
- Các nhánh write nghiệp vụ chạy bằng mock trên production bundle để không tạo/sửa/xóa dữ liệu vận hành.
- Hành trình stateful đã xác nhận các chuyển trạng thái: cọc `PENDING -> PAID -> CONVERTED_TO_CONTRACT`; hợp đồng `DRAFT -> PENDING_APPROVAL -> APPROVED -> ACTIVE -> TERMINATED`; hóa đơn `DRAFT -> ISSUED -> PAID`; phòng `AVAILABLE -> RESERVED -> OCCUPIED -> CLEANING -> AVAILABLE`.
- Quyết toán trong hành trình trên lấy snapshot điện Hunonic và nước, khấu trừ `500.000` đồng từ cọc, hoàn `4.500.000` đồng và khóa đúng trạng thái hợp đồng/phòng.
- Chạy lặp riêng cụm quyết toán đạt `6/6`; cơ chế preview dùng request mới nhất để tránh phản hồi cũ ghi đè số tiền vừa nhập. Log runtime không có HTTP 500, tranh chấp cổng hoặc token trong URL.
- Test destructive chỉ được chạy trên database dùng một lần khi có `RUN_DESTRUCTIVE_E2E=true`.
- Kết quả này xác nhận **release candidate local**, chưa thay thế staging, credential production và nghiệm thu giao dịch thật.
- Build không còn cảnh báo Gemini/NFT trace rộng hoặc deprecation về convention `middleware.ts`; Next proxy đã được kiểm tra tạo và giữ nguyên `x-correlation-id`.
- Database rỗng không thể chạy thẳng toàn bộ chuỗi migration lịch sử vì enum hợp đồng bị thêm trùng. CI/release-gate dựng schema hiện tại từ datamodel trên database rỗng rồi baseline đúng 7 migration đã review; không sửa SQL/checksum migration lịch sử.
- Commit `d6e392c` đã push và sửa bước xuất SBOM bằng CycloneDX lockfile có validate/reproducible. Trạng thái Actions mới chưa đọc được từ máy local do repository riêng không có phiên GitHub CLI/browser đăng nhập; không được tự xem là pipeline xanh.

### Chưa thể tự động hoàn tất bằng code

- [ ] Chọn domain HTTPS thật cho web và API.
- [ ] Cấp secret production ngoài Git: PostgreSQL, Redis, JWT, SePay, Zalo, Telegram, SMTP và Hunonic.
- [ ] Xác nhận hai tài khoản ngân hàng production và mapping account với owner/tòa.
- [ ] Cấu hình webhook SePay production và chạy giao dịch giá trị nhỏ có đối soát.
- [ ] Chọn nơi backup ngoài máy chủ và chạy restore drill có biên bản.
- [ ] Bật monitoring/alerting, chỉ định người trực và kênh xử lý sự cố.
- [ ] Deploy staging, chạy smoke/regression trên staging rồi mới mở production.
- [ ] Chốt phiên bản Node production phù hợp với engine dependency; cập nhật đồng bộ Docker/CI sau phê duyệt.
- [ ] Lập và nghiệm thu mốc nâng dependency để xử lý toàn bộ high-severity runtime advisory; CI hiện chặn đóng gói khi còn high/critical.
- [ ] Chạy lại GitHub Actions từ commit release candidate và lưu bằng chứng mọi job bắt buộc; security gate phải xanh, không chỉ xuất được SBOM.
- [x] Chuẩn hóa runbook bootstrap database rỗng tại `DATABASE_BASELINE.md`: guard database rỗng, checksum, review SQL, baseline 7 migration và nghiệm thu; không chạy thẳng chuỗi migration lịch sử.

Không gọi hệ thống là LIVE nếu còn bất kỳ mục nào ở phần này chưa hoàn thành.

## 2. Vai trò kiểm thử cuối

| Persona | Account | Kiểm tra bắt buộc |
|---|---|---|
| Toàn quyền vận hành | `admin@homeland.local` | Xem dashboard, team, tài chính, hợp đồng; không sửa được integration secret |
| Chủ/quản lý A | `adminA@homeland.local` | Quản lý LK01-31/LK08-25; sửa được integration secret; audit gắn đúng user |
| Chủ/quản lý B | `adminB@homeland.local` | Quản lý LK01-32/LK08-24; sửa được integration secret; audit gắn đúng user |
| Manager | `manager@homeland.local` | Vận hành phòng/khách/hợp đồng theo quyền; không vào Settings quản trị |

Quy tắc credential:

1. Mỗi account dùng một mật khẩu ngẫu nhiên riêng.
2. Không gửi mật khẩu qua Git, tài liệu hoặc nhóm chat chung.
3. Bàn giao qua password manager/kênh bảo mật và yêu cầu đổi ngay lần đầu.
4. Khi nhân sự nghỉ hoặc đổi vai trò, khóa account và thu hồi refresh token thay vì dùng chung account.

## 3. Quy trình nghiệp vụ nghiệm thu

### Luồng chuẩn

1. Sales chọn phòng trống và tạo hồ sơ cọc.
2. Tạo QR đúng bank của owner; SePay nhận tiền và match đúng payment code.
3. Kiểm tra cọc đã thu, khách/CCCD/người ở và tạo hợp đồng nháp.
4. Submit, duyệt và kích hoạt hợp đồng; phòng chuyển sang đang thuê.
5. Phát hành hóa đơn định kỳ; Hunonic đồng bộ mỗi giờ; khóa kỳ điện đã chốt.
6. SePay ghi nhận thanh toán đủ/thiếu/thừa; giao dịch sai bank hoặc không match vào hàng chờ xử lý.
7. Ghi chi phí vận hành, người ứng tiền và owner chịu chi; duyệt, chi và quyết toán hoàn ứng/khấu trừ.
8. Trước hết hạn gửi nhắc; chọn gia hạn hoặc quyết toán trả phòng.
9. Chốt điện/nước, tiền thuê theo ngày, phí hư hỏng/hỗ trợ, công nợ và cọc.
10. Thu thêm hoặc hoàn tiền; hoàn tất chứng từ; phòng sang `CLEANING`/`MAINTENANCE`, sau đó mới về `AVAILABLE`.

### Ngoại lệ phải nghiệm thu

- Hủy cọc chưa thu; hoàn toàn phần/một phần; giữ cọc; khấu trừ phí từ cọc.
- Thanh toán thiếu, thừa, sai bank, sai nội dung và gán tay giao dịch.
- Trả phòng sớm có/không hoàn tiền phòng; hoàn tiền đang chờ rồi hoàn tất sau.
- Chỉ số điện thiếu, trùng, bất thường hoặc kỳ đã khóa.
- Chi phí do owner/người khác ứng hộ và khấu trừ đúng khi chia lợi nhuận.
- Không tạo hóa đơn quyết toán rỗng khi số phải thu bằng 0.
- Mọi thao tác tiền, owner, settings và login phải truy ra đúng user trong audit log.

## 4. Cấu hình production bắt buộc

Không dùng `.env` local để deploy. Tối thiểu phải cấp:

```text
NODE_ENV=production
APP_URL=https://api.example.com
NEXT_PUBLIC_API_URL=/api/v1
CORS_ORIGINS=https://app.example.com
DATABASE_URL=postgresql://<user>:<secret>@<host>:5432/<database>?schema=public
REDIS_URL=redis://:<secret>@<host>:6379
JWT_SECRET=<random-secret-at-least-32-characters>
ALLOW_REGISTRATION=false
NEXT_PUBLIC_ALLOW_REGISTRATION=false
ENABLE_SWAGGER=false
```

Các secret SePay/Zalo/Telegram/SMTP/Hunonic cấu hình trong Integration Center bằng account owner được phép. Không commit giá trị thật.

Trước khi deploy, nạp biến môi trường production trong secret manager hoặc một file nằm ngoài Git rồi chạy preflight chỉ đọc:

```powershell
npm.cmd run preflight:prod -- --env-file C:\secure\homeland.production.env
```

Preflight kiểm tra cấu trúc PostgreSQL/Redis URL, HTTPS, CORS allowlist, JWT, khóa public registration/Swagger và trạng thái scheduler. Lệnh không kết nối database, không sửa dữ liệu và không in giá trị secret. `Configuration: PASS` vẫn chưa có nghĩa là LIVE; các nghiệm thu bank-owner, SePay, Hunonic, notification, backup, monitoring và bàn giao account vẫn phải có bằng chứng riêng.

## 5. Backup, migration và rollback

### Trước deploy

- [ ] Dump PostgreSQL theo timestamp, lưu ngoài máy chủ và chạy `pg_restore --list`.
- [ ] Ghi commit SHA, migration hiện tại và image tag đang chạy.
- [ ] Chạy `prisma migrate status`; không dùng `db push --force-reset` hoặc reset production.
- [ ] Kiểm tra dung lượng lưu trữ attachment/chứng từ và backup object storage.

### Apply

1. Bật maintenance hoặc ngăn write nếu migration có thay đổi lớn.
2. Chạy `prisma migrate deploy` một lần bằng release artifact đã duyệt.
3. Kiểm tra `/api/v1/health` và `/api/v1/health/ready`.
4. Chạy smoke read-only và một giao dịch sandbox/giá trị nhỏ đã thống nhất.

### Rollback

- Rollback app bằng image/commit trước, không `git reset --hard` trên máy production.
- Không tự động rollback schema bằng lệnh phá dữ liệu.
- Nếu migration không tương thích, dừng write, đánh giá backup và dùng migration forward-fix đã review.
- Restore database chỉ sau phê duyệt sự cố, trên bản sao trước rồi mới áp dụng production.

## 6. Lệnh kiểm tra phát hành

```powershell
$env:RELEASE_GATE_DATABASE_URL='postgresql://<user>:<secret>@<host>:5432/<release_gate_or_staging_db>?schema=public'
$env:E2E_ADMIN_PASSWORD='<release-gate-secret>'
$env:E2E_OWNER_A_PASSWORD='<release-gate-secret>'
$env:E2E_OWNER_B_PASSWORD='<release-gate-secret>'
$env:E2E_MANAGER_PASSWORD='<release-gate-secret>'
npm.cmd run verify:prod
```

Lệnh trên dùng port `3100/3101`, output cô lập, tắt cron và tăng rate limit chỉ trong API kiểm chứng. Nó không dừng dịch vụ ở `3000/3001`, không xóa `.next`, không seed, không migrate deploy và không chạy business CRUD vào database vận hành. Bốn lần credential preflight và fixture login có ghi audit/refresh-token metadata vào database release-gate riêng.

E2E destructive chỉ được phép trên DB dùng một lần:

```powershell
$env:RUN_DESTRUCTIVE_E2E='true'
npm.cmd run test:e2e --workspace=web -- tests/e2e/core/customer-flow.e2e.spec.ts
```

Không đặt cờ này khi trỏ tới database vận hành.

## 7. Go-live và 24 giờ đầu

- [x] Bốn persona đăng nhập thành công trong production gate local trên database release-gate cô lập.
- [ ] Bốn persona nhận credential bàn giao và tự đổi mật khẩu lần đầu trên staging/production.
- [x] Light/dark desktop đạt 28/28 route giao diện trên production bundle local, không redirect sai, overflow hoặc console error.
- [x] Light/dark mobile đạt 28/28 route ở ba viewport Chromium `430/390/375`, không redirect sai, overflow, console/page error hoặc HTTP 5xx.
- [x] Public registration trả 403 và trang `/register` báo đang đóng trên production bundle local.
- [ ] QR/SePay về đúng bank và owner; webhook không ghi trùng.
- [ ] Hunonic sync được, không trùng dữ liệu và không ghi đè kỳ khóa.
- [ ] Zalo/Telegram/SMTP gửi được và retry thất bại có log.
- [ ] Dashboard tổng thu/chi/còn lại khớp báo cáo owner và bank.
- [ ] Backup ngoài máy chủ và restore drill được xác nhận.
- [ ] Monitoring, cảnh báo và người trực đã hoạt động.

Trong 24 giờ đầu, theo dõi health, lỗi 5xx, queue thông báo, webhook chưa match, sync Hunonic, chênh lệch bank và audit login. Nếu có sai lệch tiền, dừng tự động đối soát/ghi nhận liên quan trước khi sửa dữ liệu.

Runbook chi tiết: [Go-live TODO](./GO_LIVE_TODO.md), [Deployment](./DEPLOYMENT.md), [Database baseline](./DATABASE_BASELINE.md), [Backup](./BACKUP.md), [Monitoring](./MONITORING.md).
