# EOS v3 Threat Model

**Status**: VERIFIED (20/20 Test Cases Pass)
# Evidence Threat Model

## Threat: AI Evidence Fabrication (Greenwashing)
**Attack Vector**: An AI agent manually creates a file containing PASS to trick the Gate Engine into closing an Epic without actually running the verification commands.
**Mitigation**: Evidence must contain raw command logs and cryptographic hashes. The Receipt Generator parses actual output, not static PASS strings.

## Threat: Stale Evidence Replay
**Attack Vector**: Re-using valid evidence from a previous successful run to close a later broken state.
**Mitigation**: Evidence is bound to a unique Execution ID. Receipts enforce that the Execution ID matches the current verification context and that the epositoryCommitSha matches.

## Threat: Log Tampering
**Attack Vector**: Modifying the raw logs after execution but before receipt generation to inject Verification PASSED. or remove failure markers.
**Mitigation**: The evidence recorder atomically writes evidence.json with SHA256 hashes of the logs at the moment of completion. The Receipt Generator recalculates hashes; mismatches invalidate the receipt.

