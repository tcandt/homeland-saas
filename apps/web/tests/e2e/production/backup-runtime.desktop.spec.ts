import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { expect } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';
import { EvidenceCollector } from '../helpers/evidence';

test.describe('Isolated backup runtime gate', () => {
  test.skip(process.env.RUN_BACKUP_RUNTIME_E2E !== 'true', 'Requires an explicitly configured disposable backup runtime.');
  test.setTimeout(120_000);

  test('uploads a synthetic document, creates a verified backup from UI and keeps online restore closed', async ({ admin }, testInfo) => {
    if (process.env.RUN_DESTRUCTIVE_E2E !== 'true' || process.env.E2E_DISPOSABLE_DATABASE !== 'true') {
      throw new Error('Backup runtime gate requires a disposable database and destructive-test opt-in.');
    }
    const prisma = new EvidenceCollector(admin.page, 'backup-runtime').getPrisma();
    const identity = await prisma.$queryRaw<Array<{ databaseId: string }>>`SELECT current_database() AS "databaseId"`;
    expect(process.env.E2E_TARGET_DB_ID).toBeTruthy();
    expect(identity[0]?.databaseId).toBe(process.env.E2E_TARGET_DB_ID);

    const beforeResponse = await admin.api.get('/api/v1/system-update/backups');
    expect(beforeResponse.ok()).toBe(true);
    const before = (await beforeResponse.json()).data;
    expect(before.connected).toBe(true);
    expect(before.restoreSupported).toBe(false);

    const pdf = await PDFDocument.create();
    pdf.addPage().drawText('Synthetic local release storage fixture. No personal data.');
    const bytes = Buffer.from(await pdf.save());
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const uploadedResponse = await admin.api.post('/api/v1/documents/upload', {
      multipart: {
        folder: 'release-runtime-fixtures',
        file: { name: `synthetic-release-${Date.now()}.pdf`, mimeType: 'application/pdf', buffer: bytes },
      },
    });
    expect(uploadedResponse.ok(), await uploadedResponse.text()).toBe(true);
    const uploaded = (await uploadedResponse.json()).data;
    expect(uploaded.documentId).toBeTruthy();
    const download = await admin.api.get(`/api/v1/documents/${uploaded.documentId}/download`);
    expect(download.ok()).toBe(true);
    expect(createHash('sha256').update(await download.body()).digest('hex')).toBe(checksum);

    await admin.page.goto('/settings?section=backup', { waitUntil: 'domcontentloaded' });
    const backupPanel = admin.page.getByTestId('settings-backup-safe-state');
    await expect(backupPanel).toBeVisible();
    const createdResponse = admin.page.waitForResponse((response) =>
      response.url().endsWith('/api/v1/system-update/backups/create') && response.request().method() === 'POST',
    );
    await backupPanel.getByRole('button', { name: 'Tạo bản sao lưu', exact: true }).click();
    const created = await createdResponse;
    expect(created.status()).toBe(201);
    const result = (await created.json()).data;
    const snapshot = result.backups.find((item: { id: string }) => !before.backups.some((old: { id: string }) => old.id === item.id));
    expect(snapshot?.status).toBe('READY');
    const row = backupPanel.getByRole('row').filter({ hasText: snapshot.id });
    await expect(row.getByText('Đã kiểm tra', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Thao tác', exact: true }).click();
    await expect(row.getByRole('button', { name: 'Khôi phục', exact: true })).toBeDisabled();
    const restore = await admin.api.post('/api/v1/system-update/backups/restore', {
      data: { snapshotId: snapshot.id },
    });
    expect(restore.status()).toBe(400);

    await testInfo.attach('backup-fixture-provenance.json', {
      body: JSON.stringify({ ...uploaded, sha256: checksum, snapshotId: snapshot.id, databaseId: identity[0].databaseId }),
      contentType: 'application/json',
    });
    await testInfo.attach('backup-runtime.png', { body: await admin.page.screenshot(), contentType: 'image/png' });
    // Preserve the disposable fixture and verified bundle for the offline restore drill.
  });
});
