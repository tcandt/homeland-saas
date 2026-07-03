# Hướng Dẫn Verification Phase 2.1 (Backend Setup)

Tài liệu này hướng dẫn cách verify môi trường Monorepo và Database (dùng SQLite cục bộ) trước khi chuyển sang xây dựng Core API.

## Lệnh ngắn nhất cần chạy
Bạn chỉ cần mở Terminal tại gốc thư mục `d:\homeland-new\homeland-saas` và chạy 3 lệnh sau:

```bash
npm install
npm run phase2:verify
```

Sau khi lệnh verify hoàn tất (và backend đang chạy), bạn có thể test Health API.

---

## Cách chạy chi tiết theo từng môi trường

### 1. Dành cho CMD
Mở Command Prompt (cmd.exe) và chạy:
```cmd
cd d:\homeland-new\homeland-saas
scripts\phase2-verify.cmd
```

### 2. Dành cho PowerShell
Mở PowerShell và chạy:
```powershell
cd d:\homeland-new\homeland-saas
.\scripts\phase2-verify.ps1
```
*(Script này đã tự động chèn Bypass Execution Policy để không bị chặn).*

---

## Kiểm tra Health API
Sau khi backend đã start ở cổng `3001`, mở terminal mới và chạy:
```bash
# Nếu có curl:
curl http://localhost:3001/api/v1/health

# Nếu dùng PowerShell:
Invoke-RestMethod http://localhost:3001/api/v1/health
```
Hoặc truy cập trực tiếp link trên trình duyệt. Kết quả phải là: `{"status":"OK", ...}`.

---

## 🛠 Cách xử lý lỗi thường gặp

### 1. "npm script disabled" hoặc "running scripts is disabled on this system"
**Xử lý:** Mở PowerShell bằng quyền Admin và chạy:
`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy Bypass -Force`

### 2. "prisma command not found"
**Xử lý:** Chắc chắn bạn đã chạy `npm install` ở thư mục root để cài các package vào workspace. Nếu lỗi vẫn tiếp diễn, hãy gọi qua npx:
`npx prisma db push --schema=packages/database/prisma/schema.prisma`

### 3. "workspace api not found"
**Xử lý:** Kiểm tra lại file `package.json` xem mảng `workspaces` có đúng là `["apps/*", "packages/*"]` hay chưa. Chạy lại `npm install` để link lại các workspace.

### 4. Lỗi "EADDRINUSE: port 3001 already in use"
**Xử lý:** Đang có một tiến trình khác chạy đè lên port 3001. Tìm và kill tiến trình đó (trên Windows: `netstat -ano | findstr :3001` và `taskkill /PID <PID> /F`).

### 5. "Seed failed" hoặc không tìm thấy toà nhà
**Xử lý:** File seed có thể đã bị lỗi lúc build hoặc chưa cài `ts-node`. Chạy lệnh `npm install ts-node typescript -g` hoặc kiểm tra log lỗi trong console. Nếu chạy bằng npm script, hãy chắc chắn `tsx` đã được cài (`npm i tsx -D` ở root).

### 6. "SQLite dev.db path issue"
**Xử lý:** Nếu prisma không thể ghi file `dev.db`, hãy đảm bảo biến môi trường trong `.env` chuẩn xác:
`DATABASE_URL="file:./dev.db"` (Được hiểu là lưu dev.db tại thư mục `packages/database/prisma/dev.db`).
