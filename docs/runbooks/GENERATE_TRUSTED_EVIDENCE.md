# Generate Trusted Evidence (Runbook)

To safely generate evidence for an Epic and pass the EOS v3 Gate Engine, you must use the Execution-Bound Evidence tools.

## 1. Start Execution
Generate a unique Execution ID for the target Epic:
`ash
npm run eos:start -- --epic=04
`
*(This will output your Execution ID, e.g., RUN-20260710T120000Z-XYZ)*

## 2. Record Evidence
Run the verification command through the trusted recorder wrapper:
`ash
npm run eos:record -- -ExecutionId <EXECUTION_ID> -Epic 04 -Stage verify_prod -CommandId verify_prod
`
*(This runs the command, captures logs, and generates cryptographically signed metadata).*

## 3. Generate Receipt
Generate the execution receipt to submit to the Gate Engine:
`ash
npm run eos:receipt -- --execution-id=<EXECUTION_ID> --epic=04
`
