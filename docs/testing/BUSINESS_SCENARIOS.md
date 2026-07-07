# Business Scenarios

This document will index approximately 300 Kịch bản (Scenarios) covering standard and edge-case business operations across the SaaS. 
All scenarios must be verified through the Production Verification Framework (the 14-Step Pipeline).

## Modules

### 1. Auth Module (Example Scenarios)
- User logs in successfully.
- User locks account after 5 failed attempts.
- Forgot password resets token securely.
- Session expires gracefully.

### 2. Property Module (Buildings, Floors, Rooms)
- Create Building -> Create Floor -> Create Room -> Edit -> Delete.
- Soft-delete Building with active Rooms -> Fails (409 Conflict).
- Sales role attempts to Delete Room -> Fails (403 Forbidden).
- Admin updates Room capacity concurrently -> Conflict handled.

### 3. Customer (Tenants) Module
- *(To be documented)*

### 4. Contract Module
- *(To be documented)*

### 5. Invoice & Accounting Module
- *(To be documented)*

*(Note: Scenarios will be expanded to reach ~300 as the system grows, serving as the blueprint for E2E automation coverage).*
