import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Headers, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CustomersService, IDENTITY_UPLOAD_LIMIT_BYTES } from './customers.service';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { CreateCustomerSchema, UpdateCustomerSchema, PaginationSchema } from '@homeland/shared';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions('customer.read')
  @ApiOperation({ summary: 'List customers' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  list(@Query() query: any, @CurrentUser('tenantId') tenantId: string) {
    const { page, limit, search, sort, order } = PaginationSchema.parse(query);
    const status = query.status;
    return this.customersService.listCustomers(tenantId, page, limit, search, status, sort, order);
  }

  @Post('deduplicate')
  @RequirePermissions('customer.update')
  @ApiOperation({ summary: 'Deduplicate customers by phone and identity number' })
  deduplicate(@CurrentUser('id') userId: string) {
    return this.customersService.deduplicateCustomers(userId);
  }

  @Get('check-duplicate')
  @RequirePermissions('customer.read')
  @ApiOperation({ summary: 'Lightweight check if phone or identity number already exists' })
  checkDuplicate(
    @Query('phone') phone?: string,
    @Query('identityNo') identityNo?: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.customersService.checkDuplicate({ phone, identityNo, excludeId });
  }

  @Get(':id')
  @RequirePermissions('customer.read')
  @ApiOperation({ summary: 'Get customer details' })
  getDetail(@Param('id') id: string) {
    return this.customersService.getDetail(id, {
      contracts: { include: { room: { include: { building: true } } } },
      occupancies: {
        where: { leftAt: null },
        select: { id: true, roomId: true, leftAt: true, room: { select: { id: true, code: true, name: true } } },
      },
    });
  }

  @Post()
  @RequirePermissions('customer.create')
  @ApiOperation({ summary: 'Create customer' })
  create(
    @Body() body: any,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const input = CreateCustomerSchema.parse(body);
    const data = {
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      identityNo: input.citizenId,
      gender: input.gender,
      birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
      nationality: input.nationality,
      address: input.address,
      zaloChatId: input.zaloChatId,
      zaloUserId: input.zaloUserId,
      emergencyPhone: input.emergencyPhone,
      roomId: input.roomId,
      relationship: input.relationship,
      notes: input.notes,
      idImages: input.idImages,
    };
    if (idempotencyKey) {
      return this.customersService.createIdempotent(tenantId, userId, data, idempotencyKey);
    }
    return this.customersService.create(data, userId, 'Customers');
  }

  @Patch(':id')
  @RequirePermissions('customer.update')
  @ApiOperation({ summary: 'Update customer' })
  update(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    const input = UpdateCustomerSchema.parse(body);
    const data: any = {
      ...(input.fullName !== undefined && { fullName: input.fullName }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.citizenId !== undefined && { identityNo: input.citizenId }),
      ...(input.gender !== undefined && { gender: input.gender }),
      ...(input.birthDate !== undefined && { birthDate: input.birthDate ? new Date(input.birthDate) : null }),
      ...(input.nationality !== undefined && { nationality: input.nationality }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.zaloChatId !== undefined && { zaloChatId: input.zaloChatId }),
      ...(input.zaloUserId !== undefined && { zaloUserId: input.zaloUserId }),
      ...(input.emergencyPhone !== undefined && { emergencyPhone: input.emergencyPhone }),
      ...(input.roomId !== undefined && { roomId: input.roomId }),
      ...(input.relationship !== undefined && { relationship: input.relationship }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.idImages !== undefined && { idImages: input.idImages }),
    };
    return this.customersService.update(id, data, userId, 'Customers');
  }

  @Post(':id/identity-images/approve')
  @RequirePermissions('customer.update')
  @ApiOperation({ summary: 'Approve tenant-owned CCCD front/back images' })
  approveIdentityImages(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const images = Array.isArray(body?.images) ? body.images.map((image: any) => ({
      url: String(image?.url || '').trim(),
      side: image?.side,
      source: image?.source,
      ...(image?.originalUrl !== undefined && { originalUrl: String(image.originalUrl).trim() }),
    })) : [];
    return this.customersService.approveIdentityImages(id, tenantId, userId, images);
  }

  @Post(':id/identity-images/upload')
  @RequirePermissions('customer.update', 'document.create')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'file', maxCount: 1 }, { name: 'original', maxCount: 1 }], {
    // Busboy emits `partsLimit` when the part count reaches this value. The
    // valid scan payload has four parts: side, source, file and original.
    limits: { fileSize: IDENTITY_UPLOAD_LIMIT_BYTES, files: 2, fields: 2, parts: 5 },
  }))
  uploadIdentityImage(
    @Param('id') id: string, @Body() body: any,
    @UploadedFiles() files: any,
    @CurrentUser('id') userId: string, @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.customersService.uploadIdentityImage(
      id, tenantId, userId, body?.side, body?.source, files?.file?.[0], files?.original?.[0],
    );
  }

  @Post(':id/identity-images/revoke')
  @RequirePermissions('customer.update')
  @ApiOperation({ summary: 'Revoke a tenant-owned CCCD image from the approved set' })
  revokeIdentityImage(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.customersService.revokeIdentityImage(id, tenantId, userId, String(body?.url || '').trim());
  }

  @Delete(':id')
  @RequirePermissions('customer.delete')
  @ApiOperation({ summary: 'Soft delete customer' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.customersService.softDelete(id, userId, 'Customers');
  }
}
