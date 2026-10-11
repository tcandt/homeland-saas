# B12 — CCCD provenance rollout

`Customer.idImageProvenance` is additive and nullable so the migration does not rewrite legacy customer data. The compiled-PDF route intentionally fails closed for a legacy `idImages`-only record; an array position is not proof of front/back or approval.

Before any staging or production export:

1. Keep the database backup and release rollback point required by `CORE-10.07`.
2. For each customer whose contract PDF is needed, upload or select the tenant-owned front and back documents, then approve each side through `POST /customers/:id/identity-images/approve`. The API verifies document ownership and stamps the authenticated reviewer and approval time.
3. Re-open the contract detail and confirm both sides are present. Only then run the compiled-PDF smoke check.
4. Do not bulk-copy `idImages[0]`/`idImages[1]` into provenance. A reviewed operator must confirm the side of every legacy image; unresolved records remain blocked with `CCCD_PROVENANCE_REQUIRED`.

This is a release prerequisite, not a production migration. No NAS or production data repair is authorized by this document.
