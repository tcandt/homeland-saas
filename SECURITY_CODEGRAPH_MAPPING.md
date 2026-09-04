# HomeLand Security CodeGraph Mapping

Ngay 2026-09-04. Pham vi: review source code local, khong pentest live site. Repo hien khong co thu muc `.codegraph`, nen mapping nay duoc lap bang static review theo luong code thay cho CodeGraph index.

## Executive Summary

| ID | Severity | Attack surface | Core risk | Trang thai |
| --- | --- | --- | --- | --- |
| VULN-001 | Critical | Next API `/api/expense-bills/*` | Public upload/read/delete hoa don, khong auth/tenant binding | Can fix ngay |
| VULN-002 | High | Nest API `/api/v1/documents/storage*`, `/api/v1/settings/file` | Public file read theo storage path, de lo tai lieu/CCCD/hop dong neu URL/path bi lo | Can thiet ke lai access control |
| VULN-003 | High | Frontend auth storage | Access/refresh token trong localStorage va password trong sessionStorage | Can chuyen sang HttpOnly cookie |
| VULN-004 | High | Next API `/api/export-contract`, `/api/export-ct01` | Public export PII/document generation, log payload nhay cam, hardcoded CCCD/bank data | Can dua qua backend auth |
| VULN-005 | High | Zalo webhook | Single-tenant auto-heal chap nhan secret moi tu request public | Can tat auto-heal production |
| VULN-006 | Medium | List endpoints | `sort` user-controlled dua vao Prisma `orderBy` | Can allowlist field sort |
| VULN-007 | Medium | Auth team provisioning | Temporary password mac dinh/co toi thieu 6 ky tu | Can password random/one-time invite |
| VULN-008 | Medium | System update/backup | Chuc nang backup/delete/restore rong gan voi `setting.update` | Can tach permission/admin gate |
| VULN-009 | Low-Medium | AI chat | User co the gui role `system/tool`; tool call parse tu model output | Can sanitize roles va dung function calling that |

## Security Boundary Map

```text
Internet
  -> Next.js web routes: apps/web/app/api/*
       -> khong qua Nest global guards
       -> local filesystem / external AI / document conversion

  -> Nest API /api/v1/*
       -> GeoIpGuard -> ThrottlerGuard -> JwtAuthGuard -> PermissionsGuard
       -> Public() bo qua JwtAuthGuard + PermissionsGuard
       -> PrismaService.tx tenant scoping chi ap dung khi co CLS tenantId

Browser
  -> zustand auth-storage in localStorage
  -> mobile recovery credentials in sessionStorage
  -> Authorization: Bearer token to Nest API
```

## VULN-001: Public Expense Bill Object Store

**Code path**

```text
apps/web/components/finance/ExpenseTable.tsx
  -> fetch("/api/expense-bills")
  -> apps/web/app/api/expense-bills/route.ts:9
  -> apps/web/app/api/expense-bills/[filename]/route.ts:15,39
  -> apps/web/lib/server/expense-bill-storage.ts:23
```

**Bang chung code**

- `apps/web/app/api/expense-bills/route.ts:9` nhan `POST` multipart nhung khong doc/verify `Authorization`.
- `apps/web/app/api/expense-bills/[filename]/route.ts:15` public `GET` doc file theo filename.
- `apps/web/app/api/expense-bills/[filename]/route.ts:39` public `DELETE` xoa file theo filename.
- `apps/web/lib/server/expense-bill-storage.ts:23` chong path traversal bang `basename`, nhung khong gan file voi tenant/user/expense.

**Impact**

Bat ky nguoi nao co URL co the xem hoa don. Neu doan duoc filename hoac lay tu UI/log, co the xoa anh hoa don. Upload public cung co the bi dung lam disk-fill/abuse do khong co auth/rate-limit rieng.

**Fix**

- Chuyen upload/read/delete sang Nest API hoac them verifier chung cho Next route.
- File phai co metadata `{ tenantId, expenseId, uploadedBy }`; doc/xoa can kiem tra user co `finance.read`/`finance.update` va expense cung tenant.
- Bo `DELETE` public; chi cho xoa qua action da audit.
- Them rate limit va scan mime bang magic bytes, khong chi tin `file.type`.

## VULN-002: Public Document/Settings Storage Read

**Code path**

```text
apps/api/src/documents/documents.controller.ts:38,50,64
  -> storageProvider.read(normalizedPath)
  -> apps/api/src/documents/providers/storage/local-storage.provider.ts:57

apps/api/src/settings/settings.controller.ts:30
  -> storageProvider.read(normalizedPath)
```

**Bang chung code**

- `@Public()` tren `documents/storage/*`, `documents/storage-link`, `documents/storage` tai `documents.controller.ts:38-65`.
- `@Public()` tren `settings/file` tai `settings.controller.ts:30-31`.
- `local-storage.provider.ts:57-72` dam bao path nam trong `STORAGE_DIR`, nhung khong kiem tra path co thuoc tenant cua requester vi endpoint public khong co requester.
- `Cache-Control: public, max-age=31536000, immutable` tai `documents.controller.ts:43-45` va `settings.controller.ts:47-49`.

**Impact**

Storage URL dang co tenant segment va random prefix, nhung neu URL bi lo qua UI, log, referrer, screenshot, message, hoac browser history thi file co the duoc tai ma khong can dang nhap. Voi hop dong/CCCD/hoa don, day la leak PII.

**Fix**

- Mac dinh document storage private. Download qua `/documents/:id/download` da co `document.download`.
- Neu can public link, tao signed URL ngann han voi scope cu the, expiry, revocation va audit.
- Tach settings asset public (logo) voi settings asset private (avatar/internal file).
- Doi cache header cho private file: `Cache-Control: no-store` hoac signed URL co TTL ngan.

## VULN-003: Client-Side Token/Password Storage

**Code path**

```text
apps/web/lib/auth/auth-store.ts:17
  -> persist auth-storage in localStorage
apps/web/lib/api/client.ts:30-38,187-195
  -> read access/refresh token and call /auth/refresh
apps/web/lib/auth/mobile-session-recovery.ts:22-32
  -> save emailOrPhone + password in sessionStorage
apps/web/app/login/page.tsx:90-91
  -> saveMobileLoginCredentials when rememberMe
```

**Impact**

XSS nho, third-party script compromised, browser extension, hoac shared-device attack co the lay access token, refresh token, va tren mobile co the lay plaintext password trong sessionStorage.

**Fix**

- Access token chi giu memory; refresh token trong `HttpOnly; Secure; SameSite=Lax/Strict` cookie.
- Bo mobile password recovery bang plaintext. Neu can UX mobile, dung refresh cookie + silent refresh.
- Them CSP chat: khong inline script, nonce/hash neu bat buoc; audit `dangerouslySetInnerHTML` trong `apps/web/app/layout.tsx:31`.

## VULN-004: Public Document Export/PII Generation

**Code path**

```text
apps/web/components/contracts/PreviewContractModal.tsx
  -> fetch("/api/export-contract?format=pdf")
  -> apps/web/app/api/export-contract/route.ts:25

apps/web/app/api/export-ct01/route.ts:24
apps/web/app/api/export-compiled-pdf/route.ts:187
```

**Bang chung code**

- `export-contract/route.ts:25` va `export-ct01/route.ts:24` khong verify auth.
- `export-contract/route.ts:26` log full payload: `console.log('--- EXPORT CONTRACT PAYLOAD ---', data)`.
- `export-contract/route.ts:43-62` va `export-ct01/route.ts:55` hardcode CCCD/phone/bank/landlord identity.
- `export-contract/route.ts:157,181` va `export-compiled-pdf/route.ts:76,86,94` goi `execSync` de convert docx/pdf.

**Impact**

Public endpoint co the bi dung de sinh tai lieu co PII/hardcoded landlord identity, spam CPU/LibreOffice/Word conversion, va payload nhay cam co the vao logs.

**Fix**

- Dua export vao Nest backend co JWT + permission (`contract.read`/`document.create`).
- Bo log payload thua, redact CCCD/phone/address.
- Khong hardcode CCCD/bank trong source; lay tu encrypted settings theo tenant va chi expose khi permission hop le.
- Queue/rate limit conversion; dung temp file name an toan va timeout rieng cho process.

## VULN-005: Zalo Webhook Single-Tenant Auto-Heal Secret

**Code path**

```text
apps/api/src/communication/communication.controller.ts:174
  -> public POST zalo/webhook
  -> settings.findMany(key='zalo-provider')
  -> auto-heal if settings.length === 1 and providedSecret.length >= 32
```

**Bang chung code**

- `communication.controller.ts:200-217` tu dong cap nhat `webhookSecret` bang secret tu request public neu chi co 1 tenant setting.

**Impact**

Trong deployment single tenant, attacker co the gui request voi secret dai 32 ky tu de "claim" webhook secret neu secret hien tai khong match. Sau do request tiep theo voi secret do co the duoc chap nhan va di vao business handling.

**Fix**

- Xoa auto-heal tren production. Neu can migration, chi cho phep qua admin-authenticated endpoint.
- Match theo tenant/provider identifier co ky HMAC, khong scan tat ca tenant settings.
- Luu webhook rejected preview khong chua PII, va rate-limit public webhook theo IP/provider.

## VULN-006: User-Controlled Prisma `orderBy`

**Code path**

```text
packages/shared/src/pagination/pagination.dto.ts:7
  -> sort: z.string()
apps/api/src/buildings/buildings.service.ts:97
apps/api/src/rooms/rooms.service.ts:38
apps/api/src/invoices/invoices.service.ts:63
apps/api/src/contracts/contracts.service.ts:129
apps/api/src/customers/customers.service.ts:613
apps/api/src/deposits/deposits.service.ts:336
apps/api/src/sales/sales.service.ts:52
```

**Impact**

Khong phai SQL injection truc tiep vi Prisma structured API, nhung attacker co the gui sort field la relation/field khong hop le de gay 500, do schema, hoac query ton kem. Day la DoS nhe va information disclosure qua error pattern.

**Fix**

- Moi module can `allowedSortFields`.
- Neu field khong trong allowlist thi fallback default hoac 400.
- Giam max `limit` chung tu 5000 xuong theo tung view; nhieu endpoint list dang include nested PII.

## VULN-007: Weak Temporary Team Password Flow

**Code path**

```text
packages/shared/src/auth/auth.dto.ts:37-47
apps/api/src/auth/auth.service.ts:536-568
apps/api/src/auth/auth.service.ts:641-668
```

**Impact**

`temporaryPassword` toi thieu 6 ky tu, default `Homeland@123`, user tao ra `ACTIVE` + `mustChangePassword`. Neu mat khau tam bi gui qua kenh khong an toan, attacker co the login truoc user that va defer password change cho phien.

**Fix**

- Bo default password co dinh.
- Sinh invite token one-time, TTL ngan, required set password lan dau.
- Temporary password neu bat buoc: random >= 16 chars, show mot lan, audit va lock sau N lan sai theo account + IP.

## VULN-008: Over-Broad System Update/Backup Permissions

**Code path**

```text
apps/api/src/system-update/system-update.controller.ts:49-89
apps/api/src/system-update/system-update.service.ts:270-589
```

**Impact**

`wipe-data`, backup restore/delete deu gan voi `setting.update`. Mat hoac bi cap quyen setting.update co the thanh destructive admin tren du lieu tenant. `install/rollback` co email gate `admin@homeland.vn`, nhung backup/wipe khong co gate tuong duong.

**Fix**

- Tao permission rieng: `system.backup.create`, `system.backup.restore`, `system.data.wipe`, `system.update.run`.
- Bat buoc step-up auth + MFA/confirm challenge cho destructive actions.
- Delete/restore snapshot phai validate snapshotId theo allowlist tu manifest, khong chi join path.

## VULN-009: AI Chat Role/Tool Surface

**Code path**

```text
apps/api/src/ai/dto/chat.dto.ts:1
apps/api/src/ai/ai.controller.ts:20-34,104-113,138-145
apps/api/src/ai/agents/agent-router.service.ts:54-107
```

**Bang chung code**

- DTO cho phep user gui role `system`, `tool`, `data`.
- `getConversationDetails` dung `findUnique({ where: { id } })`; tenant scoping dua vao Prisma extension neu CLS tenantId ton tai.
- Tool call parse tu markdown JSON trong model output, khong phai native tool/function calling.

**Impact**

Prompt injection/role injection co the lam agent bo qua safety instructions. Hien tai tool mau con nhe, nhung khi them tool co side effect, rui ro se tang nhanh.

**Fix**

- Server chi chap nhan user messages tu client; tu choi `system/tool/assistant`.
- Dung native tool calling voi schema validation, khong parse markdown.
- Permission check can ho tro alias giong `PermissionsGuard` hoac centralize lai.
- Ep tenant condition ro rang cho AI conversation thay vi phu thuoc CLS: `{ id, tenantId, userId }`.

## Suggested Fix Order

1. Khoa public Next API routes: `expense-bills`, `export-*`, `extract-cccd`, `detect-corners`, `learning/v1` bang auth/rate-limit hoac dua ve backend.
2. Doi document/settings storage sang private-by-default, chi signed URL ngan han.
3. Chuyen auth storage sang HttpOnly cookie, xoa password session recovery.
4. Tat Zalo auto-heal secret trong production.
5. Them allowlist sort/limit va permission rieng cho system-update destructive operations.

## Verification Checklist

- Unauthenticated request den `/api/expense-bills`, `/api/export-contract`, `/api/export-ct01`, `/api/extract-cccd` phai tra `401/403`.
- User tenant A khong doc duoc document/expense asset tenant B ke ca khi biet URL/path.
- Browser devtools khong thay refresh token/password trong `localStorage`/`sessionStorage`.
- Public webhook chi accept secret da cau hinh truoc; khong auto-update secret tu request.
- Fuzz `sort=__proto__`, `sort=tenant`, `sort=roles` khong tao 500.
