import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { financeApi } from './finance.api';

vi.mock('./client', () => ({ apiClient: { get: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

it.each([
  ['exportReport', '/finance/export'],
  ['exportExcelReport', '/finance/export.xlsx'],
  ['exportPdfReport', '/finance/export.pdf'],
] as const)('%s forwards the selected GMT+7 period without changing its inclusive bound', async (method, endpoint) => {
  const period = { startDate: '2026-09-30T17:00:00.000Z', endDate: '2026-10-31T16:59:59.999Z' };
  await financeApi[method](period);
  expect(apiClient.get).toHaveBeenCalledWith(endpoint, { params: period, responseType: 'blob' });
});
