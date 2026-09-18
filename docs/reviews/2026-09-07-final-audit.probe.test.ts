/**
 * Historical review-only reproducers captured before the Big Update fixes.
 * All persistence/providers are in-memory mocks; no server, real DB, or webhook is used.
 * They are intentionally skipped because the corresponding desired regressions now live
 * in the API suite (contracts, prisma, invoices, auth, and payments specs).
 */
import { describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { AuthController } from '../../apps/api/src/auth/auth.controller';
import { JwtStrategy } from '../../apps/api/src/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../apps/api/src/auth/guards/jwt-auth.guard';
import { ContractsService } from '../../apps/api/src/contracts/contracts.service';
import { InvoicesService } from '../../apps/api/src/invoices/invoices.service';
import { PaymentsService } from '../../apps/api/src/payments/payments.service';
import { PrismaService } from '../../apps/api/src/prisma.service';

const audit = () => ({ log: vi.fn().mockResolvedValue(undefined) });

describe.skip('Historical final-diagram defect reproducers (superseded by API regressions)', () => {
  it('R1: paid booking amount 1m is overwritten to contract deposit 5m without collecting 4m', async () => {
    const deposit = {
      findFirst: vi.fn().mockResolvedValue({ id: 'booking', type: 'BOOKING', status: 'PAID', amount: 1000000 }),
      update: vi.fn().mockResolvedValue({}),
    };
    const service = new ContractsService({} as any, audit() as any, { tx: { deposit } } as any, {} as any, {} as any);
    await service.syncContractDeposit({ id: 'contract', tenantId: 'tenant-a', roomId: 'room', customerId: 'customer', status: 'ACTIVE', depositMoney: 5000000 });
    expect(deposit.update).toHaveBeenCalledWith({ where: { id: 'booking' }, data: {
      contractId: 'contract', amount: 5000000, status: 'CONVERTED_TO_CONTRACT', type: 'BOOKING',
    } });
  });

  it('R2: tenant extension scopes findMany but leaves findUniqueOrThrow unscoped', async () => {
    const extension = Object.getOwnPropertyDescriptor(PrismaService.prototype, 'tx')!.get!.call({
      cls: { get: () => 'tenant-a' }, $extends: (config: any) => config,
    });
    const hook = extension.query.$allModels.$allOperations;
    const listArgs = { where: {} };
    const detailArgs = { where: { id: 'tenant-b-invoice' } };
    await hook({ model: 'Invoice', operation: 'findMany', args: listArgs, query: vi.fn() });
    await hook({ model: 'Invoice', operation: 'findUniqueOrThrow', args: detailArgs, query: vi.fn() });
    expect(listArgs.where).toEqual({ tenantId: 'tenant-a' });
    expect(detailArgs.where).toEqual({ id: 'tenant-b-invoice' });
  });

  it('R3: concurrent invoice payments record 700 in allocations but only 300 or 400 in paidAmount', async () => {
    const initial = { id: 'inv', tenantId: 'tenant-a', code: 'INV-1', total: 1000, paidAmount: 0, creditAmount: 0, status: 'ISSUED' };
    let paidAmount = 0;
    const allocations: number[] = [];
    const tx: any = {
      invoice: {
        findUniqueOrThrow: vi.fn().mockImplementation(async () => ({ ...initial })),
        update: vi.fn().mockImplementation(async ({ data }) => { paidAmount = data.paidAmount; return { ...initial, ...data }; }),
      },
      payment: { create: vi.fn().mockImplementation(async ({ data }) => ({ id: data.providerRef, ...data })) },
      paymentAllocation: { create: vi.fn().mockImplementation(async ({ data }) => { allocations.push(data.amount); return data; }) },
    };
    tx.$transaction = async (callback: any) => callback(tx);
    const service = new InvoicesService({} as any, audit() as any, { publish: vi.fn() } as any, { tx } as any);
    await Promise.all([service.pay('inv', 300, 'MANUAL', 'first', 'user'), service.pay('inv', 400, 'MANUAL', 'second', 'user')]);
    expect(allocations.reduce((a, b) => a + b, 0)).toBe(700);
    expect([300, 400]).toContain(paidAmount);
  });

  it('R4: paying a rent invoice marks every pending contract deposit PAID without a deposit charge', async () => {
    const invoice = { id: 'inv', tenantId: 'tenant-a', contractId: 'contract', code: 'INV-1', total: 1000, paidAmount: 0, creditAmount: 0, status: 'ISSUED', items: [{ type: 'RENT', amount: 1000 }] };
    const tx: any = {
      invoice: { findUniqueOrThrow: vi.fn().mockResolvedValue(invoice), update: vi.fn().mockImplementation(async ({ data }) => ({ ...invoice, ...data })) },
      payment: { create: vi.fn().mockResolvedValue({ id: 'payment' }) },
      paymentAllocation: { create: vi.fn().mockResolvedValue({}) },
      deposit: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    tx.$transaction = async (callback: any) => callback(tx);
    const service = new InvoicesService({} as any, audit() as any, { publish: vi.fn() } as any, { tx } as any);
    await service.pay('inv', 1000, 'MANUAL', 'rent-only', 'user');
    expect(tx.deposit.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', contractId: 'contract', status: 'PENDING' }, data: { status: 'PAID' },
    });
  });

  it('R5: real login refresh JWT is accepted by the actual passport access JWT strategy', async () => {
    const secret = 'audit-only-ephemeral-secret-not-production';
    const config: any = { get: (key: string) => ({ 'auth.jwtSecret': secret, 'auth.jwtExpiresIn': '15m', 'auth.jwtRefreshExpiresIn': '7d' }[key]) };
    const prisma: any = { user: {
      findFirst: vi.fn().mockResolvedValue({ id: 'user', tenantId: 'tenant-a', email: 'audit@example.invalid', status: 'ACTIVE', mustChangePassword: false, passwordHash: await bcrypt.hash('review-only-password', 4), roles: [] }),
      update: vi.fn().mockResolvedValue({}),
    } };
    const service = new AuthService(prisma, new JwtService({ secret }), config, audit() as any, {} as any);
    const login = await service.login({ emailOrPhone: 'audit@example.invalid', password: 'review-only-password' });
    const strategy: any = new JwtStrategy(config, { set: vi.fn() } as any);
    const accepted: any = await new Promise((resolve, reject) => {
      strategy.success = resolve;
      strategy.fail = (info: any) => reject(new Error(String(info)));
      strategy.error = reject;
      strategy.authenticate({ headers: { authorization: 'Bearer ' + login.refreshToken } }, {});
    });
    expect(accepted.id).toBe('user');
    expect(accepted.tenantId).toBe('tenant-a');
  });

  it('R6: public logout guard does not authenticate and logout(undefined) performs no token revocation', async () => {
    const prisma: any = { user: { update: vi.fn() } };
    const service = new AuthService(prisma, {} as any, {} as any, audit() as any, {} as any);
    const controller = new AuthController(service, {} as any);
    const request: any = { headers: { authorization: 'Bearer an-existing-token' } };
    const guard = new JwtAuthGuard(new Reflector(), { isActive: () => true, set: vi.fn() } as any);
    expect(guard.canActivate({ getHandler: () => AuthController.prototype.logout, getClass: () => AuthController, switchToHttp: () => ({ getRequest: () => request }) } as any)).toBe(true);
    await controller.logout(request.user?.id);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('R7: tenant A SePay key authenticates lookup of a tenant B request without tenant binding', async () => {
    const prisma: any = {
      appSetting: { findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-a', value: { authMode: 'api_key', webhookApiKey: 'review-only-key-a' } }]) },
      paymentWebhookLog: { upsert: vi.fn().mockResolvedValue({ id: 'log', processedAt: null }), updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn().mockResolvedValue({}) },
      paymentRequest: { findFirst: vi.fn().mockResolvedValue({ id: 'request-b', tenantId: 'tenant-b', status: 'EXPIRED' }) },
    };
    const service = new PaymentsService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, audit() as any);
    await service.handleSePayWebhook({ id: 'review-txn-a-b', code: 'B-CODE', transferAmount: 100, transferType: 'in', accountNumber: 'B-ACCOUNT' } as any, 'Apikey review-only-key-a');
    expect(prisma.paymentRequest.findFirst).toHaveBeenCalledWith({ where: { provider: 'SEPAY', paymentCode: 'B-CODE', bankAccountNumber: 'B-ACCOUNT' } });
    expect(prisma.paymentWebhookLog.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-b', status: 'NEEDS_REVIEW' }) }));
  });
});
