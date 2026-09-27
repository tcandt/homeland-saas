/* Additional source-grounded domains. Each row is a local call path, not an implied global chain. */
window.HOMELAND_GRAPH_EXTRA = (() => {
  const a='apps/api/src/', w='apps/web/', nodes=[],edges=[];
  function row(group,y,items,labels){
    items.forEach((n,i)=>nodes.push([n[0],n[1],n[2],group,70+i*500,y,n[3]||'',n[4]||'']));
    labels.forEach((label,i)=>{if(!label)return;const x=300+i*500;edges.push([items[i][0],items[i+1][0],label.replace(/^!/,''),`M${x} ${y+39} H${x+270}`,x+135,y+28,label.startsWith('!')?'gap':undefined]);});
  }
  row('sales',1460,[
    ['sales-page','Sales CRM UI',w+'app/sales/page.tsx','THIẾU','Sales desktop có nút Thêm Lead / Import / Marketing chưa có onClick. Không phải toàn trang giả: danh sách đọc API thật.'],
    ['sales-query','Sales Query / API',w+'lib/queries/sales.queries.ts','','useSalesLeadsQuery → salesApi.list → GET /sales.'],
    ['sales-controller','Sales Controller',a+'sales/sales.controller.ts','THIẾU','Chỉ có GET /sales và GET /sales/:id; chưa có POST/PATCH/convert lead trong controller. Permission sales.read.'],
    ['sales-service','Sales Service',a+'sales/sales.service.ts','','listLeads: search/status alias, pagination; getDetail; truy vấn prisma.tx để dùng tenant context.'],
    ['sales-model','SalesLead model','packages/database/prisma/schema.prisma','','Lưu SalesLead. Chưa thấy luồng controller biến WON thành Customer/Deposit/Contract.']
  ],['useSalesLeadsQuery','GET /sales','listLeads / getDetail','prisma.tx.salesLead']);
  row('sales',1660,[
    ['sales-kpi','KPI / Funnel',w+'components/sales/OperationsSalesKpi.tsx','GIỚI HẠN','KPI và Funnel gọi limit:100 và tính theo dữ liệu trả về; cần kiểm thử tổng thể khi vượt 100 lead.'],
    ['sales-funnel','Sales Funnel',w+'components/sales/OperationsSalesFunnel.tsx','','Dùng useSalesLeadsQuery(limit:100). Chọn stage chủ yếu là trình bày, không chứng minh có mutation đổi trạng thái.'],
    ['sales-drawer','Lead Drawer',w+'components/sales/OperationsSalesDrawer.tsx','','Mở bằng custom event open-sales-drawer từ lead card; xem dữ liệu lead.'],
    ['sales-convert','Lead → khách / cọc',a+'sales/sales.controller.ts','THIẾU','Đường chuyển đổi là nhu cầu còn thiếu ở Sales API đã đọc, không phải lời gọi đang tồn tại.'],
    ['sales-target','Customer / Deposit',a+'deposits/deposit-core.service.ts','','Domain đích đã tồn tại; chưa được nối bằng SalesController.']
  ],[null,null,null,'!chưa có convert command']);
  row('settings',2000,[
    ['settings-ui','Settings Page',w+'app/settings/page.tsx','','Trang cấu hình chia nhiều section. Team, Backup, Integrations không nhất thiết gọi cùng Settings API.'],
    ['settings-api','Settings API',w+'lib/api/settings.api.ts','','GET/PATCH /settings/:key; asset upload/download. Query key gồm key và scope.'],
    ['settings-controller','Settings Controller',a+'settings/settings.controller.ts','','setting.read / setting.update; parse scope USER/TENANT; public/access-control riêng.'],
    ['settings-service','Settings Service',a+'settings/settings.service.ts','','OwnerId theo user/tenant; merge secret cũ, bảo vệ secret fields; upsert AppSetting, sync Owner khi key=owners; ghi AuditService sau transaction.'],
    ['settings-db','AppSetting + Owner','packages/database/prisma/schema.prisma','','Composite key tenantId/scope/ownerId/key. Cấu hình JSON không đồng nghĩa mọi field đã có consumer nghiệp vụ.']
  ],['settingsApi','GET / PATCH','getSection / saveSection','upsert + syncOwnerDirectory']);
  row('settings',2200,[
    ['settings-workflow','Workflow Settings',w+'components/settings/sections/SettingsWorkflow.tsx','THIẾU','UI rỗng; Tạo workflow mới và Chỉnh sửa không có handler; Switch checked=false readOnly.'],
    ['settings-registry','Static Workflow Registry',a+'automation/workflow/workflow.registry.ts','','Engine thực thi registry cố định, không đọc workflow do người dùng tạo ở SettingsWorkflow.'],
    ['settings-team','Team Settings',w+'components/settings/sections/SettingsTeam.tsx','','useSWR(authApi.team), createTeamMember/updateTeamMember; đây là luồng quản lý account thật.'],
    ['settings-auth','Auth Team API',a+'auth/auth.controller.ts','','Team đi AuthController/AuthService, không chỉ ghi JSON AppSetting.'],
    ['settings-users','User / Role models','packages/database/prisma/schema.prisma','','Dữ liệu account/role/permission trong Prisma.']
  ],['!chưa nối UI ↔ registry',null,'authApi.team / mutations','AuthService']);
  row('settings',2400,[
    ['settings-backup','Backup Settings',w+'components/settings/sections/SettingsBackup.tsx','','Backups/create/restore/delete gọi systemUpdateApi. Toggle lịch còn là trạng thái localStorage; xem node kế tiếp.'],
    ['settings-schedule','Backup schedule toggle',w+'components/settings/sections/SettingsBackup.tsx','THIẾU','handle toggle lưu system_backup_schedule_enabled vào localStorage. Không thấy request cập nhật scheduler trong handler; không suy ra cron backend đã đổi.'],
    ['settings-provider','Provider configuration',a+'settings/settings.service.ts','','Protected keys: hunonic, sepay, zalo-provider, email-provider, telegram-provider. Provider đọc AppSetting trực tiếp.'],
    ['settings-readers','Payment / messaging',a+'communication/providers/communication.providers.ts','','Communication providers đọc AppSetting; PaymentsService.resolveSePayConfig và HunonicService cũng có reader riêng.'],
    ['settings-reminders','Notification reminders',a+'automation/rules/rule.scheduler.ts','','RuleScheduler đọc notifications theo tenant. Khác với SettingsWorkflow đang chưa nối.']
  ],['local preference',null,'đọc AppSetting',null]);
  row('ops',2740,[
    ['dashboard-ui','Dashboard UI',w+'app/page.tsx','','Tổng quan ứng dụng; phân biệt DashboardService với AnalyticsService dữ liệu demo.'],
    ['dashboard-api','Dashboard Service',a+'dashboard/dashboard.service.ts','','DashboardController gọi getDashboardAggregation/getRevenueHistoryByMonths theo tenant.'],
    ['analytics-api','Analytics Service',a+'analytics/analytics.service.ts','SAI','revenue/occupancy/debt/finance trả số cố định (285000000, 85%, topDebtors mẫu), rồi cache theo tenant. Inject Prisma nhưng các hàm này không aggregate DB.'],
    ['analytics-cache','Analytics Cache',a+'analytics/analytics-cache.service.ts','','Cache analytics; WorkflowEngine invalidateDashboard/invalidateFinance.'],
    ['tasks-ui','Tasks / Operations',w+'components/tasks/OperationsBoard.tsx','THIẾU','tickets=[]; chưa nối board vào nguồn Task thật. Task model tồn tại không có nghĩa UI đã nối.']
  ],['dashboard API',null,'cache.get / set',null]);
  row('ops',2940,[
    ['floors-service','Floors Service',a+'floors/floors.service.ts','','Module bị thiếu ở sơ đồ trước. BaseCrudService + FloorsRepository, buildingId, active-contract guard.'],
    ['base-repository','Base Repository',a+'shared/repositories/base.repository.ts','','CRUD dùng repository/Prisma; các service domain có thể bổ sung command và audit.'],
    ['finance-reporting','Finance Reporting',a+'finance/finance-reporting.service.ts','','FinanceController dùng service này cho ledger/cashflow/reconciliation; không dùng FinanceLedgerService.getAccountBalance.'],
    ['notification-worker','Notification Scheduler',a+'communication/communication.scheduler.ts','','Retry queue theo runtime role; tách scheduler khỏi provider dispatch để thấy đường retry.'],
    ['notification-service','Notification Queue',a+'communication/communication.service.ts','','processQueueItem claim SENDING → provider.send → DELIVERED hoặc retry/dead-letter.']
  ],['repository',null,null,'retry queue']);
  row('infra',3280,[
    ['system-ui','Backup / Update UI',w+'components/settings/sections/SettingsSystemUpdate.tsx','','Nhánh vận hành có endpoint riêng; sơ đồ chỉ mô tả, không thực thi update/restore.'],
    ['system-api','System Update Service',a+'system-update/system-update.service.ts','','Controller/service update và backup; thao tác này không được gọi trong lượt chỉnh diagram.'],
    ['metrics','Metrics / Prometheus',a+'metrics/metrics.controller.ts','','GET /metrics public decorator nhưng có InternalTokenGuard. Không coi Public đồng nghĩa không bảo vệ.'],
    ['ip-guard','GeoIP / IP Security',a+'shared/security/geo-ip.guard.ts','','Global APP_GUARD trong AppModule, đứng trước JWT/PermissionsGuard.'],
    ['health','Health / Diagnostics',a+'health.controller.ts','','HealthController + SchemaDiagnosticsService phục vụ chẩn đoán.']
  ],['systemUpdateApi',null,null,null]);
  return {height:3500,colors:{sales:['#fff0d8','#ce8017'],settings:['#e4f5fa','#168da7'],ops:['#edf2ff','#5679ca'],infra:['#f0edf5','#857098']},groups:[['sales','Sales CRM — UI → query → controller → service → model',30,1360,2540,480],['settings','Settings — persistence, consumers và các nhánh độc lập',30,1900,2540,660],['ops','Dashboard, Analytics, Tasks, Floors and Finance / Queue',30,2640,2540,480],['infra','System Operations, Metrics, Security and Health',30,3180,2540,270]],nodes,edges};
})();
