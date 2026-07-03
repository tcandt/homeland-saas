# Secrets Management

> **STATUS:** DOCUMENTED / PENDING MANUAL CONFIGURATION IN GITHUB SETTINGS
> 
> *The settings described below must be manually configured by an administrator in the GitHub Repository Settings.*

## Overview
Homeland SaaS strictly prohibits the use of hardcoded secrets or `.env.production` files committed to the repository. All secrets must be securely managed using **GitHub Secrets** and **GitHub Environments**.

## GitHub Environments

We utilize two primary deployment environments in GitHub:

### 1. Staging Environment (`staging`)
- **Auto-deploy allowed:** The `deploy-staging` job will automatically trigger when code is merged into `main`.
- **Environment Secrets:** Secrets scoped specifically to the `staging` environment (e.g., Staging DB credentials, Staging VPS keys).

### 2. Production Environment (`production`)
- **Required Reviewers:** Deployments to production must be manually approved by designated personnel.
- **Restricted Branches:** Only deployments from the `main` branch (or specific release branches) are allowed.
- **Deployment Wait Timer:** (Optional) Can be configured to delay deployment for a cooldown period.
- **Environment Secrets:** Secrets scoped specifically to the `production` environment.

## Required Secrets List

The following secrets must be populated in the GitHub Repository Settings (under Actions Secrets or Environment Secrets):

### Deployment Targets (Environment Specific)
- `STAGING_HOST` - IP address or hostname of the Staging VPS
- `STAGING_USER` - SSH username for Staging
- `STAGING_SSH_KEY` - Private SSH key for Staging access
- `STAGING_URL` - Base URL for the Staging environment (used by Playwright)

- `PRODUCTION_HOST` - IP address or hostname of the Production VPS
- `PRODUCTION_USER` - SSH username for Production
- `PRODUCTION_SSH_KEY` - Private SSH key for Production access
- `PRODUCTION_URL` - Base URL for the Production environment

### Application Secrets (Repository or Environment Specific)
- `GHCR_TOKEN` - Personal Access Token (PAT) for GitHub Container Registry (if standard `GITHUB_TOKEN` permissions are insufficient)
- `SENTRY_DSN` - DSN for Sentry error tracking
- `DATABASE_URL` - Connection string for the PostgreSQL database (Prisma)
- `REDIS_URL` - Connection string for Redis (bullmq/caching)
- `OPENAI_API_KEY` - API key for OpenAI integrations
- `JWT_SECRET` - Secret key for JWT signing
- `REFRESH_TOKEN_SECRET` - Secret key for JWT refresh token signing

## Secret Rotation Policy
- Secrets should be rotated immediately if compromised.
- Routine rotation should occur every 90 days.
- Updates to environment variables on VPS instances must be synchronized with GitHub Secrets.
