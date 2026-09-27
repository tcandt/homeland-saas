import { describe, expect, it, vi } from 'vitest';
import { KnowledgeService } from './knowledge.service';

describe('KnowledgeService ingestDocument', () => {
  it('fails closed before embedding or persisting when text extraction is unsupported', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 'document-1',
      title: 'Lease agreement',
      type: 'PDF',
      status: 'PUBLISHED',
    });
    const upsert = vi.fn();
    const executeRaw = vi.fn();
    const embed = vi.fn();
    const prisma: any = {
      document: { findUnique },
      aiKnowledgeDocument: { upsert },
      $executeRaw: executeRaw,
    };
    const aiService: any = { embed };
    const service = new KnowledgeService(prisma, aiService);

    await expect(service.ingestDocument('tenant-1', 'document-1')).rejects.toThrow(
      'AI_DOCUMENT_TEXT_EXTRACTION_UNSUPPORTED',
    );

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'document-1', tenantId: 'tenant-1' },
      include: { versions: true },
    });
    expect(embed).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
