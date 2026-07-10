# EOS V3.5 Evidence Protection Report

| Test | Objective | Expected | Actual | Result | Reason |
|---|---|---|---|---|---|
| Test U | Policy modified after start | POLICY_HASH_MISMATCH | SIGNATURE_INVALID | FAIL | - |
| Test V | Toolchain tampered | TOOLCHAIN_HASH_MISMATCH | SIGNATURE_INVALID | FAIL | - |
| Test W | Receipt replayed | EXECUTION_REPLAY_REJECTED | EXECUTION_REPLAY_REJECTED | PASS | - |
| Test X | Cross repo receipt | REPOSITORY_OR_TRUST_ANCHOR_MISMATCH | REPOSITORY_OR_TRUST_ANCHOR_MISMATCH | PASS | - |
| Test Y | Ephemeral key vs Prod Gate | UNTRUSTED_SIGNER_PROFILE | SIGNATURE_INVALID | FAIL | - |
| Test Z | Local sig vs Release Gate | TRUST_PROFILE_INSUFFICIENT | SIGNATURE_INVALID | FAIL | - |
| Test AA | Chain truncated | CHAIN_ANCHOR_MISMATCH | CHAIN_ANCHOR_MISMATCH | PASS | - |
| Test AB | Evidence missing | EVIDENCE_UNAVAILABLE | SIGNATURE_INVALID | FAIL | - |