import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
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
  list(@Query() query: any) {
    const { page, limit, search, sort, order } = PaginationSchema.parse(query);
    const status = query.status;
    return this.customersService.listCustomers(page, limit, search, status, sort, order);
  }

  @Post('cleanup')
  @RequirePermissions('customer.delete')
  @ApiOperation({ summary: 'Auto cleanup expired and inactive customers older than 30 days' })
  cleanup(@Query('days') days?: string) {
    const daysThreshold = days ? parseInt(days, 10) : 30;
    return this.customersService.cleanupExpiredAndInactiveCustomers(daysThreshold);
  }

  @Post('deduplicate')
  @RequirePermissions('customer.update')
  @ApiOperation({ summary: 'Deduplicate customers by phone and identity number' })
  deduplicate(@CurrentUser('id') userId: string) {
    return this.customersService.deduplicateCustomers(userId);
  }

  @Get(':id')
  @RequirePermissions('customer.read')
  @ApiOperation({ summary: 'Get customer details' })
  getDetail(@Param('id') id: string) {
    return this.customersService.getDetail(id, {
      contracts: { include: { room: { include: { building: true } } } },
    });
  }

  @Post()
  @RequirePermissions('customer.create')
  @ApiOperation({ summary: 'Create customer' })
  create(@Body() body: any, @CurrentUser('id') userId: string) {
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
    };
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
      ...(input.idImages !== undefined && { idImages: input.idImages }),
    };
    return this.customersService.update(id, data, userId, 'Customers');
  }

  @Delete(':id')
  @RequirePermissions('customer.delete')
  @ApiOperation({ summary: 'Soft delete customer' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.customersService.softDelete(id, userId, 'Customers');
  }
}
