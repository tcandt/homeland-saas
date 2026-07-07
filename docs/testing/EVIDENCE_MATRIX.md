# Evidence Matrix

AI không được phép nói "PASS" hoặc "VERIFIED" nếu không có Runtime Evidence. Nếu Evidence = None -> Status = UNKNOWN chứ không được ghi PASS.

| Claim | Evidence |
| --- | --- |
| CRUD Pass | Screenshot + DB Query |
| Delete Pass | API GET 404 |
| Invoice Pass | DB Row Exists |
| Room Pass | Reload UI |
| Contract Pass | Playwright Trace |
| Payment Pass | Ledger Updated |
