# EOS v4 Architecture

## 1. Hash-Chained Event Log
Evidence is now chronologically written to an immutable event.log rather than replacing state files.
- Each event is cryptographically linked to the previous event (previousEventHash).
- The Receipt validates the event log integrity and attachments.
- Tampering or truncating an event results in a broken chain.

## 2. Declarative Policy Engine
Gate logic is completely isolated in policy-engine.ts.
- It evaluates declarative JSON/YAML schemas (no executable code).
- Enforces strict criteria like requiresStages, maxEvidenceAgeMinutes, trustProfile.
- Emits policy-evaluation.json.

## 3. Dependency Graph
Policies can specify requiresDependencies (e.g. Epic 05 depends on Epic 04).
- The Engine validates the acyclic nature of the dependency graph.
- Resolves upstream Gate statuses.
- Propagates blocking statuses natively (BLOCKED_BY_DEPENDENCY).

## 4. Supply Chain Digest & Runtime Provenance
Executions snapshot their environment to assure exact reproducability.
- Capture hashes for node, npm, tools.
- Capture execution seeds and environment details (OS, Node version).
- Prevent mid-flight runtime swapping.

## 5. CI Integration Contracts (Phases 6-10)
Contracts exist for ArtifactStore, AttestationSigner, IdentityProvider, TransparencyLog, ReleaseCertifier.
Locally, these must strictly return NOT_CONFIGURED.
