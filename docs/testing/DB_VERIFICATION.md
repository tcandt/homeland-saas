# Database Verification (A-Z)

Validating at the UI and API layer is insufficient for Production Readiness. A complete end-to-end trace must confirm that the Database exactly matches the expected business model.

## A-Z Verification Flow

For any CRUD operation, the Database must be validated alongside the UI flow. Example sequence:

1. **UI Action**: Submit Create Form (e.g. Create Room).
2. **API Verification**: Wait for 2XX HTTP Status.
3. **DB Verification**: Query the actual DB directly to confirm:
   - Entity exists.
   - Core identifiers match (uildingId, loorId).
   - Expected tenant fields match (	enantId).
   - Business data matches precisely (monthlyPrice, capacity).
4. **Audit Verification**: Confirm \AuditLog\ row was created with the correct event and payload.
5. **UI Reload**: Reload the page to guarantee the UI renders from the DB truth, not just React state.
6. **Cleanup DB Verification**: Delete the entity and query DB directly to confirm deletion (or soft-deletion: \deletedAt\ is not null).

## Rule
If a test asserts \expect(toast).toBeVisible()\ but fails to assert \SELECT * FROM Room WHERE ...\, the Database Gate fails.
