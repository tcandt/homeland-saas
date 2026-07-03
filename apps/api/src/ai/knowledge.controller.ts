import { Controller, Post, Get, Body, Req, UseGuards, Param, Query } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma.service';

@Controller('ai/knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('ingest/document/:documentId')
  async ingestDocument(@Req() req: any, @Param('documentId') documentId: string) {
    return this.knowledgeService.ingestDocument(req.user.tenantId, documentId);
  }

  @Post('ingest/all')
  async ingestAll(@Req() req: any) {
    const docs = await this.prisma.document.findMany({ where: { tenantId: req.user.tenantId }, select: { id: true }});
    const results = [];
    for (const doc of docs) {
      try {
        await this.knowledgeService.ingestDocument(req.user.tenantId, doc.id);
        results.push({ id: doc.id, status: 'success' });
      } catch (e: any) {
        if (e.message === 'AI_VECTOR_STORE_NOT_READY' || e.message === 'AI_PROVIDER_NOT_CONFIGURED') {
          throw e; // fail fast
        }
        results.push({ id: doc.id, status: 'error', reason: e.message });
      }
    }
    return { ingested: results };
  }

  @Get('search')
  async search(@Req() req: any, @Query('q') query: string) {
    return this.knowledgeService.search(req.user.tenantId, query);
  }

  @Get('documents')
  async getDocuments(@Req() req: any) {
    return this.prisma.aiKnowledgeDocument.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' }
    });
  }
}
