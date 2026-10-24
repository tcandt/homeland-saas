# Local 3.2.7 Booking Cancellation Status - 2026-10-21

Status: local scoped fix verified; not committed, pushed or deployed to NAS.

## Scope And Cause

- Desktop OperationsContractRow used a generic booking-type badge before considering lifecycle status. A cancelled booking therefore still appeared as a holding deposit although its detail status was CANCELLED.
- Shared getContractDisplayStatus also allowed live/persisted conversion links to override terminal labels. Terminal status now takes precedence, while non-terminal converted sources retain their conversion label.
- Terminal records no longer receive a near-expiry badge based only on their date. Drawer remaining-time summaries show the terminal label instead of days remaining.
- Terminal booking holds no longer expose the generic invoice action. Historical invoice access for normal ended rental contracts remains available. Unconverted holds no longer claim completed conversion.
- Existing cancellation query invalidation retained; no backend financial, ledger, refund allocation, permission or database changes. Pre-existing dirty work preserved.
- Version metadata synchronized from3.2.6 to3.2.7 using the repository version script.

## Verification

- Independent review PASS after narrowing invoice suppression to terminal booking holds. Additional terminal/conversion precedence correction independently reviewed PASS.
- Focused unit gate93/93 PASS, including terminal row labels with persisted conversion links, pending/converted compatibility, cancellation, drawer invoice guard and booking conversion regressions.
- Web TypeScript `tsc --noEmit` PASS.
- Local browser6/6 PASS:1440px/390px x NONE/PARTIAL/FULL refund decisions. Verifies post-cancel drawer and list show cancellation, cancel/invoice actions absent, no remaining-day claim or false conversion success. Canonical balance/proof/retry checks retained.
- Browser ran on existing localhost3015 with mocked APIs only; no real financial/auth/provider write. Existing local server retained.
- Scoped diff whitespace check PASS. No full build or full-system UAT claim.

## Remaining

- NAS remains3.2.6. No production customer/deposit repair was attempted or required to establish this UI cause.
- Release commit, exact-source CI/image verification and NAS deployment are separate follow-up work.
