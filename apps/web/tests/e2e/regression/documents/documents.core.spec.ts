import { expect } from '@playwright/test';
import { DataFactory } from '../../utils/data-factory';
import { test } from '../../fixtures/admin.fixture';

test.describe('Documents Core Regression', () => {
  test.skip(process.env.RUN_DESTRUCTIVE_E2E !== 'true', 'Set RUN_DESTRUCTIVE_E2E=true only against an isolated disposable database.');
  let docId: string;
  let signatureReqId: string;
  let adminToken: string;

  test('Vertical Documents Workflow (CRUD, Signature, Download)', async ({ admin, request }) => {
    const factory = new DataFactory(admin.api);
    adminToken = admin.token;
    const page = admin.page;

    // 1. Create document via real API
    const docResponse = await factory.generateDocument('E2E-DOC', 'CONTRACT_TEMPLATE');
    docId = docResponse.id;
    expect(docId).toBeDefined();

    // 2. Request signature via API
    const reqResponse = await factory.requestSignature('E2E-DOC', docId);
    signatureReqId = reqResponse.id;
    expect(signatureReqId).toBeDefined();
    const partyId = reqResponse.parties[0].id;

    // 3. Apply signature
    await factory.applySignature('E2E-DOC', signatureReqId, partyId);

    // 4. Verify Document UI
    await page.goto('/documents');
    
    // Wait for the UI parts
    await expect(page.getByTestId('documents-root')).toBeVisible();
    await expect(page.getByTestId('document-explorer')).toBeVisible();
    await expect(page.getByTestId('document-list')).toBeVisible();
    
    // The specific document should be visible
    const docRow = page.getByTestId('document-list').getByRole('row', { name: 'E2E-DOC-Document' }).first();
    await expect(docRow).toBeVisible();

    // Open Drawer by clicking the view button inside the row
    await docRow.getByTestId('document-view-button').first().click({ force: true });
    const drawer = page.getByTestId('document-preview-drawer');
    await expect(drawer).toBeVisible();

    // Verify Version List
    await expect(page.getByTestId('document-version-list')).toBeVisible();

    // Verify Timeline
    await expect(page.getByTestId('document-timeline')).toBeVisible();

    // The signature canvas shouldn't be open because we already signed it via API
    await expect(page.getByTestId('signature-canvas')).not.toBeVisible();

    // Download Button
    await expect(drawer.getByTestId('document-download-button')).toBeVisible();

    // 5. Download Validation
    const downloadRes = await factory.downloadDocument(docId, adminToken);
    expect(downloadRes.status()).toBe(200);
    const contentType = downloadRes.headers()['content-type'];
    expect(contentType).toContain('application/pdf');
    const contentDisposition = downloadRes.headers()['content-disposition'];
    expect(contentDisposition).toContain('attachment');
    
    const buffer = await downloadRes.body();
    expect(buffer.byteLength).toBeGreaterThan(0);

    // 6. Security tests
    // 6.1 Download without JWT
    const noJwtRes = await request.get(`http://127.0.0.1:3001/api/v1/documents/${docId}/download`);
    expect(noJwtRes.status()).toBe(401);

    // 6.2 Invalid Document ID
    const invalidIdRes = await factory.downloadDocument('invalid-id', adminToken);
    expect([403, 404]).toContain(invalidIdRes.status());

    // 6.3 Path Traversal via download ID (e.g., passing absolute path)
    const ptRes = await factory.downloadDocument('../../../../etc/passwd', adminToken);
    expect([400, 403, 404]).toContain(ptRes.status());

    // 7. Cleanup
    await factory.cleanup({ documentId: docId });
  });
});
