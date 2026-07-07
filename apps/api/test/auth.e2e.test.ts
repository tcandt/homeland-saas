import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma.service';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

describe('Auth Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  const testRunId = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
  const testEmail = `admin_${testRunId}@example.com`;
  const testPassword = 'StrongPassword123!';
  
  let accessToken: string;
  let refreshToken: string;
  let userId: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: ['error', 'warn'] });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    
    prisma = app.get<PrismaService>(PrismaService);

    // Seed ADMIN role if it doesn't exist
    await prisma.role.upsert({
      where: { code: 'ADMIN' },
      update: {},
      create: {
        code: 'ADMIN',
        name: 'Administrator',
      }
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({ where: { email: testEmail } });
    if (tenantId) {
      await prisma.tenantOrg.deleteMany({ where: { id: tenantId } });
    }
    await app.close();
  });

  it('1. Register new Tenant and User', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        fullName: 'Test Admin',
        phone: '0901234567',
      });
      
    if (res.status === 500) {
      console.error('500 ERROR BODY:', res.body);
    }
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.tenantId).toBeDefined();
    
    userId = res.body.user.id;
    tenantId = res.body.user.tenantId;
    
    // Verify DB
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(dbUser).toBeDefined();
    expect(dbUser?.refreshTokenHash).toBeDefined();
    
    // Verify Audit log
    const auditLogs = await prisma.auditLog.findMany({
      where: { entity: 'User', action: 'REGISTER', userId }
    });
    expect(auditLogs.length).toBeGreaterThan(0);
  });

  it('2. Login with valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        emailOrPhone: testEmail,
        password: testPassword,
      });
      
    expect(res.status).toBe(201); // NestJS default for POST is 201
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
    
    // Verify Audit log
    const auditLogs = await prisma.auditLog.findMany({
      where: { entity: 'User', action: 'LOGIN_SUCCESS', userId }
    });
    expect(auditLogs.length).toBeGreaterThan(0);
  });

  it('3. Get Me profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
      
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(testEmail);
    expect(res.body.tenant.id).toBe(tenantId);
  });

  it('4. Refresh token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken
      });
      
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    
    // Update tokens for next test
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('5. Logout', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);
      
    expect(res.status).toBe(201);
    
    // Verify DB refresh token is null
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(dbUser?.refreshTokenHash).toBeNull();
  });

  it('6. Refresh fails after logout', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken
      });
      
    expect(res.status).toBe(401);
  });
});
