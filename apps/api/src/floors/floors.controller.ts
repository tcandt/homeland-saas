import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FloorsService } from './floors.service';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { CreateFloorSchema, UpdateFloorSchema, PaginationSchema } from '@homeland/shared';

@ApiTags('Floors')
@ApiBearerAuth()
@Controller('floors')
export class FloorsController {
  constructor(private readonly floorsService: FloorsService) {}

  @Get()
  @RequirePermissions('floor.read')
  @ApiOperation({ summary: 'List floors' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  list(@Query() query: any) {
    const { page, limit, search, sort, order } = PaginationSchema.parse(query);
    const buildingId = query.buildingId;
    return this.floorsService.listFloors(page, limit, search, buildingId, sort, order);
  }

  @Get(':id')
  @RequirePermissions('floor.read')
  @ApiOperation({ summary: 'Get floor details' })
  getDetail(@Param('id') id: string) {
    return this.floorsService.getDetail(id, {
      building: { select: { id: true, name: true, code: true } },
      rooms: true,
    });
  }

  @Post()
  @RequirePermissions('floor.create')
  @ApiOperation({ summary: 'Create floor' })
  create(@Body() body: any, @CurrentUser('id') userId: string) {
    const input = CreateFloorSchema.parse(body);
    return this.floorsService.create(input, userId, 'Floors');
  }

  @Patch(':id')
  @RequirePermissions('floor.update')
  @ApiOperation({ summary: 'Update floor' })
  update(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    const input = UpdateFloorSchema.parse(body);
    return this.floorsService.update(id, input, userId, 'Floors');
  }

  @Delete(':id')
  @RequirePermissions('floor.delete')
  @ApiOperation({ summary: 'Soft delete floor' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.floorsService.softDelete(id, userId, 'Floors');
  }
}
