import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { CreateRoomSchema, UpdateRoomSchema, PaginationSchema } from '@homeland/shared';

@ApiTags('Rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @RequirePermissions('room.read')
  @ApiOperation({ summary: 'List rooms' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'floorId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  list(@Query() query: any) {
    const { page, limit, search, sort, order } = PaginationSchema.parse(query);
    const { buildingId, floorId, status, type } = query;
    return this.roomsService.listRooms(page, limit, search, buildingId, floorId, status, type, sort, order);
  }

  @Get(':id')
  @RequirePermissions('room.read')
  @ApiOperation({ summary: 'Get room details' })
  getDetail(@Param('id') id: string) {
    return this.roomsService.getDetail(id, {
      building: { select: { id: true, name: true, code: true } },
      floor: { select: { id: true, name: true, level: true } },
      contracts: {
        where: { deletedAt: null },
        include: { customer: true },
      },
      roommates: {
        where: { deletedAt: null },
      },
    });
  }

  @Post()
  @RequirePermissions('room.create')
  @ApiOperation({ summary: 'Create room' })
  create(@Body() body: any, @CurrentUser('id') userId: string) {
    const input = CreateRoomSchema.parse(body);
    return this.roomsService.create(input, userId, 'Rooms');
  }

  @Patch(':id')
  @RequirePermissions('room.update')
  @ApiOperation({ summary: 'Update room' })
  update(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    const input = UpdateRoomSchema.parse(body);
    return this.roomsService.update(id, input, userId, 'Rooms');
  }

  @Delete(':id')
  @RequirePermissions('room.delete')
  @ApiOperation({ summary: 'Soft delete room' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.roomsService.softDelete(id, userId, 'Rooms');
  }
}
