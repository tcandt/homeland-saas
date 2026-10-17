import { expect } from "@playwright/test";
import { test } from "../../fixtures/admin.fixture";

function createContract(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id || "contract-active-1",
    code: overrides.code || "C-ACTIVE-001",
    status: overrides.status || "ACTIVE",
    startDate: overrides.startDate || "2026-01-01T00:00:00.000Z",
    endDate: overrides.endDate || "2026-12-31T00:00:00.000Z",
    monthlyRent: overrides.monthlyRent ?? 5000000,
    depositMoney: overrides.depositMoney ?? 5000000,
    debt: overrides.debt ?? 0,
    memberCount: overrides.memberCount ?? 2,
    attachments: overrides.attachments || [],
    customer: overrides.customer || {
      id: "customer-1",
      fullName: "Nguyen Van A",
      phone: "0901234567",
      idImages: [],
    },
    room: overrides.room || {
      id: "room-1",
      number: "P101",
      code: "P101",
      status: overrides.roomStatus || "OCCUPIED",
      building: {
        id: "building-1",
        name: "LK01-31",
      },
    },
    coRepresentatives: overrides.coRepresentatives || [],
    settlementRefund: overrides.settlementRefund ?? null,
    updatedAt: overrides.updatedAt || "2026-08-11T08:00:00.000Z",
    createdAt: overrides.createdAt || "2026-08-01T08:00:00.000Z",
  };
}

function createSettlementPreview(payload: any) {
  const depositToRefund = Number(payload?.depositToRefund || 0);
  const depositToDeduct = Number(payload?.depositToDeduct || 0);
  const chargeTotal = 2100000;
  const creditTotal = 1200000 + depositToRefund + depositToDeduct;
  const refundToCustomer = Math.max(creditTotal - chargeTotal, 0);
  const netReceivable = Math.max(chargeTotal - creditTotal, 0);

  return {
    actualMoveOutDate: payload?.actualMoveOutDate || "2026-08-11",
    roomTurnoverStatus: payload?.roomTurnoverStatus || "CLEANING",
    charges: [
      { key: "rentChargeAmount", description: "Final rent settlement (10 days)", amount: 1200000 },
      { key: "electricityAmount", description: "Electricity settlement", amount: 500000 },
      { key: "waterAmount", description: "Water settlement", amount: 200000 },
      { key: "serviceAmount", description: "Service fee", amount: 200000 },
    ],
    credits: [
      { key: "roomRefundAmount", description: "Room refund", amount: 700000 },
      { key: "waterSupportAmount", description: "Water support", amount: 500000 },
      ...(depositToDeduct > 0 ? [{ key: "depositToDeduct", description: "Deposit applied to outstanding debt", amount: depositToDeduct }] : []),
      ...(depositToRefund > 0 ? [{ key: "depositToRefund", description: "Deposit refund", amount: depositToRefund }] : []),
    ],
    totals: {
      chargeTotal,
      creditTotal,
      refundToCustomer,
      netReceivable,
    },
    utilitySnapshot: {
      electricity: {
        displayName: "Cong to phong P101",
        deviceName: "Hunonic Meter 01",
        readingAt: "2026-08-11T08:00:00.000Z",
        source: "hunonic-sync",
        monthKwh: 120,
        monthAmountVnd: 500000,
        calculatedAmountVnd: 500000,
        rateMode: "CUSTOM",
        calculationSource: "SETTLEMENT_SNAPSHOT",
      },
      water: {
        previousReading: 10,
        currentReading: 18,
        usage: 8,
        unitPrice: 25000,
        amount: 200000,
        source: "manual-preview",
      },
    },
  };
}

async function mockProofUpload(page: any, url: string) {
  await page.route("**/api/v1/documents/upload", async (route: any) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          url,
          size: 24,
          mimeType: "image/png",
          documentId: "settlement-receipt-document",
          versionId: "settlement-receipt-version",
        },
      }),
    });
  });
}

async function mockContracts(page: any, rejectTurnover = false) {
  let lastPreviewPayload: any = null;
  let lastTerminatePayload: any = null;
  let lastCompleteRefundPayload: any = null;
  let lastRoomUpdatePayload: any = null;

  const activeContract = createContract();
  const terminatedContract = createContract({
    id: "contract-terminated-1",
    code: "C-TERM-001",
    status: "TERMINATED",
    roomStatus: "CLEANING",
    settlementRefund: {
      receiptId: "receipt-1",
      receiptCode: "RC-SETTLE-001",
      receiptStatus: "PENDING",
      receiptAmount: 1800000,
      receiptDescription: "Contract settlement refund for C-TERM-001",
      taskId: "task-1",
      taskTitle: "Xu ly hoan tien C-TERM-001",
      taskStatus: "TODO",
      pending: true,
      completed: false,
    },
  });

  const contracts = [activeContract, terminatedContract];
  terminatedContract.room.id = "room-terminated-1";

  await page.route("**/api/v1/contracts**", async (route: any) => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    const method = route.request().method();

    if (pathname.endsWith("/settlement-preview") && method === "POST") {
      lastPreviewPayload = route.request().postDataJSON?.() || {};
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: createSettlementPreview(lastPreviewPayload),
        }),
      });
      return;
    }

    if (pathname.endsWith("/settlement-refund/complete") && method === "POST") {
      lastCompleteRefundPayload = route.request().postDataJSON?.() || {};
      terminatedContract.settlementRefund = {
        ...terminatedContract.settlementRefund,
        receiptStatus: "COMPLETED",
        taskStatus: "DONE",
        pending: false,
        completed: true,
      };
      terminatedContract.updatedAt = "2026-08-12T09:00:00.000Z";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            success: true,
            receiptId: "receipt-1",
            taskId: "task-1",
            amount: 1800000,
          },
        }),
      });
      return;
    }

    if (pathname.endsWith("/terminate") && method === "POST") {
      lastTerminatePayload = route.request().postDataJSON?.() || {};
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            ...activeContract,
            status: "TERMINATED",
          },
        }),
      });
      return;
    }

    if (pathname.endsWith("/contracts") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            items: contracts,
            total: contracts.length,
          },
        }),
      });
      return;
    }

    const id = pathname.split("/").pop();
    const contract = contracts.find((item) => item.id === id);
    await route.fulfill({
      status: contract ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify({
        success: !!contract,
        data: contract || null,
      }),
    });
  });

  await mockProofUpload(page, "/uploads/settlement-receipt.png");

  await page.route("**/api/v1/rooms/*", async (route: any) => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    const method = route.request().method();

    if (method === "PATCH") {
      lastRoomUpdatePayload = route.request().postDataJSON?.() || {};
      if (rejectTurnover) {
        await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ message: "ROOM_TURNOVER_ROOM_IN_USE" }) });
        return;
      }
      const roomId = pathname.split("/").pop();
      const currentContract = contracts.find((item) => item.room?.id === roomId);
      const nextStatus = String(lastRoomUpdatePayload?.status || "AVAILABLE");
      if (currentContract?.room) {
        currentContract.room = {
          ...currentContract.room,
          status: nextStatus,
        };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: roomId,
            number: currentContract?.room?.number || "P101",
            status: nextStatus,
            type: "STUDIO",
            price: 5000000,
            area: 25,
            capacity: 2,
            images: [],
            rentalType: "whole",
            buildingId: currentContract?.room?.building?.id || "building-1",
            floorId: "floor-1",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-08-11T08:00:00.000Z",
          },
        }),
      });
      return;
    }

    await route.fallback();
  });

  return {
    getLastPreviewPayload: () => lastPreviewPayload,
    getLastTerminatePayload: () => lastTerminatePayload,
    getLastCompleteRefundPayload: () => lastCompleteRefundPayload,
    getLastRoomUpdatePayload: () => lastRoomUpdatePayload,
  };
}

async function mockFullRentalJourney(page: any) {
  const bookingHoldExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const state = {
    roomStatus: "AVAILABLE",
    deposit: {
      id: "deposit-journey-1",
      code: "DEP-JOURNEY-001",
      type: "BOOKING",
      status: "PENDING",
      amount: 5000000,
      availableBalance: 0,
      note: "Deposit for end-to-end rental journey",
      expiredAt: bookingHoldExpiry,
      createdAt: "2026-08-13T08:00:00.000Z",
      updatedAt: "2026-08-13T08:00:00.000Z",
      customer: { id: "customer-journey-1", fullName: "Nguyen Van Journey", phone: "0901234567" },
      room: {
        id: "room-journey-1",
        code: "31-01",
        name: "Phong 31-01",
        building: { id: "building-journey-1", code: "LK01-31", name: "LK01-31" },
      },
      refundSummary: null as any,
    },
    bookingContract: {
      id: "contract-booking-journey-1",
      code: "HD-COC-JOURNEY-001",
      isBookingHold: true,
      status: "DRAFT",
      startDate: "2026-11-03T00:00:00.000Z",
      endDate: "2026-12-01T00:00:00.000Z",
      monthlyRent: 5000000,
      depositMoney: 5000000,
      purpose: "Cọc giữ phòng. Giá thuê: 5000000. Tiền cọc hợp đồng: 5000000",
      debt: 0,
      memberCount: 1,
      attachments: [],
      customerId: "customer-journey-1",
      roomId: "room-journey-1",
      customer: { id: "customer-journey-1", fullName: "Nguyen Van Journey", phone: "0901234567", idImages: [] },
      room: {
        id: "room-journey-1",
        number: "31-01",
        code: "31-01",
        status: "AVAILABLE",
        monthlyPrice: 5000000,
        building: { id: "building-journey-1", code: "LK01-31", name: "LK01-31" },
      },
      coRepresentatives: [],
      createdAt: "2026-08-13T08:00:00.000Z",
      updatedAt: "2026-08-13T08:00:00.000Z",
    },
    contract: {
      id: "contract-journey-1",
      code: "CTR-JOURNEY-001",
      status: "DRAFT",
      startDate: null as string | null,
      endDate: null as string | null,
      signedAt: null as string | null,
      monthlyRent: 5000000,
      depositMoney: 5000000,
      debt: 0,
      memberCount: 1,
      attachments: [],
      customer: { id: "customer-journey-1", fullName: "Nguyen Van Journey", phone: "0901234567", idImages: [] },
      room: {
        id: "room-journey-1",
        number: "31-01",
        code: "31-01",
        status: "AVAILABLE",
        building: { id: "building-journey-1", code: "LK01-31", name: "LK01-31" },
      },
      coRepresentatives: [],
      settlementRefund: null as any,
      createdAt: "2026-08-13T08:00:00.000Z",
      updatedAt: "2026-08-13T08:00:00.000Z",
    },
    bookingInvoice: {
      id: "invoice-booking-journey-1",
      code: "INV-BOOKING-JOURNEY-001",
      status: "ISSUED",
      billingKind: "BOOKING_HOLD",
      period: "Cọc giữ phòng",
      usagePeriod: "Cọc giữ phòng",
      paidAmount: 0,
      creditAmount: 0,
      remainingAmount: 5000000,
      paymentRequests: [{ id: "request-booking-journey-1", code: "PAY-BOOKING-JOURNEY-001", status: "PENDING", amount: 5000000 }],
      total: 5000000,
      paidPercent: 0,
      createdAt: "2026-08-13T08:00:00.000Z",
      dueDate: "2026-11-03T00:00:00.000Z",
      customer: { id: "customer-journey-1", name: "Nguyen Van Journey", fullName: "Nguyen Van Journey" },
      contract: {
        id: "contract-booking-journey-1",
        roomId: "room-journey-1",
        room: {
          id: "room-journey-1",
          number: "31-01",
          code: "31-01",
          building: { id: "building-journey-1", code: "LK01-31", name: "LK01-31" },
        },
      },
      items: [{ id: "item-booking-1", type: "RENT", description: "Tiền cọc giữ phòng", servicePeriod: "BOOKING_HOLD", quantity: 1, unitPrice: 5000000, amount: 5000000 }],
    },
    invoice: {
      id: "invoice-journey-1",
      code: "INV-JOURNEY-001",
      status: "ISSUED",
      billingKind: "ENTRY",
      period: "2026-08",
      paidAmount: 0,
      creditAmount: 0,
      paymentRequests: [{ id: "request-journey-1", code: "PAY-JOURNEY-001", status: "PENDING", amount: 5000000 }],
      total: 5000000,
      paidPercent: 0,
      createdAt: "2026-08-13T08:00:00.000Z",
      dueDate: "2026-08-20T00:00:00.000Z",
      customer: { id: "customer-journey-1", name: "Nguyen Van Journey", fullName: "Nguyen Van Journey" },
      contract: {
        id: "contract-journey-1",
        roomId: "room-journey-1",
        room: {
          id: "room-journey-1",
          number: "31-01",
          code: "31-01",
          building: { id: "building-journey-1", code: "LK01-31", name: "LK01-31" },
        },
      },
      items: [{ id: "item-rent-1", type: "RENT", description: "Monthly rent", quantity: 1, unitPrice: 5000000, amount: 5000000 }],
    },
    contractCreated: false,
    invoiceCreated: false,
    lastBookingInvoicePaymentPayload: null as any,
    lastBookingConversionPayload: null as any,
    lastBookingConversionIdempotencyKey: null as any,
    lastSignaturePayload: null as any,
    lastInvoicePaymentPayload: null as any,
    lastSettlementPreviewPayload: null as any,
    lastTerminationPayload: null as any,
    lastRoomPayload: null as any,
  };

  const json = (route: any, data: any, status = 200) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ success: status < 400, data }),
  });

  await mockProofUpload(page, "/uploads/journey-settlement-receipt.png");
  await page.route("**/api/v1/documents/upload", async (route: any) => {
    if (route.request().method() !== "POST") return route.fallback();
    const uploadBody = route.request().postData() || "";
    const url = uploadBody.includes("rental-contract.pdf")
      ? "/uploads/rental-contract.pdf"
      : "/uploads/journey-settlement-receipt.png";
    return json(route, { url, size: 24, mimeType: url.endsWith(".pdf") ? "application/pdf" : "image/png" }, 201);
  });

  await page.route("**/api/v1/deposits**", async (route: any) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path.endsWith(`/deposits/${state.deposit.id}`) && method === "GET") {
      return json(route, state.deposit);
    }
    if (path.endsWith("/deposits") && method === "GET") {
      return json(route, { items: [state.deposit], total: 1 });
    }
    return json(route, null, 404);
  });

  await page.route("**/api/v1/contracts**", async (route: any) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path.endsWith("/convert-booking-hold") && method === "POST") {
      state.lastBookingConversionPayload = request.postDataJSON?.() || {};
      state.lastBookingConversionIdempotencyKey = request.headers()["idempotency-key"];
      state.contract.startDate = state.lastBookingConversionPayload.startDate;
      state.contract.endDate = state.lastBookingConversionPayload.endDate;
      state.contract.monthlyRent = state.lastBookingConversionPayload.rentAmount;
      state.contract.depositMoney = state.lastBookingConversionPayload.depositAmount;
      state.contract.signedAt = null;
      state.deposit.status = "CONVERTED_TO_CONTRACT";
      state.deposit.availableBalance = 0;
      state.contractCreated = true;
      state.invoiceCreated = true;
      state.invoice.status = "ISSUED";
      state.bookingContract.bookingConversion = {
        rentalContract: { id: state.contract.id, code: state.contract.code },
        sourceBookingContract: { id: state.bookingContract.id, code: state.bookingContract.code },
      };
      return json(route, {
        ...state.contract,
        conversionPaymentRequest: { id: "request-journey-1", code: "PAY-JOURNEY-001", paymentCode: "PAY-JOURNEY-001", status: "PENDING" },
        termsSnapshot: {
          convertedFromBookingHold: {
            sourceContractId: state.bookingContract.id,
            sourceContractCode: state.bookingContract.code,
            bookingDepositConversion: {
              securityDepositId: "security-deposit-journey-1",
              securityRequired: 5000000,
              transferAmount: 5000000,
              additionalCashRequired: 0,
              excessAmount: 0,
              excessAction: "CREDIT",
            },
            initialEntryInvoice: {
              invoiceId: state.invoice.id,
              invoiceCode: state.invoice.code,
              amount: state.invoice.total,
              rentAmount: state.invoice.total,
              status: state.invoice.status,
              paymentPolicyVersion: "BOOKING_ENTRY_COMBINED_V1",
            },
          },
        },
      });
    }
    if (path.endsWith("/submit") && method === "POST") {
      state.contract.status = "PENDING_APPROVAL";
      return json(route, state.contract);
    }
    if (path.endsWith("/approve") && method === "POST") {
      state.contract.status = "APPROVED";
      state.roomStatus = "RESERVED";
      state.contract.room.status = state.roomStatus;
      return json(route, state.contract);
    }
    if (path.endsWith("/activate") && method === "POST") {
      if (state.contract.status !== "APPROVED" || state.invoice.status !== "PAID" || state.invoice.paidAmount + state.invoice.creditAmount < state.invoice.total) {
        return json(route, { message: "CONTRACT_ENTRY_INVOICE_UNPAID" }, 409);
      }
      state.contract.status = "ACTIVE";
      state.deposit.status = "CONVERTED_TO_CONTRACT";
      state.roomStatus = "OCCUPIED";
      state.contract.room.status = state.roomStatus;
      return json(route, state.contract);
    }
    if (path.endsWith("/settlement-preview") && method === "POST") {
      const payload = request.postDataJSON?.() || {};
      state.lastSettlementPreviewPayload = payload;
      const chargeTotal = Number(payload.electricityAmount || 350000) + Number(payload.waterAmount || 150000);
      const creditTotal = Number(payload.depositToRefund || 0) + Number(payload.depositToDeduct || 0);
      return json(route, {
        actualMoveOutDate: payload.actualMoveOutDate,
        roomTurnoverStatus: payload.roomTurnoverStatus || "CLEANING",
        charges: [
          { key: "electricityAmount", description: "Electricity settlement", amount: Number(payload.electricityAmount || 350000) },
          { key: "waterAmount", description: "Water settlement", amount: Number(payload.waterAmount || 150000) },
        ],
        credits: [
          ...(Number(payload.depositToDeduct || 0) > 0 ? [{ key: "depositToDeduct", description: "Deposit deduction", amount: Number(payload.depositToDeduct) }] : []),
          ...(Number(payload.depositToRefund || 0) > 0 ? [{ key: "depositToRefund", description: "Deposit refund", amount: Number(payload.depositToRefund) }] : []),
        ],
        totals: {
          chargeTotal,
          creditTotal,
          refundToCustomer: Math.max(creditTotal - chargeTotal, 0),
          netReceivable: Math.max(chargeTotal - creditTotal, 0),
        },
        utilitySnapshot: {
          electricity: {
            displayName: "Hunonic 31-01",
            deviceName: "HUNONIC-JOURNEY-01",
            readingAt: "2026-08-13T09:00:00.000Z",
            source: "hunonic-sync",
            monthKwh: 100,
            monthAmountVnd: 350000,
            calculatedAmountVnd: 350000,
            rateMode: "CUSTOM",
            calculationSource: "SETTLEMENT_SNAPSHOT",
          },
          water: {
            previousReading: 20,
            currentReading: 26,
            usage: 6,
            unitPrice: 25000,
            amount: 150000,
            source: "manual-preview",
          },
        },
      });
    }
    if (path.endsWith("/terminate") && method === "POST") {
      state.lastTerminationPayload = request.postDataJSON?.() || {};
      state.contract.status = "TERMINATED";
      state.roomStatus = state.lastTerminationPayload.roomTurnoverStatus || "CLEANING";
      state.contract.room.status = state.roomStatus;
      state.contract.settlementRefund = {
        receiptId: "receipt-journey-1",
        receiptCode: "RC-JOURNEY-001",
        receiptStatus: state.lastTerminationPayload.refundReceiptStatus || "COMPLETED",
        receiptAmount: Number(state.lastTerminationPayload.depositToRefund || 0),
        pending: state.lastTerminationPayload.refundReceiptStatus === "PENDING",
        completed: state.lastTerminationPayload.refundReceiptStatus !== "PENDING",
      };
      return json(route, state.contract);
    }
    if (path.endsWith(`/contracts/${state.contract.id}`) && method === "PATCH") {
      const payload = request.postDataJSON?.() || {};
      if (Array.isArray(payload.attachments)) state.contract.attachments = payload.attachments;
      if (payload.signedAt) state.contract.signedAt = payload.signedAt;
      state.lastSignaturePayload = payload.signedAt ? payload : state.lastSignaturePayload;
      return json(route, state.contract);
    }
    if (path.endsWith(`/contracts/${state.bookingContract.id}`) && method === "GET") {
      return json(route, {
        ...state.bookingContract,
        room: { ...state.bookingContract.room, status: state.roomStatus },
        bookingDeposit: state.deposit,
        bookingInvoice: state.bookingInvoice,
        bookingPaymentRequest: state.bookingInvoice.paymentRequests[0],
        bookingHold: {
          status: "ACTIVE",
          expiresAt: bookingHoldExpiry,
          isActive: true,
          requiresRecovery: false,
          fundedInvalidAggregate: false,
          validPartialActive: false,
        },
      });
    }
    if (path.endsWith(`/contracts/${state.contract.id}`) && method === "GET") {
      const entryInvoicePaid = state.invoice.status === "PAID" && state.invoice.paidAmount + state.invoice.creditAmount >= state.invoice.total;
      const approved = ["APPROVED", "ACTIVE", "TERMINATED"].includes(state.contract.status);
      const signed = Boolean(state.contract.signedAt);
      return json(route, state.contractCreated ? {
        ...state.contract,
        entryInvoice: state.invoice,
        bookingConversion: {
          rentalReadiness: {
            canActivate: approved && entryInvoicePaid && signed,
            entryInvoicePaid,
            securityDepositPaid: true,
            blockingReasons: [...(!approved ? ["CONTRACT_APPROVAL_REQUIRED"] : []), ...(!entryInvoicePaid ? ["ENTRY_INVOICE_UNPAID"] : []), ...(!signed ? ["CONTRACT_SIGNATURE_REQUIRED"] : [])],
          },
        },
      } : null, state.contractCreated ? 200 : 404);
    }
    if (path.endsWith("/contracts") && method === "GET") {
      const items = state.contractCreated
        ? [state.bookingContract, state.contract]
        : [state.bookingContract];
      return json(route, { items, total: items.length });
    }
    return json(route, null, 404);
  });

  await page.route("**/api/v1/invoices**", async (route: any) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path.endsWith("/issue") && method === "POST") {
      state.invoice.status = "ISSUED";
      return json(route, state.invoice);
    }
    if (path.endsWith("/pay") && method === "POST") {
      const payload = request.postDataJSON?.() || {};
      if (path.includes(state.bookingInvoice.id)) {
        state.lastBookingInvoicePaymentPayload = payload;
        state.bookingInvoice.paidAmount = Math.min(state.bookingInvoice.total, state.bookingInvoice.paidAmount + Number(payload.amount || 0));
        state.bookingInvoice.remainingAmount = Math.max(0, state.bookingInvoice.total - state.bookingInvoice.paidAmount - state.bookingInvoice.creditAmount);
        state.bookingInvoice.paidPercent = Math.round((state.bookingInvoice.paidAmount / state.bookingInvoice.total) * 100);
        state.bookingInvoice.status = state.bookingInvoice.remainingAmount === 0 ? "PAID" : "PARTIALLY_PAID";
        state.bookingInvoice.paymentRequests[0].status = state.bookingInvoice.status === "PAID" ? "CONFIRMED" : "PENDING";
        state.deposit.status = state.bookingInvoice.status === "PAID" ? "PAID" : "PENDING";
        state.deposit.availableBalance = state.bookingInvoice.paidAmount;
        state.roomStatus = state.bookingInvoice.status === "PAID" ? "RESERVED" : "AVAILABLE";
        state.contract.room.status = state.roomStatus;
        state.bookingContract.room.status = state.roomStatus;
        return json(route, state.bookingInvoice);
      }
      state.lastInvoicePaymentPayload = payload;
      state.invoice.paidAmount = Math.min(state.invoice.total, state.invoice.paidAmount + Number(payload.amount || 0));
      state.invoice.paidPercent = Math.round((state.invoice.paidAmount / state.invoice.total) * 100);
      state.invoice.status = state.invoice.paidAmount >= state.invoice.total ? "PAID" : "PARTIALLY_PAID";
      return json(route, state.invoice);
    }
    if (path.endsWith(`/invoices/${state.bookingInvoice.id}`) && method === "GET") {
      return json(route, state.bookingInvoice);
    }
    if (path.endsWith(`/invoices/${state.invoice.id}`) && method === "GET") {
      return json(route, state.invoiceCreated ? state.invoice : null, state.invoiceCreated ? 200 : 404);
    }
    if (path.endsWith("/invoices") && method === "GET") {
      const items = state.invoiceCreated ? [state.bookingInvoice, state.invoice] : [state.bookingInvoice];
      return json(route, { items, total: items.length });
    }
    return json(route, null, 404);
  });

  await page.route("**/api/v1/rooms/*", async (route: any) => {
    const request = route.request();
    if (request.method() !== "PATCH") return route.fallback();
    state.lastRoomPayload = request.postDataJSON?.() || {};
    state.roomStatus = String(state.lastRoomPayload.status || "AVAILABLE");
    state.contract.room.status = state.roomStatus;
    return json(route, {
      id: state.contract.room.id,
      number: state.contract.room.number,
      code: state.contract.room.code,
      status: state.roomStatus,
      type: "STUDIO",
      price: 5000000,
      area: 25,
      capacity: 2,
      images: [],
      rentalType: "whole",
      buildingId: state.contract.room.building.id,
      floorId: "floor-journey-1",
      createdAt: "2026-08-13T08:00:00.000Z",
      updatedAt: "2026-08-13T10:00:00.000Z",
    });
  });

  return state;
}

test.describe("Contracts Settlement Desktop Regression", () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), "Desktop-only regression");
  });

  test("does not offer contract conversion for a legacy paid deposit without booking identity or hold", async ({ admin }) => {
    const journey = await mockFullRentalJourney(admin.page);
    journey.deposit.status = "PAID";
    journey.deposit.availableBalance = journey.deposit.amount;

    await admin.page.goto("/deposits", { waitUntil: "domcontentloaded" });
    await admin.page.locator("[data-testid='deposit-card']:visible").filter({ hasText: journey.deposit.code }).first().click();
    const legacyDepositDrawer = admin.page.getByTestId("deposit-detail-drawer");
    await expect(legacyDepositDrawer).toBeVisible();
    await expect(legacyDepositDrawer.getByTestId("deposit-action-convert")).toHaveCount(0);
  });

  test("opens settlement modal and terminates contract with pending refund payload", async ({ admin }) => {
    const mock = await mockContracts(admin.page);

    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });

    await admin.page
      .locator("[data-testid='contract-card']:visible")
      .filter({ hasText: "C-ACTIVE-001" })
      .first()
      .dispatchEvent("click");

    await expect(admin.page.getByTestId("btn-open-settlement")).toBeVisible();
    await admin.page.getByTestId("btn-open-settlement").click();

    await expect(admin.page.getByTestId("contract-settlement-modal")).toBeVisible();

    await expect.poll(() => mock.getLastPreviewPayload(), { timeout: 10000 }).toMatchObject({
      refundReceiptStatus: "COMPLETED",
    });

    await admin.page.getByTestId("contract-settlement-deposit-deduct").fill("300000");
    await admin.page.getByTestId("contract-settlement-deposit-refund").fill("800000");
    await admin.page.getByTestId("contract-settlement-refund-status").selectOption("PENDING");
    await admin.page.getByTestId("contract-settlement-refund-reason").fill("Cho chuyen khoan sau doi soat");

    await expect(admin.page.getByTestId("btn-confirm-terminate-settlement")).toBeEnabled();
    await admin.page.getByTestId("btn-confirm-terminate-settlement").click();

    await expect
      .poll(() => mock.getLastTerminatePayload(), { timeout: 10000 })
      .toMatchObject({
        depositToDeduct: 300000,
        depositToRefund: 800000,
        refundReceiptStatus: "PENDING",
        refundReason: "Cho chuyen khoan sau doi soat",
      });
  });

  test("completes pending settlement refund from terminated contract", async ({ admin }) => {
    const mock = await mockContracts(admin.page);

    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });

    await admin.page
      .locator("[data-testid='contract-card']:visible")
      .filter({ hasText: "C-TERM-001" })
      .first()
      .dispatchEvent("click");

    await admin.page.getByTestId("contract-detail-drawer").getByRole("button", { name: "Thanh toán", exact: true }).click();
    await expect(admin.page.getByTestId("contract-pending-settlement-refund")).toBeVisible();
    await expect(admin.page.getByText("RC-SETTLE-001")).toBeVisible();
    await expect(admin.page.getByTestId("btn-delete-contract")).toHaveCount(0);

    await admin.page.getByTestId("contract-complete-settlement-refund-open").click();

    await expect(admin.page.getByTestId("contract-settlement-refund-complete-modal")).toBeVisible();
    await admin.page.getByTestId("contract-settlement-refund-complete-note").fill("Da chuyen khoan settlement");

    const completionModal = admin.page.getByTestId("contract-settlement-refund-complete-modal");
    await completionModal.locator('input[type="file"]').first().setInputFiles({
      name: "settlement-receipt.png",
      mimeType: "image/png",
      buffer: Buffer.from("settlement-receipt"),
    });
    await expect(completionModal.getByText("settlement-receipt.png")).toBeVisible();

    await admin.page.getByTestId("contract-settlement-refund-complete-submit").click();

    await expect
      .poll(() => mock.getLastCompleteRefundPayload(), { timeout: 10000 })
      .toMatchObject({
        note: "Da chuyen khoan settlement",
        attachmentUrls: ["/uploads/settlement-receipt.png"],
      });

    await expect(admin.page.getByTestId("contract-settlement-refund-complete-modal")).not.toBeVisible();
    await expect(admin.page.getByTestId("contract-pending-settlement-refund")).not.toBeVisible();
  });

  test("marks terminated room back to available after cleaning completion", async ({ admin }) => {
    const mock = await mockContracts(admin.page);

    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });

    await admin.page
      .locator("[data-testid='contract-card']:visible")
      .filter({ hasText: "C-TERM-001" })
      .first()
      .dispatchEvent("click");

    await expect(admin.page.getByTestId("btn-room-ready")).toBeVisible();
    await admin.page.getByTestId("btn-room-ready").click();

    await expect
      .poll(() => mock.getLastRoomUpdatePayload(), { timeout: 10000 })
      .toMatchObject({
        status: "AVAILABLE",
      });
    await expect(admin.page.getByTestId("btn-room-ready")).toHaveCount(0);
  });

  test("keeps cleaning state when guarded turnover rejects current bindings", async ({ admin }) => {
    await mockContracts(admin.page, true);
    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });
    await admin.page.locator("[data-testid='contract-card']:visible").filter({ hasText: "C-TERM-001" }).first().click();
    const response = admin.page.waitForResponse((item) => item.request().method() === "PATCH" && new URL(item.url()).pathname === "/api/v1/rooms/room-terminated-1");
    await admin.page.getByTestId("btn-room-ready").click();
    expect((await response).status()).toBe(409);
    await expect(admin.page.getByText("ROOM_TURNOVER_ROOM_IN_USE", { exact: true })).toBeVisible();
    await expect(admin.page.getByTestId("btn-room-ready")).toBeEnabled();
    await expect(admin.page.getByText("Đã chuyển phòng về trạng thái sẵn sàng khai thác", { exact: true })).toHaveCount(0);
  });

  test("shows deposit deduction as settlement credit instead of extra charge", async ({ admin }) => {
    const mock = await mockContracts(admin.page);

    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });

    await admin.page
      .locator("[data-testid='contract-card']:visible")
      .filter({ hasText: "C-ACTIVE-001" })
      .first()
      .dispatchEvent("click");

    await admin.page.getByTestId("btn-open-settlement").click();
    await expect(admin.page.getByTestId("contract-settlement-modal")).toBeVisible();

    await admin.page.getByTestId("contract-settlement-deposit-refund").fill("");
    const deductionPreviewResponse = admin.page.waitForResponse(async (response) => {
      if (!response.url().endsWith("/settlement-preview") || response.request().method() !== "POST") return false;
      const payload = response.request().postDataJSON?.() || {};
      return Number(payload.depositToDeduct || 0) === 500000;
    });
    await admin.page.getByTestId("contract-settlement-deposit-deduct").fill("500000");

    await deductionPreviewResponse;
    await expect
      .poll(() => mock.getLastPreviewPayload(), { timeout: 10000 })
      .toMatchObject({
        depositToDeduct: 500000,
      });

    const deductionCredit = admin.page.getByTestId("contract-settlement-credit-depositToDeduct");
    await expect(deductionCredit).toContainText("Deposit applied to outstanding debt");
    await expect(deductionCredit).toContainText("500.000đ");
    await expect(admin.page.getByTestId("contract-settlement-net-receivable")).toContainText("400.000đ");
  });

  test("terminates contract with maintenance turnover and completed refund surplus", async ({ admin }) => {
    const mock = await mockContracts(admin.page);

    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });

    await admin.page
      .locator("[data-testid='contract-card']:visible")
      .filter({ hasText: "C-ACTIVE-001" })
      .first()
      .dispatchEvent("click");

    await admin.page.getByTestId("btn-open-settlement").click();
    await expect(admin.page.getByTestId("contract-settlement-modal")).toBeVisible();

    await admin.page.getByTestId("contract-settlement-room-turnover-status").selectOption("MAINTENANCE");
    await admin.page.getByTestId("contract-settlement-deposit-refund").fill("2000000");
    await admin.page.getByTestId("contract-settlement-deposit-deduct").fill("");

    await expect
      .poll(() => mock.getLastPreviewPayload(), { timeout: 10000 })
      .toMatchObject({
        roomTurnoverStatus: "MAINTENANCE",
        depositToRefund: 2000000,
      });

    await expect(admin.page.getByText("Bảo trì trước khi mở bán")).toBeVisible();
    await expect(admin.page.getByTestId("contract-settlement-refund-to-customer")).toContainText("1.100.000đ");

    const settlementModal = admin.page.getByTestId("contract-settlement-modal");
    await settlementModal.locator('input[type="file"]').first().setInputFiles({
      name: "settlement-receipt.png",
      mimeType: "image/png",
      buffer: Buffer.from("settlement-receipt"),
    });
    await expect(settlementModal.getByText("settlement-receipt.png")).toBeVisible();

    await admin.page.getByTestId("btn-confirm-terminate-settlement").click();

    await expect
      .poll(() => mock.getLastTerminatePayload(), { timeout: 10000 })
      .toMatchObject({
        roomTurnoverStatus: "MAINTENANCE",
        depositToRefund: 2000000,
        refundReceiptStatus: "COMPLETED",
        refundAttachmentUrls: ["/uploads/settlement-receipt.png"],
      });
  });

  test("runs one rental record from booking payment through paid entry invoice and room turnover", async ({ admin }) => {
    test.setTimeout(60_000);
    const journey = await mockFullRentalJourney(admin.page);
    const rentalStartDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const rentalEnd = new Date(`${rentalStartDate}T00:00:00.000Z`);
    rentalEnd.setUTCFullYear(rentalEnd.getUTCFullYear() + 1);
    const rentalEndDate = rentalEnd.toISOString().slice(0, 10);
    const displayDate = (value: string) => {
      const [year, month, day] = value.split("-");
      return `${day}/${month}/${year}`;
    };
    admin.page.on("dialog", async (dialog) => {
      if (dialog.type() === "prompt") await dialog.accept("5000000");
      else await dialog.accept();
    });

    await admin.page.goto("/invoices", { waitUntil: "domcontentloaded" });
    const bookingInvoiceRow = admin.page.locator("tr").filter({ hasText: journey.bookingInvoice.code }).first();
    await expect(bookingInvoiceRow).toBeVisible({ timeout: 15_000 });
    await bookingInvoiceRow.click();
    const bookingInvoiceDrawer = admin.page.getByRole("dialog").filter({
      has: admin.page.getByRole("heading", { name: "Chi tiết hóa đơn", exact: true }),
    });
    await expect(bookingInvoiceDrawer).toBeVisible();
    await bookingInvoiceDrawer.getByRole("button", { name: /Thu tiền mặt/ }).click();
    const bookingPaymentModal = bookingInvoiceDrawer
      .getByRole("heading", { name: "Ghi nhận thu tiền mặt", exact: true })
      .locator("xpath=ancestor::div[.//input][1]");
    await expect(bookingPaymentModal).toBeVisible();
    await bookingPaymentModal.getByPlaceholder("0").fill("5000000");
    await bookingPaymentModal.getByRole("button", { name: "Xác nhận thu", exact: true }).click();
    await expect(bookingPaymentModal).toBeHidden();
    await expect.poll(() => journey.bookingInvoice.status).toBe("PAID");
    expect(journey.lastBookingInvoicePaymentPayload).toMatchObject({
      amount: 5000000,
      provider: "MANUAL",
      providerRef: expect.stringMatching(/^CASH:/),
    });
    expect(journey.deposit).toMatchObject({ status: "PAID", availableBalance: 5000000 });
    expect(journey.roomStatus).toBe("RESERVED");

    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });
    await admin.page.locator("[data-testid='contract-card']:visible").filter({ hasText: journey.bookingContract.code }).first().click();
    await expect(admin.page.getByTestId("btn-open-booking-convert")).toBeVisible();
    await admin.page.getByTestId("btn-open-booking-convert").click();
    const bookingConversionModal = admin.page.getByTestId("booking-hold-convert-modal");
    await expect(bookingConversionModal).toBeVisible();
    await expect(bookingConversionModal.getByTestId("booking-conversion-header-deposit")).toContainText("5.000.000");
    await bookingConversionModal.locator("#booking-rental-start").fill(displayDate(rentalStartDate));
    await bookingConversionModal.locator("#booking-rental-end").fill(displayDate(rentalEndDate));
    await bookingConversionModal.getByTestId("booking-hold-convert-submit").click();
    await expect.poll(() => journey.deposit.status).toBe("CONVERTED_TO_CONTRACT");
    expect(journey.lastBookingConversionPayload).toMatchObject({
      idempotencyKey: expect.any(String),
      startDate: rentalStartDate,
      endDate: rentalEndDate,
      rentAmount: 5000000,
      depositAmount: 5000000,
    });
    expect(journey.lastBookingConversionIdempotencyKey).toBe(journey.lastBookingConversionPayload.idempotencyKey);
    const bookingConversionResult = admin.page.getByTestId("booking-hold-conversion-result-modal");
    await expect(bookingConversionResult).toBeVisible();
    await expect(bookingConversionResult.getByRole("button", { name: `Hóa đơn ${journey.invoice.code}`, exact: true })).toBeVisible();
    await bookingConversionResult.getByTestId("booking-hold-submit-rental-contract").click();
    await expect.poll(() => journey.contract.status).toBe("PENDING_APPROVAL");
    await bookingConversionResult.getByTestId("booking-hold-open-rental-contract").click();
    await expect(admin.page.getByTestId("contract-detail-drawer")).toContainText(journey.contract.code);

    const openJourneyContract = async () => {
      const currentDrawer = admin.page.getByTestId("contract-detail-drawer");
      if (await currentDrawer.isVisible()) {
        await currentDrawer.getByTestId("contract-detail-close").click();
        await expect(currentDrawer).not.toBeInViewport();
      }
      const contractCard = admin.page
        .getByRole("group", { name: `Hợp đồng thuê phòng ${journey.contract.code}` })
        .first();
      await expect(contractCard).toBeVisible({ timeout: 15_000 });
      await contractCard.click();
      await expect(admin.page.getByRole("heading", { name: "Chi tiết hợp đồng thuê phòng", exact: true })).toBeVisible();
      await expect(currentDrawer).toContainText(journey.contract.code);
    };

    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });
    await openJourneyContract();
    await admin.page.getByTestId("btn-approve-contract").click();
    await expect.poll(() => journey.contract.status).toBe("APPROVED");
    await openJourneyContract();
    await admin.page.getByTestId("btn-activate-contract").click();
    const moveIn = admin.page.getByTestId("contract-move-in-confirm");
    await expect(moveIn.getByText("Hóa đơn kỳ đầu chưa thanh toán đủ.", { exact: true })).toBeVisible();
    await expect(moveIn.getByRole("button", { name: "Xác nhận đã bàn giao và nhận phòng", exact: true })).toBeDisabled();
    expect(journey.contract.status).toBe("APPROVED");
    expect(journey.roomStatus).toBe("RESERVED");
    expect(journey.invoiceCreated).toBe(true);

    const openJourneyInvoice = async () => {
      const row = admin.page.locator("tr").filter({ hasText: journey.invoice.code }).first();
      await expect(row).toBeVisible({ timeout: 15_000 });
      await expect(row).toContainText("5.000.000");
      await row.click();
      await expect(
        admin.page.getByRole("dialog").filter({
          has: admin.page.getByRole("heading", { name: "Chi tiết hóa đơn", exact: true }),
        }),
      ).toBeVisible();
    };

    await admin.page.goto("/invoices", { waitUntil: "domcontentloaded" });
    await openJourneyInvoice();
    await expect.poll(() => journey.invoice.status).toBe("ISSUED");
    const invoiceDrawer = admin.page.getByRole("dialog").filter({
      has: admin.page.getByRole("heading", { name: "Chi tiết hóa đơn", exact: true }),
    });
    await invoiceDrawer.getByRole("button", { name: "Đóng (ESC)", exact: true }).click();
    await admin.page.reload({ waitUntil: "domcontentloaded" });
    await openJourneyInvoice();
    const paymentDrawer = admin.page.getByRole("dialog").filter({
      has: admin.page.getByRole("heading", { name: "Chi tiết hóa đơn", exact: true }),
    });
    await paymentDrawer.getByRole("button", { name: /Thu tiền mặt/ }).click();
    const paymentModal = paymentDrawer
      .getByRole("heading", { name: "Ghi nhận thu tiền mặt", exact: true })
      .locator("xpath=ancestor::div[.//input][1]");
    await expect(paymentModal).toBeVisible();
    await paymentModal.getByPlaceholder("0").fill("5000000");
    await paymentModal.getByRole("button", { name: "Xác nhận thu", exact: true }).click();
    await expect(paymentModal).toBeHidden();
    await expect.poll(() => journey.invoice.status).toBe("PAID");
    expect(journey.lastInvoicePaymentPayload).toMatchObject({ amount: 5000000 });

    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });
    await openJourneyContract();
    await admin.page.getByTestId("btn-activate-contract").click();
    const unsignedMoveIn = admin.page.getByTestId("contract-move-in-confirm");
    await expect(unsignedMoveIn).toBeVisible();
    await expect(unsignedMoveIn.getByText("Hợp đồng thuê chưa ghi nhận ngày ký.", { exact: true })).toBeVisible();
    await expect(unsignedMoveIn.getByRole("button", { name: "Xác nhận đã bàn giao và nhận phòng", exact: true })).toBeDisabled();

    await admin.page.reload({ waitUntil: "domcontentloaded" });
    await openJourneyContract();
    const signingDrawer = admin.page.getByTestId("contract-detail-drawer");
    await signingDrawer.getByRole("button", { name: "Hồ sơ", exact: true }).click();
    await signingDrawer.locator('input[type="file"][accept=".pdf,image/*"]').setInputFiles({
      name: "rental-contract.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("rental-contract"),
    });
    await expect(signingDrawer.getByText("rental-contract.pdf", { exact: true })).toBeVisible();
    await signingDrawer.locator("#rental-signature-date").fill(rentalStartDate);
    await signingDrawer.getByRole("button", { name: "Xác nhận đã ký hợp đồng", exact: true }).click();
    await expect.poll(() => journey.lastSignaturePayload).toMatchObject({ signedAt: expect.any(String) });

    await admin.page.reload({ waitUntil: "domcontentloaded" });
    await openJourneyContract();
    await admin.page.getByTestId("btn-activate-contract").click();
    await expect(admin.page.getByTestId("contract-move-in-confirm")).toBeVisible();
    await admin.page.getByTestId("contract-move-in-confirm").getByRole("button", { name: "Xác nhận đã bàn giao và nhận phòng", exact: true }).click();
    await expect.poll(() => journey.contract.status).toBe("ACTIVE");
    expect(journey.roomStatus).toBe("OCCUPIED");
    await openJourneyContract();
    await admin.page.getByTestId("btn-open-settlement").click();
    await expect(admin.page.getByTestId("contract-settlement-modal")).toBeVisible();
    await expect.poll(() => journey.lastSettlementPreviewPayload).not.toBeNull();
    await expect(admin.page.getByText("HUNONIC-JOURNEY-01")).toBeVisible();
    await admin.page.getByRole("button", { name: "Áp dụng số điện này vào biểu mẫu" }).click();
    await expect.poll(() => journey.lastSettlementPreviewPayload).toMatchObject({
      electricityAmount: 350000,
      waterAmount: 150000,
      electricityClosingKwh: 100,
      waterPreviousReading: 20,
      waterCurrentReading: 26,
    });
    await admin.page
      .getByTestId("contract-settlement-room-turnover-status")
      .selectOption("CLEANING");
    await admin.page.getByTestId("contract-settlement-deposit-deduct").fill("500000");
    await admin.page.getByTestId("contract-settlement-deposit-refund").fill("4500000");
    await admin.page.getByTestId("contract-settlement-refund-reason").fill("Hoan coc sau khi tru dien nuoc");
    await expect.poll(() => journey.lastSettlementPreviewPayload).toMatchObject({
      depositToDeduct: 500000,
      depositToRefund: 4500000,
    });
    await expect(admin.page.getByTestId("btn-confirm-terminate-settlement")).toBeEnabled();
    const journeySettlementModal = admin.page.getByTestId("contract-settlement-modal");
    await journeySettlementModal.locator('input[type="file"]').first().setInputFiles({
      name: "journey-settlement-receipt.png",
      mimeType: "image/png",
      buffer: Buffer.from("journey-settlement-receipt"),
    });
    await expect(journeySettlementModal.getByText("journey-settlement-receipt.png")).toBeVisible();
    await admin.page.getByTestId("btn-confirm-terminate-settlement").click();
    await expect.poll(() => journey.contract.status).toBe("TERMINATED");
    expect(journey.lastTerminationPayload).toMatchObject({
      electricityAmount: 350000,
      waterAmount: 150000,
      depositToDeduct: 500000,
      depositToRefund: 4500000,
      refundReceiptStatus: "COMPLETED",
      refundAttachmentUrls: ["/uploads/journey-settlement-receipt.png"],
      roomTurnoverStatus: "CLEANING",
    });
    expect(journey.contract.settlementRefund.completed).toBe(true);
    expect(journey.roomStatus).toBe("CLEANING");

    // Reset the page-level query cache so the guarded turnover action reads the
    // just-terminated contract and its authoritative CLEANING room status.
    await admin.page.reload({ waitUntil: "domcontentloaded" });
    await openJourneyContract();
    await admin.page.getByTestId("btn-room-ready").click();
    await expect.poll(() => journey.roomStatus).toBe("AVAILABLE");
    expect(journey.lastRoomPayload).toEqual({ status: "AVAILABLE" });
  });
});
