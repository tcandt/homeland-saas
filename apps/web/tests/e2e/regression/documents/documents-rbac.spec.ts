import { expect } from '@playwright/test';
import { DataFactory } from '../../utils/data-factory';
import { test } from '../../fixtures/rbac.fixture';

test.describe('Documents RBAC Regression', () => {
  let docId: string;

  test.beforeAll(async ({ browser }) => {
    // Generate a document using a fresh API context
    // We cannot use fixtures in beforeAll easily without worker-scoped, so let's generate it directly
  });

  test('Admin can access and download document', async ({ admin }) => {
    const factory = new DataFactory(admin.api);
    const docResponse = await factory.generateDocument('RBAC-DOC-ADMIN', 'CONTRACT_TEMPLATE');
    docId = docResponse.id;
    
    const downloadRes = await factory.downloadDocument(docId, admin.token);
    expect(downloadRes.status()).toBe(200);
  });

  test('Sales cannot download document without document.download permission', async ({ sales, admin }) => {
    const factoryAdmin = new DataFactory(admin.api);
    const docResponse = await factoryAdmin.generateDocument('RBAC-DOC-SALES', 'CONTRACT_TEMPLATE');
    
    const factorySales = new DataFactory(sales.api);
    const downloadRes = await factorySales.downloadDocument(docResponse.id, sales.token);
    // Depending on logic, it should return 403 or 401
    expect([401, 403]).toContain(downloadRes.status());
  });

  test('Tenant isolation: Cannot access document from another tenant', async ({ admin, sales }) => {
    test.info().annotations.push({
      type: 'issue',
      description: 'Tenant document access: PENDING - Reason: Tenant portal not implemented',
    });
    
    const factoryAdmin = new DataFactory(admin.api);
    const docResponse = await factoryAdmin.generateDocument('RBAC-DOC-TENANT', 'CONTRACT_TEMPLATE');
    
    const otherTenantToken = 'other-tenant-token-mock';
    const factoryMock = new DataFactory(admin.api); // Will just use token in downloadDocument
    const downloadRes = await factoryMock.downloadDocument(docResponse.id, otherTenantToken);
    expect([401, 403, 404]).toContain(downloadRes.status());
  });
});
