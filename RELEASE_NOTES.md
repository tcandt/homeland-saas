# Homeland PMS - Release Notes

## Version: 1.0.0-rc.1 (Release Candidate)
**Release Date**: July 2026

## Overview
HomeLand PMS 1.0.0-rc.1 is the first full Release Candidate for the Property Management System. This release establishes the core architecture, tenant isolation (SaaS), security policies, and foundational property management workflows (Happy Path).

## New Features
*   **Multi-tenant SaaS Architecture**: Hardened data isolation per tenant using Prisma middleware and JWT propagation.
*   **Core Property Management**: 
    *   Building, Floor, and Room CRUD.
    *   Customer/Tenant tracking.
    *   Contract generation and digital signing workflow.
*   **Financial & Invoicing**:
    *   Automated invoicing pipeline.
    *   Deposit collection, refund, and conversion flows.
    *   Ledger, Cashflow, and Profit & Loss reporting.
*   **Security & RBAC**:
    *   Strict Role-Based Access Control (RBAC).
    *   PermissionsGuard enforcing granular feature access (e.g., `finance.read`, `building.create`).
    *   Secure export endpoints for financial data.
*   **AI & Automation (Preview)**:
    *   Initial integration for automated task workflows and AI-assisted insights. (Currently restricted for beta testing via permissions).

## Breaking Changes
*   None. This is the initial production-ready Release Candidate.

## Migration Guide
*   **Database**: Ensure the `pgvector` extension is enabled on your PostgreSQL 16 instance prior to running Prisma migrations. Use `docker-compose` for local deployments.
*   **Environment Variables**: `NEXT_PUBLIC_API_URL` must point to the Next.js proxy route (`/api/v1`) rather than the raw backend URL to bypass CORS and ensure secure cookie handling.

## Bug Fixes
*   **Security**: Fixed a vulnerability in `ReportsController` where `/:type/export` endpoints lacked `@RequirePermissions` validation.
*   **Authentication**: Fixed proxy header propagation issues that caused Next.js Server-Side Rendering (SSR) to drop `Authorization` tokens, leading to 401 Unauthorized errors.

## Known Issues
*   Please refer to `KNOWN_LIMITATIONS.md` for a complete list of P3 visual bugs, accessibility warnings, and expected logging fallbacks (e.g., SSE polling fallback).
