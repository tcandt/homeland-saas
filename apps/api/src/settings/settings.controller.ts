import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, StreamableFile, UploadedFile, UseInterceptors, BadRequestException, UseGuards, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SettingScope } from '@prisma/client';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { Public } from '../shared/decorators/public.decorator';
import { SettingsService } from './settings.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../shared/guards/permissions.guard';
import { Readable } from 'stream';
import type { Response } from 'express';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { STORAGE_PROVIDER, StorageProvider } from '../documents/interfaces/storage-provider.interface';
import { inferMimeTypeFromPath, normalizeStorageReference } from '../documents/providers/storage/storage-path.util';

function parseScope(scope?: string): SettingScope {
  return scope === 'USER' ? SettingScope.USER : SettingScope.TENANT;
}

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
  ) {}

  @Get('file')
  @RequirePermissions('setting.read')
  @ApiOperation({ summary: 'Download a settings asset' })
  @ApiQuery({ name: 'path', required: true })
  async getFile(
    @Query('path') path: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const normalizedPath = normalizeStorageReference(path || '');
    if (!normalizedPath) {
      throw new BadRequestException('Missing file path');
    }

    const buffer = await this.storageProvider.read(normalizedPath);
    const fileName = normalizedPath.split('/').pop() || 'asset';
    const mimeType = inferMimeTypeFromPath(fileName);

    res.set({
      'Content-Type': mimeType,
      'Cache-Control': 'private, no-store',
    });

    return new StreamableFile(buffer);
  }

  @Get('public/access-control')
  @Public()
  @ApiOperation({ summary: 'Get public access-control state' })
  getPublicAccessControl() {
    return this.settingsService.getPublicAccessControl();
  }

  @Get(':key')
  @RequirePermissions('setting.read')
  @ApiOperation({ summary: 'Get a settings section' })
  @ApiQuery({ name: 'scope', required: false, enum: SettingScope })
  getSection(
    @Param('key') key: string,
    @Query('scope') scope: string | undefined,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.settingsService.getSection(tenantId, userId, key, parseScope(scope));
  }

  @Patch(':key')
  @RequirePermissions('setting.update')
  @ApiOperation({ summary: 'Save a settings section' })
  saveSection(
    @Param('key') key: string,
    @Body() body: { scope?: string; value?: any },
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    const scope = parseScope(body?.scope);
    return this.settingsService.saveSection(tenantId, userId, key, scope, body?.value ?? {}, userId);
  }

  @Post('upload')
  @RequirePermissions('setting.update')
  @ApiOperation({ summary: 'Upload a settings asset (avatar/logo)' })
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 2 * 1024 * 1024,
    },
  }))
  async uploadAsset(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body() body: { folder?: string; scope?: string; purpose?: string },
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const scope = parseScope(body?.scope);
    const folder = ['avatars', 'business', 'settings'].includes(body?.folder || '')
      ? body.folder!
      : 'settings';
    const purpose = body?.purpose || 'asset';
    const fileName = `${purpose}-${Date.now()}.${(file.originalname || 'png').split('.').pop() || 'png'}`;

    const saved = await this.storageProvider.save(
      tenantId,
      folder,
      fileName,
      file.buffer,
      file.mimetype,
    );

    return {
      url: saved.url,
      size: saved.size,
      mimeType: saved.mimeType,
      scope,
      folder,
    };
  }
}
