# EOS V3.5 Evidence Protection Report

| Test | Objective | Expected | Actual | Result | Reason |
|---|---|---|---|---|---|
| Test A-T | Legacy checks (integrity) | SIGNATURE_INVALID | SIGNATURE_INVALID | PASS | - |
| Test E | Exit Code Tampering | SIGNATURE_INVALID | SIGNATURE_INVALID | PASS | - |
| Test F | Missing Evidence | EVIDENCE_UNAVAILABLE | EVIDENCE_UNAVAILABLE | PASS | - |
| Test U | Policy modified after start | POLICY_HASH_MISMATCH | POLICY_HASH_MISMATCH | PASS | - |
| Test V | Toolchain tampered | TOOLCHAIN_HASH_MISMATCH | TOOLCHAIN_HASH_MISMATCH | PASS | - |
| Test W | Receipt replayed | EXECUTION_REPLAY_REJECTED | EXECUTION_REPLAY_REJECTED | PASS | - |
| Test X | Cross repo receipt | REPOSITORY_OR_TRUST_ANCHOR_MISMATCH | REPOSITORY_OR_TRUST_ANCHOR_MISMATCH | PASS | - |
| Test Y | Ephemeral key vs Prod Gate | UNTRUSTED_SIGNER_PROFILE | UNTRUSTED_SIGNER_PROFILE | PASS | - |
| Test Z | Local sig vs Release Gate | LOCAL_VERIFIED | LOCAL_VERIFIED | PASS | - |
| Test AA | Chain truncated | CHAIN_ANCHOR_MISMATCH | CHAIN_ANCHOR_MISMATCH | PASS | - |
| Test AB | Evidence missing | EVIDENCE_UNAVAILABLE | EVIDENCE_UNAVAILABLE | PASS | - |