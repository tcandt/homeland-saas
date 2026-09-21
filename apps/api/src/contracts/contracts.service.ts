import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  Contract,
  ContractStatus,
  DepositLedgerEntryType,
  DepositOperationStatus,
  DepositOperationType,
  DepositStatus,
  DepositType,
  InvoiceItemType,
  InvoiceStatus,
  ReceiptStatus,
  RentalCycleStatus,
  RoomStatus,
  Prisma,
} from "@prisma/client";
import {
  ContractSettlementInput,
  MoveOutOccupantInput,
  PaginatedResult,
  RenewContractInput,
  TransferOccupantInput,
} from "@homeland/shared";
import { PrismaService } from "../prisma.service";
import { AuditService } from "../shared/audit/audit.service";
import { DomainEventPublisher } from "../shared/events/domain-event.publisher";
import { BaseCrudService } from "../shared/services/base-crud.service";
import { HunonicService } from "../hunonic/hunonic.service";
import {
  ACTIVE_LIKE_CONTRACT_STATUSES,
  mapStatusFilter,
} from "./contracts.adapter";
import { ContractsRepository } from "./contracts.repository";
import { buildRoomContext } from "../shared/context/room-context";
import { createHash } from "crypto";

export function calculateFirstBillingPeriod(
  monthlyRent: number,
  startDate?: Date | string | null,
) {
  const rent = Number(monthlyRent || 0);
  if (!startDate) {
    return {
      amount: rent,
      billableDays: null,
      daysInMonth: null,
      period: null,
      policyVersion: "ACTUAL_DAYS_V1",
    };
  }
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    throw new BadRequestException("CONTRACT_START_DATE_INVALID");
  }
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const billableDays = daysInMonth - start.getUTCDate() + 1;
  const amount = Math.round(((rent * billableDays) / daysInMonth) * 100) / 100;
  return {
    amount,
    billableDays,
    daysInMonth,
    period: `${year}-${String(month + 1).padStart(2, "0")}`,
    policyVersion: "ACTUAL_DAYS_V1",
  };
}

@Injectable()
export class ContractsService extends BaseCrudService<Contract> {
  constructor(
    repository: ContractsRepository,
    auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly hunonicService: HunonicService,
  ) {
    super(repository, auditService, "Contract");
  }

  async create(
    data: any,
    userId?: string,
    moduleName?: string,
  ): Promise<Contract> {
    if (data.status && data.status !== ContractStatus.DRAFT) {
      throw new BadRequestException("CONTRACT_CREATE_REQUIRES_DRAFT");
    }
    const prepared = await this.withContractSnapshots({
      ...data,
      status: ContractStatus.DRAFT,
    });
    const created = await this.prisma.tx.$transaction(async (tx) => {
      const contract = await tx.contract.create({ data: prepared });
      const existingCycle = await tx.rentalCycle.findFirst({
        where: {
          tenantId: contract.tenantId,
          customerId: contract.customerId,
          roomId: contract.roomId,
          status: {
            in: [RentalCycleStatus.PLANNED, RentalCycleStatus.RESERVED],
          },
          contracts: { none: {} },
        },
        orderBy: { createdAt: "desc" },
      });
      const cycle =
        existingCycle ||
        (await tx.rentalCycle.create({
          data: {
            tenantId: contract.tenantId,
            customerId: contract.customerId,
            roomId: contract.roomId,
            status: RentalCycleStatus.PLANNED,
            expectedMoveInAt: contract.startDate,
          },
        }));
      return tx.contract.update({
        where: { id: contract.id },
        data: { rentalCycleId: cycle.id },
      });
    });
    await this.auditService.log({
      action: "CREATE",
      entity: this.entityName,
      entityId: created.id,
      module: moduleName || this.entityName,
      after: created,
      userId,
    });
    await this.syncContractHistory(created);
    if (Number(created.depositMoney || 0) > 0) {
      await this.syncContractDeposit(created);
    }
    return created;
  }

  /**
   * Renewal deliberately bypasses create(): a renewal owns a fresh cycle and
   * must not create deposits, invoices, or occupancy for the prior contract.
   */
  async renewContract(
    id: string,
    input: RenewContractInput,
    userId: string,
    tenantId: string,
    idempotencyKey?: string,
  ): Promise<Contract> {
    const commandKey = this.requireSettlementIdempotencyKey(idempotencyKey);
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException("RENEWAL_START_DATE_INVALID");
    }
    if (Number.isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
      throw new BadRequestException("RENEWAL_END_DATE_INVALID");
    }
    const firstPaymentDate =
      input.firstPaymentDate === undefined
        ? undefined
        : input.firstPaymentDate === null
          ? null
          : new Date(input.firstPaymentDate);
    if (firstPaymentDate && Number.isNaN(firstPaymentDate.getTime())) {
      throw new BadRequestException("RENEWAL_FIRST_PAYMENT_DATE_INVALID");
    }
    const requestHash = this.hashSettlementRequest({
      sourceContractId: id,
      tenantId,
      idempotencyKey: commandKey,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      rentAmount: input.rentAmount ?? null,
      depositAmount: input.depositAmount ?? null,
      memberCount: input.memberCount ?? null,
      firstPaymentDate:
        firstPaymentDate === undefined
          ? "INHERIT"
          : firstPaymentDate?.toISOString() || null,
      purpose: input.purpose ?? null,
      coRepresentativeIds: input.coRepresentativeIds ?? null,
    });
    const renewalCode = `RN-${createHash("sha256")
      .update(`${tenantId}:${id}:${commandKey}`)
      .digest("hex")
      .slice(0, 24)
      .toUpperCase()}`;

    const renewed = await this.runRenewalSerializable(async (tx: any) => {
      await this.lockSettlementContract(tx, tenantId, id);
      const source = await tx.contract.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!source) throw new NotFoundException(`Contract with ID ${id} not found`);
      if (
        ![
          ContractStatus.ACTIVE,
          ContractStatus.EXPIRING,
          ContractStatus.EXPIRED,
        ].includes(source.status)
      ) {
        throw new BadRequestException("RENEWAL_SOURCE_CONTRACT_NOT_ELIGIBLE");
      }
      const sourceEndDate = new Date(source.endDate);
      if (
        Number.isNaN(sourceEndDate.getTime()) ||
        startDate.getTime() <= sourceEndDate.getTime()
      ) {
        throw new BadRequestException("RENEWAL_START_DATE_NOT_AFTER_SOURCE_END");
      }

      const existing = await tx.contract.findFirst({
        where: { tenantId, code: renewalCode, deletedAt: null },
      });
      if (existing) {
        const renewal = (existing.termsSnapshot as any)?.renewal;
        if (
          renewal?.sourceContractId === id &&
          renewal?.idempotencyKey === commandKey &&
          renewal?.requestHash === requestHash
        ) {
          return existing;
        }
        throw new ConflictException("RENEWAL_IDEMPOTENCY_CONFLICT");
      }

      const cycle = await tx.rentalCycle.create({
        data: {
          tenantId,
          customerId: source.customerId,
          roomId: source.roomId,
          status: RentalCycleStatus.PLANNED,
          expectedMoveInAt: startDate,
        },
      });
      const prepared = await this.withContractSnapshots({
        tenantId,
        customerId: source.customerId,
        roomId: source.roomId,
        rentalCycleId: cycle.id,
        code: renewalCode,
        status: ContractStatus.DRAFT,
        startDate,
        endDate,
        monthlyRent: input.rentAmount ?? Number(source.monthlyRent),
        depositMoney: input.depositAmount ?? Number(source.depositMoney),
        memberCount: input.memberCount ?? source.memberCount,
        firstPaymentDate:
          firstPaymentDate === undefined ? source.firstPaymentDate : firstPaymentDate,
        purpose: input.purpose ?? source.purpose,
        coRepresentativeIds: input.coRepresentativeIds ?? source.coRepresentativeIds,
        // Signed files belong to the historical version; do not carry them forward.
        attachments: [],
        signedAt: null,
      });
      const newContract = await tx.contract.create({
        data: {
          ...prepared,
          termsSnapshot: this.asJson({
            ...(prepared.termsSnapshot as any),
            renewal: {
              sourceContractId: source.id,
              sourceRentalCycleId: source.rentalCycleId || null,
              idempotencyKey: commandKey,
              requestHash,
              policyVersion: "RENEWAL_V1",
            },
          }),
        },
      });
      // A draft records its parties only; syncContractHistory never creates
      // occupancy unless the contract is active-like.
      await this.syncContractHistory(newContract, tx);
      if (tx.auditLog?.create) {
        await tx.auditLog.create({
          data: {
            action: "CREATE",
            entity: this.entityName,
            entityId: newContract.id,
            module: "ContractsRenewal",
            tenantId,
            userId,
            after: newContract,
          },
        });
      }
      return newContract;
    });

    // Party history and audit are committed atomically with the new contract.
    // Replays deliberately perform no duplicate writes.
    return renewed;
  }

  async createRentalFromBookingHold(
    id: string,
    input: RenewContractInput,
    userId: string,
    tenantId: string,
  ): Promise<Contract> {
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException("BOOKING_CONVERT_START_DATE_INVALID");
    }
    if (Number.isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
      throw new BadRequestException("BOOKING_CONVERT_END_DATE_INVALID");
    }
    const firstPaymentDate =
      input.firstPaymentDate === undefined
        ? startDate
        : input.firstPaymentDate === null
          ? null
          : new Date(input.firstPaymentDate);
    if (firstPaymentDate && Number.isNaN(firstPaymentDate.getTime())) {
      throw new BadRequestException("BOOKING_CONVERT_FIRST_PAYMENT_DATE_INVALID");
    }

    const source = await this.prisma.tx.contract.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!source) throw new NotFoundException(`Contract with ID ${id} not found`);
    const sourceText = `${source.code || ""} ${source.purpose || ""}`.toLowerCase();
    if (
      !sourceText.includes("hd-coc") &&
      !sourceText.includes("cọc giữ phòng") &&
      !sourceText.includes("coc giu phong")
    ) {
      throw new BadRequestException("SOURCE_CONTRACT_IS_NOT_BOOKING_HOLD");
    }
    if (!source.rentalCycleId) {
      throw new BadRequestException("BOOKING_CONTRACT_RENTAL_CYCLE_REQUIRED");
    }

    const existingRental = await this.prisma.tx.contract.findFirst({
      where: {
        tenantId,
        rentalCycleId: source.rentalCycleId,
        id: { not: source.id },
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    if (existingRental) return existingRental;

    const suffix = createHash("sha256")
      .update(`${tenantId}:${source.id}:${startDate.toISOString()}:${endDate.toISOString()}`)
      .digest("hex")
      .slice(0, 8)
      .toUpperCase();
    const roomSnapshot = (source.roomSnapshot as any) || {};
    const roomCode = roomSnapshot?.code || source.roomId.slice(-6).toUpperCase();
    const rentalCode = `HD-THUE-${roomCode}-${suffix}`;
    const prepared = await this.withContractSnapshots({
      tenantId,
      customerId: source.customerId,
      roomId: source.roomId,
      rentalCycleId: source.rentalCycleId,
      code: rentalCode,
      status: ContractStatus.DRAFT,
      startDate,
      endDate,
      monthlyRent: input.rentAmount ?? Number(source.monthlyRent),
      depositMoney: input.depositAmount ?? Number(source.depositMoney),
      memberCount: input.memberCount ?? source.memberCount,
      firstPaymentDate,
      purpose:
        input.purpose ||
        `Hợp đồng thuê phòng dài hạn chuyển từ ${source.code || source.id}`,
      coRepresentativeIds: input.coRepresentativeIds ?? source.coRepresentativeIds,
      attachments: [],
      signedAt: null,
    });

    const created = await this.prisma.tx.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          ...prepared,
          termsSnapshot: this.asJson({
            ...(prepared.termsSnapshot as any),
            convertedFromBookingHold: {
              sourceContractId: source.id,
              sourceRentalCycleId: source.rentalCycleId,
              policyVersion: "BOOKING_HOLD_TO_RENTAL_V1",
            },
          }),
        },
      });
      await this.syncContractHistory(contract, tx);
      if (tx.auditLog?.create) {
        await tx.auditLog.create({
          data: {
            action: "CREATE",
            entity: this.entityName,
            entityId: contract.id,
            module: "ContractsBookingHoldConvert",
            tenantId,
            userId,
            after: contract,
          },
        });
      }
      return contract;
    });

    return created;
  }

  async update(
    id: string,
    data: any,
    userId?: string,
    moduleName?: string,
  ): Promise<Contract> {
    const current = await this.getDetail(id);
    if (data.status !== undefined && data.status !== current.status) {
      throw new BadRequestException(
        "CONTRACT_STATUS_TRANSITION_REQUIRES_COMMAND",
      );
    }
    const canRefreshLegalSnapshot = [
      ContractStatus.DRAFT,
      ContractStatus.PENDING_APPROVAL,
      ContractStatus.APPROVED,
    ].includes(current.status);
    let preparedData = data;
    if (canRefreshLegalSnapshot) {
      const refreshedSnapshots = await this.withContractSnapshots({
        ...current,
        ...data,
        customerSnapshot: null,
        roomSnapshot: null,
        termsSnapshot: null,
      });
      preparedData = {
        ...data,
        customerSnapshot: refreshedSnapshots.customerSnapshot,
        roomSnapshot: refreshedSnapshots.roomSnapshot,
        termsSnapshot: refreshedSnapshots.termsSnapshot,
      };
    }
    const updated = await super.update(id, preparedData, userId, moduleName);
    if (updated.rentalCycleId && this.prisma.tx.rentalCycle?.updateMany) {
      await this.prisma.tx.rentalCycle.updateMany({
        where: { id: updated.rentalCycleId, tenantId: updated.tenantId },
        data: {
          customerId: updated.customerId,
          roomId: updated.roomId,
          expectedMoveInAt: updated.startDate,
        },
      });
    }
    await this.syncContractHistory(updated);
    if (data.depositMoney !== undefined || data.status !== undefined) {
      await this.syncContractDeposit(updated);
    }
    return updated;
  }

  override async softDelete(
    id: string,
    userId?: string,
    moduleName?: string,
  ): Promise<Contract> {
    const contract = await this.prisma.tx.contract.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            invoices: { where: { deletedAt: null } },
            deposits: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }
    if (contract.status !== ContractStatus.DRAFT) {
      throw new ConflictException(
        "CONTRACT_DELETE_REQUIRES_DRAFT_WITHOUT_HISTORY",
      );
    }
    if (contract._count.invoices > 0 || contract._count.deposits > 0) {
      throw new ConflictException(
        "CONTRACT_DELETE_BLOCKED_BY_FINANCIAL_HISTORY",
      );
    }

    return super.softDelete(id, userId, moduleName);
  }

  async syncContractDeposit(contract: any) {
    if (!contract?.id || !contract?.tenantId) return;
    const amount = Number(contract.depositMoney || 0);
    if (amount <= 0) return;

    try {
      const existingDeposit = await this.prisma.tx.deposit.findFirst({
        where: {
          tenantId: contract.tenantId,
          OR: [
            { contractId: contract.id },
            {
              contractId: null,
              roomId: contract.roomId,
              customerId: contract.customerId,
              status: {
                in: [
                  DepositStatus.PAID,
                  DepositStatus.DRAFT,
                  DepositStatus.PENDING,
                ],
              },
            },
          ],
        },
        orderBy: { createdAt: "desc" },
      });

      let targetStatus: DepositStatus = DepositStatus.PENDING;
      if (
        contract.status === ContractStatus.TERMINATED ||
        contract.status === ContractStatus.EXPIRED
      ) {
        targetStatus = DepositStatus.REFUNDED;
      } else if (existingDeposit) {
        if (existingDeposit.status === DepositStatus.PAID) {
          targetStatus =
            existingDeposit.type === "SECURITY"
              ? DepositStatus.PAID
              : DepositStatus.CONVERTED_TO_CONTRACT;
        } else if (existingDeposit.status === DepositStatus.REFUNDED) {
          targetStatus = DepositStatus.REFUNDED;
        } else {
          targetStatus = existingDeposit.status;
        }
      } else {
        targetStatus = DepositStatus.PENDING;
      }

      if (existingDeposit) {
        const updateData: Record<string, unknown> = {
          contractId: contract.id,
          ...(contract.rentalCycleId
            ? { rentalCycleId: contract.rentalCycleId }
            : {}),
          status: targetStatus,
          type: existingDeposit.type || "SECURITY",
        };
        if (
          existingDeposit.status !== DepositStatus.PAID &&
          existingDeposit.status !== DepositStatus.CONVERTED_TO_CONTRACT
        ) {
          updateData.amount = contract.depositMoney;
        }
        await this.prisma.tx.deposit.update({
          where: { id: existingDeposit.id },
          data: updateData,
        });
      }
    } catch (e) {
      // Don't fail contract operation if deposit sync fails
    }
  }

  async getDetail(id: string, include?: any): Promise<any> {
    const record = await super.getDetail(id, include);
    const settlementRefund = await this.getSettlementRefundSummary(record);
    const bookingDeposit = await this.prisma.tx.deposit.findFirst({
      where: {
        tenantId: record.tenantId,
        deletedAt: null,
        OR: [
          { contractId: record.id },
          ...(record.rentalCycleId
            ? [{ rentalCycleId: record.rentalCycleId }]
            : []),
          {
            roomId: record.roomId,
            customerId: record.customerId,
            type: { in: [DepositType.BOOKING, DepositType.RESERVATION] },
          },
        ],
        type: { in: [DepositType.BOOKING, DepositType.RESERVATION] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        type: true,
        status: true,
        amount: true,
        expiredAt: true,
        rentalCycleId: true,
        contractId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const invoiceModel = (this.prisma.tx as any).invoice;
    const paymentRequestModel = (this.prisma.tx as any).paymentRequest;
    const bookingInvoice = invoiceModel?.findFirst
      ? await invoiceModel.findFirst({
      where: {
        tenantId: record.tenantId,
        contractId: record.id,
        deletedAt: null,
        period: "Cọc giữ phòng",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        status: true,
        total: true,
        paidAmount: true,
        createdAt: true,
      },
    })
      : null;
    const bookingPaymentRequest = bookingInvoice && paymentRequestModel?.findFirst
      ? await paymentRequestModel.findFirst({
          where: {
            tenantId: record.tenantId,
            sourceType: "INVOICE",
            sourceId: bookingInvoice.id,
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            paymentCode: true,
            paidAt: true,
            createdAt: true,
            metadata: true,
        },
        })
      : null;
    const recordWithBookingDeposit = {
      ...record,
      bookingDeposit,
      bookingInvoice,
      bookingPaymentRequest,
    };
    if (record.coRepresentativeIds && record.coRepresentativeIds.length > 0) {
      const coReps = await this.prisma.tx.customer.findMany({
        where: { id: { in: record.coRepresentativeIds } },
        select: {
          id: true,
          fullName: true,
          phone: true,
          identityNo: true,
          idImages: true,
        },
      });
      return {
        ...recordWithBookingDeposit,
        coRepresentatives: coReps,
        settlementRefund,
      };
    }
    return { ...recordWithBookingDeposit, settlementRefund };
  }

  async listContracts(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    roomId?: string,
    customerId?: string,
    sort?: string,
    order?: string,
    tenantId?: string,
  ): Promise<PaginatedResult<Contract>> {
    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { customer: { fullName: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (status) where.status = mapStatusFilter(status);
    if (roomId) where.roomId = roomId;
    if (customerId) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [{ customerId }, { coRepresentativeIds: { has: customerId } }],
        },
      ];
    }

    const orderBy = { [sort || "createdAt"]: order || "desc" };

    return this.repository.paginate(where, page, limit, orderBy, {
      customer: {
        select: { id: true, fullName: true, phone: true, gender: true },
      },
      room: {
        select: {
          id: true,
          code: true,
          building: { select: { id: true, name: true } },
        },
      },
    });
  }

  async submitContract(id: string, userId: string): Promise<Contract> {
    const contract = await this.getDetail(id);

    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot submit contract in ${contract.status} status. Only DRAFT is allowed.`,
      );
    }

    const updated = await this.prisma.tx.contract.update({
      where: { id },
      data: { status: ContractStatus.PENDING_APPROVAL },
    });
    if (updated.rentalCycleId && this.prisma.tx.rentalCycle?.updateMany) {
      await this.prisma.tx.rentalCycle.updateMany({
        where: { id: updated.rentalCycleId, tenantId: updated.tenantId },
        data: {
          status: RentalCycleStatus.RESERVED,
          expectedMoveInAt: updated.startDate,
        },
      });
    }

    await this.auditService.log({
      action: "UPDATE",
      entity: this.entityName,
      entityId: id,
      module: "Contracts",
      before: contract,
      after: updated,
      userId,
    });

    return updated;
  }

  async approveContract(id: string, userId: string): Promise<Contract> {
    const contract = await this.getDetail(id);

    if (contract.status !== ContractStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Cannot approve contract in ${contract.status} status. Only PENDING_APPROVAL is allowed.`,
      );
    }

    const result = await this.prisma.tx.$transaction(async (tx) => {
      // Lock the room before checking availability. A stale OCCUPIED flag must
      // not block approval when there is no actual active occupancy, contract,
      // or hold; RESERVED/CLEANING/MAINTENANCE remain blocking states.
      if (contract.tenantId && typeof tx.$queryRaw === "function") {
        await this.lockRoomLifecycle(tx, contract.tenantId, contract.roomId);
      }

      const room = await tx.room.findUnique({
        where: { id: contract.roomId },
      });
      if (!room) {
        throw new ConflictException(
          `Room ${contract.roomId} is not AVAILABLE.`,
        );
      }

      const [openOccupancies, activeContracts, activeHolds] =
        await Promise.all([
          typeof tx.occupancy?.count === "function"
            ? tx.occupancy.count({
                where: {
                  tenantId: contract.tenantId,
                  roomId: contract.roomId,
                  leftAt: null,
                },
              })
            : 0,
          typeof tx.contract?.count === "function"
            ? tx.contract.count({
                where: {
                  tenantId: contract.tenantId,
                  roomId: contract.roomId,
                  deletedAt: null,
                  status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
                },
              })
            : 0,
          typeof tx.roomHold?.count === "function"
            ? tx.roomHold.count({
                where: {
                  tenantId: contract.tenantId,
                  roomId: contract.roomId,
                  status: "ACTIVE",
                  expiresAt: { gt: new Date() },
                },
              })
            : 0,
        ]);

      const roomHasBlockingState =
        room.status === RoomStatus.RESERVED ||
        room.status === RoomStatus.CLEANING ||
        room.status === RoomStatus.MAINTENANCE ||
        openOccupancies > 0 ||
        activeContracts > 0 ||
        activeHolds > 0;
      if (roomHasBlockingState) {
        throw new ConflictException(
          `Room ${room.code || contract.roomId} is not AVAILABLE.`,
        );
      }

      const updatedContract = await tx.contract.update({
        where: { id },
        data: { status: ContractStatus.APPROVED },
      });

      if (updatedContract.rentalCycleId && tx.rentalCycle?.updateMany) {
        await tx.rentalCycle.updateMany({
          where: {
            id: updatedContract.rentalCycleId,
            tenantId: updatedContract.tenantId,
          },
          data: {
            status: RentalCycleStatus.RESERVED,
            expectedMoveInAt: updatedContract.startDate,
          },
        });
      }

      const updatedRoom = await tx.room.update({
        where: { id: contract.roomId },
        data: { status: RoomStatus.RESERVED },
      });

      // A contract deposit may already have been created by the payment
      // reconciliation/sync flow before approval. Never create a second
      // deposit just because the contract moved to APPROVED.
      const existingContractDeposit = await tx.deposit.findFirst({
        where: {
          tenantId: contract.tenantId,
          contractId: contract.id,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
      const deposit =
        existingContractDeposit ||
        (await tx.deposit.create({
          data: {
            tenantId: contract.tenantId,
            code: `DC-${contract.code || contract.id}`,
            type: DepositType.SECURITY,
            roomId: contract.roomId,
            customerId: contract.customerId,
            contractId: contract.id,
            rentalCycleId: contract.rentalCycleId,
            amount: contract.depositMoney,
            status: DepositStatus.PENDING,
            note: `Cọc bảo đảm hợp đồng ${contract.code || contract.id}`,
          },
        }));

      return { updatedContract, updatedRoom, deposit };
    });

    await this.auditService.log({
      action: "UPDATE",
      entity: this.entityName,
      entityId: id,
      module: "Contracts",
      before: contract,
      after: result.updatedContract,
      userId,
    });

    await this.syncContractHistory(result.updatedContract);

    return result.updatedContract;
  }

  async activateContract(
    id: string,
    userId: string,
    tenantId?: string,
    idempotencyKey?: string,
  ): Promise<Contract> {
    const contract = await this.getDetail(id);

    if (tenantId && contract.tenantId !== tenantId) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }
    const normalizedIdempotencyKey = String(idempotencyKey || "").trim();
    if (
      normalizedIdempotencyKey.length < 8 ||
      normalizedIdempotencyKey.length > 128
    ) {
      throw new BadRequestException("IDEMPOTENCY_KEY_REQUIRED");
    }
    const commandOwner = await this.prisma.tx.contract.findUnique({
      where: {
        tenantId_activationIdempotencyKey: {
          tenantId: contract.tenantId,
          activationIdempotencyKey: normalizedIdempotencyKey,
        },
      },
      select: { id: true },
    });
    if (commandOwner && commandOwner.id !== contract.id) {
      throw new ConflictException("CONTRACT_ACTIVATION_IDEMPOTENCY_KEY_REUSED");
    }
    if (
      contract.status === ContractStatus.ACTIVE &&
      (contract as any).activationIdempotencyKey === normalizedIdempotencyKey
    ) {
      return contract;
    }

    if (contract.status !== ContractStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot activate contract in ${contract.status} status. Only APPROVED is allowed.`,
      );
    }

    const activationNow = new Date();
    const signedAt = contract.signedAt ? new Date(contract.signedAt) : null;
    if (
      !signedAt ||
      Number.isNaN(signedAt.getTime()) ||
      signedAt.getTime() > activationNow.getTime()
    ) {
      throw new BadRequestException("CONTRACT_SIGNATURE_REQUIRED");
    }

    const contractStartDate = contract.startDate
      ? new Date(contract.startDate)
      : null;
    const contractEndDate = contract.endDate
      ? new Date(contract.endDate)
      : null;
    if (!contractStartDate || Number.isNaN(contractStartDate.getTime())) {
      throw new BadRequestException("CONTRACT_START_DATE_INVALID");
    }
    if (
      contractEndDate &&
      (Number.isNaN(contractEndDate.getTime()) ||
        contractEndDate.getTime() <= contractStartDate.getTime())
    ) {
      throw new BadRequestException("CONTRACT_END_DATE_INVALID");
    }
    const activationUtcDay = Date.UTC(
      activationNow.getUTCFullYear(),
      activationNow.getUTCMonth(),
      activationNow.getUTCDate(),
    );
    const startUtcDay = Date.UTC(
      contractStartDate.getUTCFullYear(),
      contractStartDate.getUTCMonth(),
      contractStartDate.getUTCDate(),
    );
    if (startUtcDay > activationUtcDay) {
      throw new BadRequestException("CONTRACT_START_DATE_IN_FUTURE");
    }

    const room = await this.prisma.tx.room.findUnique({
      where: { id: contract.roomId },
    });
    const isSharedRoom = room?.rentalType === "SHARED";
    const roomStatusAllowed = isSharedRoom
      ? room && [RoomStatus.RESERVED, RoomStatus.OCCUPIED].includes(room.status)
      : room?.status === RoomStatus.RESERVED;
    if (!room || !roomStatusAllowed) {
      throw new ConflictException(
        isSharedRoom
          ? `Phòng ghép ${room?.code || contract.roomId} không ở trạng thái RESERVED/OCCUPIED.`
          : `Phòng ${room?.code || contract.roomId} không ở trạng thái RESERVED.`,
      );
    }

    const deposit = await this.prisma.tx.deposit.findFirst({
      where: {
        tenantId: contract.tenantId,
        contractId: contract.id,
        roomId: contract.roomId,
        customerId: contract.customerId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!deposit) {
      throw new BadRequestException(
        "Cannot activate contract: Deposit is missing.",
      );
    }

    if (
      deposit.status !== DepositStatus.PAID &&
      deposit.status !== DepositStatus.CONVERTED_TO_CONTRACT
    ) {
      throw new BadRequestException(
        `Cannot activate contract: Deposit is in ${deposit.status} status. Must be PAID.`,
      );
    }

    const result = await this.prisma.tx.$transaction(async (tx) => {
      const txAny = tx as any;
      if (typeof txAny.$queryRaw === "function") {
        await txAny.$queryRaw`
          SELECT "id"
          FROM "Room"
          WHERE "id" = ${contract.roomId}
            AND "tenantId" = ${contract.tenantId}
          FOR UPDATE
        `;
      }
      const lockedRoom = txAny.room?.findFirst
        ? await txAny.room.findFirst({
            where: {
              id: contract.roomId,
              tenantId: contract.tenantId,
              deletedAt: null,
            },
          })
        : room;
      const lockedRoomIsShared = lockedRoom?.rentalType === "SHARED";
      const lockedRoomStatusAllowed = lockedRoomIsShared
        ? lockedRoom &&
          [RoomStatus.RESERVED, RoomStatus.OCCUPIED].includes(lockedRoom.status)
        : lockedRoom?.status === RoomStatus.RESERVED;
      if (!lockedRoom || !lockedRoomStatusAllowed) {
        throw new ConflictException("CONTRACT_ROOM_STATE_CHANGED");
      }

      if (txAny.depositLedgerEntry?.aggregate) {
        const balance = await txAny.depositLedgerEntry.aggregate({
          where: { tenantId: contract.tenantId, depositId: deposit.id },
          _sum: { balanceEffect: true },
        });
        if (
          Number(balance?._sum?.balanceEffect || 0) <
          Number(contract.depositMoney || 0)
        ) {
          throw new BadRequestException(
            "CONTRACT_SECURITY_DEPOSIT_BALANCE_INSUFFICIENT",
          );
        }
      }

      if (contract.rentalCycleId && txAny.roomHold?.findFirst) {
        const hold = await txAny.roomHold.findFirst({
          where: {
            tenantId: contract.tenantId,
            rentalCycleId: contract.rentalCycleId,
            roomId: contract.roomId,
            depositId: deposit.id,
            status: "ACTIVE",
            expiresAt: { gt: new Date() },
          },
        });
        if (!hold) {
          throw new ConflictException("CONTRACT_ACTIVE_HOLD_REQUIRED");
        }
      }

      if (lockedRoomIsShared && txAny.occupancy?.count) {
        const openOccupants = await txAny.occupancy.count({
          where: {
            tenantId: contract.tenantId,
            roomId: contract.roomId,
            leftAt: null,
          },
        });
        if (
          openOccupants + Math.max(1, Number(contract.memberCount || 1)) >
          Number(lockedRoom.capacity || 1)
        ) {
          throw new ConflictException("ROOM_SHARED_CAPACITY_EXCEEDED");
        }
      }

      const moveInAt = new Date();
      const latestReading = txAny.hunonicMeterReading?.findFirst
        ? await txAny.hunonicMeterReading.findFirst({
            where: { tenantId: contract.tenantId, roomId: contract.roomId },
            orderBy: [{ readingAt: "desc" }, { createdAt: "desc" }],
          })
        : null;
      const moveInSnapshot = this.asJson({
        capturedAt: moveInAt,
        roomId: contract.roomId,
        roomCode: lockedRoom.code,
        rentalType: lockedRoom.rentalType,
        capacity: lockedRoom.capacity,
        meterReadingId: latestReading?.id || null,
        electricityKwh: latestReading
          ? Number(latestReading.energyMonthKwh || 0)
          : null,
        policyVersion: "MOVE_IN_V1",
      });
      const activationClaim = await tx.contract.updateMany({
        where: {
          id,
          tenantId: contract.tenantId,
          status: ContractStatus.APPROVED,
        },
        data: {
          status: ContractStatus.ACTIVE,
          moveInSnapshot,
          activatedAt: moveInAt,
          activationIdempotencyKey: normalizedIdempotencyKey,
        },
      });

      if (activationClaim.count !== 1) {
        const current = await tx.contract.findFirst({
          where: { id, tenantId: contract.tenantId },
        });
        if (
          current?.status === ContractStatus.ACTIVE &&
          (current as any).activationIdempotencyKey === normalizedIdempotencyKey
        ) {
          return { updatedContract: current, replayed: true };
        }
        throw new ConflictException("CONTRACT_ACTIVATION_CONCURRENT_CONFLICT");
      }

      const updatedContract = await tx.contract.findFirst({
        where: { id, tenantId: contract.tenantId },
      });
      if (!updatedContract) {
        throw new ConflictException("CONTRACT_ACTIVATION_STATE_NOT_FOUND");
      }

      if (updatedContract.rentalCycleId && tx.rentalCycle?.updateMany) {
        await tx.rentalCycle.updateMany({
          where: {
            id: updatedContract.rentalCycleId,
            tenantId: updatedContract.tenantId,
          },
          data: { status: RentalCycleStatus.ACTIVE, actualMoveInAt: moveInAt },
        });
      }

      const updatedRoom = await tx.room.update({
        where: { id: contract.roomId },
        data: { status: RoomStatus.OCCUPIED },
      });

      const updatedDeposit = await tx.deposit.update({
        where: { id: deposit.id },
        data: {
          status: DepositStatus.CONVERTED_TO_CONTRACT,
          rentalCycleId: contract.rentalCycleId,
        },
      });

      await this.syncContractHistory(updatedContract, tx);

      const firstBilling = calculateFirstBillingPeriod(
        Number(contract.monthlyRent || 0),
        contract.startDate,
      );
      const entryBaseInvoiceKey = `ENTRY:${contract.id}:${firstBilling.period}`;
      const invoice = await tx.invoice.create({
        data: {
          tenantId: contract.tenantId,
          code: `INV-ENTRY-${contract.code || contract.id}`,
          period: firstBilling.period,
          contractId: contract.id,
          rentalCycleId: contract.rentalCycleId,
          customerId: contract.customerId,
          status: InvoiceStatus.ISSUED,
          billingKind: "ENTRY",
          baseInvoiceKey: entryBaseInvoiceKey,
          dueDate:
            contract.firstPaymentDate ||
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          subtotal: firstBilling.amount,
          discount: 0,
          total: firstBilling.amount,
          paidAmount: 0,
          creditAmount: 0,
          items: {
            create: [
              {
                tenantId: contract.tenantId,
                type: "RENT",
                description: firstBilling.billableDays
                  ? `Tiền thuê kỳ đầu (${firstBilling.billableDays}/${firstBilling.daysInMonth} ngày, ${firstBilling.policyVersion})`
                  : "Tiền thuê kỳ đầu",
                servicePeriod: firstBilling.period,
                quantity: 1,
                unitPrice: firstBilling.amount,
                amount: firstBilling.amount,
              },
            ],
          },
        },
      });

      return {
        updatedContract,
        updatedRoom,
        updatedDeposit,
        invoice,
        replayed: false,
      };
    });

    if (result.replayed) {
      return result.updatedContract;
    }

    await this.auditService.log({
      action: "UPDATE",
      entity: this.entityName,
      entityId: id,
      module: "Contracts",
      before: contract,
      after: result.updatedContract,
      userId,
    });

    return result.updatedContract;
  }

  async expireContract(
    id: string,
    userId: string,
    tenantId?: string,
  ): Promise<Contract> {
    if (!tenantId) {
      throw new BadRequestException("CONTRACT_EXPIRY_REQUIRES_TENANT");
    }
    const contract = await this.prisma.tx.contract.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!contract) throw new NotFoundException(`Contract with ID ${id} not found`);

    // Expiry is no longer an alternate move-out implementation.  The
    // authoritative settlement command owns every financial and room/occupancy
    // transition.  After that command commits, expiry retries simply replay
    // the already-finalized contract without another side effect.
    const settlement = await this.prisma.tx.contractSettlement.findFirst({
      where: { contractId: id, tenantId },
      select: { id: true },
    });
    if (!settlement) {
      throw new ConflictException("CONTRACT_EXPIRY_REQUIRES_SETTLEMENT");
    }
    if (
      !([
        ContractStatus.TERMINATED,
        ContractStatus.EXPIRED,
        ContractStatus.CANCELLED,
      ] as ContractStatus[]).includes(contract.status)
    ) {
      throw new ConflictException("CONTRACT_EXPIRY_SETTLEMENT_STATE_MISMATCH");
    }
    return contract;
  }

  async previewSettlement(
    id: string,
    input: ContractSettlementInput,
    tenantId?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException("SETTLEMENT_PREVIEW_TENANT_REQUIRED");
    }
    const contract = await this.prisma.tx.contract.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { customer: true, room: true },
    });
    if (!contract) throw new NotFoundException(`Contract with ID ${id} not found`);
    if (!contract.rentalCycleId) {
      throw new BadRequestException("SETTLEMENT_RENTAL_CYCLE_REQUIRED");
    }
    const cycle = await this.prisma.tx.rentalCycle.findFirst({
      where: {
        id: contract.rentalCycleId,
        tenantId,
        customerId: contract.customerId,
        roomId: contract.roomId,
      },
      select: { id: true },
    });
    if (!cycle) throw new BadRequestException("SETTLEMENT_RENTAL_CYCLE_SCOPE_MISMATCH");

    const preview = await this.composeSettlementPreview(contract, input);
    const context = await this.loadSettlementFinancialContext(
      this.prisma.tx,
      contract,
    );
    return this.applyAuthoritativeSettlementBalance(
      preview,
      context.priorOutstanding,
      context.availableDepositAmount,
    );
  }

  async terminateContract(
    id: string,
    userId: string,
    input?: Partial<ContractSettlementInput>,
    tenantId?: string,
    idempotencyKey?: string,
  ): Promise<Contract> {
    // HTTP termination is intentionally routed through the settlement command.
    // The legacy overload remains for internal pre-09.01 callers only; it is
    // not tenant-addressable from the controller.
    if (tenantId) {
      if (!input?.actualMoveOutDate) {
        throw new BadRequestException("SETTLEMENT_MOVE_OUT_DATE_REQUIRED");
      }
      return this.settleAndTerminateContract(
        id,
        userId,
        tenantId,
        input as ContractSettlementInput,
        idempotencyKey,
      );
    }
    return this.finalizeContract(id, userId, ContractStatus.TERMINATED, input);
  }

  async moveOutOccupant(
    input: MoveOutOccupantInput,
    userId: string,
    tenantId?: string,
    idempotencyKey?: string,
  ) {
    // The HTTP command is deliberately separated from old internal callers:
    // it is tenant-scoped, locked and replayable.  Keep the legacy branch for
    // pre-existing non-HTTP callers until they are retired.
    if (tenantId) {
      return this.moveOutOccupantCommand(input, userId, tenantId, idempotencyKey);
    }
    const customer = tenantId
      ? await this.prisma.tx.customer.findFirst({
          where: { id: input.customerId, tenantId, deletedAt: null },
        })
      : await this.prisma.tx.customer.findUnique({
          where: { id: input.customerId },
        });
    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${input.customerId} not found`,
      );
    }

    const contractInclude = {
      customer: true,
      room: { include: { building: true, floor: true } },
    } as const;
    let contract: any = null;

    if (input.contractId) {
      contract = await this.prisma.tx.contract.findFirst({
        where: {
          id: input.contractId,
          roomId: input.roomId,
          ...(tenantId ? { tenantId } : {}),
          deletedAt: null,
        },
        include: contractInclude,
      });
    }

    if (!contract) {
      const partyFilter = {
        roomId: input.roomId,
        ...(tenantId ? { tenantId } : {}),
        deletedAt: null,
        OR: [
          { customerId: input.customerId },
          { coRepresentativeIds: { has: input.customerId } },
        ],
      };
      contract = await this.prisma.tx.contract.findFirst({
        where: {
          ...partyFilter,
          status: {
            in: [
              ContractStatus.ACTIVE,
              ContractStatus.EXPIRING,
              ContractStatus.APPROVED,
              ContractStatus.PENDING_APPROVAL,
              ContractStatus.DRAFT,
            ],
          },
        },
        include: contractInclude,
        orderBy: { createdAt: "desc" },
      });
      if (!contract) {
        contract = await this.prisma.tx.contract.findFirst({
          where: partyFilter,
          include: contractInclude,
          orderBy: { updatedAt: "desc" },
        });
      }
    }

    const isPrimary = contract?.customerId === input.customerId;
    const isCoRepresentative =
      Array.isArray(contract?.coRepresentativeIds) &&
      contract.coRepresentativeIds.includes(input.customerId);
    const isCurrentlyInRoom = customer.roomId === input.roomId;

    if (contract && !isPrimary && !isCoRepresentative && !isCurrentlyInRoom) {
      throw new ConflictException("OCCUPANT_NOT_LINKED_TO_CONTRACT_OR_ROOM");
    }
    if (!contract && !isCurrentlyInRoom) {
      throw new ConflictException("OCCUPANT_NOT_IN_ROOM");
    }

    const actualMoveOutAt = this.resolveMoveOutDate(
      input.actualMoveOutDate || new Date(),
    );
    const reason = String(input.reason || input.note || "Trả phòng").trim();
    const roomTurnoverStatus = this.resolveRoomTurnoverStatus(
      input.roomTurnoverStatus,
    );

    if (isPrimary && ACTIVE_LIKE_CONTRACT_STATUSES.includes(contract.status)) {
      const {
        roomId: _roomId,
        customerId: _customerId,
        contractId: _contractId,
        reason: _reason,
        ...settlementInput
      } = input;
      const finalizeInput = {
        ...settlementInput,
        actualMoveOutDate: actualMoveOutAt,
        roomTurnoverStatus,
        note: input.note || reason,
      };
      const updatedContract = tenantId
        ? await this.finalizeContract(
            contract.id,
            userId,
            ContractStatus.TERMINATED,
            finalizeInput,
            tenantId,
          )
        : await this.finalizeContract(
            contract.id,
            userId,
            ContractStatus.TERMINATED,
            finalizeInput,
          );
      const updatedRoom = await this.prisma.tx.room.findUnique({
        where: { id: input.roomId },
      });
      return {
        mode: "CONTRACT_SETTLED",
        contractId: contract.id,
        contractStatus: updatedContract.status,
        roomStatus: updatedRoom?.status || roomTurnoverStatus,
        removedCustomerIds: Array.from(
          new Set(
            [
              contract.customerId,
              ...(Array.isArray(contract.coRepresentativeIds)
                ? contract.coRepresentativeIds
                : []),
            ].filter(Boolean),
          ),
        ),
      };
    }

    if (
      isPrimary &&
      [
        ContractStatus.DRAFT,
        ContractStatus.PENDING_APPROVAL,
        ContractStatus.APPROVED,
      ].includes(contract.status)
    ) {
      return this.cancelPreActiveContract(
        contract,
        userId,
        actualMoveOutAt,
        reason,
        roomTurnoverStatus,
      );
    }

    if (isCoRepresentative && contract) {
      return this.detachCoRepresentative(
        contract,
        customer,
        userId,
        actualMoveOutAt,
        reason,
        roomTurnoverStatus,
      );
    }

    return this.detachSingleOccupant(
      customer,
      contract,
      input.roomId,
      userId,
      actualMoveOutAt,
      reason,
      roomTurnoverStatus,
    );
  }

  /** Tenant HTTP leave command.  It never detaches a whole contract itself. */
  private async moveOutOccupantCommand(
    input: MoveOutOccupantInput,
    userId: string,
    tenantId: string,
    idempotencyKey?: string,
  ) {
    const commandKey = this.requireSettlementIdempotencyKey(idempotencyKey);
    const actualMoveOutAt = this.resolveMoveOutDate(input.actualMoveOutDate || new Date());
    const reason = String(input.reason || input.note || "Trả phòng").trim();
    const contract = input.contractId
      ? await this.prisma.tx.contract.findFirst({
          where: {
            id: input.contractId,
            tenantId,
            roomId: input.roomId,
            deletedAt: null,
          },
        })
      : null;
    if (input.contractId && !contract) {
      throw new NotFoundException("OCCUPANT_CONTRACT_NOT_FOUND");
    }
    if (contract?.customerId === input.customerId) {
      // A primary exit owns settlement/deposit policy, so preserve the single
      // canonical settlement path instead of partially closing its occupancy.
      const settled = await this.terminateContract(
        contract.id,
        userId,
        {
          actualMoveOutDate: actualMoveOutAt,
          roomTurnoverStatus: this.resolveRoomTurnoverStatus(input.roomTurnoverStatus),
          note: input.note || reason,
        } as ContractSettlementInput,
        tenantId,
        commandKey,
      );
      const room = await this.prisma.tx.room.findFirst({
        where: { id: input.roomId, tenantId, deletedAt: null },
      });
      return {
        mode: "CONTRACT_SETTLED",
        contractId: settled.id,
        contractStatus: settled.status,
        roomStatus: room?.status || this.resolveRoomTurnoverStatus(input.roomTurnoverStatus),
        removedCustomerIds: [contract.customerId, ...(contract.coRepresentativeIds || [])],
      };
    }

    const requestHash = this.hashSettlementRequest({
      tenantId,
      commandKey,
      customerId: input.customerId,
      roomId: input.roomId,
      contractId: input.contractId || null,
      actualMoveOutAt: actualMoveOutAt.toISOString(),
      reason,
    });
    const marker = `MOVE_OUT:${requestHash}`;
    const result = await this.runTransferSerializable(async (tx: any) => {
      await this.lockRoomLifecycle(tx, tenantId, input.roomId);
      const customer = await tx.customer.findFirst({
        where: { id: input.customerId, tenantId, deletedAt: null },
      });
      if (!customer) throw new NotFoundException("OCCUPANT_CUSTOMER_NOT_FOUND");

      const scopedContract = contract
        ? await tx.contract.findFirst({
            where: { id: contract.id, tenantId, roomId: input.roomId, deletedAt: null },
          })
        : await tx.contract.findFirst({
            where: {
              tenantId,
              roomId: input.roomId,
              deletedAt: null,
              coRepresentativeIds: { has: input.customerId },
              status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
            },
            orderBy: { createdAt: "desc" },
          });
      if (!scopedContract) throw new ConflictException("OCCUPANT_SHARED_MEMBERSHIP_REQUIRED");
      const occupancyScope = {
        tenantId,
        roomId: input.roomId,
        customerId: input.customerId,
        contractId: scopedContract.id,
        rentalCycleId: scopedContract.rentalCycleId || null,
      };
      const isCurrentMember =
        scopedContract.customerId !== input.customerId &&
        Array.isArray(scopedContract.coRepresentativeIds) &&
        scopedContract.coRepresentativeIds.includes(input.customerId);
      if (!isCurrentMember) {
        const replay = await tx.occupancy.findFirst({
          where: { ...occupancyScope, leaveReason: marker, leftAt: { not: null } },
        });
        if (replay) return { replayed: true, contract: scopedContract, occupancy: replay };
        throw new ConflictException("OCCUPANT_SHARED_MEMBERSHIP_REQUIRED");
      }
      const openOccupancy = await tx.occupancy.findFirst({
        where: { ...occupancyScope, leftAt: null },
      });
      if (!openOccupancy) {
        const replay = await tx.occupancy.findFirst({
          where: { ...occupancyScope, leaveReason: marker, leftAt: { not: null } },
        });
        if (replay) return { replayed: true, contract: scopedContract, occupancy: replay };
        throw new ConflictException("OCCUPANCY_NOT_OPEN_FOR_MEMBER");
      }

      const nextMembers = scopedContract.coRepresentativeIds.filter(
        (id: string) => id !== input.customerId,
      );
      const membershipClaim = await tx.contract.updateMany({
        where: {
          id: scopedContract.id,
          tenantId,
          coRepresentativeIds: { has: input.customerId },
        },
        data: { coRepresentativeIds: nextMembers },
      });
      if (membershipClaim.count !== 1) throw new ConflictException("OCCUPANT_MEMBERSHIP_CONCURRENT_CONFLICT");
      await tx.occupancy.update({
        where: { id: openOccupancy.id },
        data: { leftAt: actualMoveOutAt, leaveReason: marker },
      });
      await tx.contractParty.updateMany({
        where: {
          tenantId,
          contractId: scopedContract.id,
          customerId: input.customerId,
          role: "CO_REPRESENTATIVE",
          leftAt: null,
        },
        data: { leftAt: actualMoveOutAt },
      });
      await this.clearCustomerRoomWhenUnbound(tx, tenantId, input.customerId, input.roomId);
      const room = await this.refreshRoomLifecycleStatus(tx, tenantId, input.roomId);
      const updated = await tx.contract.findFirst({ where: { id: scopedContract.id, tenantId } });
      if (tx.auditLog?.create) {
        await tx.auditLog.create({
          data: {
            action: "UPDATE", entity: this.entityName, entityId: scopedContract.id,
            module: "ContractsOccupancy", tenantId, userId,
            before: { occupancyId: openOccupancy.id, memberIds: scopedContract.coRepresentativeIds },
            after: { occupancyId: openOccupancy.id, memberIds: nextMembers, requestHash },
          },
        });
      }
      return { replayed: false, contract: updated || scopedContract, occupancy: openOccupancy, room };
    });
    return {
      mode: "CO_REPRESENTATIVE_DETACHED",
      contractId: result.contract.id,
      contractStatus: result.contract.status,
      roomStatus: result.room?.status || RoomStatus.OCCUPIED,
      removedCustomerIds: [input.customerId],
    };
  }

  async transferOccupant(
    input: TransferOccupantInput,
    userId: string,
    tenantId: string,
    idempotencyKey?: string,
  ) {
    const commandKey = this.requireSettlementIdempotencyKey(idempotencyKey);
    if (input.sourceRoomId === input.targetRoomId) {
      throw new BadRequestException("TRANSFER_SOURCE_AND_TARGET_ROOM_MUST_DIFFER");
    }
    const transferAt = new Date(input.transferAt);
    if (Number.isNaN(transferAt.getTime())) throw new BadRequestException("TRANSFER_DATE_INVALID");
    const requestHash = this.hashSettlementRequest({
      tenantId, commandKey, ...input, transferAt: transferAt.toISOString(),
    });
    const transferCode = `TR-${createHash("sha256")
      .update(`${tenantId}:${input.contractId}:${input.customerId}:${commandKey}`)
      .digest("hex").slice(0, 24).toUpperCase()}`;

    return this.runTransferSerializable(async (tx: any) => {
      await this.lockSettlementContract(tx, tenantId, input.contractId);
      await this.lockTransferRooms(tx, tenantId, input.sourceRoomId, input.targetRoomId);
      const source = await tx.contract.findFirst({
        where: {
          id: input.contractId, tenantId, roomId: input.sourceRoomId,
          rentalCycleId: input.rentalCycleId, deletedAt: null,
          status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
        },
      });
      if (!source) throw new NotFoundException("TRANSFER_SOURCE_CONTRACT_NOT_FOUND");
      // Check the deterministic canonical record before current membership:
      // a successful transfer has intentionally removed this member from the
      // source contract, and the retry must not be mistaken for a new move.
      const existing = await tx.contract.findFirst({ where: { tenantId, code: transferCode, deletedAt: null } });
      if (existing) {
        const transfer = (existing.termsSnapshot as any)?.transfer;
        if (transfer?.requestHash === requestHash && transfer?.idempotencyKey === commandKey) return existing;
        throw new ConflictException("TRANSFER_IDEMPOTENCY_CONFLICT");
      }
      if (source.customerId === input.customerId) {
        throw new ConflictException("TRANSFER_PRIMARY_REQUIRES_SETTLEMENT");
      }
      if (!Array.isArray(source.coRepresentativeIds) || !source.coRepresentativeIds.includes(input.customerId)) {
        throw new ConflictException("TRANSFER_SHARED_MEMBER_NOT_FOUND");
      }
      const start = new Date(source.startDate);
      const end = new Date(source.endDate);
      if (transferAt.getTime() < start.getTime() || transferAt.getTime() >= end.getTime()) {
        throw new BadRequestException("TRANSFER_DATE_OUTSIDE_SOURCE_CONTRACT");
      }
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, tenantId, deletedAt: null } });
      if (!customer) throw new NotFoundException("TRANSFER_CUSTOMER_NOT_FOUND");
      const sourceOccupancy = await tx.occupancy.findFirst({
        where: {
          tenantId, roomId: input.sourceRoomId, customerId: input.customerId,
          contractId: source.id, rentalCycleId: input.rentalCycleId, leftAt: null,
        },
      });
      if (!sourceOccupancy) throw new ConflictException("TRANSFER_SOURCE_OCCUPANCY_NOT_OPEN");
      const targetRoom = await tx.room.findFirst({
        where: { id: input.targetRoomId, tenantId, deletedAt: null },
      });
      if (!targetRoom) throw new NotFoundException("TRANSFER_TARGET_ROOM_NOT_FOUND");
      await this.assertTransferTargetCapacity(tx, tenantId, targetRoom);

      const targetCycle = await tx.rentalCycle.create({
        data: {
          tenantId, customerId: input.customerId, roomId: input.targetRoomId,
          status: RentalCycleStatus.ACTIVE, expectedMoveInAt: transferAt, actualMoveInAt: transferAt,
        },
      });
      const termsSnapshot = this.asJson({
        ...(source.termsSnapshot as any || {}),
        code: transferCode, status: ContractStatus.ACTIVE, startDate: transferAt,
        endDate: source.endDate, monthlyRent: Number(source.monthlyRent || 0),
        // A co-representative has no independently transferable deposit.  Do
        // not copy a source financial obligation into this operational record.
        depositMoney: 0, memberCount: 1, coRepresentativeIds: [], attachments: [],
        transfer: {
          sourceContractId: source.id, sourceRentalCycleId: input.rentalCycleId,
          sourceRoomId: input.sourceRoomId, targetRoomId: input.targetRoomId,
          transferAt: transferAt.toISOString(), idempotencyKey: commandKey,
          requestHash, policyVersion: "TRANSFER_V1",
        },
      });
      const newContract = await tx.contract.create({
        data: {
          tenantId, customerId: input.customerId, roomId: input.targetRoomId,
          rentalCycleId: targetCycle.id, code: transferCode, status: ContractStatus.ACTIVE,
          startDate: transferAt, endDate: source.endDate, signedAt: null,
          firstPaymentDate: source.firstPaymentDate, purpose: source.purpose,
          monthlyRent: source.monthlyRent, depositMoney: 0, memberCount: 1,
          attachments: [], coRepresentativeIds: [],
          customerSnapshot: this.asJson({ id: customer.id, fullName: customer.fullName, phone: customer.phone }),
          roomSnapshot: this.asJson({ id: targetRoom.id, code: targetRoom.code, name: targetRoom.name, rentalType: targetRoom.rentalType }),
          termsSnapshot,
          activatedAt: transferAt,
        },
      });
      const sourceParty = await tx.contractParty.findFirst({
        where: { tenantId, contractId: source.id, customerId: input.customerId, role: "CO_REPRESENTATIVE", leftAt: null },
      });
      await tx.contractParty.create({
        data: {
          tenantId, contractId: newContract.id, customerId: input.customerId, role: "PRIMARY",
          identitySnapshot: sourceParty?.identitySnapshot || this.asJson({ id: customer.id, fullName: customer.fullName, phone: customer.phone }),
          signedAt: null,
        },
      });
      const membershipClaim = await tx.contract.updateMany({
        where: { id: source.id, tenantId, coRepresentativeIds: { has: input.customerId } },
        data: { coRepresentativeIds: source.coRepresentativeIds.filter((id: string) => id !== input.customerId) },
      });
      if (membershipClaim.count !== 1) throw new ConflictException("TRANSFER_MEMBER_CONCURRENT_CONFLICT");
      await tx.contractParty.updateMany({
        where: { tenantId, contractId: source.id, customerId: input.customerId, role: "CO_REPRESENTATIVE", leftAt: null },
        data: { leftAt: transferAt },
      });
      await tx.occupancy.update({
        where: { id: sourceOccupancy.id },
        data: { leftAt: transferAt, leaveReason: `TRANSFER:${requestHash}` },
      });
      await tx.occupancy.create({
        data: {
          id: `occ_${createHash("sha256").update(`${tenantId}:${transferCode}`).digest("hex").slice(0, 32)}`,
          tenantId, roomId: input.targetRoomId, customerId: input.customerId,
          contractId: newContract.id, rentalCycleId: targetCycle.id, role: "PRIMARY", joinedAt: transferAt,
        },
      });
      await tx.customer.updateMany({ where: { id: input.customerId, tenantId }, data: { roomId: input.targetRoomId } });
      await this.refreshRoomLifecycleStatus(tx, tenantId, input.sourceRoomId);
      await tx.room.update({ where: { id: input.targetRoomId }, data: { status: RoomStatus.OCCUPIED } });
      if (tx.auditLog?.create) {
        await tx.auditLog.create({
          data: { action: "CREATE", entity: this.entityName, entityId: newContract.id,
            module: "ContractsTransfer", tenantId, userId,
            after: { sourceContractId: source.id, sourceOccupancyId: sourceOccupancy.id, targetCycleId: targetCycle.id, requestHash },
          },
        });
      }
      return newContract;
    });
  }

  async completePendingSettlementRefund(
    id: string,
    userId: string,
    note?: string,
    tenantId?: string,
    idempotencyKey?: string,
  ) {
    if (tenantId) {
      return this.completeSettlementRefundCommand(
        id,
        userId,
        tenantId,
        note,
        idempotencyKey,
      );
    }
    const contract = await this.getDetail(id);
    if (
      contract.status !== ContractStatus.TERMINATED &&
      contract.status !== ContractStatus.EXPIRED
    ) {
      throw new BadRequestException(
        `Cannot complete settlement refund in ${contract.status} status.`,
      );
    }

    const refundReceiptPrefix = this.buildRefundReceiptPrefix(contract.code);
    const refundReceipt = await this.prisma.receipt.findFirst({
      where: {
        tenantId: contract.tenantId,
        status: ReceiptStatus.PENDING,
        code: { startsWith: refundReceiptPrefix },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!refundReceipt) {
      throw new BadRequestException("SETTLEMENT_REFUND_PENDING_NOT_FOUND");
    }

    const refundTaskTitle = `Xu ly hoan tien quyet toan ${contract.code}`;
    const pendingTask = await this.prisma.task.findFirst({
      where: {
        tenantId: contract.tenantId,
        status: "TODO" as any,
        title: refundTaskTitle,
      },
      orderBy: { createdAt: "desc" },
    });

    const result = await this.prisma.tx.$transaction(async (tx) => {
      const updatedReceipt = await tx.receipt.update({
        where: { id: refundReceipt.id },
        data: {
          status: ReceiptStatus.COMPLETED,
          description: note
            ? `${refundReceipt.description || `Contract settlement refund for ${contract.code}`}\nCompleted note: ${note}`.trim()
            : refundReceipt.description,
        },
      });

      const updatedTask = pendingTask
        ? await tx.task.update({
            where: { id: pendingTask.id },
            data: {
              status: "DONE" as any,
              description: note
                ? `${pendingTask.description || ""}\nHoan tat: ${note}`.trim()
                : pendingTask.description,
            },
          })
        : null;

      return { updatedReceipt, updatedTask };
    });

    await this.auditService.log({
      action: "UPDATE",
      entity: "Receipt",
      entityId: result.updatedReceipt.id,
      module: "Contracts",
      before: refundReceipt,
      after: result.updatedReceipt,
      userId,
    });

    if (pendingTask && result.updatedTask) {
      await this.auditService.log({
        action: "UPDATE",
        entity: "Task",
        entityId: result.updatedTask.id,
        module: "Contracts",
        before: pendingTask,
        after: result.updatedTask,
        userId,
      });
    }

    const settlementAudit = await this.prisma.auditLog.findFirst({
      where: {
        tenantId: contract.tenantId,
        entity: this.entityName,
        entityId: contract.id,
        module: "Contracts",
        action: "UPDATE",
      },
      orderBy: { createdAt: "desc" },
    });
    const accountingBreakdown =
      (settlementAudit?.after as any)?.settlement?.accountingBreakdown || null;

    this.eventPublisher.publish("contract.settlement.refunded", {
      tenantId: contract.tenantId,
      userId,
      customerId: contract.customerId,
      customerName: contract.customer?.fullName,
      customerPhone: contract.customer?.phone,
      ...buildRoomContext(contract.room, contract),
      metadata: {
        code: contract.code,
        refundSourceType: "CONTRACT_SETTLEMENT",
        refundCompletionNote: note || null,
        completedFromPending: true,
        ...(accountingBreakdown ? { accountingBreakdown } : {}),
      },
      sourceId: contract.id,
      sourceType: "REFUND",
      amount: Number(result.updatedReceipt.amount || 0),
      paymentProvider: "MANUAL",
      occurredAt: new Date(),
    });

    return {
      success: true,
      receiptId: result.updatedReceipt.id,
      taskId: result.updatedTask?.id || null,
      amount: Number(result.updatedReceipt.amount || 0),
    };
  }

  private async cancelPreActiveContract(
    contract: any,
    userId: string,
    actualMoveOutAt: Date,
    reason: string,
    roomTurnoverStatus: RoomStatus,
  ) {
    const protectedDeposit = await this.prisma.tx.deposit.findFirst({
      where: {
        contractId: contract.id,
        deletedAt: null,
        status: {
          in: [DepositStatus.PAID, DepositStatus.CONVERTED_TO_CONTRACT],
        },
      },
    });
    if (protectedDeposit) {
      throw new ConflictException(
        "CONTRACT_CANCELLATION_REQUIRES_DEPOSIT_REFUND",
      );
    }

    await this.syncContractHistory(contract);
    const snapshots = await this.withContractSnapshots(contract);
    const contractCustomerIds = Array.from(
      new Set(
        [
          contract.customerId,
          ...(Array.isArray(contract.coRepresentativeIds)
            ? contract.coRepresentativeIds
            : []),
        ].filter(Boolean),
      ),
    );
    const currentRoomCustomers = await this.prisma.tx.customer.findMany({
      where: { roomId: contract.roomId, deletedAt: null },
      select: { id: true },
    });

    const result = await this.prisma.tx.$transaction(async (tx) => {
      const updatedContract = await tx.contract.update({
        where: { id: contract.id },
        data: {
          status: ContractStatus.CANCELLED,
          actualMoveOutAt,
          terminationReason: reason,
          customerSnapshot:
            contract.customerSnapshot || snapshots.customerSnapshot,
          roomSnapshot: contract.roomSnapshot || snapshots.roomSnapshot,
          termsSnapshot: contract.termsSnapshot || snapshots.termsSnapshot,
        },
      });
      if (updatedContract.rentalCycleId && tx.rentalCycle?.updateMany) {
        await tx.rentalCycle.updateMany({
          where: {
            id: updatedContract.rentalCycleId,
            tenantId: updatedContract.tenantId,
          },
          data: {
            status: RentalCycleStatus.CANCELLED,
            actualEndAt: actualMoveOutAt,
            closedReason: reason,
          },
        });
      }
      const remainingActiveContracts = await tx.contract.count({
        where: {
          roomId: contract.roomId,
          status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
          id: { not: contract.id },
          deletedAt: null,
        },
      });
      const clearWholeRoom =
        remainingActiveContracts === 0 &&
        contract.room?.rentalType !== "SHARED";

      await tx.customer.updateMany({
        where: clearWholeRoom
          ? { roomId: contract.roomId, deletedAt: null }
          : {
              id: { in: contractCustomerIds },
              roomId: contract.roomId,
              deletedAt: null,
            },
        data: { roomId: null },
      });
      await tx.occupancy.updateMany({
        where: clearWholeRoom
          ? { roomId: contract.roomId, leftAt: null }
          : { contractId: contract.id, leftAt: null },
        data: { leftAt: actualMoveOutAt, leaveReason: reason },
      });
      await tx.contractParty.updateMany({
        where: { contractId: contract.id, leftAt: null },
        data: { leftAt: actualMoveOutAt },
      });
      await tx.deposit.updateMany({
        where: {
          contractId: contract.id,
          deletedAt: null,
          status: { in: [DepositStatus.DRAFT, DepositStatus.PENDING] },
        },
        data: { status: DepositStatus.CANCELLED },
      });

      const remainingCustomers = await tx.customer.count({
        where: { roomId: contract.roomId, deletedAt: null },
      });
      const targetRoomStatus =
        remainingActiveContracts > 0 || remainingCustomers > 0
          ? RoomStatus.OCCUPIED
          : roomTurnoverStatus;
      const updatedRoom = await tx.room.update({
        where: { id: contract.roomId },
        data: { status: targetRoomStatus },
      });

      return { updatedContract, updatedRoom, clearWholeRoom };
    });

    await this.auditService.log({
      action: "UPDATE",
      entity: this.entityName,
      entityId: contract.id,
      module: "Contracts",
      before: contract,
      after: result.updatedContract,
      userId,
    });

    return {
      mode: "CONTRACT_CANCELLED",
      contractId: contract.id,
      contractStatus: result.updatedContract.status,
      roomStatus: result.updatedRoom.status,
      removedCustomerIds: result.clearWholeRoom
        ? currentRoomCustomers.map((item) => item.id)
        : contractCustomerIds,
    };
  }

  private async detachCoRepresentative(
    contract: any,
    customer: any,
    userId: string,
    actualMoveOutAt: Date,
    reason: string,
    roomTurnoverStatus: RoomStatus,
  ) {
    await this.syncContractHistory(contract);
    const nextCoRepresentativeIds = contract.coRepresentativeIds.filter(
      (id: string) => id !== customer.id,
    );

    const result = await this.prisma.tx.$transaction(async (tx) => {
      const updatedContract = await tx.contract.update({
        where: { id: contract.id },
        data: { coRepresentativeIds: nextCoRepresentativeIds },
      });
      await tx.contractParty.updateMany({
        where: {
          contractId: contract.id,
          customerId: customer.id,
          role: "CO_REPRESENTATIVE",
          leftAt: null,
        },
        data: { leftAt: actualMoveOutAt },
      });
      await tx.occupancy.updateMany({
        where: {
          roomId: contract.roomId,
          customerId: customer.id,
          leftAt: null,
        },
        data: { leftAt: actualMoveOutAt, leaveReason: reason },
      });

      const otherActiveBindings = await tx.contract.count({
        where: {
          roomId: contract.roomId,
          deletedAt: null,
          status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
          OR: [
            { customerId: customer.id },
            { coRepresentativeIds: { has: customer.id } },
          ],
        },
      });
      if (otherActiveBindings === 0 && customer.roomId === contract.roomId) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { roomId: null },
        });
      }

      const activeContracts = await tx.contract.count({
        where: {
          roomId: contract.roomId,
          deletedAt: null,
          status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
        },
      });
      const remainingCustomers = await tx.customer.count({
        where: { roomId: contract.roomId, deletedAt: null },
      });
      const updatedRoom = await tx.room.update({
        where: { id: contract.roomId },
        data: {
          status:
            activeContracts > 0 || remainingCustomers > 0
              ? RoomStatus.OCCUPIED
              : roomTurnoverStatus,
        },
      });

      return { updatedContract, updatedRoom };
    });

    await this.auditService.log({
      action: "UPDATE",
      entity: this.entityName,
      entityId: contract.id,
      module: "Contracts",
      before: contract,
      after: result.updatedContract,
      userId,
    });

    return {
      mode: "CO_REPRESENTATIVE_DETACHED",
      contractId: contract.id,
      contractStatus: result.updatedContract.status,
      roomStatus: result.updatedRoom.status,
      removedCustomerIds: [customer.id],
    };
  }

  private async detachSingleOccupant(
    customer: any,
    contract: any,
    targetRoomId: string,
    userId: string,
    actualMoveOutAt: Date,
    reason: string,
    roomTurnoverStatus: RoomStatus,
  ) {
    const before = { ...customer };
    const result = await this.prisma.tx.$transaction(async (tx) => {
      await tx.occupancy.updateMany({
        where: {
          roomId: targetRoomId,
          customerId: customer.id,
          leftAt: null,
        },
        data: { leftAt: actualMoveOutAt, leaveReason: reason },
      });
      if (contract) {
        await tx.contractParty.updateMany({
          where: {
            contractId: contract.id,
            customerId: customer.id,
            leftAt: null,
          },
          data: { leftAt: actualMoveOutAt },
        });
      }

      const updatedCustomer =
        customer.roomId === targetRoomId
          ? await tx.customer.update({
              where: { id: customer.id },
              data: { roomId: null },
            })
          : customer;
      const activeContracts = await tx.contract.count({
        where: {
          roomId: targetRoomId,
          deletedAt: null,
          status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
        },
      });
      const remainingCustomers = await tx.customer.count({
        where: { roomId: targetRoomId, deletedAt: null },
      });
      const updatedRoom = await tx.room.update({
        where: { id: targetRoomId },
        data: {
          status:
            activeContracts > 0 || remainingCustomers > 0
              ? RoomStatus.OCCUPIED
              : roomTurnoverStatus,
        },
      });
      return { updatedCustomer, updatedRoom };
    });

    await this.auditService.log({
      action: "UPDATE",
      entity: "Customer",
      entityId: customer.id,
      module: "Contracts",
      before,
      after: result.updatedCustomer,
      userId,
    });

    return {
      mode: contract
        ? "TERMINAL_CONTRACT_OCCUPANT_DETACHED"
        : "ROOMMATE_DETACHED",
      contractId: contract?.id || null,
      contractStatus: contract?.status || null,
      roomStatus: result.updatedRoom.status,
      removedCustomerIds: [customer.id],
    };
  }

  private resolveRoomTurnoverStatus(
    value?: string | null,
  ): "AVAILABLE" | "CLEANING" | "MAINTENANCE" {
    if (value === "CLEANING") return RoomStatus.CLEANING;
    if (value === "MAINTENANCE") return RoomStatus.MAINTENANCE;
    return RoomStatus.AVAILABLE;
  }

  private async withContractSnapshots(data: any) {
    const db = this.prisma.tx as any;
    const [customer, room] = await Promise.all([
      data.customerId && db.customer?.findUnique
        ? db.customer.findUnique({ where: { id: data.customerId } })
        : Promise.resolve(data.customer || null),
      data.roomId && db.room?.findUnique
        ? db.room.findUnique({
            where: { id: data.roomId },
            include: {
              building: {
                select: { id: true, code: true, name: true, address: true },
              },
              floor: { select: { id: true, name: true, level: true } },
            },
          })
        : Promise.resolve(data.room || null),
    ]);

    const customerSnapshot = this.asJson({
      id: customer?.id || data.customerId,
      fullName: customer?.fullName || data.customer?.fullName || null,
      phone: customer?.phone || data.customer?.phone || null,
      email: customer?.email || data.customer?.email || null,
      identityNo: customer?.identityNo || data.customer?.identityNo || null,
      gender: customer?.gender || data.customer?.gender || null,
      birthDate: customer?.birthDate || data.customer?.birthDate || null,
      nationality: customer?.nationality || data.customer?.nationality || null,
      address: customer?.address || data.customer?.address || null,
      emergencyPhone:
        customer?.emergencyPhone || data.customer?.emergencyPhone || null,
      idImages: customer?.idImages || data.customer?.idImages || [],
    });
    const roomSnapshot = this.asJson({
      id: room?.id || data.roomId,
      code: room?.code || data.room?.code || null,
      name: room?.name || data.room?.name || null,
      rentalType: room?.rentalType || data.room?.rentalType || null,
      building: room?.building || data.room?.building || null,
      floor: room?.floor || data.room?.floor || null,
    });
    const termsSnapshot = this.asJson({
      code: data.code,
      status: data.status,
      startDate: data.startDate,
      endDate: data.endDate,
      signedAt: data.signedAt,
      firstPaymentDate: data.firstPaymentDate,
      monthlyRent: Number(data.monthlyRent || 0),
      depositMoney: Number(data.depositMoney || 0),
      memberCount: data.memberCount || 1,
      purpose: data.purpose || null,
      coRepresentativeIds: data.coRepresentativeIds || [],
      attachments: data.attachments || [],
    });

    return {
      ...data,
      customerSnapshot: data.customerSnapshot || customerSnapshot,
      roomSnapshot: data.roomSnapshot || roomSnapshot,
      termsSnapshot: data.termsSnapshot || termsSnapshot,
    };
  }

  private async syncContractHistory(contract: any, dbOverride?: any) {
    const db = (dbOverride || this.prisma.tx) as any;
    if (
      !contract?.id ||
      !contract?.tenantId ||
      !db.contractParty ||
      !db.occupancy
    )
      return;

    const customerIds = Array.from(
      new Set(
        [
          contract.customerId,
          ...(Array.isArray(contract.coRepresentativeIds)
            ? contract.coRepresentativeIds
            : []),
        ].filter(Boolean),
      ),
    ) as string[];
    const customers =
      customerIds.length > 0
        ? await db.customer.findMany({ where: { id: { in: customerIds } } })
        : [];
    const customerById = new Map(customers.map((item: any) => [item.id, item]));
    const isCurrentContract = ![
      ContractStatus.TERMINATED,
      ContractStatus.EXPIRED,
      ContractStatus.CANCELLED,
    ].includes(contract.status);
    const isActiveOccupancy = ACTIVE_LIKE_CONTRACT_STATUSES.includes(
      contract.status,
    );
    const now = contract.actualMoveOutAt || new Date();

    for (const customerId of customerIds) {
      const customer = customerById.get(customerId) as any;
      const role =
        customerId === contract.customerId ? "PRIMARY" : "CO_REPRESENTATIVE";
      const identitySnapshot = this.asJson({
        id: customerId,
        fullName: customer?.fullName || null,
        phone: customer?.phone || null,
        email: customer?.email || null,
        identityNo: customer?.identityNo || null,
        gender: customer?.gender || null,
        birthDate: customer?.birthDate || null,
        nationality: customer?.nationality || null,
        address: customer?.address || null,
        emergencyPhone: customer?.emergencyPhone || null,
        idImages: customer?.idImages || [],
      });
      const existingParty = await db.contractParty.findFirst({
        where: { contractId: contract.id, customerId, role },
      });
      if (existingParty) {
        await db.contractParty.update({
          where: { id: existingParty.id },
          data: {
            identitySnapshot,
            leftAt: isCurrentContract ? null : existingParty.leftAt || now,
          },
        });
      } else {
        await db.contractParty.create({
          data: {
            tenantId: contract.tenantId,
            contractId: contract.id,
            customerId,
            role,
            identitySnapshot,
            signedAt: contract.signedAt || null,
            leftAt: isCurrentContract ? null : now,
          },
        });
      }

      if (isActiveOccupancy) {
        const openOccupancy = await db.occupancy.findFirst({
          where: {
            tenantId: contract.tenantId,
            roomId: contract.roomId,
            customerId,
            leftAt: null,
            OR: [{ contractId: contract.id }, { contractId: null }],
          },
        });
        if (openOccupancy) {
          await db.occupancy.update({
            where: { id: openOccupancy.id },
            data: {
              contractId: contract.id,
              rentalCycleId: contract.rentalCycleId || null,
              role,
            },
          });
        } else {
          const occupancyId = `occ_${createHash("sha256")
            .update(`${contract.tenantId}:${contract.id}:${customerId}`)
            .digest("hex")
            .slice(0, 32)}`;
          await db.occupancy.upsert({
            where: { id: occupancyId },
            update: {
              roomId: contract.roomId,
              contractId: contract.id,
              rentalCycleId: contract.rentalCycleId || null,
              role,
              leftAt: null,
              leaveReason: null,
            },
            create: {
              id: occupancyId,
              tenantId: contract.tenantId,
              roomId: contract.roomId,
              customerId,
              contractId: contract.id,
              rentalCycleId: contract.rentalCycleId || null,
              role,
              joinedAt: contract.startDate || new Date(),
            },
          });
        }
      }
    }

    await db.contractParty.updateMany({
      where: {
        contractId: contract.id,
        role: "CO_REPRESENTATIVE",
        customerId: {
          notIn: customerIds.filter((id) => id !== contract.customerId),
        },
        leftAt: null,
      },
      data: { leftAt: now },
    });

    if (isActiveOccupancy) {
      await db.customer.updateMany({
        where: { id: { in: customerIds } },
        data: { roomId: contract.roomId },
      });
    } else {
      await db.occupancy.updateMany({
        where: {
          tenantId: contract.tenantId,
          contractId: contract.id,
          leftAt: null,
        },
        data: {
          leftAt: now,
          leaveReason: contract.terminationReason || "Hợp đồng đã kết thúc",
        },
      });
    }
  }

  private asJson(value: unknown) {
    return JSON.parse(JSON.stringify(value));
  }

  private async completeSettlementRefundCommand(
    id: string,
    userId: string,
    tenantId: string,
    note: string | undefined,
    idempotencyKey?: string,
  ) {
    const completionKey = this.requireSettlementIdempotencyKey(idempotencyKey);
    const completionHash = this.hashSettlementRequest({
      contractId: id,
      tenantId,
      note: String(note || "").trim() || null,
    });
    return this.runSettlementSerializable(async (tx: any) => {
      await this.lockSettlementContract(tx, tenantId, id);
      const contract = await tx.contract.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!contract) throw new NotFoundException(`Contract with ID ${id} not found`);
      const settlement = await tx.contractSettlement.findFirst({
        where: { contractId: id, tenantId },
      });
      if (!settlement) throw new BadRequestException("SETTLEMENT_REFUND_OPERATION_NOT_FOUND");
      const details = (settlement.details || {}) as any;
      const priorCompletion = details.refundCompletion;
      if (priorCompletion) {
        if (
          priorCompletion.idempotencyKey === completionKey &&
          priorCompletion.requestHash === completionHash
        ) {
          return { ...priorCompletion.result, replayed: true };
        }
        throw new ConflictException("SETTLEMENT_REFUND_ALREADY_COMPLETED");
      }
      const receiptId = details.refundReceiptId;
      if (!receiptId) throw new BadRequestException("SETTLEMENT_REFUND_PENDING_NOT_FOUND");
      const receipt = await tx.receipt.findFirst({
        where: { id: receiptId, tenantId, status: ReceiptStatus.PENDING },
      });
      if (!receipt) throw new BadRequestException("SETTLEMENT_REFUND_PENDING_NOT_FOUND");

      const operations = await tx.depositOperation.findMany({
        where: {
          tenantId,
          contractId: id,
          receiptId,
          status: DepositOperationStatus.PENDING,
          type: DepositOperationType.CANCEL,
        },
      });
      for (const operation of operations) {
        await this.lockSettlementDeposit(tx, tenantId, operation.sourceDepositId);
        const refundAmount = this.roundMoney(
          Number((operation.result as any)?.refundAmount || 0),
        );
        if (refundAmount <= 0) continue;
        const balance = await tx.depositLedgerEntry.aggregate({
          where: { tenantId, depositId: operation.sourceDepositId },
          _sum: { balanceEffect: true },
        });
        if (refundAmount > Number(balance._sum?.balanceEffect || 0)) {
          throw new BadRequestException("SETTLEMENT_REFUND_EXCEEDS_DEPOSIT_BALANCE");
        }
        await tx.depositLedgerEntry.create({
          data: {
            tenantId,
            rentalCycleId: operation.rentalCycleId,
            depositId: operation.sourceDepositId,
            contractId: id,
            operationId: operation.id,
            type: DepositLedgerEntryType.REFUND,
            amount: refundAmount,
            balanceEffect: -refundAmount,
            idempotencyKey: `${completionKey}:refund:${operation.id}`,
            sourceType: "RECEIPT",
            sourceId: receiptId,
            metadata: { settlementId: settlement.id },
            createdBy: userId,
          },
        });
        const changed = await tx.depositOperation.updateMany({
          where: {
            id: operation.id,
            tenantId,
            status: DepositOperationStatus.PENDING,
          },
          data: {
            status: DepositOperationStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
        if (changed.count !== 1) {
          throw new ConflictException("SETTLEMENT_REFUND_CONCURRENT_CONFLICT");
        }
      }
      const receiptChanged = await tx.receipt.updateMany({
        where: { id: receiptId, tenantId, status: ReceiptStatus.PENDING },
        data: {
          status: ReceiptStatus.COMPLETED,
          description: note
            ? `${receipt.description || ""}\nCompleted note: ${note}`.trim()
            : receipt.description,
        },
      });
      if (receiptChanged.count !== 1) {
        throw new ConflictException("SETTLEMENT_REFUND_CONCURRENT_CONFLICT");
      }
      if (details.refundTaskId) {
        await tx.task.updateMany({
          where: { id: details.refundTaskId, tenantId, status: "TODO" as any },
          data: { status: "DONE" as any },
        });
      }
      const result = {
        receiptId,
        amount: this.roundMoney(Number(receipt.amount || 0)),
        status: ReceiptStatus.COMPLETED,
      };
      const nextDetails = this.asJson({
        ...details,
        refundCompletion: {
          idempotencyKey: completionKey,
          requestHash: completionHash,
          result,
        },
      });
      await tx.contractSettlement.update({
        where: { id: settlement.id },
        data: { details: nextDetails },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          module: "Contracts",
          entity: "Receipt",
          entityId: receiptId,
          action: "UPDATE",
          before: receipt,
          after: result,
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId,
          aggregateType: "ContractSettlement",
          aggregateId: settlement.id,
          eventName: "contract.settlement.refunded",
          payload: this.asJson({
            tenantId,
            contractId: id,
            rentalCycleId: contract.rentalCycleId,
            receiptId,
            amount: result.amount,
          }),
          idempotencyKey: `${completionKey}:settlement-refunded`,
        },
      });
      return result;
    });
  }

  /**
   * CORE-09.01's only HTTP-addressable settlement command.  Its durable
   * ContractSettlement row is both the result record and the claim: once it
   * exists, an identical retry is replayed and every other request is
   * rejected.  Financial writes, audit and outbox are committed together.
   */
  private async settleAndTerminateContract(
    id: string,
    userId: string,
    tenantId: string,
    input: ContractSettlementInput,
    idempotencyKey?: string,
  ): Promise<Contract> {
    const commandKey = this.requireSettlementIdempotencyKey(idempotencyKey);
    const requestHash = this.hashSettlementRequest({
      contractId: id,
      tenantId,
      input,
    });

    return this.runSettlementSerializable(async (tx: any) => {
      await this.lockSettlementContract(tx, tenantId, id);
      const contract = await tx.contract.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { customer: true, room: true },
      });
      if (!contract) throw new NotFoundException(`Contract with ID ${id} not found`);
      if (!contract.rentalCycleId) {
        throw new BadRequestException("SETTLEMENT_RENTAL_CYCLE_REQUIRED");
      }

      const existing = await tx.contractSettlement.findFirst({
        where: { contractId: id, tenantId },
      });
      if (existing) {
        const command = (existing.details as any)?.command;
        if (
          command?.idempotencyKey === commandKey &&
          command?.requestHash === requestHash
        ) {
          const replay = await tx.contract.findFirst({
            where: { id, tenantId, deletedAt: null },
          });
          if (!replay) throw new ConflictException("SETTLEMENT_REPLAY_CONTRACT_MISSING");
          return replay;
        }
        throw new ConflictException("SETTLEMENT_ALREADY_COMPLETED");
      }
      if (![ContractStatus.ACTIVE, ContractStatus.EXPIRING].includes(contract.status)) {
        throw new BadRequestException(
          `Cannot finalize contract in ${contract.status} status. Only ACTIVE or EXPIRING is allowed.`,
        );
      }

      const cycle = await tx.rentalCycle.findFirst({
        where: {
          id: contract.rentalCycleId,
          tenantId,
          customerId: contract.customerId,
          roomId: contract.roomId,
        },
      });
      if (!cycle) throw new BadRequestException("SETTLEMENT_RENTAL_CYCLE_SCOPE_MISMATCH");

      // The authoritative balance pass augments the preview breakdown with
      // finalChargeCreditAmount; keep the transaction-local value open for
      // that validated augmentation.
      let settlement: any = await this.composeSettlementPreview(contract, input);
      const deposits = await tx.deposit.findMany({
        where: {
          tenantId,
          contractId: contract.id,
          rentalCycleId: contract.rentalCycleId,
          customerId: contract.customerId,
          roomId: contract.roomId,
          deletedAt: null,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      for (const deposit of deposits) {
        await this.lockSettlementDeposit(tx, tenantId, deposit.id);
      }
      const balances = await Promise.all(
        deposits.map(async (deposit: any) => ({
          deposit,
          balance: this.roundMoney(
            Number(
              (
                await tx.depositLedgerEntry.aggregate({
                  where: { tenantId, depositId: deposit.id },
                  _sum: { balanceEffect: true },
                })
              )._sum?.balanceEffect || 0,
            ),
          ),
        })),
      );
      const availableDepositAmount = this.roundMoney(
        balances.reduce((sum: number, row: any) => sum + Math.max(row.balance, 0), 0),
      );

      await this.lockSettlementInvoices(tx, tenantId, contract.id);
      const oldInvoices = await tx.invoice.findMany({
        where: {
          tenantId,
          contractId: contract.id,
          rentalCycleId: contract.rentalCycleId,
          customerId: contract.customerId,
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
          billingKind: true,
          adjustmentOfInvoiceId: true,
          total: true,
          paidAmount: true,
          creditAmount: true,
          baseInvoiceKey: true,
          dueDate: true,
          createdAt: true,
        },
      });
      const settlementBaseInvoiceKey = `SETTLEMENT:${contract.id}`;
      const priorDebt = this.buildOutstandingInvoiceDebt(
        oldInvoices.filter(
          (invoice: any) => invoice.baseInvoiceKey !== settlementBaseInvoiceKey,
        ),
      );
      const priorOutstanding = priorDebt.total;
      settlement = this.applyAuthoritativeSettlementBalance(
        settlement,
        priorOutstanding,
        availableDepositAmount,
      );
      const finalOutstanding = settlement.totals.netReceivable;

      // Create the durable claim before the financial documents.  A failure
      // rolls the whole serializable transaction back, so there is no partial
      // claim and no second commit on retry.
      const claim = await tx.contractSettlement.create({
        data: {
          tenantId,
          contractId: contract.id,
          rentalCycleId: contract.rentalCycleId,
          actualMoveOutAt: settlement.actualMoveOutDate,
          roomTurnoverStatus: settlement.roomTurnoverStatus,
          chargeTotal: settlement.totals.chargeTotal,
          creditTotal: settlement.totals.creditTotal,
          netReceivable: finalOutstanding,
          refundToCustomer: settlement.totals.refundToCustomer,
          utilitySnapshot: settlement.utilitySnapshot,
          details: this.asJson({
            command: { idempotencyKey: commandKey, requestHash },
            settlement,
            priorOutstanding,
            finalOutstanding,
            depositOperations: [],
          }),
        } as any,
      });

      const invoice =
        settlement.totals.chargeTotal > 0
          ? await tx.invoice.create({
              data: {
                tenantId,
                code: `FIN-SET-${contract.id}`,
                period: this.getSettlementPeriod(settlement.actualMoveOutDate),
                contractId: contract.id,
                rentalCycleId: contract.rentalCycleId,
                customerId: contract.customerId,
                status: InvoiceStatus.ISSUED,
                billingKind: "CONTRACT_SETTLEMENT",
                baseInvoiceKey: settlementBaseInvoiceKey,
                dueDate: settlement.actualMoveOutDate,
                subtotal: settlement.totals.chargeTotal,
                discount: 0,
                total: settlement.totals.chargeTotal,
                paidAmount: 0,
                creditAmount:
                  settlement.accountingBreakdown.finalChargeCreditAmount,
                items: {
                  create: settlement.invoiceItems.map((item: any) => ({
                    tenantId,
                    type: item.type,
                    description: item.description,
                    quantity: 1,
                    unitPrice: item.amount,
                    amount: item.amount,
                  })),
                },
              },
            })
          : null;

      // A deposit offset is an append-only credit against the exact unpaid
      // invoices.  The CreditNote preserves source evidence; creditAmount is
      // only the invoice's current aggregate, never a rewrite of its items or
      // original amount.  The surrounding settlement claim/lock makes this
      // replay- and concurrency-safe.
      let oldDebtDepositCredit = this.roundMoney(
        Math.min(
          priorOutstanding,
          settlement.accountingBreakdown.depositAppliedAmount,
        ),
      );
      const debtCredits: Array<{ invoiceId: string; amount: number }> = [];
      for (const debt of priorDebt.rows) {
        if (oldDebtDepositCredit <= 0) break;
        const amount = this.roundMoney(
          Math.min(debt.outstanding, oldDebtDepositCredit),
        );
        if (amount <= 0) continue;
        await tx.creditNote.create({
          data: {
            tenantId,
            customerId: contract.customerId,
            sourceInvoiceId: debt.invoice.id,
            appliedInvoiceId: debt.invoice.id,
            amount,
            remainingAmount: 0,
            reason: `Cấn cọc quyết toán hợp đồng ${contract.code}`,
          },
        });
        const credited = await tx.invoice.updateMany({
          where: {
            id: debt.invoice.id,
            tenantId,
            creditAmount: debt.invoice.creditAmount,
          },
          data: {
            creditAmount: this.roundMoney(
              Number(debt.invoice.creditAmount || 0) + amount,
            ),
          },
        });
        if (credited.count !== 1) {
          throw new ConflictException("SETTLEMENT_OLD_DEBT_CONCURRENT_CONFLICT");
        }
        debtCredits.push({ invoiceId: debt.invoice.id, amount });
        oldDebtDepositCredit = this.roundMoney(oldDebtDepositCredit - amount);
      }
      if (oldDebtDepositCredit > 0) {
        throw new ConflictException("SETTLEMENT_OLD_DEBT_ALLOCATION_MISMATCH");
      }

      const refundReceipt =
        settlement.totals.refundToCustomer > 0
          ? await tx.receipt.create({
              data: {
                tenantId,
                code: `RCT-SET-${contract.id}`,
                amount: settlement.totals.refundToCustomer,
                status: settlement.refund.receiptStatus,
                description: settlement.refund.reason
                  ? `Contract settlement refund for ${contract.code} - ${settlement.refund.reason}`
                  : `Contract settlement refund for ${contract.code}`,
                date: settlement.actualMoveOutDate,
              },
            })
          : null;
      const refundTask =
        refundReceipt && settlement.refund.receiptStatus === ReceiptStatus.PENDING
          ? await tx.task.create({
              data: {
                tenantId,
                title: `Xu ly hoan tien quyet toan ${contract.code}`,
                description: settlement.refund.reason || null,
                status: "TODO" as any,
                priority: "HIGH" as any,
                dueDate: settlement.actualMoveOutDate,
              },
            })
          : null;

      const usage = this.allocateSettlementDeposit(
        balances,
        Number(settlement.accountingBreakdown.depositAppliedAmount || 0),
        Number(settlement.accountingBreakdown.depositRefundAmount || 0),
      );
      const depositOperations: any[] = [];
      for (const row of usage) {
        if (row.deductAmount <= 0 && row.refundAmount <= 0) continue;
        const operation = await tx.depositOperation.create({
          data: {
            tenantId,
            rentalCycleId: contract.rentalCycleId,
            sourceDepositId: row.deposit.id,
            contractId: contract.id,
            // The enum has no SETTLEMENT member. CANCEL is the existing
            // terminal deposit operation; details preserve the exact purpose.
            type: DepositOperationType.CANCEL,
            status:
              row.refundAmount > 0 &&
              settlement.refund.receiptStatus === ReceiptStatus.PENDING
                ? DepositOperationStatus.PENDING
                : DepositOperationStatus.COMPLETED,
            idempotencyKey: `${commandKey}:deposit:${row.deposit.id}`,
            requestHash: this.hashSettlementRequest({
              requestHash,
              depositId: row.deposit.id,
              deductAmount: row.deductAmount,
              refundAmount: row.refundAmount,
            }),
            result: {
              purpose: "CONTRACT_SETTLEMENT",
              deductAmount: row.deductAmount,
              refundAmount: row.refundAmount,
              receiptId: refundReceipt?.id || null,
            },
            receiptId: refundReceipt?.id || null,
            createdBy: userId,
            completedAt:
              row.refundAmount > 0 &&
              settlement.refund.receiptStatus === ReceiptStatus.PENDING
                ? null
                : new Date(),
          },
        });
        if (row.deductAmount > 0) {
          await tx.depositLedgerEntry.create({
            data: {
              tenantId,
              rentalCycleId: contract.rentalCycleId,
              depositId: row.deposit.id,
              contractId: contract.id,
              operationId: operation.id,
              type: DepositLedgerEntryType.DEDUCT,
              amount: row.deductAmount,
              balanceEffect: -row.deductAmount,
              idempotencyKey: `${commandKey}:deposit:${row.deposit.id}:deduct`,
              sourceType: "CONTRACT_SETTLEMENT",
              sourceId: claim.id,
              metadata: { invoiceId: invoice?.id || null },
              createdBy: userId,
            },
          });
        }
        if (
          row.refundAmount > 0 &&
          settlement.refund.receiptStatus === ReceiptStatus.COMPLETED
        ) {
          await tx.depositLedgerEntry.create({
            data: {
              tenantId,
              rentalCycleId: contract.rentalCycleId,
              depositId: row.deposit.id,
              contractId: contract.id,
              operationId: operation.id,
              type: DepositLedgerEntryType.REFUND,
              amount: row.refundAmount,
              balanceEffect: -row.refundAmount,
              idempotencyKey: `${commandKey}:deposit:${row.deposit.id}:refund`,
              sourceType: "RECEIPT",
              sourceId: refundReceipt?.id || claim.id,
              metadata: { settlementId: claim.id },
              createdBy: userId,
            },
          });
        }
        depositOperations.push({
          id: operation.id,
          depositId: row.deposit.id,
          deductAmount: row.deductAmount,
          refundAmount: row.refundAmount,
          status: operation.status,
        });
      }

      const terminationReason = String(
        input.note || "Trả phòng và quyết toán hợp đồng",
      ).trim();
      const changed = await tx.contract.updateMany({
        where: {
          id: contract.id,
          tenantId,
          status: { in: [ContractStatus.ACTIVE, ContractStatus.EXPIRING] },
        },
        data: {
          status: ContractStatus.TERMINATED,
          actualMoveOutAt: settlement.actualMoveOutDate,
          terminationReason,
        },
      });
      if (changed.count !== 1) throw new ConflictException("SETTLEMENT_CONCURRENT_CONFLICT");
      await tx.rentalCycle.updateMany({
        where: {
          id: contract.rentalCycleId,
          tenantId,
          customerId: contract.customerId,
          roomId: contract.roomId,
        },
        data: {
          status: RentalCycleStatus.CLOSED,
          actualEndAt: settlement.actualMoveOutDate,
          closedReason: terminationReason,
        },
      });
      const updatedContract = await tx.contract.findFirst({
        where: { id: contract.id, tenantId, deletedAt: null },
      });
      if (!updatedContract) throw new ConflictException("SETTLEMENT_CONTRACT_MISSING_AFTER_CLAIM");
      await this.applyCanonicalMoveOutLifecycle(tx, updatedContract, {
        actualMoveOutAt: settlement.actualMoveOutDate,
        reason: terminationReason,
        requestedRoomStatus: settlement.roomTurnoverStatus,
      });

      const details = this.asJson({
        command: { idempotencyKey: commandKey, requestHash },
        settlement,
        priorOutstanding,
        finalOutstanding,
        invoiceId: invoice?.id || null,
        refundReceiptId: refundReceipt?.id || null,
        refundTaskId: refundTask?.id || null,
        depositOperations,
        debtCredits,
      });
      await tx.contractSettlement.update({
        where: { id: claim.id },
        data: { details },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          module: "Contracts",
          entity: "ContractSettlement",
          entityId: claim.id,
          action: "CREATE",
          before: null,
          after: details,
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId,
          aggregateType: "ContractSettlement",
          aggregateId: claim.id,
          eventName: "contract.settlement.completed",
          payload: this.asJson({
            tenantId,
            contractId: contract.id,
            customerId: contract.customerId,
            rentalCycleId: contract.rentalCycleId,
            invoiceId: invoice?.id || null,
            refundReceiptId: refundReceipt?.id || null,
            finalOutstanding,
          }),
          idempotencyKey: `${commandKey}:settlement-completed`,
        },
      });
      return updatedContract;
    });
  }

  private allocateSettlementDeposit(
    balances: Array<{ deposit: any; balance: number }>,
    deductAmount: number,
    refundAmount: number,
  ) {
    let remainingDeduct = this.roundMoney(deductAmount);
    let remainingRefund = this.roundMoney(refundAmount);
    return balances.map((row) => {
      const available = this.roundMoney(Math.max(row.balance, 0));
      const deduct = this.roundMoney(Math.min(available, remainingDeduct));
      remainingDeduct = this.roundMoney(remainingDeduct - deduct);
      const refund = this.roundMoney(
        Math.min(this.roundMoney(available - deduct), remainingRefund),
      );
      remainingRefund = this.roundMoney(remainingRefund - refund);
      return { deposit: row.deposit, deductAmount: deduct, refundAmount: refund };
    });
  }

  private requireSettlementIdempotencyKey(value?: string) {
    const key = String(value || "").trim();
    if (key.length < 8 || key.length > 128) {
      throw new BadRequestException("IDEMPOTENCY_KEY_REQUIRED");
    }
    return key;
  }

  private hashSettlementRequest(value: unknown) {
    return createHash("sha256")
      .update(this.stableSettlementStringify(value))
      .digest("hex");
  }

  private async runTransferSerializable<T>(
    callback: (tx: any) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.tx.$transaction(callback, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: any) {
        const retryable =
          error?.code === "P2034" ||
          (error?.code === "P2010" && error?.meta?.code === "40001") ||
          error?.code === "P2002";
        if (retryable && attempt < 3) continue;
        if (retryable) throw new ConflictException("TRANSFER_CONCURRENT_CONFLICT");
        throw error;
      }
    }
    throw new ConflictException("TRANSFER_CONCURRENT_CONFLICT");
  }

  private stableSettlementStringify(value: any): string {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    if (Prisma.Decimal.isDecimal(value)) return JSON.stringify(value.toFixed(2));
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableSettlementStringify(item)).join(",")}]`;
    }
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${this.stableSettlementStringify(value[key])}`,
      )
      .join(",")}}`;
  }

  private async runSettlementSerializable<T>(
    callback: (tx: any) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.tx.$transaction(callback, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: any) {
        const serializationConflict =
          error?.code === "P2034" ||
          (error?.code === "P2010" && error?.meta?.code === "40001");
        if (serializationConflict && attempt < 3) continue;
        if (serializationConflict) {
          throw new ConflictException("SETTLEMENT_CONCURRENT_CONFLICT");
        }
        throw error;
      }
    }
    throw new ConflictException("SETTLEMENT_CONCURRENT_CONFLICT");
  }

  private async runRenewalSerializable<T>(
    callback: (tx: any) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.tx.$transaction(callback, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: any) {
        const retryable =
          error?.code === "P2034" ||
          (error?.code === "P2010" && error?.meta?.code === "40001") ||
          error?.code === "P2002";
        if (retryable && attempt < 3) continue;
        if (retryable) throw new ConflictException("RENEWAL_CONCURRENT_CONFLICT");
        throw error;
      }
    }
    throw new ConflictException("RENEWAL_CONCURRENT_CONFLICT");
  }

  private async lockSettlementContract(tx: any, tenantId: string, contractId: string) {
    if (typeof tx.$queryRaw !== "function") {
      throw new ConflictException("SETTLEMENT_LOCK_UNAVAILABLE");
    }
    const rows = (await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Contract" WHERE "id" = ${contractId} AND "tenantId" = ${tenantId} AND "deletedAt" IS NULL FOR UPDATE`,
    )) as Array<{ id: string }>;
    if (!rows.length) throw new NotFoundException(`Contract with ID ${contractId} not found`);
  }

  private async lockTransferRooms(
    tx: any,
    tenantId: string,
    sourceRoomId: string,
    targetRoomId: string,
  ) {
    for (const roomId of [sourceRoomId, targetRoomId].sort()) {
      await this.lockRoomLifecycle(tx, tenantId, roomId);
    }
  }

  private async assertTransferTargetCapacity(tx: any, tenantId: string, room: any) {
    if (![RoomStatus.AVAILABLE, RoomStatus.RESERVED, RoomStatus.OCCUPIED].includes(room.status)) {
      throw new ConflictException("TRANSFER_TARGET_ROOM_NOT_OPERATIONAL");
    }
    const [openOccupancies, activeHolds, activeBindings] = await Promise.all([
      tx.occupancy.count({ where: { tenantId, roomId: room.id, leftAt: null } }),
      tx.roomHold?.count
        ? tx.roomHold.count({
            where: { tenantId, roomId: room.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
          })
        : 0,
      tx.contract.count({
        where: {
          tenantId, roomId: room.id, deletedAt: null,
          status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
        },
      }),
    ]);
    if (room.rentalType === "WHOLE") {
      if (openOccupancies > 0 || activeHolds > 0 || activeBindings > 0) {
        throw new ConflictException("TRANSFER_TARGET_WHOLE_ROOM_UNAVAILABLE");
      }
      return;
    }
    const capacity = Math.max(1, Number(room.capacity || room.bedCount || 1));
    // An active hold reserves a resource even before it becomes an occupancy.
    if (openOccupancies + activeHolds + 1 > capacity) {
      throw new ConflictException("TRANSFER_TARGET_SHARED_CAPACITY_EXCEEDED");
    }
  }

  private async clearCustomerRoomWhenUnbound(
    tx: any,
    tenantId: string,
    customerId: string,
    roomId: string,
  ) {
    await tx.customer.updateMany({
      where: {
        id: customerId, tenantId, roomId,
        occupancies: { none: { tenantId, roomId, leftAt: null } },
        contractParties: {
          none: {
            tenantId, leftAt: null,
            contract: { roomId, deletedAt: null, status: { in: ACTIVE_LIKE_CONTRACT_STATUSES } },
          },
        },
      },
      data: { roomId: null },
    });
  }

  /** Recompute status from current resources; callers have already locked room. */
  private async refreshRoomLifecycleStatus(tx: any, tenantId: string, roomId: string) {
    const [openOccupancies, activeContracts, activeHolds, room] = await Promise.all([
      tx.occupancy.count({ where: { tenantId, roomId, leftAt: null } }),
      tx.contract.count({
        where: { tenantId, roomId, deletedAt: null, status: { in: ACTIVE_LIKE_CONTRACT_STATUSES } },
      }),
      tx.roomHold?.count
        ? tx.roomHold.count({
            where: { tenantId, roomId, status: "ACTIVE", expiresAt: { gt: new Date() } },
          })
        : 0,
      tx.room.findFirst({ where: { id: roomId, tenantId, deletedAt: null } }),
    ]);
    if (!room) throw new NotFoundException("ROOM_LIFECYCLE_ROOM_NOT_FOUND");
    const status =
      openOccupancies > 0 || activeContracts > 0
        ? RoomStatus.OCCUPIED
        : activeHolds > 0
          ? RoomStatus.RESERVED
          : room.status === RoomStatus.CLEANING || room.status === RoomStatus.MAINTENANCE
            ? room.status
            : RoomStatus.AVAILABLE;
    return tx.room.update({ where: { id: roomId }, data: { status } });
  }

  private async lockSettlementDeposit(tx: any, tenantId: string, depositId: string) {
    const rows = (await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Deposit" WHERE "id" = ${depositId} AND "tenantId" = ${tenantId} AND "deletedAt" IS NULL FOR UPDATE`,
    )) as Array<{ id: string }>;
    if (!rows.length) throw new ConflictException("SETTLEMENT_DEPOSIT_LOCK_FAILED");
  }

  private async lockSettlementInvoices(
    tx: any,
    tenantId: string,
    contractId: string,
  ) {
    if (typeof tx.$queryRaw !== "function") {
      throw new ConflictException("SETTLEMENT_LOCK_UNAVAILABLE");
    }
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Invoice" WHERE "tenantId" = ${tenantId} AND "contractId" = ${contractId} AND "deletedAt" IS NULL FOR UPDATE`,
    );
  }

  /**
   * The sole room/occupancy transition used after a contract leaves.  It is
   * deliberately independent from financial settlement: callers invoke it in
   * the same database transaction only after their contract status transition
   * has succeeded.  This prevents an old internal finalizer from clearing a
   * shared room simply because its own contract was the last one it counted.
   */
  private async applyCanonicalMoveOutLifecycle(
    tx: any,
    contract: any,
    input: {
      actualMoveOutAt: Date;
      reason: string;
      requestedRoomStatus: RoomStatus;
    },
  ) {
    await this.lockRoomLifecycle(tx, contract.tenantId, contract.roomId);

    const targetCustomerIds = Array.from(
      new Set(
        [
          contract.customerId,
          ...(Array.isArray(contract.coRepresentativeIds)
            ? contract.coRepresentativeIds
            : []),
        ].filter(Boolean),
      ),
    );
    const occupancyScope: any = {
      tenantId: contract.tenantId,
      roomId: contract.roomId,
      contractId: contract.id,
      leftAt: null,
    };
    if (contract.rentalCycleId) occupancyScope.rentalCycleId = contract.rentalCycleId;

    // Scope by the target contract (and its cycle when present), never by a
    // "last active contract" room-wide condition.  ContractParty is append
    // only in practice: leftAt marks departure without changing snapshots.
    await tx.occupancy.updateMany({
      where: occupancyScope,
      data: { leftAt: input.actualMoveOutAt, leaveReason: input.reason },
    });
    await tx.contractParty.updateMany({
      where: {
        tenantId: contract.tenantId,
        contractId: contract.id,
        leftAt: null,
      },
      data: { leftAt: input.actualMoveOutAt },
    });

    // Clear only customers from the terminating contract, and only after all
    // their own room bindings have ended.  A roommate or another contract
    // therefore cannot be detached by this transition.
    if (targetCustomerIds.length > 0) {
      await tx.customer.updateMany({
        where: {
          tenantId: contract.tenantId,
          id: { in: targetCustomerIds },
          roomId: contract.roomId,
          AND: [
            {
              occupancies: {
                none: {
                  tenantId: contract.tenantId,
                  roomId: contract.roomId,
                  leftAt: null,
                },
              },
            },
            {
              contracts: {
                none: {
                  tenantId: contract.tenantId,
                  roomId: contract.roomId,
                  deletedAt: null,
                  status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
                },
              },
            },
            {
              contractParties: {
                none: {
                  tenantId: contract.tenantId,
                  leftAt: null,
                  contract: {
                    roomId: contract.roomId,
                    deletedAt: null,
                    status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
                  },
                },
              },
            },
          ],
        },
        data: { roomId: null },
      });
    }

    const [remainingOccupancies, remainingActiveContracts, remainingHolds, room] =
      await Promise.all([
        tx.occupancy.count({
          where: {
            tenantId: contract.tenantId,
            roomId: contract.roomId,
            leftAt: null,
          },
        }),
        tx.contract.count({
          where: {
            tenantId: contract.tenantId,
            roomId: contract.roomId,
            deletedAt: null,
            status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
          },
        }),
        tx.roomHold?.count
          ? tx.roomHold.count({
              where: {
                tenantId: contract.tenantId,
                roomId: contract.roomId,
                status: "ACTIVE",
                expiresAt: { gt: new Date() },
              },
            })
          : 0,
        tx.room.findFirst({
          where: {
            id: contract.roomId,
            tenantId: contract.tenantId,
            deletedAt: null,
          },
          select: { status: true },
        }),
      ]);
    if (!room) throw new ConflictException("ROOM_LIFECYCLE_ROOM_NOT_FOUND");

    const roomStatus =
      remainingOccupancies > 0 || remainingActiveContracts > 0
        ? RoomStatus.OCCUPIED
        : remainingHolds > 0
          ? RoomStatus.RESERVED
          : input.requestedRoomStatus === RoomStatus.CLEANING ||
              input.requestedRoomStatus === RoomStatus.MAINTENANCE
            ? input.requestedRoomStatus
            : room.status === RoomStatus.CLEANING || room.status === RoomStatus.MAINTENANCE
              ? room.status
              : RoomStatus.AVAILABLE;

    return tx.room.update({
      where: { id: contract.roomId },
      data: { status: roomStatus },
    });
  }

  private async lockRoomLifecycle(tx: any, tenantId: string, roomId: string) {
    if (typeof tx.$queryRaw !== "function") {
      throw new ConflictException("ROOM_LIFECYCLE_LOCK_UNAVAILABLE");
    }
    const rows = (await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Room" WHERE "id" = ${roomId} AND "tenantId" = ${tenantId} AND "deletedAt" IS NULL FOR UPDATE`,
    )) as Array<{ id: string }>;
    if (!rows.length) throw new NotFoundException(`Room with ID ${roomId} not found`);
  }

  private async finalizeContract(
    id: string,
    userId: string,
    targetStatus: ContractStatus,
    input?: Partial<ContractSettlementInput>,
    tenantId?: string,
  ): Promise<Contract> {
    const contract = await this.getDetail(id);
    if (tenantId && contract.tenantId !== tenantId) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }

    if (
      contract.status !== ContractStatus.ACTIVE &&
      contract.status !== ContractStatus.EXPIRING
    ) {
      throw new BadRequestException(
        `Cannot finalize contract in ${contract.status} status. Only ACTIVE or EXPIRING is allowed.`,
      );
    }

    const settlement = input?.actualMoveOutDate
      ? await this.composeSettlementPreview(
          contract,
          input as ContractSettlementInput,
        )
      : await this.composeSettlementPreview(contract, {
          actualMoveOutDate: new Date(),
          roomTurnoverStatus: "AVAILABLE",
          rentDaysCharged: 0,
        });
    const snapshots = await this.withContractSnapshots(contract);
    const terminationReason = String(
      input?.note || "Trả phòng và quyết toán hợp đồng",
    ).trim();

    const result = await this.runSettlementSerializable(async (tx) => {
      const updatedContract = await tx.contract.update({
        where: { id },
        data: {
          status: targetStatus,
          actualMoveOutAt: settlement.actualMoveOutDate,
          terminationReason,
          customerSnapshot:
            contract.customerSnapshot || snapshots.customerSnapshot,
          roomSnapshot: contract.roomSnapshot || snapshots.roomSnapshot,
          termsSnapshot: contract.termsSnapshot || snapshots.termsSnapshot,
        },
      });

      if (updatedContract.rentalCycleId && tx.rentalCycle?.updateMany) {
        await tx.rentalCycle.updateMany({
          where: {
            id: updatedContract.rentalCycleId,
            tenantId: updatedContract.tenantId,
          },
          data: {
            status:
              targetStatus === ContractStatus.CANCELLED
                ? RentalCycleStatus.CANCELLED
                : RentalCycleStatus.CLOSED,
            actualEndAt: settlement.actualMoveOutDate,
            closedReason: terminationReason,
          },
        });
      }

      const updatedRoom = await this.applyCanonicalMoveOutLifecycle(
        tx,
        updatedContract,
        {
          actualMoveOutAt: settlement.actualMoveOutDate,
          reason: terminationReason,
          requestedRoomStatus: settlement.roomTurnoverStatus,
        },
      );

      const invoice =
        settlement.totals.netReceivable > 0
          ? await tx.invoice.create({
              data: {
                tenantId: contract.tenantId,
                code: `FIN-${Date.now()}`,
                contractId: contract.id,
                rentalCycleId: contract.rentalCycleId,
                customerId: contract.customerId,
                status: InvoiceStatus.ISSUED,
                dueDate: settlement.actualMoveOutDate,
                subtotal: settlement.totals.chargeTotal,
                discount: 0,
                total: settlement.totals.chargeTotal,
                paidAmount: 0,
                creditAmount: Math.min(
                  settlement.totals.creditTotal,
                  settlement.totals.chargeTotal,
                ),
                items: {
                  create: settlement.invoiceItems.map((item) => ({
                    tenantId: contract.tenantId,
                    type: item.type,
                    description: item.description,
                    quantity: 1,
                    unitPrice: item.amount,
                    amount: item.amount,
                  })),
                },
              },
            })
          : null;

      const refundReceipt =
        settlement.totals.refundToCustomer > 0
          ? await tx.receipt.create({
              data: {
                tenantId: contract.tenantId,
                code: this.buildRefundReceiptCode(contract.code),
                amount: settlement.totals.refundToCustomer,
                status: settlement.refund.receiptStatus,
                description: settlement.refund.reason
                  ? `Contract settlement refund for ${contract.code} - ${settlement.refund.reason}`
                  : `Contract settlement refund for ${contract.code}`,
                date: settlement.actualMoveOutDate,
              },
            })
          : null;

      const refundTask =
        settlement.totals.refundToCustomer > 0 &&
        settlement.refund.receiptStatus !== ReceiptStatus.COMPLETED
          ? await tx.task.create({
              data: {
                tenantId: contract.tenantId,
                title: `Xu ly hoan tien quyet toan ${contract.code}`,
                description: [
                  `Can hoan ${settlement.totals.refundToCustomer.toLocaleString("vi-VN")} VND cho khach.`,
                  settlement.refund.reason
                    ? `Ly do: ${settlement.refund.reason}`
                    : null,
                  Array.isArray(settlement.refund.attachmentUrls) &&
                  settlement.refund.attachmentUrls.length > 0
                    ? `Chung tu: ${settlement.refund.attachmentUrls.join(", ")}`
                    : null,
                ]
                  .filter(Boolean)
                  .join("\n"),
                status: "TODO" as any,
                priority: "HIGH" as any,
                dueDate: settlement.actualMoveOutDate,
              },
            })
          : null;

      if (tx.deposit?.updateMany) {
        await tx.deposit.updateMany({
          where: {
            tenantId: contract.tenantId,
            contractId: contract.id,
            rentalCycleId: contract.rentalCycleId,
          },
          data: {
            status:
              settlement.refund.receiptStatus === ReceiptStatus.PENDING
                ? DepositStatus.PENDING
                : DepositStatus.REFUNDED,
          },
        });
      }

      if (tx.contractSettlement?.upsert) {
        await tx.contractSettlement.upsert({
          where: { contractId: contract.id },
          create: {
            tenantId: contract.tenantId,
            contractId: contract.id,
            actualMoveOutAt: settlement.actualMoveOutDate,
            roomTurnoverStatus: settlement.roomTurnoverStatus,
            chargeTotal: settlement.totals.chargeTotal,
            creditTotal: settlement.totals.creditTotal,
            netReceivable: settlement.totals.netReceivable,
            refundToCustomer: settlement.totals.refundToCustomer,
            utilitySnapshot: settlement.utilitySnapshot,
            details: settlement,
          } as any,
          update: {
            actualMoveOutAt: settlement.actualMoveOutDate,
            roomTurnoverStatus: settlement.roomTurnoverStatus,
            chargeTotal: settlement.totals.chargeTotal,
            creditTotal: settlement.totals.creditTotal,
            netReceivable: settlement.totals.netReceivable,
            refundToCustomer: settlement.totals.refundToCustomer,
            utilitySnapshot: settlement.utilitySnapshot,
            details: settlement,
          } as any,
        });
      }

      return {
        updatedContract,
        updatedRoom,
        invoice,
        refundReceipt,
        refundTask,
      };
    });

    await this.auditService.log({
      action: "UPDATE",
      entity: this.entityName,
      entityId: id,
      module: "Contracts",
      before: contract,
      after: {
        ...result.updatedContract,
        settlement,
        refundReceipt: result.refundReceipt
          ? {
              id: result.refundReceipt.id,
              code: result.refundReceipt.code,
              amount: result.refundReceipt.amount,
              status: result.refundReceipt.status,
            }
          : null,
        refundTask: result.refundTask
          ? {
              id: result.refundTask.id,
              title: result.refundTask.title,
              status: result.refundTask.status,
            }
          : null,
      },
      userId,
    });

    if (result.refundReceipt) {
      await this.auditService.log({
        action: "CREATE",
        entity: "Receipt",
        entityId: result.refundReceipt.id,
        module: "Contracts",
        before: null,
        after: result.refundReceipt,
        userId,
      });
    }

    if (result.refundTask) {
      await this.auditService.log({
        action: "CREATE",
        entity: "Task",
        entityId: result.refundTask.id,
        module: "Contracts",
        before: null,
        after: result.refundTask,
        userId,
      });
    }

    if (
      settlement.totals.refundToCustomer > 0 &&
      settlement.refund.receiptStatus === ReceiptStatus.COMPLETED
    ) {
      this.eventPublisher.publish("contract.settlement.refunded", {
        tenantId: contract.tenantId,
        userId,
        customerId: contract.customerId,
        customerName: contract.customer?.fullName,
        customerPhone: contract.customer?.phone,
        ...buildRoomContext(contract.room, contract),
        metadata: {
          code: contract.code,
          refundSourceType: "CONTRACT_SETTLEMENT",
          actualMoveOutDate: settlement.actualMoveOutDate,
          settlement,
          accountingBreakdown: settlement.accountingBreakdown,
          refundReason: settlement.refund.reason,
          refundAttachmentUrls: settlement.refund.attachmentUrls,
        },
        sourceId: contract.id,
        sourceType: "REFUND",
        amount: settlement.totals.refundToCustomer,
        paymentProvider: "MANUAL",
        occurredAt: new Date(),
      });
    }

    const depositAppliedAmount = Number(
      settlement.accountingBreakdown.depositAppliedAmount || 0,
    );
    if (depositAppliedAmount > 0) {
      this.eventPublisher.publish("deposit.deducted", {
        tenantId: contract.tenantId,
        userId,
        customerId: contract.customerId,
        customerName: contract.customer?.fullName,
        customerPhone: contract.customer?.phone,
        ...buildRoomContext(contract.room, contract),
        metadata: {
          code: contract.code,
          adjustmentType: "DEPOSIT_SETTLEMENT_APPLICATION",
          resolutionAction: "DEDUCT",
          contractId: contract.id,
          invoiceId: result.invoice?.id || null,
          actualMoveOutDate: settlement.actualMoveOutDate,
        },
        sourceId: contract.id,
        sourceType: "ADJUSTMENT",
        amount: depositAppliedAmount,
        paymentProvider: "MANUAL",
        occurredAt: new Date(),
      });
    }

    this.eventPublisher.publish("contract.settlement.completed", {
      tenantId: contract.tenantId,
      userId,
      customerId: contract.customerId,
      customerName: contract.customer?.fullName,
      customerPhone: contract.customer?.phone,
      ...buildRoomContext(contract.room, contract),
      metadata: {
        code: contract.code,
        settlement,
        roomId: contract.roomId,
        title: `Quyet toan hop dong ${contract.code}`,
        message:
          settlement.totals.netReceivable > 0
            ? `Hop dong ${contract.code} da quyet toan. Khach can thanh toan them ${settlement.totals.netReceivable.toLocaleString("vi-VN")} VND.`
            : settlement.totals.refundToCustomer > 0
              ? settlement.refund.receiptStatus === ReceiptStatus.COMPLETED
                ? `Hop dong ${contract.code} da quyet toan. He thong da hoan ${settlement.totals.refundToCustomer.toLocaleString("vi-VN")} VND cho khach.`
                : `Hop dong ${contract.code} da quyet toan. He thong dang cho xu ly hoan ${settlement.totals.refundToCustomer.toLocaleString("vi-VN")} VND cho khach.`
              : `Hop dong ${contract.code} da quyet toan xong va khong con cong no.`,
      },
      sourceId: contract.id,
      sourceType: "CONTRACT",
      amount: settlement.totals.netReceivable,
      occurredAt: new Date(),
    });

    return result.updatedContract;
  }

  private async loadSettlementFinancialContext(client: any, contract: any) {
    const invoices = await client.invoice.findMany({
      where: {
        tenantId: contract.tenantId,
        contractId: contract.id,
        rentalCycleId: contract.rentalCycleId,
        customerId: contract.customerId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        billingKind: true,
        adjustmentOfInvoiceId: true,
        total: true,
        paidAmount: true,
        creditAmount: true,
        baseInvoiceKey: true,
        dueDate: true,
        createdAt: true,
      },
    });
    const deposits = await client.deposit.findMany({
      where: {
        tenantId: contract.tenantId,
        contractId: contract.id,
        rentalCycleId: contract.rentalCycleId,
        customerId: contract.customerId,
        roomId: contract.roomId,
        deletedAt: null,
      },
      select: { id: true },
    });
    const balances = await Promise.all(
      deposits.map(async (deposit: any) =>
        Number(
          (
            await client.depositLedgerEntry.aggregate({
              where: { tenantId: contract.tenantId, depositId: deposit.id },
              _sum: { balanceEffect: true },
            })
          )._sum?.balanceEffect || 0,
        ),
      ),
    );
    return {
      priorOutstanding: this.buildOutstandingInvoiceDebt(
        invoices.filter(
          (invoice: any) =>
            invoice.baseInvoiceKey !== `SETTLEMENT:${contract.id}`,
        ),
      ).total,
      availableDepositAmount: this.roundMoney(
        balances.reduce((sum: number, balance: number) => sum + Math.max(balance, 0), 0),
      ),
    };
  }

  private buildOutstandingInvoiceDebt(invoices: any[]) {
    const debtStatuses = new Set<string>([
      InvoiceStatus.ISSUED,
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.OVERDUE,
    ]);
    const active = invoices.filter((invoice) => debtStatuses.has(invoice.status));
    const creditByRoot = new Map<string, number>();
    for (const invoice of active) {
      if (invoice.billingKind !== "CREDIT_ADJUSTMENT" || !invoice.adjustmentOfInvoiceId) {
        continue;
      }
      creditByRoot.set(
        invoice.adjustmentOfInvoiceId,
        this.roundMoney(
          (creditByRoot.get(invoice.adjustmentOfInvoiceId) || 0) +
            Number(invoice.total || 0),
        ),
      );
    }

    const rows = active
      .filter((invoice) => invoice.billingKind !== "CREDIT_ADJUSTMENT")
      .map((invoice) => ({
        invoice,
        outstanding: this.roundMoney(
          Math.max(
            Number(invoice.total || 0) -
              Number(invoice.paidAmount || 0) -
              Number(invoice.creditAmount || 0),
            0,
          ),
        ),
      }))
      .sort((a, b) => {
        const aDate = new Date(a.invoice.dueDate || a.invoice.createdAt || 0).getTime();
        const bDate = new Date(b.invoice.dueDate || b.invoice.createdAt || 0).getTime();
        return aDate - bDate || String(a.invoice.id).localeCompare(String(b.invoice.id));
      });

    // Issued credit adjustments neutralize the whole invoice family once,
    // including both the root and debit adjustments. Applying only to the
    // root leaves a false balance when family credit exceeds the root debt.
    const remainingFamilyCredit = new Map(creditByRoot);
    for (const row of rows) {
      const familyRootId = row.invoice.adjustmentOfInvoiceId || row.invoice.id;
      const availableCredit = remainingFamilyCredit.get(familyRootId) || 0;
      if (availableCredit <= 0 || row.outstanding <= 0) continue;
      const appliedCredit = this.roundMoney(
        Math.min(row.outstanding, availableCredit),
      );
      row.outstanding = this.roundMoney(row.outstanding - appliedCredit);
      remainingFamilyCredit.set(
        familyRootId,
        this.roundMoney(availableCredit - appliedCredit),
      );
    }
    const payableRows = rows.filter((row) => row.outstanding > 0);
    return {
      rows: payableRows,
      total: this.roundMoney(
        payableRows.reduce((sum, row) => sum + row.outstanding, 0),
      ),
    };
  }

  private applyAuthoritativeSettlementBalance(
    settlement: any,
    priorOutstanding: number,
    availableDepositAmount: number,
  ) {
    const requestedDepositAmount = this.roundMoney(
      Number(settlement.accountingBreakdown.depositCreditTotal || 0),
    );
    if (requestedDepositAmount > availableDepositAmount) {
      throw new BadRequestException("SETTLEMENT_DEPOSIT_BALANCE_INSUFFICIENT");
    }
    const chargeTotal = this.roundMoney(settlement.totals.chargeTotal);
    const operationalCreditTotal = this.roundMoney(
      settlement.accountingBreakdown.operationalCreditTotal,
    );
    const finalChargeAfterOperationalCredits = this.roundMoney(
      Math.max(chargeTotal - operationalCreditTotal, 0),
    );
    const debtBeforeDeposit = this.roundMoney(
      priorOutstanding + finalChargeAfterOperationalCredits,
    );
    const depositAppliedAmount = this.roundMoney(
      Math.min(requestedDepositAmount, debtBeforeDeposit),
    );
    const depositRefundAmount = this.roundMoney(
      requestedDepositAmount - depositAppliedAmount,
    );
    const revenueRefundAmount = this.roundMoney(
      Math.max(operationalCreditTotal - chargeTotal, 0),
    );
    const finalChargeDepositCredit = this.roundMoney(
      Math.max(depositAppliedAmount - priorOutstanding, 0),
    );
    const finalChargeCreditAmount = this.roundMoney(
      Math.min(chargeTotal, operationalCreditTotal + finalChargeDepositCredit),
    );
    const netReceivable = this.roundMoney(debtBeforeDeposit - depositAppliedAmount);
    const refundToCustomer = this.roundMoney(
      revenueRefundAmount + depositRefundAmount,
    );
    const credits = settlement.credits
      .filter((line: any) => line.key !== "depositToDeduct" && line.key !== "depositToRefund")
      .concat(
        depositAppliedAmount > 0
          ? [{ key: "depositToDeduct", description: "Khấu trừ cọc vào công nợ", amount: depositAppliedAmount }]
          : [],
        depositRefundAmount > 0
          ? [{ key: "depositToRefund", description: "Tiền cọc hoàn trả khách", amount: depositRefundAmount }]
          : [],
      );

    return {
      ...settlement,
      credits,
      assumptions: {
        ...settlement.assumptions,
        depositBalance: availableDepositAmount,
        priorOutstanding,
      },
      accountingBreakdown: {
        ...settlement.accountingBreakdown,
        depositAppliedAmount,
        depositRefundAmount,
        revenueRefundAmount,
        finalChargeCreditAmount,
        priorOutstanding,
        debtBeforeDeposit,
      },
      totals: {
        ...settlement.totals,
        netReceivable,
        refundToCustomer,
      },
    };
  }

  private buildSettlementPreview(
    contract: any,
    input: ContractSettlementInput,
  ) {
    const actualMoveOutDate = new Date(input.actualMoveOutDate);
    if (Number.isNaN(actualMoveOutDate.getTime())) {
      throw new BadRequestException("SETTLEMENT_MOVE_OUT_DATE_INVALID");
    }

    const monthlyRent = Number(contract.monthlyRent || 0);
    const dailyRent = monthlyRent > 0 ? monthlyRent / 30 : 0;
    const rentDaysCharged = input.rentDaysCharged ?? 0;
    const rentChargeAmount = this.roundMoney(
      input.baseRentAmount ?? dailyRent * rentDaysCharged,
    );
    const electricityAmount = this.roundMoney(input.electricityAmount ?? 0);
    const waterUsage = this.resolveWaterUsage(input);
    const waterUnitPrice = this.roundMoney(input.waterUnitPrice ?? 0);
    const waterAmount = this.roundMoney(
      input.waterAmount ??
        (waterUsage !== null && waterUnitPrice > 0
          ? waterUsage * waterUnitPrice
          : 0),
    );
    const serviceAmount = this.roundMoney(input.serviceAmount ?? 0);
    const damageFee = this.roundMoney(input.damageFee ?? 0);
    const penaltyFee = this.roundMoney(input.penaltyFee ?? 0);
    const otherChargeAmount = this.roundMoney(input.otherChargeAmount ?? 0);
    const roomRefundAmount = this.roundMoney(input.roomRefundAmount ?? 0);
    const waterSupportAmount = this.roundMoney(input.waterSupportAmount ?? 0);
    const otherCreditAmount = this.roundMoney(input.otherCreditAmount ?? 0);
    const depositToRefund = this.roundMoney(input.depositToRefund ?? 0);
    const depositToDeduct = this.roundMoney(input.depositToDeduct ?? 0);
    const depositBalance = this.roundMoney(Number(contract.depositMoney || 0));
    const refundReceiptStatus =
      input.refundReceiptStatus === "PENDING"
        ? ReceiptStatus.PENDING
        : ReceiptStatus.COMPLETED;
    const refundReason = String(input.refundReason || "").trim() || null;
    const refundAttachmentUrls = Array.isArray(input.refundAttachmentUrls)
      ? input.refundAttachmentUrls.filter(Boolean)
      : [];

    const chargeLines = [
      {
        key: "rentChargeAmount",
        type: "RENT" as InvoiceItemType,
        description: `Tiền thuê phát sinh (${rentDaysCharged} ngày)`,
        amount: rentChargeAmount,
      },
      {
        key: "electricityAmount",
        type: "UTILITY_ELECTRICITY" as InvoiceItemType,
        description: "Tiền điện chốt kỳ",
        amount: electricityAmount,
      },
      {
        key: "waterAmount",
        type: "UTILITY_WATER" as InvoiceItemType,
        description: "Tiền nước quyết toán",
        amount: waterAmount,
      },
      {
        key: "serviceAmount",
        type: "SERVICE" as InvoiceItemType,
        description: "Phí dịch vụ phát sinh",
        amount: serviceAmount,
      },
      {
        key: "damageFee",
        type: "PENALTY" as InvoiceItemType,
        description: "Bồi thường hư hỏng",
        amount: damageFee,
      },
      {
        key: "penaltyFee",
        type: "PENALTY" as InvoiceItemType,
        description: "Phí phạt vi phạm / trả sớm",
        amount: penaltyFee,
      },
      {
        key: "otherChargeAmount",
        type: "OTHER" as InvoiceItemType,
        description: "Khoản thu phát sinh khác",
        amount: otherChargeAmount,
      },
    ].filter((line) => line.amount > 0);

    const creditLines = [
      {
        key: "roomRefundAmount",
        description: "Hoàn tiền phòng dư",
        amount: roomRefundAmount,
      },
      {
        key: "waterSupportAmount",
        description: "Hỗ trợ tiền nước",
        amount: waterSupportAmount,
      },
      {
        key: "otherCreditAmount",
        description: "Khoản giảm trừ khác",
        amount: otherCreditAmount,
      },
      {
        key: "depositToDeduct",
        description: "Khấu trừ cọc vào công nợ",
        amount: depositToDeduct,
      },
      {
        key: "depositToRefund",
        description: "Tiền cọc hoàn trả khách",
        amount: depositToRefund,
      },
    ].filter((line) => line.amount > 0);

    const chargeTotal = this.roundMoney(
      chargeLines.reduce((sum, line) => sum + line.amount, 0),
    );
    const creditTotal = this.roundMoney(
      creditLines.reduce((sum, line) => sum + line.amount, 0),
    );
    const netReceivable = this.roundMoney(
      Math.max(chargeTotal - creditTotal, 0),
    );
    const refundToCustomer = this.roundMoney(
      Math.max(creditTotal - chargeTotal, 0),
    );
    const operationalCreditTotal = this.roundMoney(
      roomRefundAmount + waterSupportAmount + otherCreditAmount,
    );
    const depositCreditTotal = this.roundMoney(
      depositToRefund + depositToDeduct,
    );
    const depositAppliedAmount = this.roundMoney(
      Math.min(
        depositCreditTotal,
        Math.max(chargeTotal - operationalCreditTotal, 0),
      ),
    );
    const depositRefundAmount = this.roundMoney(
      Math.max(depositCreditTotal - depositAppliedAmount, 0),
    );
    const revenueRefundAmount = this.roundMoney(
      Math.max(operationalCreditTotal - chargeTotal, 0),
    );

    return {
      contract: {
        id: contract.id,
        code: contract.code,
        customerId: contract.customerId,
        roomId: contract.roomId,
      },
      actualMoveOutDate,
      roomTurnoverStatus:
        input.roomTurnoverStatus === "MAINTENANCE" ||
        (damageFee > 0 && input.roomTurnoverStatus !== "AVAILABLE")
          ? RoomStatus.MAINTENANCE
          : input.roomTurnoverStatus === "CLEANING"
            ? RoomStatus.CLEANING
            : RoomStatus.AVAILABLE,
      assumptions: {
        monthlyRent,
        dailyRent: this.roundMoney(dailyRent),
        rentDaysCharged,
        depositBalance,
        note: input.note || null,
      },
      refund: {
        receiptStatus: refundReceiptStatus,
        reason: refundReason,
        attachmentUrls: refundAttachmentUrls,
      },
      charges: chargeLines,
      credits: creditLines,
      accountingBreakdown: {
        operationalCreditTotal,
        depositCreditTotal,
        depositAppliedAmount,
        depositRefundAmount,
        revenueRefundAmount,
      },
      invoiceItems: chargeLines.map(({ key, ...line }) => line),
      totals: {
        chargeTotal,
        creditTotal,
        netReceivable,
        refundToCustomer,
      },
    };
  }

  private async getSettlementRefundSummary(contract: any) {
    if (!contract?.id || !contract?.code) {
      return null;
    }

    const refundReceiptPrefix = this.buildRefundReceiptPrefix(contract.code);
    const [receipt, task] = await Promise.all([
      this.prisma.receipt.findFirst({
        where: {
          tenantId: contract.tenantId,
          code: { startsWith: refundReceiptPrefix },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.task.findFirst({
        where: {
          tenantId: contract.tenantId,
          title: `Xu ly hoan tien quyet toan ${contract.code}`,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!receipt && !task) {
      return null;
    }

    const receiptStatus = String(receipt?.status || "");
    const taskStatus = String(task?.status || "");
    const isPending =
      receiptStatus === ReceiptStatus.PENDING ||
      taskStatus === "TODO" ||
      taskStatus === "IN_PROGRESS";
    const isCompleted =
      receiptStatus === ReceiptStatus.COMPLETED &&
      (!task || taskStatus === "DONE");

    return {
      receiptId: receipt?.id || null,
      receiptCode: receipt?.code || null,
      receiptStatus: receipt?.status || null,
      receiptAmount: Number(receipt?.amount || 0),
      receiptDescription: receipt?.description || null,
      taskId: task?.id || null,
      taskTitle: task?.title || null,
      taskStatus: task?.status || null,
      pending: isPending,
      completed: isCompleted,
    };
  }

  private roundMoney(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private async composeSettlementPreview(
    contract: any,
    input: ContractSettlementInput,
  ) {
    const actualMoveOutDate = this.resolveMoveOutDate(input.actualMoveOutDate);
    const utilitySnapshot = await this.getUtilitySnapshot(
      contract.tenantId,
      contract.roomId,
      actualMoveOutDate,
    );
    const electricityClosingKwh =
      input.electricityClosingKwh !== undefined &&
      input.electricityClosingKwh !== null
        ? Number(input.electricityClosingKwh || 0)
        : null;
    if (utilitySnapshot.electricity && electricityClosingKwh !== null) {
      utilitySnapshot.electricity = this.applyManualElectricityClosingKwh(
        utilitySnapshot.electricity,
        electricityClosingKwh,
      );
    }
    const waterUsage = this.resolveWaterUsage(input);
    const waterUnitPrice = this.roundMoney(Number(input.waterUnitPrice || 0));
    const derivedWaterAmount =
      waterUsage !== null && waterUnitPrice > 0
        ? this.roundMoney(waterUsage * waterUnitPrice)
        : 0;
    const waterAmount = input.waterAmount ?? derivedWaterAmount;
    utilitySnapshot.water =
      waterUsage !== null || waterAmount > 0
        ? {
            previousReading: Number(input.waterPreviousReading || 0),
            currentReading: Number(input.waterCurrentReading || 0),
            usage: Number(waterUsage || 0),
            unitPrice: waterUnitPrice,
            amount: this.roundMoney(Number(waterAmount || 0)),
            source:
              input.waterAmount !== undefined && input.waterAmount !== null
                ? "MANUAL_AMOUNT"
                : waterUsage !== null && waterUnitPrice > 0
                  ? "MANUAL_READING"
                  : "MANUAL_AMOUNT",
          }
        : null;
    const preview = this.buildSettlementPreview(contract, {
      ...input,
      actualMoveOutDate,
      electricityAmount:
        input.electricityAmount ??
        utilitySnapshot.electricity?.calculatedAmountVnd ??
        utilitySnapshot.electricity?.monthAmountVnd ??
        0,
      waterAmount,
    });
    return {
      ...preview,
      utilitySnapshot,
      settlementSnapshot: this.buildSettlementSnapshot(
        utilitySnapshot,
        actualMoveOutDate,
      ),
    };
  }

  private resolveMoveOutDate(value: string | Date) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [year, month, day] = trimmed.split("-").map(Number);
        // End of day in Vietnam time (GMT+7): 23:59:59.999 -> 16:59:59.999 UTC
        return new Date(Date.UTC(year, month - 1, day, 16, 59, 59, 999));
      }
    }
    const actualMoveOutDate = new Date(value);
    if (Number.isNaN(actualMoveOutDate.getTime())) {
      throw new BadRequestException("SETTLEMENT_MOVE_OUT_DATE_INVALID");
    }
    return actualMoveOutDate;
  }

  private async getUtilitySnapshot(
    tenantId: string,
    roomId: string,
    moveOutDate: Date,
  ) {
    if (!tenantId || !roomId) {
      return { electricity: null, water: null };
    }

    const mapping = await (this.prisma as any).hunonicMeterMapping.findFirst({
      where: {
        tenantId,
        roomId,
        enabled: true,
      },
      include: {
        readings: {
          where: {
            readingAt: {
              lte: moveOutDate,
            },
          },
          orderBy: { readingAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!mapping) {
      return { electricity: null, water: null };
    }

    const latestReading =
      Array.isArray(mapping.readings) && mapping.readings.length > 0
        ? mapping.readings[0]
        : await (this.prisma as any).hunonicMeterReading.findFirst({
            where: {
              tenantId,
              meterMappingId: mapping.id,
            },
            orderBy: { readingAt: "desc" },
          });
    const period =
      latestReading?.currentMonth || this.getSettlementPeriod(moveOutDate);
    let pricing: Awaited<
      ReturnType<HunonicService["getRoomElectricityPricing"]>
    > = null;
    try {
      pricing = await this.hunonicService.getRoomElectricityPricing(
        tenantId,
        roomId,
      );
    } catch {
      pricing = null;
    }
    const room = (this.prisma as any).room?.findUnique
      ? await (this.prisma as any).room.findUnique({
          where: { id: roomId },
          select: {
            id: true,
            code: true,
            name: true,
            rentalType: true,
            capacity: true,
            bedCount: true,
          },
        })
      : null;
    const isSharedRoom = room?.rentalType === "SHARED";
    let activeOccupants = 1;
    if (isSharedRoom) {
      const activeContracts = (this.prisma as any).contract?.count
        ? await (this.prisma as any).contract.count({
            where: {
              tenantId,
              roomId,
              status: "ACTIVE",
            },
          })
        : 0;
      activeOccupants = Math.max(
        1,
        activeContracts || room?.capacity || room?.bedCount || 1,
      );
    }

    const totalRoomMonthKwh = Number(
      latestReading?.energyMonthKwh ?? mapping.lastReadingKwh ?? 0,
    );
    const totalRoomAmountVnd = Number(
      latestReading?.moneyMonthVnd ?? mapping.lastAmountVnd ?? 0,
    );
    const totalCalculatedAmountVnd =
      this.calculateElectricityAmount(totalRoomMonthKwh, pricing) ??
      totalRoomAmountVnd;

    const monthKwh = isSharedRoom
      ? Math.round((totalRoomMonthKwh / activeOccupants) * 100) / 100
      : totalRoomMonthKwh;
    const monthAmountVnd = isSharedRoom
      ? Math.round(totalRoomAmountVnd / activeOccupants)
      : totalRoomAmountVnd;
    const calculatedAmountVnd = isSharedRoom
      ? Math.round(totalCalculatedAmountVnd / activeOccupants)
      : totalCalculatedAmountVnd;

    return {
      electricity: {
        meterId: mapping.id,
        providerMeterId: mapping.providerMeterId,
        displayName: mapping.displayName,
        deviceName: mapping.deviceName,
        status: mapping.lastStatus,
        isSharedRoom,
        activeOccupants,
        totalRoomMonthKwh,
        totalRoomAmountVnd,
        totalCalculatedAmountVnd,
        monthKwh,
        monthAmountVnd,
        calculatedAmountVnd,
        rateMode: pricing?.currentMode || null,
        customRateVnd: pricing?.customRateVnd ?? null,
        residentialSteps: pricing?.residentialSteps || [],
        powerCurrentW: Number(latestReading?.powerCurrentW ?? 0),
        readingAt: latestReading?.readingAt ?? mapping.lastSyncedAt ?? null,
        currentMonth: period,
        source: latestReading ? "HUNONIC_READING" : "HUNONIC_MAPPING",
        calculationSource:
          pricing?.currentMode === "custom"
            ? "CUSTOM_RATE"
            : pricing?.currentMode === "residential"
              ? "RESIDENTIAL_STEPS"
              : "HUNONIC_AMOUNT",
        sharedSplitNote: isSharedRoom
          ? `Phòng ghép (${activeOccupants} người) · Chia đều 1/${activeOccupants}`
          : null,
      },
      water: null,
    };
  }

  private resolveWaterUsage(input: Partial<ContractSettlementInput>) {
    if (input.waterUsage !== undefined && input.waterUsage !== null) {
      return Number(input.waterUsage || 0);
    }
    if (
      input.waterCurrentReading !== undefined &&
      input.waterPreviousReading !== undefined
    ) {
      const usage =
        Number(input.waterCurrentReading || 0) -
        Number(input.waterPreviousReading || 0);
      if (usage < 0) {
        throw new BadRequestException("SETTLEMENT_WATER_READING_INVALID");
      }
      return usage;
    }
    return null;
  }

  private calculateElectricityAmount(
    monthKwh: number,
    pricing: Awaited<
      ReturnType<HunonicService["getRoomElectricityPricing"]>
    > | null,
  ) {
    if (!pricing || !Number.isFinite(monthKwh) || monthKwh <= 0) return null;

    if (pricing.currentMode === "custom") {
      const customRateVnd = Number(pricing.customRateVnd || 0);
      if (!Number.isFinite(customRateVnd) || customRateVnd <= 0) return null;
      return Math.round(monthKwh * customRateVnd);
    }

    if (
      pricing.currentMode !== "residential" ||
      !Array.isArray(pricing.residentialSteps) ||
      pricing.residentialSteps.length === 0
    ) {
      return null;
    }

    let remaining = monthKwh;
    let total = 0;
    const steps = pricing.residentialSteps
      .map((step) => ({
        minRate: Number(step.minRate ?? 0),
        maxRate:
          step.maxRate === null || step.maxRate === undefined
            ? null
            : Number(step.maxRate),
        price: Number(step.price ?? 0),
      }))
      .filter((step) => Number.isFinite(step.price) && step.price > 0)
      .sort((a, b) => a.minRate - b.minRate);

    for (const step of steps) {
      if (remaining <= 0) break;
      const lowerBound = Math.max(0, step.minRate);
      const upperBound =
        step.maxRate === null || !Number.isFinite(step.maxRate)
          ? Number.POSITIVE_INFINITY
          : Math.max(lowerBound, step.maxRate);
      const capacity =
        upperBound === Number.POSITIVE_INFINITY
          ? remaining
          : Math.max(0, upperBound - lowerBound);
      if (capacity <= 0) continue;
      const usage = Math.min(remaining, capacity);
      total += usage * step.price;
      remaining -= usage;
    }

    if (remaining > 0 && steps.length > 0) {
      total += remaining * steps[steps.length - 1].price;
    }

    return Math.round(total);
  }

  private applyManualElectricityClosingKwh(
    electricitySnapshot: any,
    closingKwh: number,
  ) {
    const normalizedClosingKwh = this.roundMoney(Number(closingKwh || 0));
    const calculatedAmountVnd = this.calculateElectricityAmount(
      normalizedClosingKwh,
      {
        currentMode:
          electricitySnapshot?.rateMode === "custom"
            ? "custom"
            : electricitySnapshot?.rateMode === "residential"
              ? "residential"
              : null,
        customRateVnd: electricitySnapshot?.customRateVnd ?? null,
        residentialSteps: electricitySnapshot?.residentialSteps || [],
      } as Awaited<ReturnType<HunonicService["getRoomElectricityPricing"]>>,
    );

    return {
      ...electricitySnapshot,
      closingKwh: normalizedClosingKwh,
      monthKwh: normalizedClosingKwh,
      calculatedAmountVnd:
        calculatedAmountVnd !== null && calculatedAmountVnd !== undefined
          ? calculatedAmountVnd
          : Number(
              electricitySnapshot?.calculatedAmountVnd ||
                electricitySnapshot?.monthAmountVnd ||
                0,
            ),
      source: "MANUAL_MOVE_OUT_READING",
      readingAt: electricitySnapshot?.readingAt || new Date(),
    };
  }

  private buildSettlementSnapshot(
    utilitySnapshot: { electricity: any | null; water?: any | null },
    actualMoveOutDate?: Date,
  ) {
    if (!utilitySnapshot?.electricity && !utilitySnapshot?.water) {
      return {
        capturedAt: (actualMoveOutDate || new Date()).toISOString(),
        electricity: null,
        water: null,
      };
    }

    return {
      capturedAt: (actualMoveOutDate || new Date()).toISOString(),
      electricity: utilitySnapshot.electricity
        ? {
            meterId: utilitySnapshot.electricity.meterId,
            providerMeterId: utilitySnapshot.electricity.providerMeterId,
            displayName: utilitySnapshot.electricity.displayName,
            deviceName: utilitySnapshot.electricity.deviceName,
            currentMonth: utilitySnapshot.electricity.currentMonth,
            closingKwh: Number(
              utilitySnapshot.electricity.closingKwh ??
                (utilitySnapshot.electricity.monthKwh || 0),
            ),
            monthKwh: Number(utilitySnapshot.electricity.monthKwh || 0),
            monthAmountVnd: Number(
              utilitySnapshot.electricity.monthAmountVnd || 0,
            ),
            calculatedAmountVnd: Number(
              utilitySnapshot.electricity.calculatedAmountVnd || 0,
            ),
            rateMode: utilitySnapshot.electricity.rateMode,
            customRateVnd: utilitySnapshot.electricity.customRateVnd,
            residentialSteps:
              utilitySnapshot.electricity.residentialSteps || [],
            powerCurrentW: Number(
              utilitySnapshot.electricity.powerCurrentW || 0,
            ),
            readingAt: utilitySnapshot.electricity.readingAt,
            source: utilitySnapshot.electricity.source,
            calculationSource: utilitySnapshot.electricity.calculationSource,
          }
        : null,
      water: utilitySnapshot.water
        ? {
            previousReading: Number(utilitySnapshot.water.previousReading || 0),
            currentReading: Number(utilitySnapshot.water.currentReading || 0),
            usage: Number(utilitySnapshot.water.usage || 0),
            unitPrice: Number(utilitySnapshot.water.unitPrice || 0),
            amount: Number(utilitySnapshot.water.amount || 0),
            source: utilitySnapshot.water.source,
          }
        : null,
    };
  }

  private getSettlementPeriod(moveOutDate: Date) {
    return `${moveOutDate.getFullYear()}-${String(moveOutDate.getMonth() + 1).padStart(2, "0")}`;
  }

  private buildRefundReceiptCode(contractCode: string) {
    return `${this.buildRefundReceiptPrefix(contractCode)}${Date.now()}`;
  }

  private buildRefundReceiptPrefix(contractCode: string) {
    const normalizedCode = String(contractCode || "CONTRACT")
      .replace(/[^A-Z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toUpperCase();
    return `RCT-${normalizedCode}-`;
  }
}
