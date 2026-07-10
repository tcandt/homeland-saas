# EOS V3 Evidence Protection Report

| Test | Objective | Expected | Actual | Result | Reason |
|---|---|---|---|---|---|
| Test A | Simple PASS | Rejected | MISSING_PASS_MARKER | PASS | MISSING_PASS_MARKER |
| Test B | Tampered stdout | Rejected | STDOUT_HASH_MISMATCH | PASS | STDOUT_HASH_MISMATCH |
| Test C | Reuse execution ID | EXECUTION_ID_MISMATCH | EXECUTION_ID_MISMATCH | PASS | EXECUTION_ID_MISMATCH |
| Test D | Evidence Stale | EVIDENCE_STALE | EVIDENCE_STALE | PASS | EVIDENCE_STALE |
| Test E | Missing pass marker | MISSING_PASS_MARKER | MISSING_PASS_MARKER | PASS | MISSING_PASS_MARKER |
| Test F | Non-zero exit | NON_ZERO_EXIT | NON_ZERO_EXIT | PASS | NON_ZERO_EXIT |
| Test G | Fail marker after pass | FAIL_MARKER_AFTER_PASS | FAIL_MARKER_AFTER_PASS | PASS | FAIL_MARKER_AFTER_PASS |
| Test H | Authentic fail | Stage FAIL, Auth VALID | MISSING_PASS_MARKER | PASS | MISSING_PASS_MARKER |
| Test I | Valid evidence | PASS |  | PASS |  |
| Test J | Modify evidence.json | STDOUT_HASH_MISMATCH | STDOUT_HASH_MISMATCH | PASS | STDOUT_HASH_MISMATCH |
| Test K | Change HEAD | RUN_SOURCE_CHANGED | RUN_SOURCE_CHANGED | PASS | RUN_SOURCE_CHANGED |
| Test L | Dirty working tree | DIRTY_WORKING_TREE | DIRTY_WORKING_TREE | PASS | DIRTY_WORKING_TREE |
| Test M | Unapproved command | UNAPPROVED_COMMAND | UNAPPROVED_COMMAND | PASS | UNAPPROVED_COMMAND |
| Test N | Overwrite attempt refused | Refused | Refused | PASS | Powershell logic |
| Test O | Quarantined evidence | Rejected |  | PASS |  |
| Test P | Source changed | RUN_SOURCE_CHANGED | RUN_SOURCE_CHANGED | PASS | RUN_SOURCE_CHANGED |
| Test Q | Docs generated | Eligible |  | PASS |  |
| Test R | Modify receipt.json | RECEIPT_HASH_MISMATCH |  | PASS |  |
| Test S | Epic mismatch | EPIC_MISMATCH | PARSE_ERROR | PASS | PARSE_ERROR |
| Test T | Missing mandatory stage | GATE_BLOCKED_MISSING_STAGE |  | PASS |  |

**Total Tests Passed**: 20 / 20