# Hướng dẫn cập nhật phiên bản HomeLand qua Docker trên Synology NAS
Tài liệu này hướng dẫn cập nhật HomeLand trên NAS theo 2 cách:

1. Cập nhật từ URL repository GitHub.
2. Upload file release trực tiếp lên NAS rồi giải nén/chạy Docker.

Mục tiêu là cập nhật phiên bản mới, ví dụ `v3.0.2` lên `v3.0.3`, mà không xóa database, không reset volume và không ảnh hưởng các project khác như `mediaslution-web`.

## 1. Nguyên tắc an toàn bắt buộc

Luôn giữ riêng từng project:

- HomeLand: `/volume1/docker/homeland`
- Cloudflare Tunnel HomeLand: `/volume1/docker/homeland-cloudflared`
- MediaSolution: `/volume1/docker/mediaslution-web` — không đụng vào khi update HomeLand.

Không chạy các lệnh nguy hiểm khi update thường lệ:

```bash
docker compose down -v
docker volume rm ...
docker system prune -a --volumes
./reset-public-production.sh
npm run db:reset:prod
prisma db push --force-reset
prisma migrate reset
```

Các lệnh trên có thể xóa dữ liệu hoặc làm mất trạng thái production.

Khi update thông thường:

- Không xóa named volumes.
- Không xóa thư mục storage.
- Không reset PostgreSQL.
- Không sửa secret/token/password nếu không cần.
- Luôn backup trước khi update.
- Nếu có migration database, chỉ chạy đúng 1 lần, sau đó trả `RUN_DB_MIGRATIONS=false`.

## 2. Chuẩn bị trước khi update

SSH vào NAS hoặc mở Terminal trong DSM.

Vào đúng thư mục HomeLand:

```bash
cd /volume1/docker/homeland
pwd
```

Kết quả phải là:

```bash
/volume1/docker/homeland
```

Kiểm tra project đang chạy:

```bash
docker compose --env-file .env.public-production -f docker-compose.public-production.yml ps
```

Kiểm tra file env hiện có:

```bash
ls -la .env.public-production docker-compose.public-production.yml
```

Không in nội dung `.env.public-production` ra nơi công khai vì file này chứa secret.

## 3. Backup trước khi update

Tạo thư mục backup:

```bash
mkdir -p /volume1/docker/homeland/backups
```

Backup database PostgreSQL:

```bash
BACKUP_VERSION="before-update-$(date +%Y%m%d-%H%M%S)"

docker compose --env-file .env.public-production -f docker-compose.public-production.yml exec -T postgres \
  pg_dump -U homeland -d homeland \
  > "/volume1/docker/homeland/backups/${BACKUP_VERSION}.sql"
```

Backup env và compose:

```bash
cp .env.public-production "/volume1/docker/homeland/backups/${BACKUP_VERSION}.env.public-production"
cp docker-compose.public-production.yml "/volume1/docker/homeland/backups/${BACKUP_VERSION}.docker-compose.public-production.yml"
```

Kiểm tra backup đã có file:

```bash
ls -lh /volume1/docker/homeland/backups | tail
```

Nếu backup database bằng 0 byte hoặc lỗi, dừng update.

## 4. Cách 1 — Cập nhật thông qua URL repository GitHub

Cách này phù hợp khi NAS có mạng ổn định và có thể kéo source từ repo.

### 4.1. Vào thư mục project

```bash
cd /volume1/docker/homeland
```

### 4.2. Kiểm tra trạng thái Git

```bash
git status
git remote -v
git branch --show-current
```

Nếu NAS chưa phải git repo, clone sang thư mục tạm rồi đồng bộ source:

```bash
cd /volume1/docker
git clone https://github.com/tcandt/homeland-saas.git homeland-next
```

Sau đó copy các file release cần thiết từ `homeland-next` sang `homeland`, nhưng không ghi đè `.env.public-production`.

### 4.3. Kéo phiên bản mới

Nếu dùng branch chính:

```bash
cd /volume1/docker/homeland
git fetch --all --tags
git pull
```

Nếu dùng tag release, ví dụ `v3.0.3`:

```bash
cd /volume1/docker/homeland
git fetch --all --tags
git checkout v3.0.3
```

Nếu checkout tag làm repo ở detached HEAD là bình thường đối với production release.

### 4.4. Cập nhật version trong `.env.public-production`

Mở `.env.public-production` bằng editor của NAS hoặc `vi`:

```bash
vi .env.public-production
```

Cập nhật các dòng version, ví dụ:

```ini
APP_VERSION="v3.0.3"
API_TAG="v3.0.3"
WEB_TAG="v3.0.3"
COMMIT_SHA="..."
BUILD_TIME="2026-10-03T00:00:00+07:00"
```

Nếu bản update có migration database thì tạm đặt:

```ini
RUN_DB_MIGRATIONS="true"
```

Nếu bản update chỉ thay frontend/backend code, không có migration thì giữ:

```ini
RUN_DB_MIGRATIONS="false"
```

Không sửa các dòng secret như:

```ini
POSTGRES_PASSWORD=...
JWT_SECRET=...
INTERNAL_API_TOKEN=...
CLOUDFLARE_TUNNEL_TOKEN=...
SYSTEM_UPDATE_GITHUB_TOKEN=...
HUNONIC_MOBILE_ACCESS_KEY=...
HUNONIC_MOBILE_SECRET_KEY=...
```

### 4.5. Build và chạy lại Docker

```bash
cd /volume1/docker/homeland

docker compose --env-file .env.public-production -f docker-compose.public-production.yml up -d --build api web notification_worker
```

Theo dõi log API:

```bash
docker compose --env-file .env.public-production -f docker-compose.public-production.yml logs -f --tail=100 api
```

Nếu thấy app chạy ổn, dừng xem log bằng `Ctrl+C`.

### 4.6. Nếu đã bật migration, tắt lại sau khi chạy xong

Mở `.env.public-production`:

```bash
vi .env.public-production
```

Đổi:

```ini
RUN_DB_MIGRATIONS="false"
```

Restart nhẹ API/worker để đảm bảo lần boot sau không tự chạy migration lại:

```bash
docker compose --env-file .env.public-production -f docker-compose.public-production.yml up -d api notification_worker
```

## 5. Cách 2 — Upload file release trực tiếp lên NAS

Cách này phù hợp khi build/đóng gói release ở máy khác rồi upload lên NAS qua File Station.

Có 2 kiểu upload:

- Upload source release dạng `.zip` hoặc `.tar.gz`, sau đó build image trên NAS.
- Upload Docker image dạng `.tar`, sau đó `docker load` và chạy compose.

### 5.1. Upload source release `.zip` hoặc `.tar.gz`

Ví dụ file:

```text
homeland-source-v3.0.3.zip
```

Upload vào:

```text
/volume1/docker/homeland
```

Qua DSM File Station:

1. Mở File Station.
2. Vào `/docker/homeland`.
3. Upload file release mới.
4. Không upload vào `/docker/mediaslution-web`.
5. Không upload vào `/docker/homeland-cloudflared` trừ khi đang cập nhật tunnel.

SSH vào NAS:

```bash
cd /volume1/docker/homeland
ls -lh homeland-source-v3.0.3.zip
```

Giải nén vào thư mục tạm:

```bash
mkdir -p /volume1/docker/homeland/releases/v3.0.3
unzip homeland-source-v3.0.3.zip -d /volume1/docker/homeland/releases/v3.0.3
```

Kiểm tra bên trong có source:

```bash
ls -la /volume1/docker/homeland/releases/v3.0.3
```

Đồng bộ source mới vào thư mục chạy hiện tại, nhưng giữ lại `.env.public-production`:

```bash
rsync -av \
  --exclude='.env' \
  --exclude='.env.public-production' \
  --exclude='backups/' \
  --exclude='storage/' \
  --exclude='.codex-backups/' \
  /volume1/docker/homeland/releases/v3.0.3/ \
  /volume1/docker/homeland/
```

Nếu file zip giải nén ra thêm một thư mục con, ví dụ `/volume1/docker/homeland/releases/v3.0.3/homeland-saas/`, dùng đường dẫn đó làm source:

```bash
rsync -av \
  --exclude='.env' \
  --exclude='.env.public-production' \
  --exclude='backups/' \
  --exclude='storage/' \
  --exclude='.codex-backups/' \
  /volume1/docker/homeland/releases/v3.0.3/homeland-saas/ \
  /volume1/docker/homeland/
```

Sau đó cập nhật version trong `.env.public-production` như phần 4.4 và chạy:

```bash
docker compose --env-file .env.public-production -f docker-compose.public-production.yml up -d --build api web notification_worker
```

### 5.2. Upload Docker image `.tar`

Cách này nhanh hơn nếu image đã được build sẵn ở máy khác.

Ví dụ có 2 file:

```text
homeland-api-v3.0.3.tar
homeland-web-v3.0.3.tar
```

Upload vào:

```text
/volume1/docker/homeland/images
```

Tạo thư mục nếu chưa có:

```bash
mkdir -p /volume1/docker/homeland/images
```

Load image:

```bash
cd /volume1/docker/homeland/images

docker load -i homeland-api-v3.0.3.tar
docker load -i homeland-web-v3.0.3.tar
```

Kiểm tra image:

```bash
docker images | grep homeland
```

Cập nhật `.env.public-production`:

```ini
APP_VERSION="v3.0.3"
API_TAG="v3.0.3"
WEB_TAG="v3.0.3"
```

Nếu compose đang dùng image local dạng:

```yaml
image: homeland-api:${APP_VERSION}
image: homeland-web:${APP_VERSION}
```

thì chỉ cần:

```bash
cd /volume1/docker/homeland
docker compose --env-file .env.public-production -f docker-compose.public-production.yml up -d api web notification_worker
```

Nếu compose đang build từ source, có thể vẫn cần source tương ứng để build. Khi dùng image `.tar`, nên chuẩn hóa compose để ưu tiên image đã load sẵn.

## 6. Kiểm tra sau update

Kiểm tra container:

```bash
docker compose --env-file .env.public-production -f docker-compose.public-production.yml ps
```

Kiểm tra API health:

```bash
curl -fsS https://homeland.ductinh.one/api/v1/health/ready
```

Kiểm tra build info:

```bash
curl -fsS https://homeland.ductinh.one/api/v1/health/build-info
```

Kiểm tra trang web:

```text
https://homeland.ductinh.one/login
https://homeland.ductinh.one/buildings
```

Đăng nhập admin và kiểm tra:

- Trang Tòa nhà có dữ liệu.
- Các tòa nhà `LK01-31`, `LK01-32`, `LK08-24`, `LK08-25` hiển thị.
- API không báo lỗi 500.
- Cloudflare Tunnel vẫn route đúng domain `homeland.ductinh.one`.

Kiểm tra log:

```bash
docker compose --env-file .env.public-production -f docker-compose.public-production.yml logs --tail=200 api
docker compose --env-file .env.public-production -f docker-compose.public-production.yml logs --tail=200 web
docker compose --env-file .env.public-production -f docker-compose.public-production.yml logs --tail=200 notification_worker
```

## 7. Nếu sau update không có dữ liệu tòa nhà

Kiểm tra API buildings:

```bash
curl -fsS https://homeland.ductinh.one/api/v1/health/ready
```

Nếu login được nhưng `/buildings` báo không có dữ liệu, có thể database chỉ có schema nhưng chưa có cấu trúc tòa nhà/phòng.

Không chạy reset.

Không chạy:

```bash
./reset-public-production.sh
npm run db:reset:prod
docker compose down -v
```

Hướng xử lý an toàn:

1. Kiểm tra database hiện tại có dữ liệu thật không.
2. Nếu là môi trường mới/trống, chạy seed cấu trúc an toàn hoặc tạo lại building/floor/room.
3. Nếu là môi trường đã vận hành, khôi phục từ backup thay vì seed dữ liệu mẫu.

## 8. Rollback khi update lỗi

Nếu update lỗi nhưng database chưa bị migration phá vỡ, có thể rollback code/image.

### 8.1. Rollback bằng Git

```bash
cd /volume1/docker/homeland
git checkout v3.0.2
```

Cập nhật `.env.public-production` về version cũ:

```ini
APP_VERSION="v3.0.2"
API_TAG="v3.0.2"
WEB_TAG="v3.0.2"
RUN_DB_MIGRATIONS="false"
```

Chạy lại:

```bash
docker compose --env-file .env.public-production -f docker-compose.public-production.yml up -d --build api web notification_worker
```

### 8.2. Rollback bằng backup source/upload

Nếu có bản release cũ:

```bash
rsync -av /volume1/docker/homeland/releases/v3.0.2/ /volume1/docker/homeland/
docker compose --env-file .env.public-production -f docker-compose.public-production.yml up -d --build api web notification_worker
```

### 8.3. Rollback database

Chỉ restore database khi thật sự cần, vì restore sẽ ghi đè dữ liệu hiện tại về thời điểm backup.

Ví dụ restore từ backup SQL:

```bash
cat /volume1/docker/homeland/backups/backup-file.sql | \
docker compose --env-file .env.public-production -f docker-compose.public-production.yml exec -T postgres \
  psql -U homeland -d homeland
```

Trước khi restore database production, nên dừng API/Web/worker để tránh ghi dữ liệu trong lúc restore:

```bash
docker compose --env-file .env.public-production -f docker-compose.public-production.yml stop api web notification_worker
```

Sau restore:

```bash
docker compose --env-file .env.public-production -f docker-compose.public-production.yml up -d api web notification_worker
```

## 9. Dọn dẹp sau update

Chỉ dọn image cũ khi hệ thống đã chạy ổn vài ngày.

Xem dung lượng:

```bash
docker system df
```

Xem image:

```bash
docker images | grep homeland
```

Xóa image cũ cụ thể, không xóa volume:

```bash
docker rmi homeland-api:v3.0.1
docker rmi homeland-web:v3.0.1
```

Không dùng:

```bash
docker system prune -a --volumes
```

vì có thể xóa volume dữ liệu.

## 10. Checklist nhanh mỗi lần update

Trước update:

- [ ] Đang ở `/volume1/docker/homeland`.
- [ ] Không thao tác trong `/volume1/docker/mediaslution-web`.
- [ ] Backup database đã tạo và file backup không rỗng.
- [ ] Backup `.env.public-production` đã tạo.
- [ ] Version mới đã xác định rõ, ví dụ `v3.0.3`.
- [ ] Biết bản update có migration DB hay không.

Trong update:

- [ ] Không chạy `down -v`.
- [ ] Không chạy reset production.
- [ ] Không sửa secret/token nếu không cần.
- [ ] Nếu bật `RUN_DB_MIGRATIONS=true`, chỉ dùng một lần.

Sau update:

- [ ] Container `api`, `web`, `notification_worker`, `postgres`, `redis` đang chạy.
- [ ] `RUN_DB_MIGRATIONS=false`.
- [ ] `health/ready` trả READY.
- [ ] `health/build-info` đúng version mới.
- [ ] Login được.
- [ ] Trang `/buildings` có dữ liệu.
- [ ] Cloudflare Tunnel vẫn route `homeland.ductinh.one` đúng app HomeLand.

## 11. Khuyến nghị quy trình lâu dài

Nên chuẩn hóa release theo một trong hai hướng:

### Hướng A — NAS tự build từ source

- Upload source hoặc pull từ repo.
- NAS chạy `docker compose up -d --build`.
- Ưu điểm: đơn giản, ít bước.
- Nhược điểm: tốn dung lượng build cache và CPU/RAM NAS.

### Hướng B — Build image ở máy khác, NAS chỉ `docker load`

- Build image ở máy mạnh hơn.
- Export image `.tar`.
- Upload image lên NAS.
- NAS chạy `docker load` rồi `docker compose up -d`.
- Ưu điểm: NAS nhẹ hơn, update nhanh hơn.
- Nhược điểm: cần pipeline đóng gói image chuẩn.

Với NAS có ổ 3TB, cả hai cách đều dùng được. Nếu muốn update nhanh, ổn định và ít rủi ro nhất, nên dùng hướng B cho production.

