# Monitoring

## Stack hiện có

`docker-compose.monitoring.yml` cung cấp Prometheus, Alertmanager, Grafana, Loki, Promtail và Tempo. API công khai health/readiness/build-info và Prometheus metrics.

Đây mới là cấu hình triển khai mẫu. `monitoring/alertmanager.yml` còn URL localhost và token placeholder; không được coi monitoring là hoạt động và không expose các cổng ra Internet trước khi thay endpoint, bảo vệ truy cập và gửi thử cảnh báo thành công.

## Điều kiện bật production

- [ ] Prometheus scrape được API qua mạng nội bộ tại `/api/v1/metrics`.
- [ ] Grafana, Prometheus, Loki, Tempo và Alertmanager không mở công khai hoặc được bảo vệ bằng TLS/auth/VPN.
- [ ] Mật khẩu Grafana mặc định đã đổi và lưu trong secret manager.
- [ ] Alertmanager receiver thật đã thay toàn bộ endpoint/token placeholder.
- [ ] Critical alert gửi tới ít nhất hai người/kênh; warning có owner xử lý.
- [ ] Test fire/resolved alert đã tới đúng kênh và có timestamp.
- [ ] Đồng hồ máy chủ đồng bộ; log có correlation ID, user ID và tenant ID nhưng không chứa token.
- [ ] Có người trực chính/dự phòng và quy tắc escalation.

## Cảnh báo kỹ thuật tối thiểu

| Tín hiệu | Ngưỡng ban đầu | Hành động |
|---|---:|---|
| API down | `1 phút` | Critical, kiểm tra process/network/database |
| HTTP 5xx | `>5% trong 5 phút` | Critical, dừng rollout hoặc luồng ghi liên quan |
| HTTP 4xx | `>10% trong 5 phút` | Warning, kiểm tra auth/client/version |
| P95 latency | `>2 giây trong 10 phút` | Warning |
| P99 latency | `>5 giây trong 10 phút` | Critical |
| Readiness database DOWN | Một lần liên tục `>1 phút` | Critical |
| Disk/database/storage | `>80%` warning, `>90%` critical | Mở rộng/giảm log, không xóa dữ liệu tùy tiện |
| Backup quá hạn | Không có backup hợp lệ `>24 giờ` | Critical |

Các rule HTTP/SLO đã có trong `monitoring/prometheus-rules.yml`. Trước LIVE phải bổ sung hoặc cấu hình monitor ngoài cho readiness DB, disk/storage và backup freshness nếu chưa có metric tương ứng.

## Cảnh báo nghiệp vụ bắt buộc

- SePay webhook lỗi, signature sai, giao dịch trùng hoặc transaction chưa match quá SLA.
- Giao dịch vào sai bank so với owner/tòa hoặc số tiền thiếu/thừa chưa xử lý.
- Hunonic sync thất bại, lần sync cuối quá `2 giờ`, reading trùng/bất thường hoặc cố ghi kỳ khóa.
- Notification Zalo/Telegram/SMTP thất bại sau retry hoặc queue tăng liên tục.
- Sai lệch dashboard tổng thu/chi/còn lại so với bank/owner.
- Hoàn cọc/hoàn tiền ở trạng thái pending quá SLA.
- Login thất bại tăng đột biến, sửa integration secret hoặc thay owner.

Nếu metric tự động chưa tồn tại, đội vận hành phải lập dashboard/query kiểm tra định kỳ và ticket có người chịu trách nhiệm; không đánh dấu mục này hoàn thành chỉ bằng việc khởi động container monitoring.

## Quy trình xử lý cảnh báo

1. Acknowledge và ghi người nhận trong `5 phút` với critical, `30 phút` với warning.
2. Xác định tenant, owner, bank, correlation ID và thời điểm bắt đầu.
3. Với sai lệch tiền: dừng tự động match/ghi nhận liên quan trước khi sửa dữ liệu.
4. Với sync/notification: giữ queue/log, không replay hàng loạt cho tới khi xác nhận idempotency.
5. Chọn rollback app, forward-fix hoặc maintenance; restore database là phương án cuối theo [BACKUP.md](./BACKUP.md).
6. Ghi timeline, tác động, quyết định và bằng chứng phục hồi.
7. Đóng sự cố sau khi dashboard ổn định và reconciliation hoàn tất.

## Theo dõi 24 giờ đầu

- Mỗi `15 phút` trong giờ đầu, sau đó mỗi giờ: health/readiness, 5xx, latency và database connection.
- Mỗi giờ: Hunonic sync, notification queue và webhook chưa match.
- Sau mỗi giao dịch thật: đối chiếu bank, SePay, invoice/deposit và audit user.
- Cuối ngày: đối chiếu tổng thu/chi/còn lại theo cả hai owner và xác nhận backup off-host.
- Không giảm tần suất theo dõi khi còn cảnh báo chưa có owner hoặc reconciliation chưa khớp.
