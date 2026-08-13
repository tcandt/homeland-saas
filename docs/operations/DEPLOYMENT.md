# Deployment

## Mục tiêu và trạng thái

Runbook này áp dụng cho staging và production của HomeLand. Nhánh `main` hiện có pipeline tại `.github/workflows/ci-cd-pipeline.yml`: kiểm tra code, đóng gói image, deploy staging, smoke test, rollback staging khi smoke thất bại và chờ approval trước production.

Không gọi bản phát hành là LIVE chỉ vì pipeline xanh. Production chỉ được mở sau khi các mục ngoại vi trong [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) có bằng chứng.

## Điều kiện trước deploy

- [ ] Commit release candidate đã push và GitHub Actions đạt toàn bộ job bắt buộc.
- [ ] `npm.cmd run verify:prod` đạt trên commit cần phát hành với `RELEASE_GATE_DATABASE_URL` trỏ database test/staging riêng; không trỏ database vận hành.
- [ ] `npm.cmd run preflight:prod -- --env-file <production-env-outside-git>` trả `Configuration: PASS`.
- [ ] Domain web/API có HTTPS hợp lệ; `CORS_ORIGINS` chỉ chứa origin được phép.
- [ ] PostgreSQL, Redis, JWT và Integration Center dùng secret production, không dùng giá trị trong file example.
- [ ] Hai bank account được map đúng owner/tòa; đã thống nhất payment-code prefix.
- [ ] Có backup PostgreSQL và attachment ngoài máy chủ, kiểm tra được manifest trước deploy.
- [ ] Ghi lại commit SHA, version/image tag hiện tại và tag rollback.
- [ ] Monitoring/Alertmanager đã thay endpoint placeholder, test cảnh báo thành công và có người trực.
- [ ] Cửa sổ deploy, người phê duyệt và người rollback đã được chỉ định.

## Staging

1. Cho pipeline đóng gói image từ đúng commit và deploy staging.
2. Kiểm tra `/api/v1/health`, `/api/v1/health/ready` và `/api/v1/health/build-info`.
3. Xác nhận `build-info.commit` đúng SHA được duyệt.
4. Chạy production gate trên URL staging với credential staging riêng.
5. Chạy giao dịch sandbox/giá trị nhỏ cho cả owner A và B; xác nhận webhook không ghi trùng.
6. Chạy Hunonic sync; đối chiếu số bản ghi, kỳ khóa và phòng được map.
7. Gửi thử Zalo, Telegram và SMTP; kiểm tra retry/log khi provider lỗi.
8. Kiểm tra dashboard tổng thu, tổng chi và số còn lại theo owner/bank.
9. Lưu ảnh/log/kết quả kiểm tra vào biên bản phát hành.

Nếu bất kỳ bước nào sai, dừng promote production. Không sửa trực tiếp dữ liệu để làm test xanh.

`verify:prod` local khởi động bundle trên `3100/3101` và đăng nhập bốn persona thật. Login cập nhật audit/refresh-token metadata, vì vậy script từ chối chạy authenticated E2E nếu tên database không thể hiện rõ `release_gate`, `staging`, `test` hoặc `ci`. Các mutation nghiệp vụ trong regression được mock.

## Production

1. Xác nhận staging đạt và backup trước deploy còn sử dụng được.
2. Phê duyệt GitHub environment `production` bằng người có thẩm quyền.
3. Deploy đúng immutable image tag đã chạy trên staging, không deploy tag chưa nghiệm thu.
4. Nếu có migration mới trên database đã baseline, chạy `prisma migrate deploy` đúng một lần từ artifact đã duyệt hoặc khởi động một lần với `RUN_DB_MIGRATIONS=true`, sau đó trả cờ về `false`. Không dùng `db push`, `--force-reset` hoặc seed production trong deploy thường lệ. Database rỗng phải theo runbook baseline đã review; không chạy thẳng chuỗi migration lịch sử hiện tại.
5. Kiểm tra health/readiness/build-info trước khi mở traffic đầy đủ.
6. Smoke read-only bốn persona: `admin`, `adminA`, `adminB`, `manager`.
7. Chạy một giao dịch nhỏ đã thống nhất cho mỗi owner và đối chiếu bank, SePay, hóa đơn, audit log.
8. Kiểm tra Hunonic, notification queue, lỗi 5xx và dashboard tài chính.
9. Ghi thời gian deploy, SHA, image tag, migration, người duyệt và kết quả smoke.

## Rollback ứng dụng

- Dừng rollout khi health/readiness lỗi, 5xx tăng, sai owner/bank, ghi nhận tiền trùng hoặc số liệu quyết toán sai.
- Chuyển `API_TAG`/`WEB_TAG` về immutable tag trước đó rồi khởi động lại service theo runbook máy chủ.
- Không dùng `git reset --hard` trên máy production và không tự rollback schema bằng thao tác phá dữ liệu.
- Nếu code cũ không tương thích migration mới, chặn write, giữ traffic ở maintenance và chuẩn bị migration forward-fix đã review.
- Restore database chỉ theo [BACKUP.md](./BACKUP.md), sau phê duyệt sự cố và thử trên môi trường cô lập trước.

## Biên bản phát hành

```text
Release version / image tag:
Commit SHA:
Migration trước / sau:
Backup ID và vị trí off-host:
Người deploy / phê duyệt / trực:
Health, readiness, build-info:
Persona smoke:
SePay owner A / owner B:
Hunonic / Zalo / Telegram / SMTP:
Dashboard owner-bank:
Kết luận GO / NO-GO:
```
