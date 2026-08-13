# Backup Strategy

## Mục tiêu

- RPO mục tiêu giai đoạn đầu: tối đa `24 giờ`; khi giao dịch tăng, giảm xuống `1 giờ` bằng WAL/PITR hoặc dịch vụ PostgreSQL managed.
- RTO mục tiêu giai đoạn đầu: tối đa `4 giờ`.
- Full backup PostgreSQL hằng ngày, giữ tối thiểu `30 ngày`.
- Attachment/chứng từ và cấu hình triển khai được backup cùng lịch, nhưng secret lưu trong secret manager riêng.
- Có ít nhất một bản mã hóa nằm ngoài máy chủ production và ngoài cùng failure domain.

Backup chưa được coi là thành công nếu chưa kiểm tra manifest và chưa có restore drill định kỳ.

## Phạm vi

1. PostgreSQL database và migration history.
2. Attachment/chứng từ ở storage root hoặc object storage.
3. Cấu hình deployment không chứa secret: image tag, commit SHA, compose version và migration hiện tại.
4. Grafana dashboards/alert rules đã version trong Git.
5. Secret chỉ backup bằng cơ chế của secret manager; không đưa secret thật vào Git hoặc biên bản.

## Tạo backup PostgreSQL

Thao tác này ảnh hưởng tài nguyên hệ thống và phải được phê duyệt trước khi chạy trên production. Dùng biến môi trường/`.pgpass` được bảo vệ, không đặt password trực tiếp trong command history.

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
pg_dump --format=custom --no-owner --no-acl --file "homeland-$stamp.dump" $env:DATABASE_URL
pg_restore --list "homeland-$stamp.dump"
Get-FileHash "homeland-$stamp.dump" -Algorithm SHA256
```

Sau đó mã hóa và chuyển file tới off-host storage có retention/immutable policy. Không xóa bản cũ ngoài chính sách retention đã phê duyệt.

## Backup attachment

- Chụp snapshot hoặc export object storage nhất quán với thời điểm database dump.
- Lưu manifest gồm tên object, kích thước, checksum và thời gian.
- Không ghi đè bản backup trước; dùng prefix/version theo timestamp.
- Kiểm tra ngẫu nhiên file ảnh/PDF có thể đọc được sau khi tải từ off-host storage.

## Restore drill cô lập

Restore drill không được trỏ vào database đang vận hành.

1. Tạo PostgreSQL instance/database tạm biệt lập với production.
2. Xác nhận đích restore là instance tạm và ghi lại connection identity.
3. Chạy `pg_restore --list` và kiểm tra checksum trước restore.
4. Restore dump vào database trống tạm bằng `pg_restore --clean` chỉ khi đích tạm đã được phê duyệt rõ ràng.
5. Chạy `prisma migrate status`, health/readiness và smoke read-only trên bản restore.
6. Đối chiếu số lượng owner, building, room, contract, invoice, payment, expense, Hunonic reading và audit log.
7. Mở ngẫu nhiên attachment/chứng từ từ bản restore.
8. Ghi thời gian restore thực tế, lỗi phát sinh và RTO đạt được.
9. Dọn môi trường tạm chỉ sau phê duyệt riêng; không tự động xóa.

## Restore khi có sự cố

- Chặn write và giữ bằng chứng trước khi quyết định restore.
- Xác định phạm vi mất dữ liệu, recovery point và các giao dịch cần nhập lại.
- Ưu tiên rollback app hoặc forward-fix nếu database vẫn toàn vẹn.
- Restore production cần phê duyệt của cả owner vận hành và người chịu trách nhiệm kỹ thuật.
- Luôn restore/test trên bản sao trước; chỉ chuyển traffic khi đối chiếu tài chính, owner-bank và audit đạt.
- Sau restore, rotate credential nếu có khả năng secret bị lộ và chạy lại toàn bộ reconciliation.

## Biên bản backup/restore

```text
Backup ID / timestamp / commit SHA:
Database server identity:
File size / SHA256 / off-host location:
Attachment manifest:
Retention expiry:
Người tạo / người kiểm tra:
Restore target identity:
Restore start / finish / duration:
Prisma status / health / smoke:
Đối chiếu bản ghi và tài chính:
Kết luận PASS / FAIL:
```
