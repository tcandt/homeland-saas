import { afterEach, describe, expect, it, vi } from 'vitest';
import { customersApi } from '../../lib/api/customers.api';
import { apiClient } from '../../lib/api/client';

describe('customer create idempotency adapter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reuses the supplied logical command key across a retry', async () => {
    const key = '70c7e0e1-4ef4-4f54-b060-5a8f8d9a7c1c';
    const payload = { fullName: 'Nguyen Van A', phone: '0901234567' };
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ id: 'customer-1' } as any);

    await customersApi.create(payload, key);
    await customersApi.create(payload, key);

    expect(post).toHaveBeenNthCalledWith(1, '/customers', payload, { headers: { 'Idempotency-Key': key } });
    expect(post).toHaveBeenNthCalledWith(2, '/customers', payload, { headers: { 'Idempotency-Key': key } });
  });

  it('preserves the legacy request shape when no key is supplied', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ id: 'customer-1' } as any);

    await customersApi.create({ fullName: 'Nguyen Van B', phone: '0901234568' });

    expect(post).toHaveBeenCalledWith(
      '/customers',
      { fullName: 'Nguyen Van B', phone: '0901234568' },
    );
  });
});
