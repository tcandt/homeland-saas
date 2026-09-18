import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BillingProvenanceBadge,
  ElectricityMismatchAlert,
} from "../../components/summary/BillingSnapshotPresentation";
import {
  HunonicSnapshotPresentation,
  type HunonicSnapshotData,
} from "../../components/finance/HunonicSnapshotPresentation";
import { apiClient } from "../../lib/api/client";
import { invoicesApi } from "../../lib/api/invoices.api";
import { shouldEnableInvoicesQuery } from "../../lib/queries/invoices.queries";
import {
  createInvoiceRentalCycleScope,
  isInvoiceInRentalCycleScope,
  isSameInvoiceRentalCycleScope,
  withInvoiceRentalCycleScope,
} from "../../lib/invoices/rental-cycle-scope";
import { createFinanceSourceTarget } from "../../components/finance/RoomFinanceSummaryPresentation";

function render(node: React.ReactElement) {
  return renderToStaticMarkup(node);
}

function lockedHunonicSnapshot(
  overrides: Partial<HunonicSnapshotData> = {},
): HunonicSnapshotData {
  return {
    roomCode: "P.101",
    buildingName: "Tòa A",
    cycleMonth: "09/2026",
    isLive: false,
    pricingMode: "custom",
    electricity: {
      startReading: 100,
      endReading: 110,
      totalKwh: 10,
      unitPrice: 3500,
      totalAmount: 35000,
    },
    water: {
      occupantCount: 2,
      unitPricePerPerson: 100000,
      totalAmount: 200000,
    },
    tenantShares: [
      {
        customerId: "tenant-1",
        customerName: "Nguyễn An",
        sharePercent: 1,
        electricityAmount: 35000,
        waterAmount: 200000,
        totalAmount: 235000,
      },
    ],
    ...overrides,
  };
}

describe("CORE-07.08: billing snapshot presentation", () => {
  it("keeps locked provenance visible for a contracted 0 đ bill", () => {
    // Amount is deliberately not an input to the provenance component: a zero
    // amount must not suppress the server-provided LOCKED_SNAPSHOT provenance.
    const html = render(
      React.createElement(BillingProvenanceBadge, {
        hasContract: true,
        dataSource: "LOCKED_SNAPSHOT",
        snapshotId: "snapshot-zero-vnd",
        usagePeriod: "09/2026",
        testId: "billing-provenance-zero-amount",
      }),
    );

    expect(html).toContain('data-testid="billing-provenance-zero-amount"');
    expect(html).toContain("Snapshot đã khóa");
    expect(html).toContain("snapshot snapshot-zero-vnd, kỳ 09/2026");
    expect(html).toContain("Nguồn dữ liệu hóa đơn: Snapshot đã khóa");
  });

  it("labels an unlocked contracted bill as non-final data", () => {
    const html = render(
      React.createElement(BillingProvenanceBadge, {
        hasContract: true,
        dataSource: "LIVE_REFERENCE",
        testId: "billing-provenance-unlocked",
      }),
    );

    expect(html).toContain("Dữ liệu chưa khóa");
    expect(html).toContain("Nguồn dữ liệu hóa đơn: Dữ liệu chưa khóa");
  });

  it("renders a red reconciliation alert containing the API deltas", () => {
    const html = render(
      React.createElement(ElectricityMismatchAlert, {
        testId: "billing-mismatch",
        reconciliation: {
          status: "MISMATCHED",
          deltaKwh: 12.5,
          deltaAmount: 45000,
        },
      }),
    );

    expect(html).toContain('data-testid="billing-mismatch"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("12,5 kWh");
    expect(html).toContain("45.000 đ");
    expect(html).toContain("text-red-700");
  });

  it("does not render an alert for matched reconciliation", () => {
    const html = render(
      React.createElement(ElectricityMismatchAlert, {
        testId: "billing-matched",
        reconciliation: { status: "MATCHED", deltaKwh: 0, deltaAmount: 0 },
      }),
    );

    expect(html).toBe("");
  });
});

describe("CORE-07.08: Hunonic live versus locked presentation", () => {
  it("treats a live payload as reference-only even when it carries money, water, and allocation fields", () => {
    const html = render(
      React.createElement(HunonicSnapshotPresentation, {
        data: lockedHunonicSnapshot({ isLive: true }),
      }),
    );

    expect(html).toContain("Công tơ trực tiếp (tham khảo)");
    expect(html).toContain("Dữ liệu công tơ trực tiếp chỉ để tham khảo");
    expect(html).toContain("10 kWh");
    expect(html).not.toContain("35.000 đ");
    expect(html).not.toContain("200.000 đ");
    expect(html).not.toContain("Nước sinh hoạt");
    expect(html).not.toContain("Phân bổ theo khách");
    expect(html).not.toContain("Nguyễn An");
    expect(html).not.toContain("Đơn giá:");
  });

  it("renders API-provided billing breakdown only for a locked snapshot", () => {
    const html = render(
      React.createElement(HunonicSnapshotPresentation, {
        data: lockedHunonicSnapshot(),
      }),
    );

    expect(html).toContain("Snapshot kỳ chốt");
    expect(html).toContain("35.000 đ");
    expect(html).toContain("200.000 đ");
    expect(html).toContain("Nước sinh hoạt");
    expect(html).toContain("Phân bổ theo khách trong phòng (1 người)");
    expect(html).toContain("Nguyễn An");
    expect(html).toContain("235.000 đ");
  });
});

describe("CORE-07.08: invoice rental-cycle request scope", () => {
  afterEach(() => vi.restoreAllMocks());

  it("passes the selected rentalCycleId unchanged to the invoice API", async () => {
    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({ data: [] } as any);

    await invoicesApi.list({
      roomId: "room-shared-across-cycles",
      customerId: "customer-1",
      contractId: "contract-1",
      rentalCycleId: "cycle-current-only",
    });

    expect(getSpy).toHaveBeenCalledOnce();
    expect(getSpy).toHaveBeenCalledWith("/invoices", {
      params: {
        roomId: "room-shared-across-cycles",
        customerId: "customer-1",
        contractId: "contract-1",
        rentalCycleId: "cycle-current-only",
      },
    });
  });

  it("does not enable a finance invoice query when its rental cycle is missing", () => {
    expect(
      shouldEnableInvoicesQuery(
        { roomId: "room-1", customerId: "customer-1", contractId: "contract-1" },
        { requireRentalCycle: true },
      ),
    ).toBe(false);
  });

  it("keeps the exact RoomPremium rental-cycle identity in the create payload", () => {
    const scope = createInvoiceRentalCycleScope("room-1", {
      customerId: "customer-selected",
      contractId: "contract-selected",
      cycleId: "cycle-selected",
    });

    expect(scope).toEqual({
      roomId: "room-1",
      customerId: "customer-selected",
      contractId: "contract-selected",
      rentalCycleId: "cycle-selected",
    });
    expect(
      withInvoiceRentalCycleScope(
        { roomId: "room-other", customerId: "customer-other", contractId: "contract-other", totalAmount: 0 },
        scope || undefined,
      ),
    ).toMatchObject({
      roomId: "room-1",
      customerId: "customer-selected",
      contractId: "contract-selected",
      rentalCycleId: "cycle-selected",
      totalAmount: 0,
    });
  });
});

describe("GATE-08: finance source deep-link scope", () => {
  it("keeps the exact shared-room customer, contract and rental cycle on an invoice source link", () => {
    const target = createFinanceSourceTarget(
      {
        rentalCycleId: "cycle-customer-a",
        customerId: "customer-a",
        contractId: "contract-a",
      },
      { entity: "Invoice", id: "invoice-a", code: "HD-A" },
    );

    expect(target).toEqual({
      rentalCycleId: "cycle-customer-a",
      customerId: "customer-a",
      contractId: "contract-a",
      source: { entity: "Invoice", id: "invoice-a", code: "HD-A" },
    });
    expect(target.customerId).not.toBe("customer-b");
  });

  it("invalidates invoice A after switching a shared room to customer B's cycle", () => {
    const scopeA = {
      roomId: "room-shared",
      customerId: "customer-a",
      contractId: "contract-a",
      rentalCycleId: "cycle-a",
    };
    const scopeB = {
      roomId: "room-shared",
      customerId: "customer-b",
      contractId: "contract-b",
      rentalCycleId: "cycle-b",
    };
    const invoiceA = {
      customerId: "customer-a",
      contractId: "contract-a",
      rentalCycleId: "cycle-a",
      contract: { roomId: "room-shared" },
    };

    expect(isSameInvoiceRentalCycleScope(scopeA, scopeB)).toBe(false);
    expect(isInvoiceInRentalCycleScope(invoiceA, scopeB)).toBe(false);
  });
});
