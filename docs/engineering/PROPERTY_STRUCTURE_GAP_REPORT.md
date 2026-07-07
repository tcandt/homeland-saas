# Property Structure Gap Report
(Buildings → Floors → Rooms)

## 1. Existing Backend Endpoints
- **Buildings**: CRUD operations exist in `apps/api/src/buildings/buildings.controller.ts` & `buildings.service.ts`.
- **Floors**: CRUD operations exist in `apps/api/src/floors/floors.controller.ts` & `floors.service.ts`.
- **Rooms**: CRUD operations exist in `apps/api/src/rooms/rooms.controller.ts` & `rooms.service.ts`.

## 2. Existing Frontend Pages/Components
- `apps/web/app/buildings/page.tsx`
- `apps/web/app/rooms/page.tsx`
- Components in `apps/web/components/buildings`: `BuildingGrid.tsx`, `BuildingDetailPanel.tsx`, `BuildingExplorerTree.tsx`, etc.
- **Critical Issue**: The frontend UI is entirely disconnected from the backend API. It strictly uses hardcoded mock data from `apps/web/components/buildings/mockData.ts`.

## 3. Existing Tests
- **Backend**: `0` Unit tests for Buildings, Floors, and Rooms modules.
- **Frontend/E2E**: No existing Smoke/E2E tests specifically covering the integration between Building UI and Backend API.

## 4. Missing Flows & UI Components
- Fetching real data from the backend (React Query integration).
- Create/Edit/Delete Modals for Buildings, Floors, and Rooms that connect to the backend endpoints.
- Error handling & loading states for property structure.

## 5. Mock Data
- Heavily utilized in `apps/web/components/buildings/mockData.ts` representing `Building`, `Floor`, `Room`, `SharedTenant`, `Contract`, and `Invoice` all at once. This mocks an entire hierarchical JSON structure that the frontend expects but the backend might serve differently (requires mapping).

## 6. TODO/FIXME
- The frontend needs to replace `mockData.ts` with API calls (`useBuildingsQuery`, `useRoomsQuery`, etc.).
- Implement relation filtering (e.g., getting all rooms inside a specific building).
- Missing test coverage for all `buildings`, `floors`, and `rooms` API services.

## 7. RBAC Gaps
- Need to verify if `BuildingsController`, `FloorsController`, and `RoomsController` properly enforce the `RequiresPermission` guards (`building.read`, `room.create`, etc.). 

## 8. Data Integrity Gaps
- Cannot delete a Building if it has active Rooms.
- Cannot delete a Room if it has active Contracts/Tenants.
- Need to ensure Prisma Cascade/Restrict deletes are configured correctly for `Building -> Floor -> Room`.

## 9. A-Z Scenarios to Verify
- Create a Building.
- Create Floors inside that Building.
- Create Rooms inside those Floors.
- Edit Room properties (Type, Capacity, Price).
- Prevent deleting a Room that has an active Contract.
- Delete a vacant Room.
- Archive a Building.

## 10. Recommended First Implementation/Fix Commit
- **Commit 1 (DONE)**: Integrate Frontend `buildings` page with backend API to replace `mockData.ts` with real data fetching.
- **Commit 2 (DONE)**: Add unit tests for `buildings`, `floors`, `rooms` on the backend to verify RBAC and validation logic.
- **Commit 3**: Build Create/Edit/Delete UI Modals and Wire up to API hooks.
