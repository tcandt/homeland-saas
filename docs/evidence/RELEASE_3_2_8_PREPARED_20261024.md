# Release 3.2.8 preparation — 24 October 2026

Scope: operational reset availability during testing and terminal booking-contract status display. Preserve fixed buildings/rooms, application settings, Hunonic mappings and payment routes. Reset requires administrator password and explicit confirmation. Configured backup remains enabled by default; absent backup configuration does not disable reset.

Prior focused verification: API 35/35, Web units 93/93, mocked reset browser 4/4 and booking cancellation browser 6/6, API/Web typechecks passed. These results were obtained in the working tree; exact staged candidate CI remains required.

No production reset, seed or migration is authorized as deployment acceptance. Real PostgreSQL reset FK/trigger/rollback behavior remains unverified. CORE10/GATE10, provider delivery and financial UAT remain open.

Deployment pending. Baseline NAS release 3.2.6, four buildings, 34 rooms and 37 completed migrations. Release scripts require exact Git provenance, successful CI, image security/runtime checks, private database dump and protected-row integrity comparison before acceptance.
