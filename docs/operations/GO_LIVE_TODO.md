# HomeLand Go-Live TODO

Ngày cập nhật: 2026-08-13
Trạng thái: **LOCAL RELEASE CANDIDATE PASS / LIVE NO-GO**

Đây là nguồn theo dõi duy nhất cho các việc còn lại trước LIVE. Các checklist khác phải dẫn chiếu về file này; không tự đánh dấu LIVE ở tài liệu khác nếu P0 trong file này chưa hoàn thành.

## 1. Quy ước theo dõi

| Giá trị | Ý nghĩa |
|---|---|
| `[x]` | Hoàn thành và đã có bằng chứng kiểm tra được |
| `[ ]` | Chưa hoàn thành |
| `BLOCKED` | Chưa thể làm do thiếu phê duyệt, credential, hạ tầng hoặc bên thứ ba |
| `P0` | Bắt buộc hoàn thành trước khi mở traffic production |
| `P1` | Bắt buộc hoàn thành trước khi kết thúc hypercare hoặc vận hành ổn định |

Owner trong file là vai trò chịu trách nhiệm đề xuất, không phải xác nhận người đã nhận việc:

- `TL`: technical lead/release owner.
- `SEC`: security owner.
- `DEV`: đội phát triển.
- `INFRA`: hạ tầng/DevOps.
- `DBA`: người chịu trách nhiệm PostgreSQL/Redis/backup.
- `INT`: người chịu trách nhiệm SePay/Hunonic/Zalo/Telegram/SMTP.
- `OPS`: quản lý vận hành.
- `SALES`: nhân sự đặt cọc, hợp đồng và chăm sóc khách thuê.
- `FIN`: kế toán/đối soát.
- `OWNER-A`, `OWNER-B`: hai chủ sở hữu.

Mỗi mục chỉ được đổi sang `[x]` khi đủ `Definition of Done` và đường dẫn/ID bằng chứng. Không đưa password, token, cookie, private key, CCCD, thông tin bank đầy đủ hoặc dữ liệu khách hàng vào Git hay ảnh chụp công khai.

## 2. Baseline đã hoàn thành

| ID | Trạng thái | Kết quả |
|---|---|---|
| `DONE-01` | [x] | API typecheck/unit PASS `195/195`; Web typecheck/unit PASS `49/49` |
| `DONE-02` | [x] | Production bundle, health và readiness local PASS |
| `DONE-03` | [x] | Desktop Playwright PASS `47/47` |
| `DONE-04` | [x] | Chromium mobile `430/390/375` PASS `18/18`, tổng 168 lượt render light/dark |
| `DONE-05` | [x] | Persona/RBAC PASS cho `admin`, `adminA`, `adminB`, `manager` trên release-gate DB |
| `DONE-06` | [x] | Vòng đời cọc -> hợp đồng -> hóa đơn -> quyết toán -> trả phòng PASS |
| `DONE-07` | [x] | Safety/preflight tests PASS `21/21` sau khi liên kết central go-live TODO |
| `DONE-08` | [x] | Runbook baseline database rỗng và 7 checksum migration đã review |
| `DONE-09` | [x] | SBOM workflow, Gitleaks guard và runtime audit policy đã có trong CI |
| `DONE-10` | [x] | Các mốc `d6e392c`, `04f7cdd`, `e3633b1` đã push lên `origin/main` |

Các kết quả trên chứng minh release candidate local. Chúng không thay thế staging, credential thật, giao dịch thật, backup/restore và phê duyệt GO.

### Tổng quan phần còn lại

Không xem toàn bộ dòng chưa hoàn thành là lỗi code. Baseline local đã hoàn tất 10 mốc; phần còn lại chủ yếu là cấp hạ tầng/credential, nghiệm thu với dữ liệu thật, diễn tập vận hành và ký duyệt. Trạng thái chỉ được cập nhật khi có evidence tương ứng.

| Workstream | P0 còn mở | Đang BLOCKED | Kết luận hiện tại |
|---|---:|---:|---|
| Governance/phạm vi phát hành | 5 | 0 | Chưa gán người thật và lịch go-live |
| Security/runtime/supply chain | 6 | 3 | Chờ GitHub, phê duyệt runtime và triage audit |
| Hạ tầng production/staging | 14 | 0 | Chưa có production topology và staging immutable |
| Dữ liệu/backup/restore | 9 | 0 | Chưa có inventory, off-host backup và restore drill |
| SePay/hai ngân hàng | 7 | 0 | Chưa nghiệm thu giao dịch thật và đối soát hai owner |
| Hunonic/điện/giá điện | 7 | 0 | Chưa nghiệm thu key mới, mapping, sync và giá bằng dữ liệu thật |
| Zalo/Telegram/SMTP | 5 | 0 | Chưa nghiệm thu gửi, retry và escalation trên môi trường thật |
| UAT nghiệp vụ/kế toán/persona/thiết bị | 10 | 0 | Chưa ký staging acceptance và chưa test thiết bị thật |
| Account/bàn giao/audit | 5 | 0 | Chưa cấp credential production riêng cho từng người |
| Monitoring/incident readiness | 6 | 0 | Chưa có dashboard, on-call và diễn tập cảnh báo |
| Cutover/mở traffic | 10 | 0 | Chỉ thực hiện sau khi mọi P0 phía trên PASS |
| **Tổng P0** | **84** | **3** | **87 mục chưa hoàn thành; LIVE NO-GO** |

Sau LIVE còn 10 mục P1 hypercare từ T+1 giờ đến T+30 ngày/định kỳ. Những mục này không thay thế bất kỳ P0 nào trước khi mở traffic.

## 3. Critical path bắt buộc

Thực hiện theo thứ tự. Một phase không được coi là đạt nếu dependency ở phase trước chưa hoàn thành.

1. Governance và security/runtime.
2. Hạ tầng production và staging.
3. Dữ liệu ban đầu, backup và restore drill.
4. Nghiệm thu SePay, Hunonic và notification.
5. UAT nghiệp vụ/kế toán/persona trên staging.
6. Cutover, smoke production và quyết định GO/NO-GO.
7. Hypercare 24 giờ và ổn định 7 ngày.

## 4. P0 - Governance và phạm vi phát hành

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `GOV-01` | [ ] | TL, OWNER-A, OWNER-B | Không | Chỉ định release owner, security owner, DBA, integration owner, người GO/NO-GO và người rollback | Biên bản có tên, số liên hệ, vai trò chính/dự phòng; mọi vai trò đã xác nhận nhận việc |
| `GOV-02` | [ ] | TL, OPS | `GOV-01` | Chọn ngày/giờ go-live, change-freeze, thời lượng maintenance và cửa sổ rollback | Lịch phát hành đã được hai owner và vận hành chấp thuận; có múi giờ và deadline quyết định NO-GO |
| `GOV-03` | [ ] | TL | Security + staging PASS | Chốt release SHA/version/image tag immutable sau cùng | SHA trên Git bằng SHA build-info; API/Web image digest được ghi vào release record |
| `GOV-04` | [ ] | TL | `GOV-03` | Mở evidence package ngoài Git cho release | Có thư mục/record chứa CI, security, backup, staging, UAT, integration, GO/NO-GO; không chứa secret/PII |
| `GOV-05` | [ ] | TL, FIN, OPS | Toàn bộ P0 | Tổ chức cuộc họp GO/NO-GO | Checklist P0 100%, rủi ro còn lại được chấp nhận bằng văn bản, có chữ ký TL/FIN/OPS/OWNER-A/OWNER-B |

## 5. P0 - Security, runtime và supply chain

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `SEC-01` | `BLOCKED` | TL, SEC | Quyền GitHub | Mở GitHub Actions mới nhất của HEAD và xác nhận mọi required job | Lưu run ID/URL; lint, typecheck, unit, integration, build API/Web, Gitleaks, SBOM, Trivy và E2E đều PASS; không suy ra xanh từ local |
| `SEC-02` | `BLOCKED` | TL, SEC, DEV | Phê duyệt đổi phiên bản | Chốt Node runtime thống nhất cho local, CI, Docker và production | ADR ghi phiên bản được phê duyệt, tương thích Next/Nest/Prisma/Puppeteer/ZXing; Docker/CI dùng cùng major; không tự nâng khi chưa duyệt |
| `SEC-03` | `BLOCKED` | SEC, DEV | `SEC-02` | Triage `17 high`, `23 moderate`, `3 low` từ runtime audit gần nhất | Danh sách direct/transitive, đường khai thác, package owner, bản vá/mitigation và deadline; không bỏ qua high/critical bằng allowlist chung |
| `SEC-04` | [ ] | SEC, DEV | `SEC-03` | Sửa toàn bộ high/critical runtime advisory trên branch riêng | `npm audit --omit=dev` có `0 critical`, `0 high`; full regression PASS; lockfile được review; không đổi framework ngoài phạm vi phê duyệt |
| `SEC-05` | [ ] | SEC, INT | Credential Hunonic mới | Rotate Hunonic mobile signing key đã từng xuất hiện trong lịch sử Git | Key cũ bị revoke tại provider; key mới nằm trong secret manager; login/sync PASS; Gitleaks không phát hiện key mới |
| `SEC-06` | [ ] | SEC, INFRA | Secret manager | Lập inventory và rotate toàn bộ secret production | PostgreSQL, Redis, JWT, SePay, Hunonic, Zalo, Telegram, SMTP có owner, created/expiry/rotation date; không dùng giá trị example/local |
| `SEC-07` | [ ] | SEC, INFRA | `SEC-06` | Cấu hình least privilege và network access cho secret/service account | DB app user không có quyền tạo/drop database; integration token đúng scope; secret chỉ được đọc bởi service cần dùng |
| `SEC-08` | [ ] | SEC | `SEC-01` | Xử lý trạng thái CodeQL/GHAS hoặc scanner thay thế đã phê duyệt | Có kết quả SAST cho đúng SHA; P0/P1 security finding đã đóng hoặc có risk acceptance có thời hạn |
| `SEC-09` | [ ] | SEC, TL | `SEC-04..08` | Chạy security gate cuối | Gitleaks, SBOM validate, license scan, SAST, Trivy FS/image, runtime audit đều có artifact; policy job PASS |

## 6. P0 - Hạ tầng production và staging

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `INF-01` | [ ] | INFRA, TL | `GOV-01` | Chốt topology production/staging, sizing và failure domain | Sơ đồ web/API/PostgreSQL/Redis/storage/reverse proxy; CPU/RAM/disk/IOPS; staging tách credential và database production |
| `INF-02` | [ ] | INFRA | Domain được chọn | Cấu hình DNS và HTTPS cho web/API | Certificate hợp lệ, auto-renew test, TLS policy đạt, HTTP redirect HTTPS, domain hiển thị đúng build |
| `INF-03` | [ ] | DBA, INFRA | `INF-01` | Provision PostgreSQL production có extension `vector` | Database identity ghi nhận; `vector` available; app user least privilege; timezone/encoding đúng; connection limit đủ |
| `INF-04` | [ ] | DBA, INFRA | `INF-01` | Provision Redis production có auth và giới hạn mạng | Redis không public, password/TLS/VPN theo kiến trúc, persistence/eviction policy được duyệt, health PASS |
| `INF-05` | [ ] | INFRA, OPS | `INF-01` | Provision attachment/object storage | Storage root bền vững, không nằm trong container ephemeral; quota/retention/checksum/access policy được kiểm tra |
| `INF-06` | [ ] | INFRA, SEC | `INF-02..05`, `SEC-06` | Tạo production env trong secret manager | `NODE_ENV=production`, registration/Swagger tắt, HTTPS/CORS đúng, scheduler chủ động, không có secret trong repo/compose output |
| `INF-07` | [ ] | INFRA | `INF-06` | Chạy production preflight chỉ đọc | `npm.cmd run preflight:prod -- --env-file <secure-file-outside-git>` trả `Configuration: PASS`; report không in secret |
| `INF-08` | [ ] | INFRA | `INF-01` | Cấu hình firewall/reverse proxy/rate limit/body limit | Chỉ port bắt buộc được mở; webhook route hoạt động; upload hợp lệ; header correlation/proxy IP đúng; không lộ internal port |
| `INF-09` | [ ] | INFRA | `INF-01` | Đồng bộ thời gian và timezone | NTP active; timestamp DB/API/log/SePay/Hunonic cùng chuẩn; kiểm tra lệch thời gian dưới ngưỡng đã duyệt |
| `STG-01` | [ ] | INFRA, TL | `SEC-09`, `INF-01..09` | Build và deploy immutable API/Web images lên staging | Image digest gắn đúng SHA; `/health`, `/health/ready`, `/health/build-info` PASS; không dùng `latest` để nghiệm thu |
| `STG-02` | [ ] | DBA, TL | `STG-01` | Baseline/migrate staging theo runbook | Database identity đúng; baseline chỉ khi DB rỗng; `7/7` migration up to date; SQL/checksum/reviewer lưu trong evidence |
| `STG-03` | [ ] | TL, OPS | `STG-02` | Tạo account/dataset staging riêng, không seed production | Có bốn persona staging và dữ liệu UAT không chứa PII thật; password chuyển qua kênh bảo mật |
| `STG-04` | [ ] | DEV, TL | `STG-03` | Chạy toàn bộ `verify:prod` trên staging/release-gate DB | Encoding, safety, typecheck, unit, health, persona preflight, desktop `47/47`, mobile `18/18` PASS cho đúng SHA |
| `STG-05` | [ ] | INFRA, TL | `STG-04` | Diễn tập rollback application trên staging | Rollback về immutable tag trước không sửa schema dữ liệu; health/smoke PASS; thời gian rollback và owner được ghi nhận |

## 7. P0 - Dữ liệu, backup và restore

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `DAT-01` | [ ] | OPS, FIN, DBA | Staging sẵn sàng | Lập inventory dữ liệu mở đầu | Chốt owner/building/room/customer/contract/deposit/invoice/expense/meter/bank cần đưa vào production; có tổng số kỳ vọng |
| `DAT-02` | [ ] | OWNER-A, OWNER-B, OPS | `DAT-01` | Xác nhận owner-building mapping | Tính: LK01-31/LK08-25; Thể: LK01-32/LK08-24 hoặc giá trị Settings mới; hai owner ký xác nhận |
| `DAT-03` | [ ] | FIN, OWNER-A, OWNER-B | `DAT-01` | Chốt số dư đầu kỳ và công nợ | Tiền cọc đang giữ, hóa đơn chưa thu, khoản hoàn chờ, chi phí ứng hộ, tiền cần khấu trừ lợi nhuận có chứng từ và tổng kiểm soát |
| `DAT-04` | [ ] | FIN, DBA | `DAT-03` | Đối chiếu dữ liệu nguồn và dữ liệu nạp | Tổng cọc/công nợ/thu/chi theo owner và bank khớp; bản ghi trùng/thiếu được xử lý bằng script review, không sửa tay không log |
| `BKP-01` | [ ] | DBA, INFRA | Storage off-host | Chọn off-host backup destination và retention | Có encryption, immutable/version policy, quyền restore tách biệt, retention tối thiểu theo BACKUP.md |
| `BKP-02` | [ ] | DBA | `BKP-01`, staging | Tạo PostgreSQL dump và attachment manifest | Dump custom format theo timestamp; `pg_restore --list` PASS; SHA-256 và object manifest được lưu; không ghi đè backup trước |
| `BKP-03` | [ ] | DBA, TL | `BKP-02` | Restore drill trên môi trường cô lập | Restore PASS, migration status/health/smoke PASS, record count và tài chính đối chiếu đúng, RPO/RTO đo được |
| `BKP-04` | [ ] | DBA, OPS | `BKP-03` | Chốt backup schedule và owner kiểm tra | Lịch tự động, cảnh báo backup stale/fail, người kiểm tra hằng ngày/tuần và thủ tục restore được ký nhận |
| `DAT-05` | [ ] | DBA, FIN, OPS | `DAT-04`, `BKP-03` | Dry-run cutover dữ liệu trên staging | Thời lượng nằm trong maintenance window; report before/after khớp; có rollback/forward-fix plan; không dùng reset/force |

## 8. P0 - Nghiệm thu SePay và hai tài khoản ngân hàng

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `SEP-01` | [ ] | INT, SEC, OWNER-A, OWNER-B | `SEC-06`, staging | Cấu hình hai bank account và SePay credential | Mỗi bank active có owner đúng, account label/mã nhận diện đúng, secret ngoài Git, admin vận hành không sửa token |
| `SEP-02` | [ ] | INT, INFRA | `SEP-01`, HTTPS staging | Cấu hình webhook và signature validation | HTTPS endpoint nhận đúng, reject signature sai, log correlation ID, retry không tạo giao dịch trùng |
| `SEP-03` | [ ] | FIN, INT | `SEP-02` | Test giao dịch giá trị nhỏ cho OWNER-A | QR/payment code đúng bank A; webhook match đúng invoice/deposit; cash/accounting/audit cập nhật một lần |
| `SEP-04` | [ ] | FIN, INT | `SEP-02` | Test giao dịch giá trị nhỏ cho OWNER-B | QR/payment code đúng bank B; webhook match đúng invoice/deposit; cash/accounting/audit cập nhật một lần |
| `SEP-05` | [ ] | FIN, INT | `SEP-03..04` | Test thiếu, thừa, sai bank, sai nội dung, outgoing và gán tay | Mỗi tình huống vào đúng hàng chờ/trạng thái; action availability đúng; không tự ghi nhận doanh thu sai owner |
| `SEP-06` | [ ] | FIN, INT | `SEP-05` | Test hoàn tiền thừa/chờ hoàn/hoàn tất | Refund amount/note/audit đúng; không tăng cash collected; pending -> completed đúng một lần |
| `SEP-07` | [ ] | FIN, OWNER-A, OWNER-B | `SEP-03..06` | Đối soát website với sao kê hai bank | Tổng thu theo bank/owner/payment code khớp; chênh lệch bằng 0 hoặc có ticket có owner/deadline |

## 9. P0 - Nghiệm thu Hunonic, điện và giá điện

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `HUN-01` | [ ] | INT, SEC | `SEC-05`, staging | Cấu hình access/secret mới và login mobile API | Login/signed request PASS, không in token/cookie, key cũ bị revoke |
| `HUN-02` | [ ] | OPS, INT | `HUN-01`, `DAT-02` | Xác nhận mapping công tơ -> tòa/phòng | Toàn bộ meter LK01-31/LK01-32 map duy nhất; Văn Phòng LK01-32 đúng meter; orphan/duplicate bằng 0 |
| `HUN-03` | [ ] | INT, DBA | `HUN-02` | Chạy manual sync 6 tháng gần nhất | Đủ kỳ, không duplicate theo unique key, số bản ghi/room/month có report, retry idempotent |
| `HUN-04` | [ ] | INT, OPS | `HUN-03` | Chạy scheduler 1 giờ/lần tối thiểu 24 giờ staging | Không overlap job, không duplicate, last-sync/failed-sync hiển thị, lỗi provider retry có backoff/log |
| `HUN-05` | [ ] | DBA, OPS | `HUN-03` | Xác nhận retention/query 3 năm | Filter/search month/year/room/meter nhanh và đúng; backup bao phủ readings; khóa kỳ không bị sync ghi đè |
| `HUN-06` | [ ] | FIN, OPS | `HUN-02..05` | Nghiệm thu giá EVN/tự thiết lập theo một/nhiều công tơ | Mode lưu bền, giá custom không về 0, giá hiển thị toàn cột, invoice/room profile dùng cùng kết quả |
| `HUN-07` | [ ] | FIN, OPS | `HUN-06` | Đối chiếu ít nhất 3 phòng x 3 kỳ bằng tính tay | Chỉ số đầu/cuối, kWh, đơn giá, tiền điện và rounding khớp; có người kiểm và chữ ký |

## 10. P0 - Notification và kênh liên lạc

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `NOT-01` | [ ] | INT, SEC | `SEC-06`, staging | Cấu hình Zalo, Telegram và SMTP production/staging | Credential đúng môi trường, secret ngoài Git, recipient test được duyệt, không gửi PII tới nhóm công khai |
| `NOT-02` | [ ] | OPS, INT | `NOT-01` | Review template và trigger | Cọc, hóa đơn, đến hạn/quá hạn, hợp đồng sắp hết, thanh toán, hoàn tiền có nội dung tiếng Việt đúng và đúng đối tượng |
| `NOT-03` | [ ] | INT | `NOT-02` | Test gửi thành công trên cả ba kênh | Message ID/status/timestamp lưu; link/amount/customer mask đúng; không gửi trùng |
| `NOT-04` | [ ] | INT, OPS | `NOT-03` | Test provider timeout/failure/retry/dead-letter | Retry có giới hạn/backoff; lỗi hiển thị queue; operator có thể xử lý lại; audit không mất |
| `NOT-05` | [ ] | OPS, FIN | `NOT-03..04` | Xác nhận SLA và escalation notification | Có owner cho message fail/quá hạn; quy định không dùng notification thành bằng chứng thanh toán thay SePay/bank |

## 11. P0 - UAT nghiệp vụ, kế toán, persona và thiết bị

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `UAT-01` | [ ] | OPS, SALES, FIN | `STG-04`, integrations staging | Chạy luồng chuẩn end-to-end | Chọn phòng -> cọc -> SePay -> hợp đồng -> hóa đơn -> điện/nước -> thanh toán -> chi phí -> quyết toán -> vệ sinh -> trống; không sửa DB tay |
| `UAT-02` | [ ] | OPS, FIN | `UAT-01` | Chạy ngoại lệ cọc | Cọc chưa thu, hoàn toàn phần/một phần, giữ cọc, khấu trừ phí, pending refund/completed refund đúng chứng từ/audit |
| `UAT-03` | [ ] | OPS, FIN | `UAT-01` | Chạy trả phòng sớm và quyết toán | Tiền thuê theo ngày, hỗ trợ/hoàn tiền phòng, điện/nước sớm, công nợ/cọc, CLEANING/MAINTENANCE/AVAILABLE đúng |
| `UAT-04` | [ ] | FIN | `SEP-*`, `HUN-*`, `UAT-01..03` | Nghiệm thu kế toán và chia lợi nhuận | Tổng thu/chi/còn lại, người ứng tiền, owner chịu chi, hoàn ứng/khấu trừ, deposit held/refund/credit khớp sổ kiểm soát |
| `UAT-05` | [ ] | OWNER-A | `UAT-04` | Owner A nghiệm thu dashboard/tòa/bank/lợi nhuận | Chỉ thấy/quản lý đúng phạm vi đã duyệt; số liệu và audit đúng; ký acceptance |
| `UAT-06` | [ ] | OWNER-B | `UAT-04` | Owner B nghiệm thu dashboard/tòa/bank/lợi nhuận | Chỉ thấy/quản lý đúng phạm vi đã duyệt; số liệu và audit đúng; ký acceptance |
| `UAT-07` | [ ] | OPS, TL | `STG-03` | Nghiệm thu RBAC account thật | Admin vận hành không sửa token; owner A/B sửa token; manager không vào Settings; sales/finance đúng quyền nếu đưa vào vận hành |
| `UAT-08` | [ ] | OPS | `STG-04` | UAT thiết bị Android/iOS thật | Chrome Android và Safari iOS: login, theme, Buildings 3D/2.5D, phòng, hợp đồng, chi phí, table/modal/toast không vỡ/overflow |
| `UAT-09` | [ ] | DEV, OPS | WebKit browser được phê duyệt/cài | Chạy Playwright WebKit hoặc BrowserStack/device farm | Public/auth route light/dark PASS; lỗi khác Chromium được đóng; artifact gắn đúng SHA |
| `UAT-10` | [ ] | OPS, FIN, TL | `UAT-01..09` | Ký staging acceptance | Danh sách testcase PASS, issue còn lại không có P0/P1, acceptance có TL/OPS/FIN/OWNER-A/OWNER-B |

## 12. P0 - Account, bàn giao và audit

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `ACC-01` | [ ] | TL, OPS, SEC | Production sẵn sàng | Tạo account production riêng | `admin`, `adminA`, `adminB`, `manager` và sales/finance nếu dùng; không dùng chung account; email/role đúng |
| `ACC-02` | [ ] | SEC, OPS | `ACC-01` | Bàn giao mật khẩu tạm qua password manager | Mỗi account mật khẩu riêng, must-change bật, không gửi trong Git/chat/log; người nhận xác nhận |
| `ACC-03` | [ ] | Mỗi user | `ACC-02` | Đổi mật khẩu lần đầu và đăng nhập lại | Must-change tắt sau đổi; refresh token cũ bị thu hồi; audit có đúng user/IP/user-agent |
| `ACC-04` | [ ] | OPS, SEC | `ACC-03` | Test quy trình khóa/thu hồi account | Disable account trả 401/403; refresh token bị revoke; SOP nhân sự nghỉ/đổi vai trò được ghi nhận |
| `ACC-05` | [ ] | OPS, TL | `ACC-03..04` | Review audit log | Login success/fail, tiền, hợp đồng, phòng, owner, Settings/token truy được đúng actor/correlation ID; không chứa secret |

## 13. P0 - Monitoring, cảnh báo và incident readiness

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `OBS-01` | [ ] | INFRA | Production network | Prometheus scrape API metrics | Target UP qua private network; metric HTTP/latency/error có label hợp lệ; endpoint không public |
| `OBS-02` | [ ] | INFRA, SEC | `OBS-01` | Bảo vệ Grafana/Prometheus/Loki/Tempo/Alertmanager | TLS/auth/VPN, password mặc định đã đổi, secret trong secret manager |
| `OBS-03` | [ ] | INFRA, OPS | `OBS-01` | Cấu hình dashboard và alert thiết yếu | API down/5xx/latency, DB/Redis readiness, disk, backup stale, webhook unmatched/duplicate, Hunonic sync fail, notification queue |
| `OBS-04` | [ ] | OPS, INFRA | `OBS-03`, `GOV-01` | Cấu hình người trực và escalation | Primary/backup, kênh critical/warning, SLA acknowledge/resolve và quyền dừng reconciliation/write |
| `OBS-05` | [ ] | INFRA, OPS | `OBS-04` | Test alert fire và resolved | Critical alert tới ít nhất hai người/kênh; resolved tới đúng nơi; timestamp/correlation/evidence đầy đủ |
| `OBS-06` | [ ] | TL, OPS, FIN | `OBS-05` | Diễn tập incident tài chính | Tình huống payment duplicate/sai owner: dừng xử lý, giữ evidence, đối soát, forward-fix, thông báo owner; không sửa DB tay |

## 14. P0 - Cutover và mở LIVE

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `REL-01` | [ ] | TL | Mọi staging/UAT/security P0 PASS | Đóng change-freeze và chốt SHA/tag/digest | Working tree release sạch, CI đúng SHA xanh, release note/known issue/rollback tag có trong evidence |
| `REL-02` | [ ] | DBA, INFRA | `BKP-03`, `REL-01` | Tạo backup ngay trước cutover | Dump/attachment manifest/checksum/off-host upload PASS; backup ID và restore point ghi nhận |
| `REL-03` | [ ] | DBA, TL | `REL-02` | Kiểm tra migration trước deploy | `prisma migrate status`, database identity, disk capacity, maintenance/write policy được xác nhận; không dùng reset/db push |
| `REL-04` | [ ] | INFRA, TL | `REL-03` | Deploy immutable API/Web image | Đúng digest đã staging; env production; migration opt-in một lần nếu cần rồi trả `RUN_DB_MIGRATIONS=false` |
| `REL-05` | [ ] | INFRA, TL | `REL-04` | Chạy technical smoke | Health/readiness/build-info, login, CORS/TLS, route chính, log 5xx, DB/Redis/storage PASS |
| `REL-06` | [ ] | OPS, FIN | `REL-05` | Chạy production persona smoke | Bốn persona login/đổi mật khẩu/quyền đúng; chỉ tạo dữ liệu/giao dịch nhỏ đã phê duyệt |
| `REL-07` | [ ] | FIN, INT | `REL-06` | Chạy một giao dịch nhỏ mỗi owner | SePay bank A/B, invoice/payment/audit/dashboard khớp; không duplicate; hoàn test nếu quy trình yêu cầu |
| `REL-08` | [ ] | OPS, INT | `REL-06` | Chạy Hunonic + notification production smoke | Sync một phạm vi nhỏ không ghi đè kỳ khóa; gửi test Zalo/Telegram/SMTP tới recipient đã duyệt |
| `REL-09` | [ ] | TL, FIN, OPS, OWNER-A, OWNER-B | `REL-01..08`, `GOV-05` | Ký GO và mở traffic | Tất cả P0 `[x]`, dashboard/alerts xanh, backup dùng được; thời điểm GO và người phê duyệt ghi nhận |
| `REL-10` | [ ] | TL, INFRA | Bất kỳ smoke fail | Thực thi NO-GO/rollback | Dừng traffic/write liên quan, rollback image tag, giữ schema/evidence, health PASS; không reset/restore nếu chưa phê duyệt sự cố |

## 15. P1 - Hypercare và vận hành ổn định

| ID | Trạng thái | Owner | Deadline | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `HC-01` | [ ] | OPS, INFRA | T+1h | Theo dõi health/5xx/latency/DB/Redis/disk | Không critical alert chưa xử lý; baseline metric được lưu |
| `HC-02` | [ ] | FIN, INT | Mỗi giờ trong 24h | Kiểm tra SePay unmatched/duplicate/sai bank | Queue trong SLA; mọi chênh lệch có ticket/owner; không có tiền ghi trùng |
| `HC-03` | [ ] | OPS, INT | Mỗi giờ trong 24h | Kiểm tra Hunonic sync và notification queue | Job đúng lịch, không duplicate, failed queue trong SLA |
| `HC-04` | [ ] | DBA | T+24h | Xác nhận backup production đầu tiên | Dump/manifest/checksum/off-host PASS; backup freshness alert xanh |
| `HC-05` | [ ] | FIN, OWNER-A, OWNER-B | T+24h | Đối soát tổng thu/chi/còn lại theo owner/bank | Hai owner xác nhận; chênh lệch bằng 0 hoặc có RCA/ticket |
| `HC-06` | [ ] | OPS, TL | T+24h | Review audit/login/permission | Không shared account, không unauthorized Settings/token change, không secret trong log |
| `HC-07` | [ ] | OPS, TL | T+3 ngày | Đào tạo và bàn giao SOP | Sales/manager/finance/owner thực hiện được luồng chuẩn, ngoại lệ, incident và escalation |
| `HC-08` | [ ] | TL, OPS, FIN | T+7 ngày | Kết thúc hypercare | Không P0/P1 mở, SLO đạt, backup/alerts/integrations ổn định, ký biên bản chuyển BAU |
| `HC-09` | [ ] | SEC, TL | T+30 ngày | Review quyền và secret rotation | Account/role còn đúng; token hết hạn được rotate; offboard test PASS |
| `HC-10` | [ ] | DBA, INFRA | Theo quý | Restore drill định kỳ | RPO/RTO đo và đạt; đối chiếu dữ liệu/tài chính PASS; action item có owner |

## 16. Lịch thực hiện khuyến nghị

### T-14 đến T-7

- Hoàn thành `GOV-*`, `SEC-*`, `INF-*`.
- Dựng staging và chạy `STG-01..05`.
- Chốt inventory dữ liệu và mapping owner/bank/meter.

### T-7 đến T-3

- Hoàn thành backup/restore drill và dry-run dữ liệu.
- Nghiệm thu SePay, Hunonic, notification.
- Chạy UAT chuẩn/ngoại lệ/kế toán/thiết bị thật.
- Đóng mọi bug P0/P1 và chạy lại full gate.

### T-2 đến T-1

- Change-freeze, chốt release SHA/digest.
- Chạy CI/security cuối, backup pre-cutover rehearsal.
- Bàn giao credential và xác nhận on-call/rollback.
- Họp GO/NO-GO sơ bộ; còn P0 là NO-GO.

### T0

- Thực hiện `REL-01..08` theo maintenance window.
- Họp GO/NO-GO cuối; chỉ `REL-09` khi toàn bộ P0 `[x]`.
- Nếu có bất kỳ trigger NO-GO, thực hiện `REL-10`, không cố sửa dữ liệu trực tiếp.

### T+1 đến T+7

- Thực hiện `HC-01..08`.
- Chỉ kết thúc hypercare khi kế toán, owner, integration, backup và monitoring ổn định.

## 17. Trigger NO-GO bắt buộc

Không mở hoặc phải dừng LIVE khi có một trong các điều kiện:

- GitHub required job/security gate đỏ hoặc chưa xác nhận đúng SHA.
- Runtime audit còn critical/high chưa được risk acceptance có thời hạn và phê duyệt đúng thẩm quyền.
- Secret production dùng giá trị local/example, key Hunonic cũ chưa revoke hoặc phát hiện secret trong Git/log.
- Staging full gate không PASS, build-info khác release SHA hoặc image không immutable.
- Backup chưa off-host, `pg_restore --list` lỗi hoặc restore drill chưa PASS.
- SePay sai bank/owner, webhook duplicate, giao dịch nhỏ không đối soát được.
- Hunonic duplicate/thiếu dữ liệu, mapping meter sai, kỳ khóa bị ghi đè hoặc giá điện tính sai.
- Dashboard tổng thu/chi/còn lại không khớp kế toán/sao kê/owner.
- Bốn persona/RBAC/must-change/audit chưa PASS bằng credential thật.
- Health/readiness/DB/Redis/storage lỗi, critical alert không tới người trực hoặc không có rollback owner.
- Có bug P0/P1 nghiệp vụ, mất dữ liệu, sai tiền, sai cọc, sai hợp đồng hoặc sai trạng thái phòng chưa đóng.

## 18. Evidence package tối thiểu

| Nhóm | Bằng chứng bắt buộc |
|---|---|
| Release | SHA, version, API/Web image digest, build-info |
| CI/Security | Actions run URL/ID, audit JSON, SBOM checksum, Gitleaks/SAST/Trivy/license result |
| Database | Identity, migration status, baseline/migration review, backup ID/checksum, restore drill |
| Staging | Health, full production gate, desktop/mobile artifacts, rollback drill |
| SePay | Hai bank/owner test, webhook idempotency, exception/refund, reconciliation |
| Hunonic | Credential rotation, meter mapping, 6-month sync, hourly sync, pricing/retention/locked period |
| Notification | Zalo/Telegram/SMTP success/failure/retry logs |
| UAT | Standard/exception/accounting/persona/device test cases và chữ ký |
| Operations | Monitoring dashboard, fire/resolved alert, on-call/escalation, incident drill |
| Go-live | Pre-cutover backup, smoke, GO/NO-GO record, hypercare 24h/7d |

## 19. Việc cần làm ngay tiếp theo

1. Gán người thật cho `GOV-01` và chốt quyền truy cập GitHub Actions.
2. Phê duyệt hướng xử lý Node/dependency cho `SEC-02`; không đổi phiên bản trước phê duyệt.
3. Mở run CI mới nhất và lấy artifact audit để thực hiện `SEC-01`, `SEC-03`.
4. Rotate Hunonic mobile key theo `SEC-05`.
5. Chọn hạ tầng/domain/secret manager, thực hiện `INF-01..09`.
6. Deploy staging immutable, baseline DB và chạy full gate `STG-01..05`.
7. Sau đó mới nghiệm thu tiền/điện/notification, dữ liệu, backup, UAT và cutover.
