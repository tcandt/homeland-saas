# Security Gate

Every module must proactively prove it is secure against standard vulnerabilities and business logic bypasses. 

## Requirements

### 1. Tenant Isolation
Cross-tenant data access is strictly forbidden. A test MUST explicitly assert that Tenant A cannot read, update, or delete data belonging to Tenant B via direct API calls or UI traversal.

### 2. Role-Based Access Control (RBAC)
Endpoints and UI routes must respect roles. A standard test suite MUST verify that users without necessary permissions (e.g. Sales staff trying to Delete a Building) receive a 403 Forbidden response and appropriate UI blocking.

### 3. Core Protections
- Ensure CSRF tokens or equivalent protective measures are active on mutations.
- Ensure XSS vectors are sanitized on all text inputs.
- Ensure Rate Limiting is active and prevents brute force scenarios on sensitive endpoints.
