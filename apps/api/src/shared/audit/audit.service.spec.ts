import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const params = {
    action: 'CREATE' as any,
    entity: 'Expense',
    entityId: 'expense-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
  };

  it('retries a transient write and resolves after the audit row is durable', async () => {
    const create = vi.fn()
      .mockRejectedValueOnce(new Error('temporary database failure'))
      .mockResolvedValueOnce({ id: 'audit-1' });
    const service = new AuditService({ auditLog: { create } } as any, { getId: () => 'request-1', get: vi.fn() } as any);

    await expect(service.log(params)).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('surfaces a durable write failure instead of swallowing it', async () => {
    const create = vi.fn().mockRejectedValue(new Error('database unavailable'));
    const service = new AuditService({ auditLog: { create } } as any, { getId: () => 'request-1', get: vi.fn() } as any);

    await expect(service.log(params)).rejects.toThrow('database unavailable');
    expect(create).toHaveBeenCalledTimes(3);
  });
});
