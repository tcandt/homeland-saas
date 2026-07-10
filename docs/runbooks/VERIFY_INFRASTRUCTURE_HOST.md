cd D:\homeland-new\homeland-saas
powershell -ExecutionPolicy Bypass -File scripts/infra/run-all.ps1

npm run verify:prod
