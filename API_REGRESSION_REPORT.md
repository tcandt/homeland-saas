# API Regression Report

## Tier 2 CI Acceptance Update

The API interactions and proxy layer behaviors were thoroughly evaluated across all 3 E2E suites.

### Status: PASS
- **Core API Operations:** Entities (Building, Room, Customer, Finance Contracts, Invoices) process cleanly with expected HTTP 2xx statuses.
- **Throttler Resilience:** Backend NestJS API successfully prevents test suite deadlocks by implementing customizable rate limits depending on the E2E environment configuration. During E2E, limits were lifted to safely allow parallel test ingestion (7 Playwright viewports generating concurrent heavy workloads).
- **Error Propagation:** Proxy routes correctly relay 401s, 403s, 500s back to the client application without masking headers or bodies. This was verified through the `network-chaos` suite which intercepts traffic and injects these status codes.

### RBAC Checks
All backend roles effectively secured their corresponding routes. API routes explicitly returned `403 Forbidden` whenever out-of-scope resources were accessed by Sales, Manager, or Finance personas.
