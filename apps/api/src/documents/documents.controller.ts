import { Controller, Get, Post, Patch, Delete, Body, Param, Res, StreamableFile, Req, UseGuards, UnauthorizedException, UseInterceptors, UploadedFile, BadRequestException, Inject, Query, Redirect } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { Readable } from 'stream';
import { STORAGE_PROVIDER, StorageProvider } from './interfaces/storage-provider.interface';
import { inferMimeTypeFromPath, normalizeStorageReference } from './providers/storage/storage-path.util';

// Assuming JwtAuthGuard is available globally or can be imported.
// In homeland we usually use guards on controllers or globally. 
// We will rely on global auth or standard req.user structure.

import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../shared/guards/permissions.guard';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { Public } from '../shared/decorators/public.decorator';

const DOCUMENT_UPLOAD_LIMIT_BYTES = Number(process.env.DOCUMENT_UPLOAD_LIMIT_BYTES || 20 * 1024 * 1024);

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
  ) {}

  private getTenantId(req: any): string {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant ID missing');
    return tenantId;
  }

  @Get('storage/*')
  @Public()
  async serveStorage(@Param('0') path: string, @Res({ passthrough: true }) res: Response) {
    const normalizedPath = normalizeStorageReference(path || '');
    const buffer = await this.storageProvider.read(normalizedPath);
    res.set({
      'Content-Type': inferMimeTypeFromPath(normalizedPath),
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    return new StreamableFile(Readable.from(buffer));
  }

  @Get('storage-link')
  @Public()
  @Redirect()
  async getStorageLink(@Query('path') path: string, @Query('direct') direct?: string) {
    const normalizedPath = normalizeStorageReference(path || '');
    if (!normalizedPath) {
      throw new BadRequestException('Missing file path');
    }
    if (direct === 'true' && this.storageProvider.getDownloadUrl) {
      return { url: await this.storageProvider.getDownloadUrl(normalizedPath) };
    }
    return { url: normalizedPath ? `/api/v1/documents/storage?path=${encodeURIComponent(normalizedPath)}` : '' };
  }

  @Get('storage')
  @Public()
  async serveStorageByQuery(@Query('path') path: string, @Res({ passthrough: true }) res: Response) {
    const normalizedPath = normalizeStorageReference(path || '');
    if (!normalizedPath) {
      throw new BadRequestException('Missing file path');
    }
    const buffer = await this.storageProvider.read(normalizedPath);
    res.set({
      'Content-Type': inferMimeTypeFromPath(normalizedPath),
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    return new StreamableFile(Readable.from(buffer));
  }

  @Get()
  @RequirePermissions('document.read')
  async findAll(@Req() req: any) {
    return this.documentsService.findAll(this.getTenantId(req));
  }

  @Get(':id')
  @RequirePermissions('document.read')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.documentsService.findOne(this.getTenantId(req), id);
  }

  @Get(':id/download')
  @RequirePermissions('document.download')
  async download(@Req() req: any, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const fileData = await this.documentsService.getDownloadStream(this.getTenantId(req), id);
    
    res.set({
      'Content-Type': fileData.mimeType,
      'Content-Disposition': `attachment; filename="${fileData.fileName}"`,
    });

    return new StreamableFile(Readable.from(fileData.buffer));
  }

  @Get(':id/versions/:versionId/download')
  @RequirePermissions('document.download')
  async downloadVersion(@Req() req: any, @Param('id') id: string, @Param('versionId') versionId: string, @Res({ passthrough: true }) res: Response) {
    const fileData = await this.documentsService.getDownloadStream(this.getTenantId(req), id, versionId);
    
    res.set({
      'Content-Type': fileData.mimeType,
      'Content-Disposition': `attachment; filename="${fileData.fileName}"`,
    });

    return new StreamableFile(Readable.from(fileData.buffer));
  }

  @Throttle({ short: { limit: 100, ttl: 60000 } })
  @Post(':id/generate')
  @RequirePermissions('document.create')
  async generate(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    // For our simplified implementation, we pass templateCode in body or param.
    // The ID might refer to a new document or an existing record.
    return this.documentsService.generateDocument(this.getTenantId(req), body.templateCode, body.payload, {
      createdBy: req.user?.email || 'system',
      title: body.title,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
    });
  }

  @Get(':id/versions')
  @RequirePermissions('document.read')
  async getVersions(@Req() req: any, @Param('id') id: string) {
    const doc = await this.documentsService.findOne(this.getTenantId(req), id);
    return doc.versions;
  }

  @Post('upload')
  @RequirePermissions('document.create')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: DOCUMENT_UPLOAD_LIMIT_BYTES,
    },
  }))
  async uploadFile(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body() body: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const tenantId = this.getTenantId(req);
    const fileName = file.originalname;
    const folder = body.folder || 'uploads';
    const storageResult = await this.documentsService.saveFile(
      tenantId,
      folder,
      fileName,
      file.buffer,
      file.mimetype,
    );
    return {
      url: storageResult.url,
      size: storageResult.size,
      mimeType: storageResult.mimeType,
    };
  }
}
