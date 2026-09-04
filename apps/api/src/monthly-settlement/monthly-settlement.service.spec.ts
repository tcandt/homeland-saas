import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MonthlySettlementService,
  formatVietnamPeriod,
  getPreviousVietnamPeriod,
  getNextVietnamPeriod,
  isLastDayOfVietnamMonth,
} from './monthly-settlement.service';

describe('MonthlySettlementService', () => {
  let service: MonthlySettlementService;
  let prisma: any;
  let paymentsService: any;
  let invoicesService: any;
  let communicationService: any;
  let hunonicService: any;
  let auditService: any;

  beforeEach(() => {
    prisma = {
      appSetting: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      building: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'bld-1', name: 'Tòa A', code: 'A', displayOrder: 1 },
        ]),
      },
      room: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'room-1',
            code: '101',
            name: 'Phòng 101',
            monthlyPrice: 3500000,
            rentalType: 'WHOLE',
            capacity: 2,
            building: { id: 'bld-1', name: 'Tòa A', code: 'A' },
            floor: { id: 'floor-1', name: 'Tầng 1', level: 1 },
            contracts: [
              {
                id: 'contract-1',
                code: 'HD-101',
                status: 'ACTIVE',
                startDate: new Date('2026-08-01T00:00:00.000Z'),
                endDate: new Date('2027-08-01T00:00:00.000Z'),
                signedAt: new Date('2026-07-25T00:00:00.000Z'),
                monthlyRent: 3500000,
                customer: {
                  id: 'cust-1',
                  fullName: 'Nguyễn Văn A',
                  phone: '0901234567',
                  identityNo: '001234567890',
                  gender: 'MALE',
                  zaloPhone: '0901234567',
                  zaloChatId: 'zalo-chat-1',
                },
              },
            ],
            roommates: [
              {
                id: 'cust-2',
                fullName: 'Trần Thị B',
                phone: '0907654321',
                identityNo: '001987654321',
                gender: 'FEMALE',
                zaloPhone: '0907654321',
                relationship: 'Bạn cùng phòng',
                createdAt: new Date(),
              },
            ],
          },
        ]),
      },
      invoice: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'inv-1', ...data })),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'inv-1', ...data })),
      },
      invoiceItem: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    paymentsService = {
      sendInvoiceRequestToZalo: vi.fn().mockResolvedValue({ id: 'req-1', status: 'PENDING' }),
    };

    invoicesService = {
      getDetail: vi.fn(),
    };

    communicationService = {
      dispatchDirect: vi.fn(),
    };

    hunonicService = {
      getOverview: vi.fn().mockResolvedValue({
        meters: [
          {
            buildingCode: 'A',
            roomCode: '101',
            energyMonthKwh: 120,
            moneyMonthVnd: 420000,
            powerCurrentW: 250,
            lastStatus: 'on',
          },
        ],
      }),
      lockPeriods: vi.fn().mockResolvedValue({ success: true }),
    };

    auditService = {
      log: vi.fn(),
    };

    service = new MonthlySettlementService(
      prisma,
      paymentsService,
      invoicesService,
      communicationService,
      hunonicService,
      auditService,
    );
  });

  describe('Vietnam timezone helper functions', () => {
    it('formats Vietnam period correctly (YYYY-MM)', () => {
      const period = formatVietnamPeriod(new Date('2026-09-01T08:00:00Z'));
      expect(period).toBe('2026-09');
    });

    it('calculates previous period correctly', () => {
      expect(getPreviousVietnamPeriod('2026-09')).toBe('2026-08');
      expect(getPreviousVietnamPeriod('2026-01')).toBe('2025-12');
    });

    it('calculates next period correctly', () => {
      expect(getNextVietnamPeriod('2026-09')).toBe('2026-10');
      expect(getNextVietnamPeriod('2026-12')).toBe('2027-01');
    });

    it('detects last day of month accurately', () => {
      const lastDaySept = new Date('2026-09-30T10:00:00Z');
      expect(isLastDayOfVietnamMonth(lastDaySept)).toBe(true);

      const midMonth = new Date('2026-09-15T10:00:00Z');
      expect(isLastDayOfVietnamMonth(midMonth)).toBe(false);
    });
  });

  describe('getOverview', () => {
    it('summarizes room data, member list and hunonic meter reading', async () => {
      const res = await service.getOverview('tenant-1', { period: '2026-09' });

      expect(res.stats.totalRooms).toBe(1);
      expect(res.stats.occupiedRooms).toBe(1);
      expect(res.items.length).toBe(1);

      const item = res.items[0];
      expect(item.roomCode).toBe('101');
      expect(item.representative?.fullName).toBe('Nguyễn Văn A');
      expect(item.membersCount).toBe(2);
      expect(item.members[0].fullName).toBe('Nguyễn Văn A');
      expect(item.members[0].isRepresentative).toBe(true);
      expect(item.members[1].fullName).toBe('Trần Thị B');
      expect(item.members[1].isRepresentative).toBe(false);

      expect(item.electricityKwh).toBe(120);
      expect(item.electricityAmount).toBe(420000);
      expect(item.waterAmount).toBe(200000); // 2 thành viên x 100.000đ
      expect(item.roomPrice).toBe(3500000);
      expect(item.totalAmount).toBe(3500000 + 420000 + 200000);
    });

    it('does not charge previous usage electricity for a first-month tenant', async () => {
      prisma.room.findMany.mockResolvedValue([
        {
          id: 'room-1',
          code: '101',
          name: 'Phòng 101',
          monthlyPrice: 3500000,
          rentalType: 'WHOLE',
          capacity: 2,
          building: { id: 'bld-1', name: 'Tòa A', code: 'A' },
          floor: { id: 'floor-1', name: 'Tầng 1', level: 1 },
          contracts: [
            {
              id: 'contract-1',
              code: 'HD-101',
              status: 'ACTIVE',
              startDate: new Date('2026-10-01T00:00:00.000Z'),
              endDate: new Date('2027-10-01T00:00:00.000Z'),
              signedAt: new Date('2026-09-03T00:00:00.000Z'),
              monthlyRent: 3500000,
              customer: {
                id: 'cust-1',
                fullName: 'Nguyễn Văn A',
                phone: '0901234567',
                identityNo: '001234567890',
                gender: 'MALE',
                zaloPhone: '0901234567',
                zaloChatId: 'zalo-chat-1',
              },
            },
          ],
          roommates: [],
        },
      ]);

      const res = await service.getOverview('tenant-1', { period: '2026-10' });
      const item = res.items[0];

      expect(item.hasContract).toBe(true);
      expect(item.isFirstMonthNewTenant).toBe(true);
      expect(item.usagePeriod).toBe('2026-09');
      expect(item.electricityEligible).toBe(false);
      expect(item.electricityKwh).toBe(0);
      expect(item.electricityAmount).toBe(0);
      expect(item.roomPrice).toBe(3500000);
      expect(item.waterAmount).toBe(100000);
      expect(item.totalAmount).toBe(3600000);
    });
  });

  describe('closeMonth', () => {
    it('creates invoice and locks hunonic meter readings for period', async () => {
      const res = await service.closeMonth('tenant-1', 'user-1', {
        period: '2026-09',
        autoSend: false,
      });

      expect(res.success).toBe(true);
      expect(res.settledCount).toBe(1);
      expect(prisma.invoice.create).toHaveBeenCalled();
      expect(hunonicService.lockPeriods).toHaveBeenCalledWith('tenant-1', {
        rows: [
          {
            buildingCode: 'A',
            roomCode: '101',
            period: '2026-08',
            note: 'Khóa chỉ số điện sử dụng tháng 2026-08 cho kỳ thu 2026-09',
          },
        ],
      });
    });

    it('creates first-month invoice without previous usage electricity item', async () => {
      prisma.room.findMany.mockResolvedValue([
        {
          id: 'room-1',
          code: '101',
          name: 'Phòng 101',
          monthlyPrice: 3500000,
          rentalType: 'WHOLE',
          capacity: 2,
          building: { id: 'bld-1', name: 'Tòa A', code: 'A' },
          floor: { id: 'floor-1', name: 'Tầng 1', level: 1 },
          contracts: [
            {
              id: 'contract-1',
              code: 'HD-101',
              status: 'ACTIVE',
              startDate: new Date('2026-10-01T00:00:00.000Z'),
              endDate: new Date('2027-10-01T00:00:00.000Z'),
              signedAt: new Date('2026-09-03T00:00:00.000Z'),
              monthlyRent: 3500000,
              customer: {
                id: 'cust-1',
                fullName: 'Nguyễn Văn A',
                phone: '0901234567',
                identityNo: '001234567890',
                gender: 'MALE',
                zaloPhone: '0901234567',
                zaloChatId: 'zalo-chat-1',
              },
            },
          ],
          roommates: [],
        },
      ]);

      const res = await service.closeMonth('tenant-1', 'user-1', {
        period: '2026-10',
        autoSend: false,
      });

      expect(res.settledCount).toBe(1);
      expect(hunonicService.lockPeriods).not.toHaveBeenCalled();
      const createCall = prisma.invoice.create.mock.calls[0][0];
      expect(createCall.data.period).toBe('2026-10');
      expect(createCall.data.usagePeriod).toBe('2026-09');
      expect(createCall.data.items.create).toEqual([
        expect.objectContaining({ type: 'RENT', servicePeriod: '2026-10', amount: 3500000 }),
        expect.objectContaining({ type: 'UTILITY_WATER', servicePeriod: '2026-10', amount: 100000 }),
      ]);
      expect(createCall.data.items.create).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'UTILITY_ELECTRICITY' })]),
      );
    });

    it('skips settled invoices that already have payment activity', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-101',
          code: 'INV-202609-101',
          period: '2026-09',
          status: 'PARTIALLY_PAID',
          paidAmount: 100000,
          contract: { roomId: 'room-1' },
          createdAt: new Date('2026-09-01'),
          items: [],
          total: 4170000,
        },
      ]);
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-101',
        code: 'INV-202609-101',
        status: 'PARTIALLY_PAID',
        paidAmount: 100000,
      });

      const res = await service.closeMonth('tenant-1', 'user-1', {
        period: '2026-09',
        autoSend: false,
      });

      expect(res.settledCount).toBe(0);
      expect(res.skippedCount).toBe(1);
      expect(prisma.invoiceItem.deleteMany).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe('sendNotifications', () => {
    it('dispatches payment request via Zalo for settled rooms', async () => {
      // Mock existing invoice
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-101',
          code: 'INV-202609-101',
          period: '2026-09',
          contract: { roomId: 'room-1' },
          createdAt: new Date('2026-09-01'),
          items: [],
          total: 4170000,
        },
      ]);

      const res = await service.sendNotifications('tenant-1', 'user-1', {
        period: '2026-09',
      });

      expect(res.sentCount).toBe(1);
      expect(paymentsService.sendInvoiceRequestToZalo).toHaveBeenCalledWith('inv-101', 'user-1');
    });
  });
});
