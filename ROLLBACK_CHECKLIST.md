# Rollback Checklist

This checklist is used when an emergency rollback is required on Staging or Production.

## Automated Rollback (Staging Only)
Staging handles rollback automatically if Health Checks or Smoke Tests fail post-deployment.
- [ ] Check GitHub Actions logs to verify `rollback-staging` successfully executed.
- [ ] Confirm the Staging environment `/api/v1/health/build-info` reflects the PREVIOUS commit hash.

## Manual Rollback (Production & Staging)
Follow these steps to manually rollback a deployment.

### 1. Identify the previous stable version
- [ ] Check GitHub Releases or GHCR for the previous stable tag (e.g., `v1.2.2`).
- [ ] Alternatively, check the `deployment.json` artifacts from previous GitHub Action runs.

### 2. Connect to the Server
- [ ] SSH into the affected environment:
  ```bash
  ssh user@<environment-host>
  cd /opt/homeland-<environment>
  ```

### 3. Apply the Rollback
- [ ] View the backup tags:
  ```bash
  cat .env.tmp # This file stores PREVIOUS_API_TAG and PREVIOUS_WEB_TAG from the last CI run
  ```
- [ ] Edit `.env` to restore the previous tags:
  ```bash
  vim .env
  # Set API_TAG=v1.2.2
  # Set WEB_TAG=v1.2.2
  ```
- [ ] Pull the older images (if not cached):
  ```bash
  docker compose pull
  ```
- [ ] Restart the services:
  ```bash
  docker compose up -d
  ```

### 4. Verify Rollback
- [ ] Check the Build Info endpoint:
  ```bash
  curl -s https://<environment-url>/api/v1/health/build-info
  ```
- [ ] Confirm that `version` and `commit` match the expected older version.
- [ ] Check logs for crash loops:
  ```bash
  docker compose logs -f api web
  ```

### 5. Post-Mortem
- [ ] Open an Incident ticket mapping the failed commit.
- [ ] Lock deployments to Production until the fix is merged.
