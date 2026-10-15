# NAS HTTPS UI smoke - 2026-10-15

Status: bounded admin UI smoke PASS on API573bc663/Webe9e24274. Not full UAT,
financial reconciliation, Web rollback or production acceptance.

- Chrome through `https://homeland.ductinh.one`: synthetic admin login,
  Dashboard, Finance and Reports rendered. Sidebar has no Sales module.
- Finance default:10/2026 ->10/2026. Reports default:2026-10. Both match the
  current month in GMT+7, not the latest month having financial data.
- Desktop Reports and Finance render with seeded buildings and zero financial
  activity. No payment, contract or external notification was created.
- At the390x844 viewport override, settled Finance and Reports main content
  have left0/margin-left0 and no document horizontal overflow (client/scroll
  width375, excluding the desktop scrollbar). Finance light/dark inspected;
  viewport and light theme restored afterward. Not physical Android/iOS UAT.
- First screenshot immediately after switching from desktop caught the300ms
  sidebar-margin transition, appearing to leave a large left gap. Settled DOM
  measurements and screenshots did not reproduce a persistent defect. No
  production code was changed for this transient observation.
- Logout returned to login. Reopening Reports while logged out redirected to
  login. Browser console error list was empty through login/navigation/theme/
  logout/unauthenticated route checks. This does not test token-expiry races or
  every cause of a401; unauthenticated protected APIs should still reject access.
- Private fixture credential was loaded directly from local configuration, not
  logged or committed; in-memory parsed values cleared after testing. No password
  manager, browser password-save, settings security or provider controls changed.

Local screenshots under `testing/nas-runtime-20261015/`:

- `reports-ui.png`: authenticated desktop Reports.
- `reports-mobile-before.png`: transient, NOT a persistent-defect baseline.
- `reports-mobile-settled.png`: settled mobile Reports.
- `finance-mobile-settled.png` and `finance-mobile-dark.png`.

UI login/logout causes expected User/AuditLog/session writes AFTER the recovery
drill's final source hash checkpoint. The unchanged-source proof in the recovery
report applies to the isolated restore/rollback interval, not all subsequent UI
tests. Recovery evidence: `NAS_BOOTSTRAP_RUNTIME_20261015.md`.

Remaining: manager/finance/owner UI, nonzero financial lifecycles, attachments,
worker processing, provider-approved integration tests, Web rollback, physical
devices/WebKit, unified immutable release and independent review. LIVE NO-GO.
