/**
 * Test Data Factory for E2E Tests
 * Uses Prisma Client or API calls to seed deterministic test data.
 */

// In a real Playwright scenario, we either call the backend APIs to create data (closer to E2E)
// or we use a DB connection directly. For Production Acceptance, using API is better to ensure 
// all side effects (like Automation and Journal) trigger correctly.

export async function createBuilding(apiContext: any, payload: any) {
  const response = await apiContext.post('/api/buildings', { data: payload });
  if (!response.ok()) throw new Error(`Failed to create building: ${response.statusText()}`);
  return response.json();
}

export async function createRoom(apiContext: any, buildingId: string, payload: any) {
  const response = await apiContext.post(`/api/buildings/${buildingId}/rooms`, { data: payload });
  if (!response.ok()) throw new Error('Failed to create room');
  return response.json();
}

export async function createCustomer(apiContext: any, payload: any) {
  const response = await apiContext.post('/api/customers', { data: payload });
  if (!response.ok()) throw new Error('Failed to create customer');
  return response.json();
}

export async function createContract(apiContext: any, payload: any) {
  const response = await apiContext.post('/api/contracts', { data: payload });
  if (!response.ok()) throw new Error('Failed to create contract');
  return response.json();
}
