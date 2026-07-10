import { Controller, Get, Post, Patch, Delete, Body, Param, Res, StreamableFile, Req, UseGuards, UnauthorizedException, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { Readable } from 'stream';

// Assuming JwtAuthGuard is available globally or can be imported.
// In homeland we usually use guards on controllers or globally. 
// We will rely on global auth or standard req.user structure.

import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../shared/guards/permissions.guard';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  private getTenantId(req: any): string {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant ID missing');
    return tenantId;
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
  @UseInterceptors(FileInterceptor('file'))
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
