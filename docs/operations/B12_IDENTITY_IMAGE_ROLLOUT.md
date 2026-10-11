# B12 — CCCD provenance rollout

`Customer.idImageProvenance` is additive and nullable so the migration does not rewrite legacy customer data. The compiled-PDF route intentionally fails closed for a legacy `idImages`-only record; an array position is not proof of front/back or approval.

Before any staging or production export:

1. Keep the database backup and release rollback point required by `CORE-10.07`.
2. For each customer whose contract PDF is needed, upload each side through `POST /customers/:id/identity-images/upload` (send `file`; for a scan also send `original`) or select an existing tenant-owned document and use `POST /customers/:id/identity-images/approve`. The API verifies document ownership and stamps the authenticated reviewer and approval time.
3. Re-open the contract detail and confirm both sides are present. Only then run the compiled-PDF smoke check.
4. Do not bulk-copy `idImages[0]`/`idImages[1]` into provenance. A reviewed operator must confirm the side of every legacy image; unresolved records remain blocked with `CCCD_PROVENANCE_REQUIRED`.
5. For a scan, upload the original photo and the cropped scan as two separate tenant-owned documents. The original is retained as `originalUrl`; only the approved scan `url` is selected for the compiled PDF.
6. Treat `idImages` as a compatibility projection of the currently approved provenance only. Replacing or revoking a side must remove the old URL from that projection. `idImageProvenance` holds the active set; the transactional AuditLog `before` snapshot retains the replaced/revoked URL, original, reviewer and approval time.
7. Prefer the upload endpoint for new scans: original, scan, document records, approval and audit are committed as one transaction. If the transaction rolls back, only newly staged files without a committed document record are compensated; a committed file is never deleted because of an ambiguous client response.

This is a release prerequisite, not a production migration. No NAS or production data repair is authorized by this document.
