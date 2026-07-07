const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, 'docs');

const filesToCreate = {
    'PROJECT_INDEX.md': `# HomeLand Engineering Operating System (EOS) Index\n\n**START HERE.**\n\nIf you are an AI agent opening a new session, your first mandatory action is to read:\n1. [PROJECT_BOOTSTRAP.md](./PROJECT_BOOTSTRAP.md)\n\nDirectory Structure:\n- \`engineering/\`: Core laws and production scores.\n- \`architecture/\`: System design.\n- \`product/\`: Business rules and workflows.\n- \`testing/\`: E2E flows and matrices.\n- \`operations/\`: Deployment, security, monitoring.\n- \`incidents/\`: Incident logs.\n- \`decisions/\`: Architecture Decision Records (ADR).\n- \`runbooks/\`: Troubleshooting guides.\n`,
    
    'PROJECT_BOOTSTRAP.md': `# Project Bootstrap Sequence\n\n**MANDATORY BEFORE ANY CODE MODIFICATION.**\n\nYou must read these files in the exact order below:\n\n1. Read [docs/engineering/ENGINEERING_CONSTITUTION.md](engineering/ENGINEERING_CONSTITUTION.md)\n2. Read [docs/PROJECT_MEMORY.md](PROJECT_MEMORY.md)\n3. Read [docs/engineering/PROJECT_CONTEXT.md](engineering/PROJECT_CONTEXT.md)\n4. Read [docs/architecture/SYSTEM_OVERVIEW.md](architecture/SYSTEM_OVERVIEW.md)\n5. Read [docs/product/PRODUCT_SPEC.md](product/PRODUCT_SPEC.md)\n6. Read [docs/MODULE_STATUS.md](MODULE_STATUS.md)\n7. Read [docs/VERIFICATION_MATRIX.md](VERIFICATION_MATRIX.md)\n8. Read [docs/engineering/KNOWN_ISSUES.md](engineering/KNOWN_ISSUES.md)\n9. Read [docs/engineering/ROOT_CAUSE_LOG.md](engineering/ROOT_CAUSE_LOG.md)\n10. Read \`docs/incidents/\` (Latest incidents)\n11. Calculate/Read [docs/engineering/PRODUCTION_SCORE.md](engineering/PRODUCTION_SCORE.md)\n12. Choose Highest Priority Unverified Module\n13. Start Autonomous Loop (FSM)\n`,
    
    'PROJECT_MEMORY.md': `# Project Memory\n\n**LONG-TERM IMMUTABLE MEMORY.**\n\n- **Verified Root Causes**: (Append here)\n- **Architecture Decisions**: \n  - Use \`127.0.0.1\` over \`localhost\` in tests.\n  - Local Mirror First.\n- **Anti-Patterns (BANNED)**:\n  - Greenwashing CI\n  - Placeholder tests (\`passWithNoTests\`, \`continue-on-error\`)\n  - Mocking business logic just to pass tests.\n- **Lessons Learned**:\n  - Playwright session cache issues.\n`,
    
    'MODULE_STATUS.md': `# Module Status\n\n| Module | CRUD | Business | Unit | Integration | E2E | Security | Performance | Production |\n| ------ | ---- | -------- | ---- | ----------- | --- | -------- | ----------- | ---------- |\n| Auth | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 0 |\n`,
    
    'VERIFICATION_MATRIX.md': `# Verification Matrix\n\n| Module | Flow | Test | Production Ready |\n| ------ | ---- | ---- | ---------------- |\n| Auth | Register | ❌ | ❌ |\n`,
    
    'engineering/ENGINEERING_CONSTITUTION.md': `# HomeLand Engineering Constitution\n\n1. You are the Lead Principal Software Architect.\n2. No bypasses. No green CI faking.\n3. Local Mirror First.\n4. One Root Cause = One Commit.\n5. Business Logic > Cosmetic UI.\n6. CI is a verifier, not a debugger.\n`,
    
    'engineering/PROJECT_CONTEXT.md': `# Project Context\n\nHomeLand is a commercial SaaS platform for apartment management.\nCore modules: Auth, Tenant, Building, Floor, Room, Customer, Contract, Invoice, Finance, Accounting, Reports, Documents, Notifications, Automation, AI Command Center, Settings, RBAC, Audit Log, Dashboard.\n`,
    
    'engineering/PRODUCTION_SCORE.md': `# Production Score\n\n| Module | Score |\n| ------ | ----- |\n| Overall| 0% |\n`,
    
    'engineering/KNOWN_ISSUES.md': `# Known Issues\n\n(Append non-blocking technical debt here)\n`,
    
    'engineering/ROOT_CAUSE_LOG.md': `# Root Cause Log\n\n(Append all verified root causes here)\n`,
    
    'architecture/SYSTEM_OVERVIEW.md': `# System Overview\n\nNext.js frontend, NestJS backend, PostgreSQL, Redis.\n`,
    
    'architecture/DATABASE.md': `# Database Architecture\n\nPostgreSQL Schema Definitions.\n`,
    
    'architecture/RBAC.md': `# Role-Based Access Control\n\n`,
    
    'architecture/AUTH.md': `# Authentication Foundation\n\n`,
    
    'architecture/EVENTS.md': `# Event Driven Architecture\n\n`,
    
    'architecture/MULTI_TENANT.md': `# Multi-Tenant Architecture\n\n`,
    
    'architecture/API.md': `# API Design\n\n`,
    
    'architecture/OBSERVABILITY.md': `# Observability\n\n`,
    
    'product/PRODUCT_SPEC.md': `# Product Specification\n\n`,
    
    'product/FEATURE_SPEC.md': `# Feature Specifications\n\n`,
    
    'product/WORKFLOWS.md': `# Workflows\n\n1. Register -> Login -> Tenant -> Building -> Floor -> Room -> Customer -> Contract -> Invoice -> Payment -> Accounting -> Dashboard -> Reports -> Logout.\n`,
    
    'product/PERMISSIONS.md': `# Permissions\n\n`,
    
    'product/DATA_DICTIONARY.md': `# Data Dictionary\n\n`,
    
    'product/VISION.md': `# Product Vision\n\n`,
    
    'product/ROADMAP.md': `# Roadmap\n\n`,
    
    'product/MODULES.md': `# Modules\n\n`,
    
    'product/BUSINESS_RULES.md': `# Business Rules\n\n`,
    
    'product/USER_ROLES.md': `# User Roles\n\n`,
    
    'product/PRICE_RULES.md': `# Price Rules\n\n`,
    
    'testing/TEST_STRATEGY.md': `# Test Strategy\n\n`,
    
    'testing/BUSINESS_SCENARIOS.md': `# Business Scenarios\n\n`,
    
    'testing/TEST_MATRIX.md': `# Test Matrix\n\n`,
    
    'testing/KNOWN_FLAKY.md': `# Known Flaky Tests\n\n`,
    
    'testing/PRODUCTION_SCENARIOS.md': `# Production Scenarios\n\n`,
    
    'testing/EDGE_CASES.md': `# Edge Cases\n\n`,
    
    'operations/DEPLOYMENT.md': `# Deployment\n\n`,
    
    'operations/BACKUP.md': `# Backup Strategy\n\n`,
    
    'operations/RESTORE.md': `# Restore Strategy\n\n`,
    
    'operations/MONITORING.md': `# Monitoring\n\n`,
    
    'operations/LOGGING.md': `# Logging\n\n`,
    
    'operations/SECURITY.md': `# Security\n\n`,
    
    'operations/DISASTER_RECOVERY.md': `# Disaster Recovery\n\n`,
    
    'runbooks/CI_FAILURE.md': `# CI Failure Runbook\n\n`,
    
    'runbooks/AUTH_FAILURE.md': `# Auth Failure Runbook\n\n`,
    
    'runbooks/DATABASE_FAILURE.md': `# Database Failure Runbook\n\n`,
    
    'runbooks/PLAYWRIGHT.md': `# Playwright Troubleshooting\n\n`,
    
    'runbooks/DEPLOY.md': `# Deploy Runbook\n\n`,
    
    'runbooks/ROLLBACK.md': `# Rollback Runbook\n\n`
};

for (const [filename, content] of Object.entries(filesToCreate)) {
    const fullPath = path.join(docsDir, filename);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(fullPath)) {
        fs.writeFileSync(fullPath, content);
        console.log(`Created: ${filename}`);
    } else {
        console.log(`Exists: ${filename}`);
    }
}
console.log('EOS scaffolding complete.');
