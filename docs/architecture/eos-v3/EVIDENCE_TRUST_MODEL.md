# EOS v3 Evidence Trust Model

## Core Principle
Evidence is valid only if it originates directly from execution logs bound to a unique, cryptographically identifiable Execution ID. A timestamp alone is not proof of origin.

## Trust Requirements

1. **Origin Authority**: Evidence must be created by ecord-evidence.ps1.
2. **Execution Binding**: Evidence must belong to an Execution ID generated before command execution.
3. **Metadata Integrity**: Evidence metadata manifest must exactly match its raw output files.
4. **Cryptographic Proof**: Evidence SHA256 hashes must match the recorded manifest.
5. **Command Whitelist**: The executed command must be allowed for the requested stage.
6. **Exit Code Validation**: The exit code must be zero (or match specific stage requirements).
7. **Semantic Validation**: Stage-specific output markers (e.g., "Verification PASSED.") must be present in stdout, and failure markers must be absent.
8. **Immutability**: Files must not be altered after generation.
9. **Execution Context**: Evidence must belong to the current verification run.
10. **Quarantine**: Legacy/untrusted evidence is permanently ineligible.
