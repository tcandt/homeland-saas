import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma.service';
import { AuthService } from './../src/auth/auth.service';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

describe('Building Property Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let tenant1Token: string;
  let tenant2Token: string;
  let tenant1Id: string;
  let tenant2Id: string;
  let buildingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: ['error', 'warn', 'debug', 'log'] });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    
    prisma = app.get<PrismaService>(PrismaService);

    // Seed Roles if missing
    await prisma.role.upsert({
      where: { code: 'ADMIN' },
      update: {},
      create: {
        code: 'ADMIN',
        name: 'Administrator',
        permissions: {
          create: [
            { permission: { create: { key: 'building.create', description: 'Create Building' } } },
            { permission: { create: { key: 'building.read', description: 'Read Building' } } },
            { permission: { create: { key: 'building.update', description: 'Update Building' } } },
            { permission: { create: { key: 'building.delete', description: 'Delete Building' } } },
            { permission: { create: { key: 'room.create', description: 'Create Room' } } },
            { permission: { create: { key: 'room.read', description: 'Read Room' } } },
            { permission: { create: { key: 'room.update', description: 'Update Room' } } },
            { permission: { create: { key: 'room.delete', description: 'Delete Room' } } },
          ]
        }
      }
    });

    const authService = app.get(AuthService);
    
    // Register Tenant 1
    const res1 = await authService.register({ email: 't1@example.com', password: 'Password123!', fullName: 'Tenant One' }, '127.0.0.1', 'Vitest');
    tenant1Token = res1.accessToken;
    tenant1Id = res1.user.tenantId;

    // Register Tenant 2
    const res2 = await authService.register({ email: 't2@example.com', password: 'Password123!', fullName: 'Tenant Two' }, '127.0.0.1', 'Vitest');
    tenant2Token = res2.accessToken;
    tenant2Id = res2.user.tenantId;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.building.deleteMany({ where: { tenantId: { in: [tenant1Id, tenant2Id] } } });
    await prisma.user.deleteMany({ where: { email: { in: ['t1@example.com', 't2@example.com'] } } });
    if (tenant1Id && tenant2Id) {
      await prisma.tenantOrg.deleteMany({ where: { id: { in: [tenant1Id, tenant2Id] } } });
    }
    await app.close();
  });

  it('1. Create Building - API CRUD and Database Verification', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/buildings')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        code: 'BLD-ALPHA',
        name: 'Alpha Tower',
        address: '123 Alpha St',
        status: 'active'
      });
    
    expect(res.status).toBe(201);
    buildingId = res.body.id;

    // Verify DB
    const dbBuilding = await prisma.building.findUnique({ where: { id: buildingId } });
    expect(dbBuilding).toBeDefined();
    expect(dbBuilding?.tenantId).toBe(tenant1Id);
    expect(dbBuilding?.name).toBe('Alpha Tower');
  });

  it('2. Tenant Isolation - Tenant 2 cannot read Tenant 1 building', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/buildings')
      .set('Authorization', `Bearer ${tenant2Token}`);
    
    expect(res.status).toBe(200);
    // Should have 0 buildings for Tenant 2
    expect(res.body.data).toHaveLength(0);

    // Direct access attempt
    const resDirect = await request(app.getHttpServer())
      .get(`/api/v1/buildings/${buildingId}`)
      .set('Authorization', `Bearer ${tenant2Token}`);
    expect(resDirect.status).toBe(404);
  });

  it('3. Audit Log Verification', async () => {
    const allLogs = await prisma.auditLog.findMany({ where: { tenantId: tenant1Id } });
    console.log('All Tenant1 Audit Logs:', allLogs);
    
    const auditLogs = await prisma.auditLog.findMany({
      where: { entity: 'Building', action: 'CREATE', tenantId: tenant1Id }
    });
    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].entityId).toBe(buildingId);
  });
});
