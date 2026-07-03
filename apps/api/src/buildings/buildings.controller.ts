import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { BuildingsService } from './buildings.service';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { CreateBuildingSchema, UpdateBuildingSchema, PaginationSchema } from '@homeland/shared';

@ApiTags('Buildings')
@ApiBearerAuth()
@Controller('buildings')
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get()
  @RequirePermissions('building.read')
  @ApiOperation({ summary: 'List buildings' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  list(@Query() query: any) {
    const { page, limit, search, sort, order } = PaginationSchema.parse(query);
    const status = query.status;
    return this.buildingsService.listBuildings(page, limit, search, status, sort, order);
  }

  @Get(':id')
  @RequirePermissions('building.read')
  @ApiOperation({ summary: 'Get building details' })
  getDetail(@Param('id') id: string) {
    return this.buildingsService.getDetail(id, {
      floors: true,
      rooms: true,
    });
  }

  @Post()
  @RequirePermissions('building.create')
  @ApiOperation({ summary: 'Create building' })
  create(@Body() body: any, @CurrentUser('id') userId: string) {
    const input = CreateBuildingSchema.parse(body);
    return this.buildingsService.create(input, userId, 'Buildings');
  }

  @Patch(':id')
  @RequirePermissions('building.update')
  @ApiOperation({ summary: 'Update building' })
  update(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    const input = UpdateBuildingSchema.parse(body);
    return this.buildingsService.update(id, input, userId, 'Buildings');
  }

  @Delete(':id')
  @RequirePermissions('building.delete')
  @ApiOperation({ summary: 'Soft delete building' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.buildingsService.softDelete(id, userId, 'Buildings');
  }
}
