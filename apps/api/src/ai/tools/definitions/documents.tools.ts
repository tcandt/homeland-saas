import { AiTool, AiToolContext, AiToolDefinition } from '../tool.interface';

export class SearchDocumentsTool implements AiTool {
  definition: AiToolDefinition = {
    name: 'searchDocuments',
    description: 'Tìm kiếm tài liệu, hợp đồng, biên bản trong hệ thống',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Từ khóa tìm kiếm' },
        type: { type: 'string', description: 'Loại tài liệu: CONTRACT, INVOICE, RECEIPT' }
      },
      required: ['keyword']
    },
    isSafe: true,
    requiredPermissions: ['document.read']
  };

  async execute(args: any, context: AiToolContext): Promise<any> {
    return {
      message: `Kết quả tìm kiếm tài liệu cho từ khóa: ${args.keyword}`,
      data: [
        { id: 'doc-1', title: 'Hợp đồng thuê phòng A101', type: 'CONTRACT', status: 'SIGNED' }
      ]
    };
  }
}
