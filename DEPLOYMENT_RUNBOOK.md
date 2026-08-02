   # Deployment Runbook

This document describes the automated and manual deployment processes for Homeland SaaS.

## Automated CI/CD (GitHub Actions)

### Staging Deployment (Automatic)
1. **Trigger:** Push to `main` branch.
2. **Build & Test:** CI runs Linting, Unit, Integration, and Security checks.
3. **Packaging:** Docker images for API and Web are built with version/commit ARGs, signed with Cosign, and pushed to GHCR.
4. **Deploy:** GitHub Actions SSHes into the Staging server, updates `.env` with the new image tags, and runs `docker compose pull && docker compose up -d`.
5. **Validation:** CI checks `/api/v1/health/build-info` to confirm the commit matches `github.sha`, then runs Playwright Smoke tests.
6. **Auto-Rollback:** If validation fails, the `rollback-staging` job reverts `.env` to the previous tag and restarts containers.

### Production Deployment (Manual Approval)
1. **Trigger:** `deploy-production` job in GitHub Actions.
2. **Approval:** Click "Review deployments" in the GitHub UI (Requires approval for the `production` environment).
3. **Deploy:** Identical process to Staging; SSHes to Production server, updates tags, pulls, and restarts.

## Manual Deployment (Emergency / Break-glass)

If GitHub Actions is down, you can manually deploy using the following steps:

1. **SSH into the server:**
   ```bash
   ssh user@production-host
   ```
2. **Navigate to app directory:**
   ```bash
   cd /opt/homeland-production
   ```
3. **Update Version:**
   ```bash
   vim .env
   # Update API_TAG and WEB_TAG to the desired version (e.g., v1.2.3)
   ```
4. **Pull and Restart:**
   ```bash
   docker compose pull
   docker compose up -d
   ```
5. **Verify:**
   ```bash
   curl -s https://homeland.example.com/api/v1/health/build-info
   ```
