# Production Gate

To call a module or flow "Production Ready", it MUST meet 100% of the following requirements. Thiếu 1 dòng = không được gọi Production Ready.

| Layer        | Required |
| ------------ | -------- |
| UI CRUD      | 100%     |
| API CRUD     | 100%     |
| DB Verify    | 100%     |
| Unit         | >=90%    |
| Integration  | >=90%    |
| E2E          | 100%     |
| RBAC         | 100%     |
| Multi Tenant | 100%     |
| Performance  | PASS     |
| Security     | PASS     |
