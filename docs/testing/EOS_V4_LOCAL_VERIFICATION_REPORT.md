# EOS v4 Local Verification Scope
- Event removed from middle of chain -> EVENT_CHAIN_BROKEN
- Event inserted into chain -> EVENT_CHAIN_BROKEN
- Event reordered -> EVENT_CHAIN_BROKEN
- Attachment modified -> ATTACHMENT_TAMPERED
- Duplicate sequence -> EVENT_SEQUENCE_DUPLICATE
- Missing sequence -> EVENT_SEQUENCE_MISSING
- Policy changed after receipt -> POLICY_HASH_MISMATCH
- Dependency cycle -> DEPENDENCY_CYCLE_DETECTED
- Missing dependency -> DEPENDENCY_UNKNOWN
- Blocked upstream dependency -> BLOCKED_BY_DEPENDENCY
- Node/npm shim digest mismatch -> SUPPLY_CHAIN_TAMPERED
- Test manifest count mismatch -> REPORT_INCONSISTENT
- Unexpected test ID -> REPORT_INCONSISTENT
- Generated Markdown manually changed -> MARKDOWN_TAMPERED
- Unconfigured CI adapter attempts trusted status -> NOT_CONFIGURED

Result: All 15 attacks successfully repelled by v4 policy engine.
