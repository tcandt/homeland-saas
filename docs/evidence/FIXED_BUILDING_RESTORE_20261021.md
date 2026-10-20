# Fixed Building Inventory Restore

User clarified on 21 October 2026 (Asia/Bangkok) that the four fixed buildings and rooms must survive the business-data reset. The preceding whitelist mistakenly omitted this reference inventory.

## Result

- Source: retained `homeland_release_320_postgres`, read-only repeatable-read export.
- Target: serving `homeland_checkout_87aa2457_postgres`; no application image or schema/migration change.
- Restored original IDs/tenant/owner/structure/prices: 4 buildings, 16 floors, 34 rooms. Codes remain canonical DB values `LK01.31`, `LK01.32`, `LK08.24`, `LK08.25`; room counts 7, 7, 10, 10 respectively.
- Old OCCUPIED/RESERVED room states normalized to AVAILABLE because old customers/contracts were intentionally not restored. Other room states unchanged.
- Restored 34 unused room-meter bindings using original mapping/provider/tenant identities. All 37 effective mapping links were verified; every other mapping field remained identical.
- Two building-only mappings (`PN 08-24`, `PN 08-25`) already acquired new readings while investigation was underway. Their existing null bindings were preserved, not forcibly restored: the immutable-used-identity trigger correctly forbids that change. Their building bindings remain deferred. Common EV mapping also preserved unchanged.
- All 21 new readings preserved; 0 billing snapshots, 0 customers and 0 contracts at acceptance. Every other public table's complete row digest was unchanged in the restore transaction.
- Fresh pre-write full target dump retained root-only (`600`) under the protected (`700`) release directory as `inventory-restore-20261021.private.dump`. Source DB untouched, no history deleted, no trigger disabled.

## Checks

- Independent Sol High review PASS after exact two-building-only defer guards were added; independent focused tests 7/7 PASS.
- Exact SQL exercised against a no-network/tmpfs disposable clone of live target: counts/equality/history invariants PASS; repeat application rejected nonempty inventory. Disposable containers removed.
- Live application completed in one guarded transaction after API/worker quiescence and backup; API/worker restarted in finally. Actual result: `PASS, buildings4, floors16, rooms34, linkedMeters34, deferredBuildingBindings2, preservedReadings21, customers0, contracts0`.
- External readiness HTTP200, database/schema UP. Web healthy; API/worker running with restart0 after restart. No fixed-building create/edit UI was added; existing application CRUD policy is not changed by this inventory-only repair.
- Public HTTPS normal login/logout and buildings/rooms/customers/contracts/invoices/Hunonic-history API smoke PASS, including static assets; temporary fixture cleaned. Final API/Web healthy, worker running, restart0; counts rechecked `4|34|0|0|21` (buildings/rooms/customers/contracts/readings).
- Temporary root SSH key revoked after acceptance; key-only reconnect denied. User-account key remained absent. Other authorized keys preserved.
