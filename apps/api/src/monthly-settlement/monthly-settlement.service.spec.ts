import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  MonthlySettlementService,
  formatVietnamPeriod,
  getPreviousVietnamPeriod,
  getNextVietnamPeriod,
  isLastDayOfVietnamMonth,
  allocateDeterministically,
  buildSettlementRunIdentity,
  assertValidBillingPeriod,
  getPeriodBounds,
  getHalfOpenPeriodBounds,
  resolveCanonicalRoomPeriodOccupancy,
} from "./monthly-settlement.service";

describe("MonthlySettlementService", () => {
  let service: MonthlySettlementService;
  let prisma: any;
  let paymentsService: any;
  let invoicesService: any;
  let communicationService: any;
  let hunonicService: any;
  let auditService: any;
  let storedBillingSnapshot: any;

  it("uses standard_conforming_strings-safe month regexes in the billing migration", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "../../packages/database/prisma/migrations/20260909153000_add_billing_snapshot/migration.sql"),
      "utf8",
    );
    const safePeriodRegex = "^[0-9]{4}-(0[1-9]|1[0-2])$";

    expect(migration.split(safePeriodRegex)).toHaveLength(5);
    expect(migration).not.toContain("^\\\\d{4}-(0[1-9]|1[0-2])$");
    expect(migration).toContain('CHECK ("status" = \'LOCKED\')');
    expect(migration).toContain('MONTHLY_UTILITY_SNAPSHOT_REQUIRED');
  });

  it.each(["2026-00", "2026-13", "09-2026", "2026-9", ""])(
    "rejects invalid billing period %s",
    (period) => {
      expect(() => assertValidBillingPeriod(period)).toThrow(
        "BILLING_PERIOD_INVALID",
      );
    },
  );

  it("uses Vietnam midnight boundaries independently of the process timezone", () => {
    const bounds = getPeriodBounds("2026-09");
    expect(bounds.start.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-09-30T16:59:59.999Z");
  });

  beforeEach(() => {
    storedBillingSnapshot = null;
    prisma = {
      $transaction: vi.fn(async (callback: any) => callback(prisma)),
      appSetting: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      building: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "bld-1", name: "Tòa A", code: "A", displayOrder: 1 },
          ]),
      },
      room: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "room-1",
            code: "101",
            name: "Phòng 101",
            monthlyPrice: 3500000,
            rentalType: "WHOLE",
            capacity: 2,
            building: { id: "bld-1", name: "Tòa A", code: "A" },
            floor: { id: "floor-1", name: "Tầng 1", level: 1 },
            contracts: [
              {
                id: "contract-1",
                code: "HD-101",
                status: "ACTIVE",
                startDate: new Date("2026-08-01T00:00:00.000Z"),
                endDate: new Date("2027-08-01T00:00:00.000Z"),
                signedAt: new Date("2026-07-25T00:00:00.000Z"),
                monthlyRent: 3500000,
                customer: {
                  id: "cust-1",
                  fullName: "Nguyễn Văn A",
                  phone: "0901234567",
                  identityNo: "001234567890",
                  gender: "MALE",
                  zaloPhone: "0901234567",
                  zaloChatId: "zalo-chat-1",
                },
              },
            ],
            roommates: [
              {
                id: "cust-2",
                fullName: "Trần Thị B",
                phone: "0907654321",
                identityNo: "001987654321",
                gender: "FEMALE",
                zaloPhone: "0907654321",
                relationship: "Bạn cùng phòng",
                createdAt: new Date(),
              },
            ],
            occupancies: [
              {
                id: "occupancy-1",
                customerId: "cust-1",
                contractId: "contract-1",
                role: "ĐẠI DIỆN",
                joinedAt: new Date("2026-08-01T00:00:00.000Z"),
                leftAt: null,
                customer: {
                  id: "cust-1", fullName: "Nguyễn Văn A", phone: "0901234567",
                  identityNo: "001234567890", gender: "MALE", zaloPhone: "0901234567", zaloChatId: "zalo-chat-1",
                },
              },
              {
                id: "occupancy-2",
                customerId: "cust-2",
                contractId: "contract-1",
                role: "THÀNH VIÊN Ở CÙNG",
                joinedAt: new Date("2026-08-01T00:00:00.000Z"),
                leftAt: null,
                customer: {
                  id: "cust-2", fullName: "Trần Thị B", phone: "0907654321",
                  identityNo: "001987654321", gender: "FEMALE", zaloPhone: "0907654321",
                },
              },
            ],
          },
        ]),
      },
      invoice: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: "inv-1", ...data }),
          ),
        update: vi
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: "inv-1", ...data }),
          ),
      },
      invoiceItem: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      billingSnapshot: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockImplementation(({ data }) => {
          if (!storedBillingSnapshot && data?.[0]) {
            storedBillingSnapshot = { id: "snapshot-1", ...data[0] };
          }
          return Promise.resolve({ count: storedBillingSnapshot ? 1 : 0 });
        }),
        findUnique: vi.fn().mockImplementation(() =>
          Promise.resolve(storedBillingSnapshot),
        ),
      },
      hunonicMeterReading: {
        findFirst: vi.fn().mockResolvedValue({
          id: "reading-1",
          meterMappingId: "meter-1",
          payloadHash: "a".repeat(64),
          energyMonthKwh: 120,
          moneyMonthVnd: 420000,
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "reading-1",
            roomId: "room-1",
            meterMappingId: "meter-1",
            currentMonth: "2026-08",
            sourcePeriod: "2026-08",
            aggregateBasis: "MONTHLY_AGGREGATE_V1",
            sourceProvider: "hunonic",
            sourceProviderMeterId: "provider-meter-1",
            payloadHash: "a".repeat(64),
            energyMonthKwh: 120,
            moneyMonthVnd: 420000,
            readingAt: new Date("2026-08-31T17:00:00.000Z"),
          },
        ]),
      },
    };

    paymentsService = {
      sendInvoiceRequestToZalo: vi
        .fn()
        .mockResolvedValue({ id: "req-1", status: "PENDING" }),
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
            buildingCode: "A",
            roomCode: "101",
            energyMonthKwh: 120,
            moneyMonthVnd: 420000,
            powerCurrentW: 250,
            lastStatus: "on",
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

  describe("Vietnam timezone helper functions", () => {
    it("formats Vietnam period correctly (YYYY-MM)", () => {
      const period = formatVietnamPeriod(new Date("2026-09-01T08:00:00Z"));
      expect(period).toBe("2026-09");
    });

    it("calculates previous period correctly", () => {
      expect(getPreviousVietnamPeriod("2026-09")).toBe("2026-08");
      expect(getPreviousVietnamPeriod("2026-01")).toBe("2025-12");
    });

    it("calculates next period correctly", () => {
      expect(getNextVietnamPeriod("2026-09")).toBe("2026-10");
      expect(getNextVietnamPeriod("2026-12")).toBe("2027-01");
    });

    it("detects last day of month accurately", () => {
      const lastDaySept = new Date("2026-09-30T10:00:00Z");
      expect(isLastDayOfVietnamMonth(lastDaySept)).toBe(true);

      const midMonth = new Date("2026-09-15T10:00:00Z");
      expect(isLastDayOfVietnamMonth(midMonth)).toBe(false);
    });
  });

  describe("deterministic utility allocation", () => {
    it("preserves the exact room total while assigning rounding remainder stably", () => {
      expect(allocateDeterministically(100, [1, 1, 1], 2)).toEqual([
        33.34, 33.33, 33.33,
      ]);
      expect(allocateDeterministically(1, [1, 1, 1], 3)).toEqual([
        0.334, 0.333, 0.333,
      ]);
    });

    it("does not allocate previous-period usage to an ineligible contract", () => {
      expect(allocateDeterministically(420000, [1, 0], 2)).toEqual([420000, 0]);
    });
  });

  describe("canonical Occupancy resolver (CORE-07.05)", () => {
    const contract = (id: string, customerId = `payer-${id}`, memberCount = 1) => ({
      id, customerId, memberCount, customer: { id: customerId }, startDate: new Date("2026-01-01T00:00:00.000Z"),
    });
    const occupant = (id: string, customerId: string, contractId: string | null, joinedAt: string, leftAt: string | null = null) => ({
      id, customerId, contractId, joinedAt: new Date(joinedAt), leftAt: leftAt ? new Date(leftAt) : null,
      role: "MEMBER", customer: { id: customerId, fullName: customerId },
    });

    it("uses UTC+7 half-open boundaries and deduplicates same-customer intervals", () => {
      const bounds = getHalfOpenPeriodBounds("2026-09");
      const resolution = resolveCanonicalRoomPeriodOccupancy({
        rentalType: "WHOLE", contracts: [contract("whole", "payer", 1)],
        periodStart: bounds.start, nextPeriodStart: bounds.nextStart,
        occupancies: [
          occupant("at-start", "customer", null, "2026-08-31T17:00:00.000Z"),
          occupant("duplicate", "customer", null, "2026-09-10T00:00:00.000Z"),
          occupant("at-end", "later", null, "2026-09-30T17:00:00.000Z"),
          occupant("left-start", "earlier", null, "2026-08-01T00:00:00.000Z", "2026-08-31T17:00:00.000Z"),
        ],
      });
      expect(resolution.byContractId.get("whole")?.membersCount).toBe(1);
      expect(resolution.blockers).toEqual([]);
    });

    it("uses Occupancy rather than payer, parties, roommates or cached memberCount", () => {
      const bounds = getHalfOpenPeriodBounds("2026-09");
      const resolution = resolveCanonicalRoomPeriodOccupancy({
        rentalType: "WHOLE", contracts: [contract("whole", "payer", 3)],
        periodStart: bounds.start, nextPeriodStart: bounds.nextStart,
        occupancies: [occupant("q", "Q", null, "2026-09-01T00:00:00.000Z")],
      });
      expect(resolution.byContractId.get("whole")?.members.map((member) => member.id)).toEqual(["Q"]);
      expect(resolution.byContractId.get("whole")?.membersCount).toBe(1);
      expect(resolution.warnings.map((warning) => warning.code)).toContain("CONTRACT_MEMBER_COUNT_MISMATCH");
    });

    it("requires exact shared contract ownership and blocks cross-contract occupants", () => {
      const bounds = getHalfOpenPeriodBounds("2026-09");
      const resolution = resolveCanonicalRoomPeriodOccupancy({
        rentalType: "SHARED", contracts: [contract("a"), contract("b")],
        periodStart: bounds.start, nextPeriodStart: bounds.nextStart,
        occupancies: [
          occupant("a1", "A", "a", "2026-09-01T00:00:00.000Z"),
          occupant("null", "N", null, "2026-09-01T00:00:00.000Z"),
          occupant("cross", "C", "other", "2026-09-01T00:00:00.000Z"),
          occupant("invalid", "I", "b", "2026-09-10T00:00:00.000Z", "2026-09-09T00:00:00.000Z"),
        ],
      });
      expect(resolution.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
        "SHARED_OCCUPANCY_CONTRACT_REQUIRED", "OCCUPANCY_CROSS_CONTRACT",
        "OCCUPANCY_INTERVAL_INVALID", "OCCUPANCY_REQUIRED",
      ]));
    });
  });

  describe("getOverview", () => {
    it("summarizes room data, member list and hunonic meter reading", async () => {
      const res = await service.getOverview("tenant-1", { period: "2026-09" });

      expect(res.stats.totalRooms).toBe(1);
      expect(res.stats.occupiedRooms).toBe(1);
      expect(res.items.length).toBe(1);

      const item = res.items[0];
      expect(item.roomCode).toBe("101");
      expect(item.representative?.fullName).toBe("Nguyễn Văn A");
      expect(item.membersCount).toBe(2);
      expect(item.members[0].fullName).toBe("Nguyễn Văn A");
      expect(item.members[0].isRepresentative).toBe(true);
      expect(item.members[1].fullName).toBe("Trần Thị B");
      expect(item.members[1].isRepresentative).toBe(false);

      expect(item.electricityKwh).toBe(120);
      expect(item.electricityAmount).toBe(420000);
      expect(item.waterAmount).toBe(200000); // 2 thành viên x 100.000đ
      expect(item.roomPrice).toBe(3500000);
      expect(item.totalAmount).toBe(3500000 + 420000 + 200000);
    });

    it("blocks a live custom Hunonic meter without an explicit provider unit price", async () => {
      hunonicService.getOverview.mockResolvedValue({
        meters: [{
          buildingCode: "A", roomCode: "101", energyMonthKwh: 120, moneyMonthVnd: 420000,
          rateMode: "custom", customRateVnd: null, lastStatus: "on",
        }],
      });

      const res = await service.getOverview("tenant-1", { period: "2026-09" });

      expect(res.items[0]).toMatchObject({ electricityAmount: 420000 });
      expect(res.items[0].settlementBlockers.map((blocker: any) => blocker.code)).toContain(
        "HUNONIC_CUSTOM_RATE_REQUIRED",
      );
    });

    it("never falls back to a same-code meter from another building", async () => {
      prisma.hunonicMeterReading.findMany.mockResolvedValue([]);
      hunonicService.getOverview.mockResolvedValue({
        meters: [
          {
            buildingCode: "B",
            roomCode: "101",
            energyMonthKwh: 999,
            moneyMonthVnd: 999999,
          },
        ],
      });

      const res = await service.getOverview("tenant-1", { period: "2026-10" });

      expect(res.items[0]).toMatchObject({ electricityKwh: 0, electricityAmount: 0 });
    });

    it("does not charge previous usage electricity for a first-month tenant", async () => {
      prisma.room.findMany.mockResolvedValue([
        {
          id: "room-1",
          code: "101",
          name: "Phòng 101",
          monthlyPrice: 3500000,
          rentalType: "WHOLE",
          capacity: 2,
          building: { id: "bld-1", name: "Tòa A", code: "A" },
          floor: { id: "floor-1", name: "Tầng 1", level: 1 },
          contracts: [
            {
              id: "contract-1",
              code: "HD-101",
              status: "ACTIVE",
              startDate: new Date("2026-10-01T00:00:00.000Z"),
              endDate: new Date("2027-10-01T00:00:00.000Z"),
              signedAt: new Date("2026-09-03T00:00:00.000Z"),
              monthlyRent: 3500000,
              customer: {
                id: "cust-1",
                fullName: "Nguyễn Văn A",
                phone: "0901234567",
                identityNo: "001234567890",
                gender: "MALE",
                zaloPhone: "0901234567",
                zaloChatId: "zalo-chat-1",
              },
            },
          ],
          roommates: [],
          occupancies: [
            {
              id: "occupancy-1", customerId: "cust-1", contractId: "contract-1", role: "ĐẠI DIỆN",
              joinedAt: new Date("2026-10-01T00:00:00.000Z"), leftAt: null,
              customer: { id: "cust-1", fullName: "Nguyễn Văn A", phone: "0901234567", identityNo: "001234567890", gender: "MALE", zaloChatId: "zalo-chat-1" },
            },
          ],
        },
      ]);

      const res = await service.getOverview("tenant-1", { period: "2026-10" });
      const item = res.items[0];

      expect(item.hasContract).toBe(true);
      expect(item.isFirstMonthNewTenant).toBe(true);
      expect(item.usagePeriod).toBe("2026-09");
      expect(item.electricityEligible).toBe(false);
      expect(item.waterEligible).toBe(false);
      expect(item.electricityKwh).toBe(0);
      expect(item.electricityAmount).toBe(0);
      expect(item.waterAmount).toBe(0);
      expect(item.roomPrice).toBe(3500000);
      expect(item.totalAmount).toBe(3500000);
    });

    it("splits shared room electricity by contract member count while keeping contract rent separate", async () => {
      prisma.room.findMany.mockResolvedValue([
        {
          id: "room-1",
          code: "101",
          name: "Phòng 101",
          monthlyPrice: 6000000,
          rentalType: "SHARED",
          capacity: 4,
          building: { id: "bld-1", name: "Tòa A", code: "A" },
          floor: { id: "floor-1", name: "Tầng 1", level: 1 },
          contracts: [
            {
              id: "contract-a",
              code: "HD-A",
              status: "ACTIVE",
              startDate: new Date("2026-08-01T00:00:00.000Z"),
              endDate: new Date("2027-08-01T00:00:00.000Z"),
              signedAt: new Date("2026-07-25T00:00:00.000Z"),
              monthlyRent: 2000000,
              memberCount: 1,
              customer: {
                id: "cust-a",
                fullName: "Khách A",
                phone: "0900000001",
                identityNo: "001",
                gender: "MALE",
                zaloPhone: "0900000001",
                zaloChatId: "zalo-a",
              },
            },
            {
              id: "contract-b",
              code: "HD-B",
              status: "ACTIVE",
              startDate: new Date("2026-08-01T00:00:00.000Z"),
              endDate: new Date("2027-08-01T00:00:00.000Z"),
              signedAt: new Date("2026-07-25T00:00:00.000Z"),
              monthlyRent: 3000000,
              memberCount: 2,
              customer: {
                id: "cust-b",
                fullName: "Khách B",
                phone: "0900000002",
                identityNo: "002",
                gender: "FEMALE",
                zaloPhone: "0900000002",
                zaloChatId: "zalo-b",
              },
            },
          ],
          roommates: [],
          occupancies: [
            {
              id: "occupancy-a", customerId: "cust-a", contractId: "contract-a", role: "ĐẠI DIỆN",
              joinedAt: new Date("2026-08-01T00:00:00.000Z"), leftAt: null,
              customer: { id: "cust-a", fullName: "Khách A", phone: "0900000001", identityNo: "001", gender: "MALE", zaloChatId: "zalo-a" },
            },
            {
              id: "occupancy-b-1", customerId: "cust-b", contractId: "contract-b", role: "ĐẠI DIỆN",
              joinedAt: new Date("2026-08-01T00:00:00.000Z"), leftAt: null,
              customer: { id: "cust-b", fullName: "Khách B", phone: "0900000002", identityNo: "002", gender: "FEMALE", zaloChatId: "zalo-b" },
            },
            {
              id: "occupancy-b-2", customerId: "cust-b-2", contractId: "contract-b", role: "THÀNH VIÊN Ở CÙNG",
              joinedAt: new Date("2026-08-01T00:00:00.000Z"), leftAt: null,
              customer: { id: "cust-b-2", fullName: "Khách B2", phone: "0900000003", identityNo: "003", gender: "FEMALE" },
            },
          ],
        },
      ]);

      const res = await service.getOverview("tenant-1", { period: "2026-09" });

      expect(res.stats.occupiedRooms).toBe(1);
      expect(res.stats.billingGroups).toBe(2);
      expect(res.items).toHaveLength(2);

      const itemA = res.items.find((item) => item.contractId === "contract-a");
      const itemB = res.items.find((item) => item.contractId === "contract-b");
      expect(itemA).toMatchObject({
        billingScope: "CONTRACT",
        roomRentalType: "SHARED",
        roomPrice: 2000000,
        membersCount: 1,
        waterAmount: 100000,
        electricityAmount: 140000,
        totalAmount: 2240000,
      });
      expect(itemB).toMatchObject({
        billingScope: "CONTRACT",
        roomRentalType: "SHARED",
        roomPrice: 3000000,
        membersCount: 2,
        waterAmount: 200000,
        electricityAmount: 280000,
        totalAmount: 3480000,
      });
    });

    it("keeps a locked billing snapshot immutable and only exposes later readings as reconciliation delta", async () => {
      prisma.billingSnapshot.findMany.mockResolvedValue([
        {
          id: "snapshot-locked-1",
          tenantId: "tenant-1",
          roomId: "room-1",
          usagePeriod: "2026-08",
          status: "LOCKED",
          usageKwh: 90,
          electricityAmount: 315000,
          waterAmount: 200000,
          pricingMode: "residential",
          occupantCount: 2,
          occupants: [{ customerId: "cust-1" }, { customerId: "cust-2" }],
          allocations: [
            {
              contractId: "contract-1",
              memberCount: 2,
              eligible: true,
              electricityKwh: 90,
              electricityAmount: 315000,
              waterAmount: 200000,
              shareRatio: 1,
              occupancySource: "OCCUPANCY",
            },
          ],
        },
      ]);
      prisma.hunonicMeterReading.findMany.mockResolvedValue([
        {
          id: "reading-newer-1",
          roomId: "room-1",
          meterMappingId: "meter-1",
          currentMonth: "2026-08",
          sourcePeriod: "2026-08",
          aggregateBasis: "MONTHLY_AGGREGATE_V1",
          energyMonthKwh: 92,
          moneyMonthVnd: 322000,
          readingAt: new Date("2026-09-01T00:00:00.000Z"),
        },
      ]);

      const res = await service.getOverview("tenant-1", { period: "2026-09" });
      expect(res.items[0]).toMatchObject({
        billingSnapshotId: "snapshot-locked-1",
        billingDataSource: "LOCKED_SNAPSHOT",
        membersCount: 2,
        electricityKwh: 90,
        electricityAmount: 315000,
        waterAmount: 200000,
        electricityReconciliation: {
          currentKwh: 92,
          currentAmount: 322000,
          deltaKwh: 2,
          deltaAmount: 7000,
          status: "MISMATCHED",
        },
      });
      expect(res.items[0].settlementBlockers.map((blocker) => blocker.code)).toContain(
        "LOCKED_SNAPSHOT_MEMBER_COUNT_INVALID",
      );
    });

    it("accepts an immutable zero-headcount allocation when its prior-usage eligibility is false", async () => {
      prisma.room.findMany.mockResolvedValue([
        {
          id: "room-1", code: "101", name: "Phòng 101", monthlyPrice: 3500000,
          rentalType: "WHOLE", capacity: 2,
          building: { id: "bld-1", name: "Tòa A", code: "A" },
          floor: { id: "floor-1", name: "Tầng 1", level: 1 },
          contracts: [{
            id: "contract-1", code: "HD-101", status: "ACTIVE",
            startDate: new Date("2026-10-01T00:00:00.000Z"),
            endDate: new Date("2027-10-01T00:00:00.000Z"), monthlyRent: 3500000,
            customer: { id: "cust-1", fullName: "Nguyễn Văn A" },
          }],
          // Deliberately contradictory live data: a locked snapshot must hydrate
          // from its own allocation rather than fall back to current Occupancy.
          occupancies: [{
            id: "legacy-occupancy", customerId: "legacy-customer", contractId: "other-contract",
            joinedAt: new Date("2026-09-10T00:00:00.000Z"), leftAt: null,
            customer: { id: "legacy-customer", fullName: "Legacy tenant" },
          }],
          roommates: [],
        },
      ]);
      prisma.billingSnapshot.findMany.mockResolvedValue([{
        id: "snapshot-new-tenant", tenantId: "tenant-1", roomId: "room-1",
        usagePeriod: "2026-09", status: "LOCKED", usageKwh: 0,
        electricityAmount: 0, waterAmount: 0, occupantCount: 0,
        occupants: [],
        allocations: [{
          contractId: "contract-1", memberCount: 0, eligible: false,
          electricityKwh: 0, electricityAmount: 0, waterAmount: 0,
        }],
      }]);

      const res = await service.getOverview("tenant-1", { period: "2026-10" });

      expect(res.items[0]).toMatchObject({
        billingDataSource: "LOCKED_SNAPSHOT",
        occupancySource: "LOCKED_SNAPSHOT",
        membersCount: 0,
        electricityEligible: false,
        waterEligible: false,
        waterAmount: 0,
      });
      expect(res.items[0].settlementBlockers).toEqual([]);
    });
  });

  describe("closeMonth", () => {
    it("preflights every targeted room before financial writes and surfaces terminal contracts explicitly", async () => {
      vi.spyOn(service, "getOverview").mockResolvedValue({
        items: [{
          roomId: "ambiguous-room", roomCode: "A-1", hasContract: true,
          settlementBlockers: [{
            code: "TERMINAL_CONTRACT_REQUIRES_FINAL_SETTLEMENT",
            message: "final settlement required", contractId: "terminal-contract",
          }],
        }],
      } as any);

      await expect(
        service.closeMonth("tenant-1", "user-1", { period: "2026-09", roomIds: ["ambiguous-room"] }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "MONTHLY_SETTLEMENT_OCCUPANCY_AMBIGUOUS",
          reason: "TERMINAL_CONTRACT_REQUIRES_FINAL_SETTLEMENT",
        }),
      });
      expect(prisma.invoice.create).not.toHaveBeenCalled();
      expect(prisma.billingSnapshot.createMany).not.toHaveBeenCalled();
      expect(hunonicService.lockPeriods).not.toHaveBeenCalled();
    });

    it("does not lock a usage period when occupancy preflight is ambiguous", async () => {
      vi.spyOn(service, "getOverview").mockResolvedValue({
        items: [{
          roomId: "ambiguous-room", roomCode: "A-1", hasContract: true,
          settlementBlockers: [{ code: "OCCUPANCY_REQUIRED", message: "no occupancy" }],
        }],
      } as any);
      await expect(service.finalizeUsagePeriod("tenant-1", { period: "2026-08" })).rejects.toMatchObject({
        response: expect.objectContaining({ code: "MONTHLY_SETTLEMENT_OCCUPANCY_AMBIGUOUS" }),
      });
      expect(hunonicService.lockPeriods).not.toHaveBeenCalled();
    });

    it("claims and completes one durable settlement run", async () => {
      prisma.monthlySettlementRun = {
        create: vi.fn().mockResolvedValue({ id: "run-1", status: "RUNNING" }),
        findUnique: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      };

      const res = await service.closeMonth("tenant-1", "user-1", {
        period: "2026-09",
        autoSend: false,
      });

      expect(res.success).toBe(true);
      expect(prisma.monthlySettlementRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          billingPeriod: "2026-09",
          scopeKey: "ALL",
          status: "RUNNING",
          createdBy: "user-1",
        }),
      });
      expect(prisma.monthlySettlementRun.updateMany).toHaveBeenLastCalledWith({
        where: { id: "run-1", status: "RUNNING" },
        data: expect.objectContaining({
          status: "COMPLETED",
          result: expect.objectContaining({ success: true, period: "2026-09" }),
          completedAt: expect.any(Date),
        }),
      });
    });

    it("replays a completed run without creating another invoice", async () => {
      const identity = buildSettlementRunIdentity("2026-09", {
        autoSend: false,
      });
      const previousResult = {
        success: true,
        period: "2026-09",
        settledCount: 1,
        invoices: [{ invoiceId: "inv-existing" }],
      };
      prisma.monthlySettlementRun = {
        create: vi.fn().mockRejectedValue({ code: "P2002" }),
        findUnique: vi.fn().mockResolvedValue({
          id: "run-existing",
          status: "COMPLETED",
          requestHash: identity.requestHash,
          result: previousResult,
        }),
        updateMany: vi.fn(),
      };

      await expect(
        service.closeMonth("tenant-1", "user-1", {
          period: "2026-09",
          autoSend: false,
        }),
      ).resolves.toEqual(previousResult);
      expect(prisma.invoice.create).not.toHaveBeenCalled();
      expect(prisma.monthlySettlementRun.updateMany).not.toHaveBeenCalled();
    });

    it("fails closed while the same tenant, period and scope is already running", async () => {
      const identity = buildSettlementRunIdentity("2026-09", {
        autoSend: false,
      });
      prisma.monthlySettlementRun = {
        create: vi.fn().mockRejectedValue({ code: "P2002" }),
        findUnique: vi.fn().mockResolvedValue({
          id: "run-running",
          status: "RUNNING",
          requestHash: identity.requestHash,
          result: null,
        }),
        updateMany: vi.fn(),
      };

      await expect(
        service.closeMonth("tenant-1", "user-1", {
          period: "2026-09",
          autoSend: false,
        }),
      ).rejects.toThrow("MONTHLY_SETTLEMENT_ALREADY_RUNNING");
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });

    it("rejects a different command payload for an existing settlement scope", async () => {
      const differentIdentity = buildSettlementRunIdentity("2026-09", {
        autoSend: true,
      });
      prisma.monthlySettlementRun = {
        create: vi.fn().mockRejectedValue({ code: "P2002" }),
        findUnique: vi.fn().mockResolvedValue({
          id: "run-existing",
          status: "COMPLETED",
          requestHash: differentIdentity.requestHash,
          result: { success: true },
        }),
        updateMany: vi.fn(),
      };

      await expect(
        service.closeMonth("tenant-1", "user-1", {
          period: "2026-09",
          autoSend: false,
        }),
      ).rejects.toThrow("MONTHLY_SETTLEMENT_REQUEST_MISMATCH");
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });

    it("reclaims one FAILED run and records a new completion", async () => {
      const identity = buildSettlementRunIdentity("2026-09", {
        autoSend: false,
      });
      prisma.monthlySettlementRun = {
        create: vi.fn().mockRejectedValue({ code: "P2002" }),
        findUnique: vi.fn().mockResolvedValue({
          id: "run-failed",
          status: "FAILED",
          requestHash: identity.requestHash,
          result: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      };

      const result = await service.closeMonth("tenant-1", "user-2", {
        period: "2026-09",
        autoSend: false,
      });

      expect(result.success).toBe(true);
      expect(prisma.monthlySettlementRun.updateMany.mock.calls[0][0]).toEqual({
        where: { id: "run-failed", status: "FAILED" },
        data: expect.objectContaining({
          status: "RUNNING",
          createdBy: "user-2",
          startedAt: expect.any(Date),
        }),
      });
      expect(prisma.monthlySettlementRun.updateMany).toHaveBeenLastCalledWith({
        where: { id: "run-failed", status: "RUNNING" },
        data: expect.objectContaining({ status: "COMPLETED" }),
      });
    });

    it("creates invoice and locks hunonic meter readings for period", async () => {
      const res = await service.closeMonth("tenant-1", "user-1", {
        period: "2026-09",
        autoSend: false,
      });

      expect(res.success).toBe(true);
      expect(res.settledCount).toBe(1);
      expect(prisma.invoice.create).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.billingSnapshot.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({
          tenantId: "tenant-1",
          roomId: "room-1",
          usagePeriod: "2026-08",
        })],
        skipDuplicates: true,
      });
      const createdItems =
        prisma.invoice.create.mock.calls[0][0].data.items.create;
      expect(prisma.invoice.create.mock.calls[0][0].data).toMatchObject({
        billingKind: "MONTHLY_BASE",
        baseInvoiceKey: "MONTHLY:contract-1:2026-09",
      });
      expect(createdItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "UTILITY_ELECTRICITY",
            billingSnapshotId: "snapshot-1",
          }),
          expect.objectContaining({
            type: "UTILITY_WATER",
            billingSnapshotId: "snapshot-1",
          }),
        ]),
      );
      expect(hunonicService.lockPeriods).toHaveBeenCalledWith("tenant-1", {
        rows: [
          {
            buildingCode: "A",
            roomCode: "101",
            period: "2026-08",
            note: "Khóa chỉ số điện sử dụng tháng 2026-08 cho kỳ thu 2026-09",
          },
        ],
      });
    });

    it("stores monthly aggregates with null register endpoints and canonical provenance", async () => {
      await service.closeMonth("tenant-1", "user-1", { period: "2026-09", autoSend: false });

      const snapshot = prisma.billingSnapshot.createMany.mock.calls[0][0].data[0];
      expect(snapshot).toMatchObject({
        aggregateBasis: "MONTHLY_AGGREGATE_V1",
        startReadingKwh: null,
        endReadingKwh: null,
        sourcePayloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        sourceProvenance: expect.objectContaining({
          tenantId: "tenant-1",
          usagePeriod: "2026-08",
          aggregateBasis: "MONTHLY_AGGREGATE_V1",
        }),
      });
    });

    it("fails closed when positive utility totals only come from a live mapping", async () => {
      prisma.hunonicMeterReading.findMany.mockResolvedValue([]);

      await expect(
        service.closeMonth("tenant-1", "user-1", { period: "2026-09", autoSend: false }),
      ).rejects.toThrow("BILLING_SNAPSHOT_REQUIRES_PERSISTED_OBSERVATION");
    });

    it("fails closed when the persisted Hunonic aggregate is incomplete", async () => {
      prisma.hunonicMeterReading.findMany.mockResolvedValue([
        {
          id: "reading-partial",
          roomId: "room-1",
          meterMappingId: "meter-1",
          currentMonth: "2026-08",
          sourcePeriod: "2026-08",
          aggregateBasis: "MONTHLY_AGGREGATE_V1",
          sourceProvider: "hunonic",
          sourceProviderMeterId: "provider-meter-1",
          payloadHash: "b".repeat(64),
          energyMonthKwh: 120,
          moneyMonthVnd: null,
          readingAt: new Date("2026-08-31T17:00:00.000Z"),
        },
      ]);

      await expect(
        service.closeMonth("tenant-1", "user-1", { period: "2026-09", autoSend: false }),
      ).rejects.toThrow("HUNONIC_MONTHLY_AGGREGATE_INCOMPLETE");
    });

    it("aborts when a newer canonical observation wins before the evidence lock", async () => {
      prisma.hunonicMeterReading.findFirst.mockResolvedValue({
        id: "reading-newer",
        meterMappingId: "meter-1",
      });

      await expect(
        service.closeMonth("tenant-1", "user-1", { period: "2026-09", autoSend: false }),
      ).rejects.toThrow("BILLING_SNAPSHOT_SOURCE_CHANGED_RETRY");
      expect(prisma.billingSnapshot.createMany).not.toHaveBeenCalled();
    });

    it("creates first-month invoice without previous usage electricity item", async () => {
      prisma.room.findMany.mockResolvedValue([
        {
          id: "room-1",
          code: "101",
          name: "Phòng 101",
          monthlyPrice: 3500000,
          rentalType: "WHOLE",
          capacity: 2,
          building: { id: "bld-1", name: "Tòa A", code: "A" },
          floor: { id: "floor-1", name: "Tầng 1", level: 1 },
          contracts: [
            {
              id: "contract-1",
              code: "HD-101",
              status: "ACTIVE",
              startDate: new Date("2026-10-01T00:00:00.000Z"),
              endDate: new Date("2027-10-01T00:00:00.000Z"),
              signedAt: new Date("2026-09-03T00:00:00.000Z"),
              monthlyRent: 3500000,
              customer: {
                id: "cust-1",
                fullName: "Nguyễn Văn A",
                phone: "0901234567",
                identityNo: "001234567890",
                gender: "MALE",
                zaloPhone: "0901234567",
                zaloChatId: "zalo-chat-1",
              },
            },
          ],
          roommates: [],
          occupancies: [
            {
              id: "occupancy-1", customerId: "cust-1", contractId: "contract-1", role: "ĐẠI DIỆN",
              joinedAt: new Date("2026-10-01T00:00:00.000Z"), leftAt: null,
              customer: { id: "cust-1", fullName: "Nguyễn Văn A", phone: "0901234567", identityNo: "001234567890", gender: "MALE", zaloChatId: "zalo-chat-1" },
            },
          ],
        },
      ]);

      const res = await service.closeMonth("tenant-1", "user-1", {
        period: "2026-10",
        autoSend: false,
      });

      expect(res.settledCount).toBe(1);
      expect(hunonicService.lockPeriods).not.toHaveBeenCalled();
      const createCall = prisma.invoice.create.mock.calls[0][0];
      expect(createCall.data.period).toBe("2026-10");
      expect(createCall.data.usagePeriod).toBe("2026-09");
      expect(createCall.data.items.create).toEqual([
        expect.objectContaining({
          type: "RENT",
          servicePeriod: "2026-10",
          amount: 3500000,
        }),
      ]);
      expect(createCall.data.items.create).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "UTILITY_ELECTRICITY" }),
        ]),
      );
      expect(createCall.data.items.create).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "UTILITY_WATER" }),
        ]),
      );
    });

    it("skips settled invoices that already have payment activity", async () => {
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: "inv-101",
          code: "INV-202609-101",
          period: "2026-09",
          status: "PARTIALLY_PAID",
          paidAmount: 100000,
          contract: { roomId: "room-1" },
          createdAt: new Date("2026-09-01"),
          items: [],
          total: 4170000,
        },
      ]);
      prisma.invoice.findFirst.mockResolvedValue({
        id: "inv-101",
        code: "INV-202609-101",
        status: "PARTIALLY_PAID",
        paidAmount: 100000,
      });

      const res = await service.closeMonth("tenant-1", "user-1", {
        period: "2026-09",
        autoSend: false,
      });

      expect(res.settledCount).toBe(0);
      expect(res.skippedCount).toBe(1);
      expect(prisma.invoiceItem.deleteMany).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it("creates one invoice per active contract for shared rooms", async () => {
      prisma.room.findMany.mockResolvedValue([
        {
          id: "room-1",
          code: "101",
          name: "Phòng 101",
          monthlyPrice: 6000000,
          rentalType: "SHARED",
          capacity: 4,
          building: { id: "bld-1", name: "Tòa A", code: "A" },
          floor: { id: "floor-1", name: "Tầng 1", level: 1 },
          contracts: [
            {
              id: "contract-a",
              code: "HD-A",
              status: "ACTIVE",
              startDate: new Date("2026-08-01T00:00:00.000Z"),
              endDate: new Date("2027-08-01T00:00:00.000Z"),
              signedAt: new Date("2026-07-25T00:00:00.000Z"),
              monthlyRent: 2000000,
              memberCount: 1,
              customer: {
                id: "cust-a",
                fullName: "Khách A",
                phone: "0900000001",
                identityNo: "001",
                gender: "MALE",
                zaloPhone: "0900000001",
                zaloChatId: "zalo-a",
              },
            },
            {
              id: "contract-b",
              code: "HD-B",
              status: "ACTIVE",
              startDate: new Date("2026-08-01T00:00:00.000Z"),
              endDate: new Date("2027-08-01T00:00:00.000Z"),
              signedAt: new Date("2026-07-25T00:00:00.000Z"),
              monthlyRent: 3000000,
              memberCount: 2,
              customer: {
                id: "cust-b",
                fullName: "Khách B",
                phone: "0900000002",
                identityNo: "002",
                gender: "FEMALE",
                zaloPhone: "0900000002",
                zaloChatId: "zalo-b",
              },
            },
          ],
          roommates: [],
          occupancies: [
            {
              id: "occupancy-a", customerId: "cust-a", contractId: "contract-a", role: "ĐẠI DIỆN",
              joinedAt: new Date("2026-08-01T00:00:00.000Z"), leftAt: null,
              customer: { id: "cust-a", fullName: "Khách A", phone: "0900000001", identityNo: "001", gender: "MALE", zaloChatId: "zalo-a" },
            },
            {
              id: "occupancy-b-1", customerId: "cust-b", contractId: "contract-b", role: "ĐẠI DIỆN",
              joinedAt: new Date("2026-08-01T00:00:00.000Z"), leftAt: null,
              customer: { id: "cust-b", fullName: "Khách B", phone: "0900000002", identityNo: "002", gender: "FEMALE", zaloChatId: "zalo-b" },
            },
            {
              id: "occupancy-b-2", customerId: "cust-b-2", contractId: "contract-b", role: "THÀNH VIÊN Ở CÙNG",
              joinedAt: new Date("2026-08-01T00:00:00.000Z"), leftAt: null,
              customer: { id: "cust-b-2", fullName: "Khách B2", phone: "0900000003", identityNo: "003", gender: "FEMALE" },
            },
          ],
        },
      ]);

      const res = await service.closeMonth("tenant-1", "user-1", {
        period: "2026-09",
        autoSend: false,
      });

      expect(res.settledCount).toBe(2);
      expect(prisma.invoice.create).toHaveBeenCalledTimes(2);
      expect(prisma.invoice.create.mock.calls[0][0].data).toMatchObject({
        code: "INV-202609-101-HD-A",
        contractId: "contract-a",
        customerId: "cust-a",
        total: 2240000,
      });
      expect(prisma.invoice.create.mock.calls[1][0].data).toMatchObject({
        code: "INV-202609-101-HD-B",
        contractId: "contract-b",
        customerId: "cust-b",
        total: 3480000,
      });
      expect(hunonicService.lockPeriods).toHaveBeenCalledTimes(1);
      expect(hunonicService.lockPeriods.mock.calls[0][1].rows).toHaveLength(1);
    });
  });

  describe("sendNotifications", () => {
    it("dispatches payment request via Zalo for settled rooms", async () => {
      // Mock existing invoice
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: "inv-101",
          code: "INV-202609-101",
          period: "2026-09",
          billingKind: "MONTHLY_BASE",
          baseInvoiceKey: "MONTHLY:contract-1:2026-09",
          contractId: "contract-1",
          contract: { id: "contract-1", roomId: "room-1" },
          createdAt: new Date("2026-09-01"),
          items: [],
          total: 4170000,
        },
      ]);

      const res = await service.sendNotifications("tenant-1", "user-1", {
        period: "2026-09",
      });

      expect(res.sentCount).toBe(1);
      expect(paymentsService.sendInvoiceRequestToZalo).toHaveBeenCalledWith(
        "inv-101",
        "user-1",
      );
    });
  });
});
