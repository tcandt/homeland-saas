# EOS v3.5 Evidence Trust Model

**Status**: IMPLEMENTING

## Core Principles
1. **Cryptographic Signatures**: Evidence must be cryptographically signed by a trusted anchor (Ed25519/HMAC). SHA256 alone is insufficient as it proves integrity but not origin.
2. **Trust Profiles**: Two explicit profiles:
   - LOCAL_DEVELOPMENT: Machine-local evidence. Max gate status: LOCAL_VERIFIED.
   - CI_TRUSTED: Uses external trust anchor (e.g. GitHub Actions OIDC + Sigstore). Required for PRODUCTION_VERIFIED.
3. **Immutable Storage**: Artifacts are stored in .eos/runs/ which is .gitignored and append-only.
4. **Receipt Chaining**: Receipts must link to the previousReceiptHash forming a continuous verifiable chain anchored externally.
5. **SLSA Provenance**: Complete provenance (OS, Node, lockfile SHA, package.json SHA, Prisma SHA) is recorded.
6. **Tool & Policy Integrity**: Toolchain and policy hashes are pinned before execution and verified to prevent post-execution tampering.
