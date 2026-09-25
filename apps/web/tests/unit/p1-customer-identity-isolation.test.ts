import { describe, it, expect, vi, beforeEach } from 'vitest';
import { maskPhone, maskCccd } from '../../lib/adapters/tenant-masking.adapter';
import { evaluateExistingCustomerSelection } from '../../lib/adapters/customer-selection';
import { customersApi } from '../../lib/api/customers.api';
import { apiClient } from '../../lib/api/client';
import { customerKeys } from '../../lib/queries/customers.queries';

vi.mock('../../lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('P1: Customer Identity, Normalization, Duplicate Review & Multi-Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('P1.1: Canonical Normalization & Safe Masking (No PII leak)', () => {
    it('masks phone and CCCD without leaking middle identity digits', () => {
      expect(maskPhone('0901234567')).toBe('090****567');
      expect(maskPhone('+84901234567')).toBe('+84****567');
      expect(maskCccd('079199001234')).toBe('079******234');
      expect(maskCccd('123456789')).toBe('123******789');
    });

    it('handles empty or null inputs gracefully without crashing', () => {
      expect(maskPhone('')).toBe('');
      expect(maskPhone(null as any)).toBe('');
      expect(maskCccd('')).toBe('');
      expect(maskCccd(null as any)).toBe('');
    });
  });

  describe('P1.2: Tenant-scoped Duplicate Review & Selection', () => {
    it('allows re-selecting a former customer who has terminated contracts and no active occupancy', () => {
      const formerCustomer = {
        id: 'cust-former-01',
        fullName: 'Nguyen Van Cu',
        phone: '0901234567',
        identityNo: '001099001234',
        contracts: [{ status: 'TERMINATED', roomId: 'room-old' }],
        occupancies: [{ roomId: 'room-old', leftAt: '2026-08-01T00:00:00Z' }],
      };

      const result = evaluateExistingCustomerSelection(formerCustomer, 'room-new');
      expect(result.isSelectable).toBe(true);
      expect(result.isInAnotherRoom).toBe(false);
      expect(result.isInCurrentRoom).toBe(false);
    });

    it('blocks selecting a customer who is already active in another room within the tenant', () => {
      const activeCustomer = {
        id: 'cust-active-02',
        fullName: 'Tran Thi Dang O',
        phone: '0912345678',
        identityNo: '001099005678',
        occupancies: [{ roomId: 'room-other', leftAt: null }],
      };

      const result = evaluateExistingCustomerSelection(activeCustomer, 'room-target');
      expect(result.isSelectable).toBe(false);
      expect(result.isInAnotherRoom).toBe(true);
    });

    it('blocks selecting a customer already in the target room', () => {
      const currentOccupant = {
        id: 'cust-current-03',
        fullName: 'Le Van Tai',
        occupancies: [{ roomId: 'room-target', leftAt: null }],
      };

      const result = evaluateExistingCustomerSelection(currentOccupant, 'room-target');
      expect(result.isSelectable).toBe(false);
      expect(result.isInCurrentRoom).toBe(true);
    });
  });

  describe('P1.3: Cross-Tenant Isolation Guarantee & API Query Contract', () => {
    it('ensures web customer queries delegate tenant isolation to server and never send tenantId parameter', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ isDuplicate: false, duplicateCustomer: null });

      await customersApi.checkDuplicate({ phone: '0901234567', identityNo: '123456789' });

      expect(apiClient.get).toHaveBeenCalledWith('/customers/check-duplicate', {
        params: { phone: '0901234567', identityNo: '123456789' },
      });
      const checkDuplicateParams = (vi.mocked(apiClient.get).mock.calls[0][1] as any)?.params;
      expect(checkDuplicateParams.tenantId).toBeUndefined();

      vi.mocked(apiClient.get).mockResolvedValueOnce({ items: [], total: 0 });
      await customersApi.list({ search: 'Nguyen Van A' });
      expect(apiClient.get).toHaveBeenCalledWith('/customers', {
        params: { search: 'Nguyen Van A' },
      });
      const listParams = (vi.mocked(apiClient.get).mock.calls[1][1] as any)?.params;
      expect(listParams.tenantId).toBeUndefined();
    });

    it('builds canonical tenant-isolated React Query keys for customer cache', () => {
      const listKey = customerKeys.list({ search: '0901234567' });
      expect(listKey).toEqual(['customers', 'list', { search: '0901234567' }]);

      const detailKey = customerKeys.detail('cust-001');
      expect(detailKey).toEqual(['customers', 'detail', 'cust-001']);
    });
  });
});
