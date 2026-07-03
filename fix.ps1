$modules = @("buildings", "floors", "rooms", "customers", "contracts", "invoices")
foreach ($m in $modules) {
  $dir = "d:\homeland-new\homeland-saas\apps\api\src\$m"
  
  # Controller
  $ctrl = "$dir\$m.controller.ts"
  if (Test-Path $ctrl) {
    (Get-Content $ctrl) -replace '\.\./\.\./shared/', '../shared/' | Set-Content $ctrl
  }
  
  # Service
  $svc = "$dir\$m.service.ts"
  if (Test-Path $svc) {
    (Get-Content $svc) -replace '\.\./\.\./shared/', '../shared/' -replace '\.\./\.\./prisma.service', '../prisma.service' | Set-Content $svc
  }
  
  # Repository
  $repo = "$dir\$m.repository.ts"
  if (Test-Path $repo) {
    (Get-Content $repo) -replace '\.\./\.\./shared/', '../shared/' -replace '\.\./\.\./prisma.service', '../prisma.service' | Set-Content $repo
  }
}

# Audit service
$audit = "d:\homeland-new\homeland-saas\apps\api\src\shared\audit\audit.service.ts"
if (Test-Path $audit) {
  (Get-Content $audit) -replace '\.\./\.\./\.\./prisma.service', '../../prisma.service' | Set-Content $audit
}

# Base Repository
$baseRepo = "d:\homeland-new\homeland-saas\apps\api\src\shared\repositories\base.repository.ts"
if (Test-Path $baseRepo) {
  (Get-Content $baseRepo) -replace '\.\./\.\./\.\./prisma.service', '../../prisma.service' | Set-Content $baseRepo
}
