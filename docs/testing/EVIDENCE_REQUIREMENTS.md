# Evidence Requirements

Every module MUST produce a verifiable **Evidence Package** after each E2E test run. Logging "PASS" in terminal output is strictly prohibited as a final measure of success.

## The Evidence Package

For every scenario executed, the following artifacts must be preserved:

- 	race.zip: Full Playwright trace for offline replay.
- ideo.webm: Video recording of the scenario.
- console.log: Complete browser console output, proving 0 runtime errors.
- 
etwork.har: Network HAR file to audit API calls and payload sizes.
- screenshots/: Visual snapshots at key interaction points and error states.
- db-before.json: Database snapshot before the scenario.
- db-after.json: Database snapshot after the scenario.

## Directory Structure
Evidence MUST be stored logically by module and timestamp:
\\\
artifacts/
  <module>/
    YYYY-MM-DD/
      playwright-report/
      trace.zip
      video.webm
      ...
\\\

## Policy vs Tooling
This policy is established first. Tooling (e.g., \playwright.config.ts\) will be updated in subsequent iterations to enforce this standard automatically.
