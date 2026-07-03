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

      // Check vector db availability (simplified check)
      try {
        await this.prisma.$queryRaw`SELECT 1 FROM pg_extension WHERE extname = 'vector'`;
      } catch (e) {
        throw new BadRequestException('AI_VECTOR_STORE_NOT_READY');
      }

      const textToEmbed = `Tài liệu: ${doc.title}\nLoại: ${doc.type}\nTrạng thái: ${doc.status}`;

      // 2. Chunking (Stub)
      const chunks = [textToEmbed]; // Replace with real chunker later

      // 3. Generate Embeddings
      for (const chunk of chunks) {
        const embedding = await this.aiService.embed(chunk);

        // 4. Save to Vector Store
        const knowledgeDoc = await this.prisma.aiKnowledgeDocument.upsert({
          where: { tenantId_sourceType_sourceId: { tenantId, sourceType: 'Document', sourceId: doc.id } },
          update: { status: 'COMPLETED' },
          create: { tenantId, sourceType: 'Document', sourceId: doc.id, title: doc.title, status: 'COMPLETED' },
        });

        const tokenCount = Math.ceil(chunk.length / 4); // Approximation

        // Raw SQL insert for pgvector
        await this.prisma.$executeRaw`
          INSERT INTO "AiKnowledgeChunk" ("id", "tenantId", "documentId", "content", "tokenCount", "embedding", "createdAt")
          VALUES (gen_random_uuid()::text, ${tenantId}, ${knowledgeDoc.id}, ${chunk}, ${tokenCount}, ${embedding}::vector, NOW())
        `;
      }

      return { success: true, message: 'Ingestion completed' };
    } catch (error: any) {
      if (error.message === 'AI_VECTOR_STORE_NOT_READY' || error.message.includes('AI_PROVIDER_NOT_CONFIGURED')) {
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
