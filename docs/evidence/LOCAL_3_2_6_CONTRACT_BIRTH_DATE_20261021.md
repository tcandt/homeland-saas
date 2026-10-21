# Local 3.2.6 Contract Birth Date - 2026-10-21

Status: LOCAL VERIFIED WITH RENDERING LIMIT; not committed, pushed or deployed.

## Scope

- Screenshot title traces to PreviewContractModal, fed by RoomPremiumModal contract payloads. Those payloads could contain placeholder ngaySinh and reduced or snapshot-merged customer data; preview previously preferred a nonempty placeholder over available birthDate and used dayjs for local dates.
- Shared strict DOB parsing now accepts calendar-valid ISO dates/timestamps and DD/MM/YYYY, preserves written birth calendar fields without timezone shifting, rejects impossible/future dates and normalizes DD/MM/YYYY.
- Room preview/export reads current contract customer first, then exact-ID local customer. Merged representative data cannot override the primary DOB when a snapshot exists. Snapshot fallback requires matching primary customer ID. Review caught and corrected an initial snapshot/current precedence issue.
- Preview ignores placeholder ngaySinh when valid primary data exists. Missing/invalid date produces a clear update-customer message before export.
- Both export-contract and compiled dossier routes reject missing/invalid primary DOB with422 before template/converter work. Newly generated lease and CT01 use the same validated date.
- Existing signed/uploaded PDF attachments remain unchanged. No DOB was inferred from identity number or written into customer records.
- Version increased from local3.2.5 to3.2.6; existing dirty changes preserved.

## Evidence

- Independent review PASS after confirmed precedence correction.
- Focused Web gate44/44: DOB helper, compiled-pdf export, Preview source regression and mocked export-contract route.
- Tests cover local date normalization, leap/impossible/future dates, primary preference, matching/mismatched snapshot identities, placeholder masking, CT01/lease fields and422 before rendering/conversion.
- Web typecheck PASS; scoped whitespace check PASS. Local http://localhost:3015/login returned200.

## Limits

- Actual PDF visual acceptance not performed: LibreOffice converter is unavailable locally. Conversion/template dependencies are mocked in route tests; Preview regression is source-level, not browser interaction acceptance.
- Customer-specific production DOB was not inspected or repaired. Missing production DOB still requires the correct date to be entered in customer profile. Previously saved PDFs are not automatically regenerated or edited.
- No production database mutation, real provider call, commit/push or NAS deployment. NAS remains3.2.3.
