const path = require('node:path');
const a = require('node:assert/strict');
const root = path.resolve(process.argv[2]);
const load = name => require(path.join(root, name));
const { Test } = load('node_modules/@nestjs/testing');
const { Reflector } = load('node_modules/@nestjs/core');
const request = load('node_modules/supertest');
const { ContractsController } = load('apps/api/dist/contracts/contracts.controller');
const { ContractsService } = load('apps/api/dist/contracts/contracts.service');
const { PermissionsGuard } = load('apps/api/dist/shared/guards/permissions.guard');
const { GlobalExceptionFilter } = load('apps/api/dist/shared/exceptions/global-exception.filter');
async function main() {
  const calls = [];
  const module = await Test.createTestingModule({ controllers: [ContractsController], providers: [{
    provide: ContractsService, useValue: { importExisting: (...args) => { calls.push(args); return { contract: { id: 'fixture' } }; } },
  }] }).compile();
  const app = module.createNestApplication({ logger: false });
  app.use((req, res, next) => {
    req.user = { id: 'http-user', tenantId: 'http-tenant', roles: [], permissions: String(req.headers['x-test-permissions'] || '').split(',') };
    next();
  });
  app.useGlobalGuards(new PermissionsGuard(new Reflector()));
  app.useGlobalFilters(new GlobalExceptionFilter({ getId: () => 'fixture-request' }));
  await app.init();
  try {
    const endpoint = '/contracts/import-existing';
    const permissions = 'contract.create,contract.approve,contract.activate,deposit.create,deposit.collect';
    const payload = { idempotencyKey: 'http-legacy-command', customerId: 'fixture-customer', roomId: 'fixture-room',
      startDate: '2026-01-01', endDate: '2027-12-31', paidThrough: '2026-10-31', rentAmount: 3000000, depositAmount: 0 };
    await request(app.getHttpServer()).post(endpoint).send(payload).expect(403);
    await request(app.getHttpServer()).post(endpoint).set('x-test-permissions', 'contract.create').send(payload).expect(403);
    await request(app.getHttpServer()).post(endpoint).set('x-test-permissions', permissions).send({ ...payload, rentAmount: -1 }).expect(400);
    a.equal(calls.length, 0);
    await request(app.getHttpServer()).post(endpoint).set('x-test-permissions', permissions)
      .set('Idempotency-Key', payload.idempotencyKey).send(payload).expect(201);
    a.equal(calls.length, 1);
    a.deepEqual(calls[0].slice(1), ['http-user', 'http-tenant', payload.idempotencyKey]);
    a.equal(calls[0][0].depositAmount, 0);
    console.log('HTTP_CONTROLLER_PASS 4/4: permissions, approval scope, validation, authenticated command context');
  } finally { await app.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
