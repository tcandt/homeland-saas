# Performance Gate

Performance metrics must be evaluated systematically on every test run. Poor performance that "passes" functionally is considered a failure.

## Metrics Assessed

### 1. Network Request Count
The number of requests executed to perform a single business action must be tracked and bounded.
- *Example*: Creating a Room must not cause 12 separate GET requests (e.g. GET Building, GET Floors, GET Rooms, GET Tree, GET Sidebar...). If a single UI interaction triggers a waterfall of requests exceeding defined thresholds, the Performance Gate fails.

### 2. Time to Interactive (TTI)
- The time from clicking an action to the UI being fully responsive must not exceed 2000ms.

### 3. Payload Sizes
- API responses must be paginated or appropriately trimmed. Returning 5000 rooms in a single unpaginated JSON array will fail the Performance Gate.

## Enforcement
The 
etwork.har from the Evidence Package will be parsed after E2E runs to assert against these metrics.
