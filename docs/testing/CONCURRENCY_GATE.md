# Concurrency Gate

Modern SaaS applications must handle simultaneous operations gracefully. The Concurrency Gate ensures modules do not suffer from data corruption due to race conditions.

## Requirements

### 1. Optimistic Concurrency Control (OCC)
- If two users (User A and User B) open the same record simultaneously, and User A saves an update, User B's subsequent save attempt MUST fail gracefully (e.g., 409 Conflict) or merge correctly. It must not blindly overwrite User A's changes.

### 2. Multi-user Concurrent CRUD
- Load testing scenarios MUST simulate simultaneous writes to the same collection (e.g. 5 concurrent requests attempting to create a Room in the same Floor).
- Ensure the database enforces constraints (like unique room names per floor) and prevents duplicates when hit concurrently.

### 3. Idempotency
- Duplicate POST requests executed rapidly must not result in duplicated records where a single business action was intended.
