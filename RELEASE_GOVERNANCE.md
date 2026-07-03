# Release Governance & Workflow

> **STATUS:** DOCUMENTED / PENDING MANUAL CONFIGURATION IN GITHUB SETTINGS
> 
> *The workflows described below depend on Branch Protection and Environment policies that must be manually configured in GitHub.*

## 1. Release Approval Workflow

Homeland SaaS utilizes a Continuous Delivery (CD) model with a final manual gate for Production deployments.

1. **Development & PR:** Developers create feature branches and submit Pull Requests targeting `main`.
2. **Validation:** All Required Status Checks (Lint, Typecheck, Unit, Integration, E2E, Security) must pass.
3. **Peer Review:** 1-2 approvals are required from Code Owners.
4. **Merge to Main:** Once merged, the `semantic-release` job automatically bumps the version, creates a Git tag, and generates a release note.
5. **Staging Deployment:** The pipeline automatically deploys the new artifact to the `staging` environment.
6. **Production Approval:** The `deploy-production` job pauses and waits for manual approval.
   - **Approvers:** Only authorized individuals (e.g., Tech Leads, Release Managers) designated in the GitHub `production` environment settings can approve the release.
7. **Production Deployment:** Upon approval, the deployment proceeds to the Production VPS.

## 2. Hotfix Workflow

In the event of a critical issue in Production that requires immediate resolution:

1. **Identify the Issue:** Confirm the bug is affecting Production.
2. **Create Hotfix Branch:** Branch off the affected release tag (e.g., `hotfix/v1.2.x`).
3. **Develop Fix:** Apply the minimal necessary code changes.
4. **Pull Request:** Open a PR against the `main` branch (if applicable) and a dedicated release branch if backporting is required.
5. **Expedited Review:** A Tech Lead must review and approve the PR immediately.
6. **Pipeline Execution:** Ensure all CI checks pass.
7. **Deploy:** The fix is merged, a new patch version is generated (e.g., `v1.2.1`), and the standard Release Approval Workflow is followed to deploy to Staging, then Production.

## 3. Rollback Governance

If a deployment to Production introduces severe degradation or critical failures, an immediate rollback must be executed.

- **Authority to Rollback:** Any On-Call Engineer, Tech Lead, or Release Manager has the authority to initiate a rollback. No secondary approval is required during an active incident.
- **Rollback Procedure:** Refer to `ROLLBACK_CHECKLIST.md` for the exact steps to revert the `.env` tags on the Production VPS and restart the containers.
- **Post-Rollback:** 
  - Verify system stability via Health Checks.
  - Halt further deployments in GitHub Actions.
  - Conduct a post-mortem to identify the root cause.
  - Apply a forward-fix via the standard or hotfix workflow.

## 4. Release Freeze

During critical business periods (e.g., major marketing campaigns, holidays), a Release Freeze may be enacted.

- **Enforcement:** Administrators will temporarily disable the manual approval mechanism for the `production` environment or lock the `main` branch.
- **Exceptions:** Only critical hotfixes (P0/Sev1) are permitted during a freeze, requiring explicit sign-off from Engineering Leadership.
