# Zalo Production Webhook Checklist

Ngay luc nay, neu VPS khong lay duoc `chatId` nhom admin, can kiem tra theo dung thu tu duoi day.

## Ket luan ky thuat da duoc xac nhan

- Route `POST /api/v1/notifications/zalo/webhook` cua HomeLand hoat dong.
- Domain `https://homeland.ductinh.one` nhan duoc request vao API.
- Secret webhook duoc xac thuc dung.
- API ghi duoc `lastWebhookChatId`, `lastWebhookReceivedAt`, `recentWebhookChats` vao database khi co webhook hop le.

Dieu nay co nghia la: neu production van khong co `chatId` that, van de nam o luong su kien webhook tu Zalo di vao VPS, khong nam o route webhook cua HomeLand nua.

## Checklist xu ly

1. Xac nhan webhook dang tro dung domain production
   - Webhook URL phai la:
     - `https://homeland.ductinh.one/api/v1/notifications/zalo/webhook`
   - Khong duoc tro ve `localhost`, `127.0.0.1`, domain tunnel cu, hoac domain test.

2. Xac nhan secret header khop 100%
   - Header bat buoc:
     - `x-bot-api-secret-token`
   - Gia tri header phai giong voi `webhookSecret` dang luu trong cau hinh Zalo cua HomeLand.
   - Neu sai secret, API se tra:
     - `ZALO_WEBHOOK_SECRET_INVALID`

3. Xac nhan HomeLand da nhan webhook that hay chua
   - Mo trang cau hinh Zalo.
   - Kiem tra cac truong:
     - `Last webhook received`
     - `Last webhook chat`
     - `Recent webhook chats`
   - Neu 3 muc nay van rong sau khi nhan tin trong group, co nghia la Zalo chua gui su kien vao VPS.

4. Thu gui webhook thu cong de loai tru phia HomeLand
   - Gui `POST` thu cong vao:
     - `https://homeland.ductinh.one/api/v1/notifications/zalo/webhook`
   - Neu request thu cong duoc luu vao DB, chung minh HomeLand route/API/DB van tot.

5. Kiem tra bot da nam trong dung nhom admin chua
   - Bot phai da duoc them vao group can ket noi.
   - Nguoi quan tri can nhan tin truc tiep trong chinh group do.
   - Nen thu:
     - `/id`
     - `/chatid`
     - `/setadmin <CODE>`

6. Xac nhan su kien group co thuc su duoc Zalo phat ra
   - Ban local + tunnel da nhan duoc, nhung VPS khong nhan duoc, thi kha nang cao la kenh webhook production tu Zalo chua thuc su goi vao domain VPS.
   - Can kiem tra trong Zalo developer console neu co delivery log, retry log, webhook history hoac event status.

7. Kiem tra tunnel/proxy chi la yeu to phu tro, khong phai dich webhook
   - Web app chi can public qua `localhost:49187`.
   - API webhook production dang duoc proxy qua web domain.
   - Khong can tro webhook Zalo vao `localhost:49188` truc tiep.

8. Kiem tra co dang dua vao du lieu test hay khong
   - `group-test-001`, `group-test-prod` la ID gia lap, khong phai `chatId` that cua Zalo.
   - He thong chi co the gan `adminGroupChatId` khi nhan duoc payload that tu Zalo.

9. Kiem tra tinh huong `getUpdates` khong co su kien
   - Neu log co `error_code=408` va `Request timeout`, do la polling timeout, khong phai loi nghiem trong.
   - Patch moi da chuyen truong hop nay thanh ket qua rong thay vi nem loi.
   - Nghia la nut auto-detect se on dinh hon, nhung van can du lieu su kien that tu Zalo de bat duoc nhom admin.

10. Cach ket luan nhanh nhat
   - Neu webhook thu cong vao production luu DB thanh cong.
   - Nhung nhan tin that trong group admin van khong tao `recentWebhookChats`.
   - Thi phai xu ly tiep o phia Zalo delivery / event permission / webhook configuration production.

## Lenh kiem tra de dung tren VPS

```bash
docker compose --env-file .env.public-production -f docker-compose.public-production.yml ps
docker logs homeland_production_api 2>&1 | grep -n "connect-webhook\|auto-detect-admin-group\|Accepted Zalo webhook\|Rejected Zalo webhook\|getUpdates"
curl -sS https://homeland.ductinh.one/api/v1/notifications/zalo/webhook/health
docker exec -i homeland_production_postgres psql -U homeland -d homeland -c "select key, value from \"AppSetting\" where key='zalo-provider';"
```

## Hanh dong uu tien tiep theo

1. Deploy patch `getUpdates` moi len VPS.
2. Gui lai tin nhan that trong group admin.
3. Neu `lastWebhookReceivedAt` van khong thay doi, chot ket luan: production khong nhan duoc webhook that tu Zalo.
