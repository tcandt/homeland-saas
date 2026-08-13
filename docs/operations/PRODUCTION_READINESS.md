# HomeLand Production Readiness

Ngày cập nhật: 2026-08-13

Tài liệu này là checklist vận hành chuẩn cho bản desktop. Tài liệu nghiệp vụ chi tiết nằm tại [rental-lifecycle-flow.md](../product/rental-lifecycle-flow.md).

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
- [x] Audit 10 trang desktop ở light/dark kiểm tra lỗi console, overflow, màu nền/chữ và lưu ảnh bằng chứng.
- [x] Prisma có đủ 7 migration trên database hiện tại.
- [x] Prisma dùng một provider global duy nhất; API không còn tạo connection pool lặp theo feature module.
- [x] Attachment chi phí dùng storage root ổn định ở dev/production, chặn path traversal và trả 404 khi file không tồn tại.
- [x] SSE thông báo dùng Bearer header; backend từ chối JWT trong query string để token không đi vào URL/log.

### Bằng chứng release candidate desktop gần nhất

Lần chạy: `2026-08-13 15:07` (Asia/Bangkok), local production bundle cô lập trên `3100/3101`.

| Cổng kiểm tra | Kết quả |
|---|---|
| Mojibake/encoding | PASS |
| Prisma schema | Hợp lệ |
| Migration hiện tại | `7/7`, up to date |
| API typecheck + unit | PASS, `181/181` |
| Web typecheck + unit | PASS, `49/49` |
| API + Next production build | PASS |
| Health/readiness | PASS |
| Production Playwright desktop | PASS, `40/40` |
| Light/dark | PASS trên 10 trang/mỗi theme; không overflow, page error, console error hoặc HTTP 5xx ngoài SSE 503 cố ý của fixture |
| Persona | PASS đăng nhập/RBAC cho `admin`, `adminA`, `adminB`, `manager`; admin vận hành có đủ 5 trường integration secret ở trạng thái chỉ đọc |
| Public registration | PASS: API `403`, UI hiển thị đăng ký đóng và không có nút tạo account |
| Vòng đời | PASS regression cọc, giữ/khấu trừ/hoàn cọc, quyết toán, hoàn tiền, trạng thái phòng, chi phí, SePay và credit hóa đơn |

Phạm vi bằng chứng:

- Auth, RBAC, các trang đọc và health chạy với API/database hiện tại.
- Các nhánh write nghiệp vụ chạy bằng mock trên production bundle để không tạo/sửa/xóa dữ liệu vận hành.
- Test destructive chỉ được chạy trên database dùng một lần khi có `RUN_DESTRUCTIVE_E2E=true`.
- Kết quả này xác nhận **release candidate local**, chưa thay thế staging, credential production và nghiệm thu giao dịch thật.
- Build không còn cảnh báo Gemini/NFT trace rộng hoặc deprecation về convention `middleware.ts`; Next proxy đã được kiểm tra tạo và giữ nguyên `x-correlation-id`.

### Chưa thể tự động hoàn tất bằng code

- [ ] Chọn domain HTTPS thật cho web và API.
- [ ] Cấp secret production ngoài Git: PostgreSQL, Redis, JWT, SePay, Zalo, Telegram, SMTP và Hunonic.
- [ ] Xác nhận hai tài khoản ngân hàng production và mapping account với owner/tòa.
- [ ] Cấu hình webhook SePay production và chạy giao dịch giá trị nhỏ có đối soát.
- [ ] Chọn nơi backup ngoài máy chủ và chạy restore drill có biên bản.
- [ ] Bật monitoring/alerting, chỉ định người trực và kênh xử lý sự cố.
- [ ] Deploy staging, chạy smoke/regression trên staging rồi mới mở production.

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
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
CORS_ORIGINS=https://app.example.com
DATABASE_URL=postgresql://<user>:<secret>@<host>:5432/<database>?schema=public
REDIS_URL=redis://:<secret>@<host>:6379
JWT_SECRET=<random-secret-at-least-32-characters>
ALLOW_REGISTRATION=false
NEXT_PUBLIC_ALLOW_REGISTRATION=false
ENABLE_SWAGGER=false
```

Các secret SePay/Zalo/Telegram/SMTP/Hunonic cấu hình trong Integration Center bằng account owner được phép. Không commit giá trị thật.

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
npm.cmd run verify:prod
```

Lệnh trên dùng port `3100/3101`, output cô lập và tắt cron trong API kiểm chứng. Nó không dừng dịch vụ ở `3000/3001`, không xóa `.next`, không seed, không migrate deploy và không chạy E2E destructive.

E2E destructive chỉ được phép trên DB dùng một lần:

```powershell
$env:RUN_DESTRUCTIVE_E2E='true'
npm.cmd run test:e2e --workspace=web -- tests/e2e/core/customer-flow.e2e.spec.ts
```

Không đặt cờ này khi trỏ tới database vận hành.

## 7. Go-live và 24 giờ đầu

- [x] Bốn persona đăng nhập thành công trong production gate local.
- [ ] Bốn persona nhận credential bàn giao và tự đổi mật khẩu lần đầu trên staging/production.
- [x] Light/dark desktop đạt 10/10 trang trên production bundle local, không overflow và không console error.
- [x] Public registration trả 403 và trang `/register` báo đang đóng trên production bundle local.
- [ ] QR/SePay về đúng bank và owner; webhook không ghi trùng.
- [ ] Hunonic sync được, không trùng dữ liệu và không ghi đè kỳ khóa.
- [ ] Zalo/Telegram/SMTP gửi được và retry thất bại có log.
- [ ] Dashboard tổng thu/chi/còn lại khớp báo cáo owner và bank.
- [ ] Backup ngoài máy chủ và restore drill được xác nhận.
- [ ] Monitoring, cảnh báo và người trực đã hoạt động.

Trong 24 giờ đầu, theo dõi health, lỗi 5xx, queue thông báo, webhook chưa match, sync Hunonic, chênh lệch bank và audit login. Nếu có sai lệch tiền, dừng tự động đối soát/ghi nhận liên quan trước khi sửa dữ liệu.
