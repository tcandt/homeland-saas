# DESIGN SYSTEM FINAL AUDIT (Cuối Sprint 3.10)

## Global Primitives Status
- **Raw `<button>`**: 0
- **Raw `<input>`**: 0
- **Raw `<select>`**: 0
- **Custom Drawer/Badge**: 0 (Đã đồng nhất dùng `components/ui/Drawer` & `components/ui/Badge`)
- **Hardcoded Colors / Arbitrary Layout Classes (`bg-[#...]`)**: 0
- **`any` Usage (Build pass workaround)**: 0

## Known Lint Warnings (Whitelist)
Hiện tại dự án đang còn các warning liên quan đến `@next/next/no-img-element`. 
Đã sửa `<img>` thành `<Image>` trong Layout/Auth (ví dụ `Sidebar.tsx`). Tuy nhiên, đối với các module chức năng nội bộ, các cảnh báo sau đã được cho vào whitelist để xử lý sau do yêu cầu cấu hình Domain Name/Storage Bucket cho Next Image Optimization.

- `@next/next/no-img-element`: 11 instances
- **Reason**: Sử dụng thẻ `<img>` thay vì `<Image>` (Next.js) do dữ liệu ảnh trả về từ nhiều source URL động (CDN/avatar/external) cần cấu hình `remotePatterns` trước khi có thể dùng `<Image>` để không bị lỗi runtime.
- **Plan**: Thêm vào Sprint backlog tương lai về Image Optimization sau khi chốt xong Storage Cloud Provider (AWS S3, R2, v.v.).

### Files whitelisted:
1. `components/buildings/BuildingGrid.tsx:146, 344, 512`
2. `components/buildings/views/FloorView.tsx:129`
3. `components/dashboard/BuildingHealth.tsx:34, 81`
4. `components/dashboard/ForecastPanel.tsx:24`
5. `components/dashboard/RecentActivity.tsx:61`
6. `components/sales/OperationsSalesDrawer.tsx:39`
7. `components/sales/OperationsSalesLeadCard.tsx:40`
8. `components/tenants/TenantCard.tsx:27`
9. `components/tenants/TenantDetailDrawer.tsx:29`
10. `components/tenants/TenantsMobileFlow.tsx:152, 204`

## Kết luận
Toàn bộ dự án đã hoàn toàn tuân thủ Design System, vượt qua Phase Build & Lint. Wave 3 chính thức khép lại.
