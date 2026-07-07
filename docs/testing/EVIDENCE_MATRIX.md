# Evidence Matrix

AI không được phép nói "PASS" hoặc "VERIFIED" nếu không có Runtime Evidence. Nếu Evidence rỗng -> Status = UNKNOWN, không được ghi PASS.

| Requirement  | Evidence           |
| ------------ | ------------------ |
| Backend CRUD | Test File          |
| API CRUD     | Supertest          |
| DB Verify    | Prisma Query       |
| UI CRUD      | Playwright         |
| Cache        | React Query Verify |
| Reload       | Browser Reload     |
| RBAC         | Multi Role Test    |
| Tenant       | Multi Tenant Test  |
| Audit        | DB Query           |
| Error        | Negative Test      |
| Performance  | Benchmark          |
| Screenshot   | Artifact           |
| Trace        | Playwright Trace   |
