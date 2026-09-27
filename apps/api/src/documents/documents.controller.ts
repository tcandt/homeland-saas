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

const DOCUMENT_UPLOAD_LIMIT_BYTES = Number(process.env.DOCUMENT_UPLOAD_LIMIT_BYTES || 20 * 1024 * 1024);
const ALLOWED_UPLOAD_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

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
  @RequirePermissions('document.download')
  async serveStorage(@Req() req: any, @Param('0') path: string, @Res({ passthrough: true }) res: Response) {
    const normalizedPath = normalizeStorageReference(path || '');
    const storagePath = await this.documentsService.resolveTenantStoragePath(this.getTenantId(req), normalizedPath);
    const buffer = await this.storageProvider.read(storagePath);
    res.set({
      'Content-Type': inferMimeTypeFromPath(storagePath),
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(Readable.from(buffer));
  }

  @Get('storage-link')
  @RequirePermissions('document.download')
  @Redirect()
  async getStorageLink(@Req() req: any, @Query('path') path: string, @Query('direct') direct?: string) {
    const normalizedPath = normalizeStorageReference(path || '');
    if (!normalizedPath) {
      throw new BadRequestException('Missing file path');
    }
    const storagePath = await this.documentsService.resolveTenantStoragePath(this.getTenantId(req), normalizedPath);
    if (direct === 'true' && this.storageProvider.getDownloadUrl) {
      return { url: await this.storageProvider.getDownloadUrl(storagePath) };
    }
    return { url: `/api/v1/documents/storage?path=${encodeURIComponent(normalizedPath)}` };
  }

  @Get('storage')
  @RequirePermissions('document.download')
  async serveStorageByQuery(@Req() req: any, @Query('path') path: string, @Res({ passthrough: true }) res: Response) {
    const normalizedPath = normalizeStorageReference(path || '');
    if (!normalizedPath) {
      throw new BadRequestException('Missing file path');
    }
    const storagePath = await this.documentsService.resolveTenantStoragePath(this.getTenantId(req), normalizedPath);
    const buffer = await this.storageProvider.read(storagePath);
    res.set({
      'Content-Type': inferMimeTypeFromPath(storagePath),
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(Readable.from(buffer));
  }

  @Get()
  @RequirePermissions('document.read')
  async findAll(@Req() req: any) {
    return this.documentsService.findAll(this.getTenantId(req));
  }

  @Get('templates')
  @RequirePermissions('document.read')
  async listTemplates(@Req() req: any) {
    return this.documentsService.listTemplates(this.getTenantId(req));
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
    const templateCode = typeof body?.templateCode === 'string' ? body.templateCode.trim() : '';
    if (!templateCode) {
      throw new BadRequestException('Template code is required');
    }

    if (body?.payload !== undefined && (
      body.payload === null ||
      typeof body.payload !== 'object' ||
      Array.isArray(body.payload)
    )) {
      throw new BadRequestException('Document payload must be an object');
    }

    return this.documentsService.generateDocument(this.getTenantId(req), templateCode, body?.payload || {}, {
      createdBy: req.user?.email || 'system',
      title: typeof body?.title === 'string' ? body.title.trim() || undefined : undefined,
      sourceType: typeof body?.sourceType === 'string' ? body.sourceType.trim() || undefined : undefined,
      sourceId: typeof body?.sourceId === 'string' ? body.sourceId.trim() || undefined : undefined,
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
    const byteLength = Number(file.size ?? file.buffer?.length ?? 0);
    if (byteLength > DOCUMENT_UPLOAD_LIMIT_BYTES) {
      throw new BadRequestException(`File exceeds the ${Math.floor(DOCUMENT_UPLOAD_LIMIT_BYTES / (1024 * 1024))} MB upload limit`);
    }
    const mimeType = typeof file.mimetype === 'string' ? file.mimetype.toLowerCase().trim() : '';
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException('Only PDF or image files are supported');
    }
    const tenantId = this.getTenantId(req);
    const fileName = file.originalname;
    const folder = body.folder || 'uploads';
    const upload = await this.documentsService.createUploadedDocument(
      tenantId,
      folder,
      fileName,
      file.buffer,
      mimeType,
      { createdBy: req.user?.email },
    );
    return {
      url: upload.url,
      size: upload.size,
      mimeType: upload.mimeType,
      documentId: upload.documentId,
      versionId: upload.versionId,
    };
  }
}
