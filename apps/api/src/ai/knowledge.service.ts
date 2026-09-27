import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AiService } from './ai.service';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async ingestDocument(tenantId: string, documentId: string) {
    try {
      // 1. Fetch document text (simplified stub, would read from PDF or extract text)
      const doc = await this.prisma.document.findUnique({
        where: { id: documentId, tenantId },
        include: { versions: true }
      });
      if (!doc) throw new BadRequestException('Document not found');

      // Metadata is not document content. Do not claim a document was ingested
      // until a real extractor supplies text from its current version.
      throw new BadRequestException('AI_DOCUMENT_TEXT_EXTRACTION_UNSUPPORTED');
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error.message === 'AI_VECTOR_STORE_NOT_READY' ||
        error.message.includes('AI_PROVIDER_NOT_CONFIGURED')
      ) {
        throw error;
      }
      this.logger.error(`Ingestion Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to ingest document');
    }
  }

  async search(tenantId: string, query: string, limit: number = 5) {
    try {
      const queryEmbedding = await this.aiService.embed(query);

      // Perform cosine similarity search
      // The lower the distance (operator <=>), the higher the similarity
      const results = await this.prisma.$queryRaw`
        SELECT c.id, c.content, d.title, d."sourceType", 1 - (c.embedding <=> ${queryEmbedding}::vector) as similarity
        FROM "AiKnowledgeChunk" c
        JOIN "AiKnowledgeDocument" d ON c."documentId" = d.id
        WHERE c."tenantId" = ${tenantId}
        ORDER BY c.embedding <=> ${queryEmbedding}::vector
        LIMIT ${limit};
      `;

      return results;
    } catch (error: any) {
      if (error.message === 'AI_PROVIDER_NOT_CONFIGURED' || error.code === 'P2010') {
         throw new BadRequestException('AI_VECTOR_STORE_NOT_READY');
      }
      this.logger.error(`Vector Search Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to search knowledge base');
    }
  }
}
