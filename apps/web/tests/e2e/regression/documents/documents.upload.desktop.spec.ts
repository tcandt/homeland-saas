import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

type DocumentRecord = {
  id: string;
  code: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const createdAt = '2026-09-23T00:00:00.000Z';

function documentRecord(id: string, title: string): DocumentRecord {
  return {
    id,
    code: `DOC-${id}`,
    title,
    type: 'UPLOAD',
    status: 'DRAFT',
    createdAt,
    updatedAt: createdAt,
  };
}

async function mockDocumentApi(page: Page, options: { failUpload?: boolean } = {}) {
  const documents = [documentRecord('existing-document', 'Tài liệu ban đầu')];
  let listRequests = 0;
  let uploadRequests = 0;

  await page.route('**/api/v1/documents**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/documents') && request.method() === 'GET') {
      listRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: documents }),
      });
      return;
    }

    if (url.pathname.endsWith('/documents/upload') && request.method() === 'POST') {
      uploadRequests += 1;
      if (options.failUpload) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'UPLOAD_FAILED', message: 'Máy chủ không thể lưu tệp.' } }),
        });
        return;
      }

      const title = uploadRequests === 1 ? 'Ảnh đã tải lên' : 'Tệp PDF đã tải lên';
      const uploaded = documentRecord(`uploaded-${uploadRequests}`, title);
      documents.unshift(uploaded);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            url: `/uploads/${uploaded.id}`,
            size: 32,
            mimeType: 'image/png',
            documentId: uploaded.id,
            versionId: `version-${uploadRequests}`,
          },
        }),
      });
      return;
    }

    await route.fallback();
  });

  return {
    documents,
    getListRequests: () => listRequests,
    getUploadRequests: () => uploadRequests,
  };
}

test.describe('Documents upload regression', () => {
  test('accepts image, PDF, and camera image input; refreshes the list only after successful upload', async ({ admin }) => {
    const state = await mockDocumentApi(admin.page);
    await admin.page.goto('/documents');

    await expect(admin.page.getByTestId('document-explorer')).toBeVisible();
    await expect(admin.page.getByTestId('document-card').getByText('Tài liệu ban đầu')).toBeVisible();
    expect(state.getListRequests()).toBe(1);

    const inputs = admin.page.locator('input[type="file"]');
    await expect(inputs).toHaveCount(2);
    await expect(inputs.nth(0)).toHaveAttribute('accept', 'image/*,application/pdf,.pdf');
    await expect(inputs.nth(1)).toHaveAttribute('accept', 'image/*');
    await expect(inputs.nth(1)).toHaveAttribute('capture', 'environment');

    await inputs.nth(0).setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: Buffer.from('image-content'),
    });
    await expect(admin.page.getByText('Đã tải tài liệu lên.')).toBeVisible();
    await expect(admin.page.getByTestId('document-card').getByText('Ảnh đã tải lên')).toBeVisible();
    expect(state.getUploadRequests()).toBe(1);
    expect(state.getListRequests()).toBe(2);

    await inputs.nth(0).setInputFiles({
      name: 'agreement.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7'),
    });
    await expect(admin.page.getByTestId('document-card').getByText('Tệp PDF đã tải lên')).toBeVisible();
    expect(state.getUploadRequests()).toBe(2);

    await inputs.nth(1).setInputFiles({
      name: 'camera-proof.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('camera-content'),
    });
    expect(state.getUploadRequests()).toBe(3);
  });

  test('rejects unsupported and oversized files before any upload request', async ({ admin }) => {
    const state = await mockDocumentApi(admin.page);
    await admin.page.goto('/documents');
    await expect(admin.page.getByTestId('document-explorer')).toBeVisible();

    const input = admin.page.locator('input[type="file"]').first();
    await input.setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a supported document'),
    });
    await expect(admin.page.getByTestId('document-upload-error')).toHaveText('Chỉ hỗ trợ ảnh hoặc tệp PDF.');
    expect(state.getUploadRequests()).toBe(0);

    await input.setInputFiles({
      name: 'too-large.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(20 * 1024 * 1024 + 1),
    });
    await expect(admin.page.getByTestId('document-upload-error')).toHaveText('Tệp tải lên không được vượt quá 20 MB.');
    expect(state.getUploadRequests()).toBe(0);
    expect(state.documents).toHaveLength(1);
  });

  test('shows an upload error without a false success or list update when the upload fails', async ({ admin }) => {
    const state = await mockDocumentApi(admin.page, { failUpload: true });
    await admin.page.goto('/documents');
    await expect(admin.page.getByTestId('document-explorer')).toBeVisible();

    await admin.page.locator('input[type="file"]').first().setInputFiles({
      name: 'failed-upload.png',
      mimeType: 'image/png',
      buffer: Buffer.from('will fail'),
    });

    await expect(admin.page.getByTestId('document-upload-error')).toHaveText('Máy chủ không thể lưu tệp.');
    await expect(admin.page.getByText('Đã tải tài liệu lên.')).toHaveCount(0);
    await expect(admin.page.getByTestId('document-card').getByText('Tài liệu ban đầu')).toBeVisible();
    expect(state.getUploadRequests()).toBe(1);
    expect(state.getListRequests()).toBe(1);
    expect(state.documents).toHaveLength(1);
  });
});
