import { AiAgent, AiAgentDefinition } from '../agent.interface';
import { AiTool } from '../../tools/tool.interface';
import { SearchRoomsTool, GetRoomDetailTool } from '../../tools/definitions/rooms.tools';
import { SearchDocumentsTool } from '../../tools/definitions/documents.tools';
import { CreateTaskDraftTool } from '../../tools/definitions/actions.tools';

export class BuildingAgent implements AiAgent {
  definition: AiAgentDefinition = {
    id: 'agent_building',
    name: 'BuildingAgent',
    description: 'Quản lý tòa nhà, phòng, trạng thái trống/thuê',
    systemPrompt: `Bạn là trợ lý Quản lý Tòa nhà của hệ thống HomeLand PMS.
Chuyên môn của bạn là tra cứu thông tin phòng, tình trạng trống, đang thuê hoặc bảo trì.
Khi được hỏi về phòng, hãy luôn kiểm tra trạng thái mới nhất.`,
    allowedTools: ['searchRooms', 'getRoomDetail'],
    requiredPermissions: ['room.read'],
    safetyRules: ['Không thay đổi trạng thái phòng trực tiếp']
  };

  getTools(): AiTool[] {
    return [
      new SearchRoomsTool(),
      new GetRoomDetailTool()
    ];
  }
}

export class DocumentAgent implements AiAgent {
  definition: AiAgentDefinition = {
    id: 'agent_document',
    name: 'DocumentAgent',
    description: 'Quản lý tài liệu, hợp đồng, biên bản',
    systemPrompt: `Bạn là trợ lý Quản lý Tài liệu của hệ thống HomeLand PMS.
Chuyên môn của bạn là tra cứu các hợp đồng, hóa đơn, và văn bản liên quan đến khách thuê.
Lưu ý: Không được phép tự động ký tài liệu.`,
    allowedTools: ['searchDocuments'],
    requiredPermissions: ['document.read'],
    safetyRules: ['Không được phép tự động ký tài liệu', 'Không xóa tài liệu']
  };

  getTools(): AiTool[] {
    return [
      new SearchDocumentsTool()
    ];
  }
}

export class OperationsAgent implements AiAgent {
  definition: AiAgentDefinition = {
    id: 'agent_operations',
    name: 'OperationsAgent',
    description: 'Quản lý vận hành chung, công việc và thông báo',
    systemPrompt: `Bạn là trợ lý Vận hành chung của hệ thống HomeLand PMS.
Chuyên môn của bạn là điều phối công việc, xem dashboard tổng quan, và lên lịch trình.
Tất cả các hành động tạo task/thông báo phải ở dạng DRAFT và đợi người dùng xác nhận.`,
    allowedTools: ['createTaskDraft'],
    requiredPermissions: [],
    safetyRules: ['Tất cả hành động tạo mới phải là DRAFT', 'Không được xóa data']
  };

  getTools(): AiTool[] {
    return [
      new CreateTaskDraftTool()
    ];
  }
}

export class ContractAgent implements AiAgent {
  definition: AiAgentDefinition = {
    id: 'agent_contract',
    name: 'ContractAgent',
    description: 'Xử lý hợp đồng, gia hạn, thanh lý',
    systemPrompt: `Bạn là trợ lý Hợp đồng.
Chuyên quản lý gia hạn, tạo mới hợp đồng, thanh lý. Mọi action tạo mới phải là DRAFT.`,
    allowedTools: ['searchDocuments'], // For now reuse search document
    requiredPermissions: ['contract.read'],
    safetyRules: ['Mọi action tạo mới phải là DRAFT', 'Tuyệt đối không auto-sign hợp đồng']
  };

  getTools(): AiTool[] {
    return [new SearchDocumentsTool()];
  }
}

export class SalesAgent implements AiAgent {
  definition: AiAgentDefinition = {
    id: 'agent_sales',
    name: 'SalesAgent',
    description: 'Tư vấn, chốt sales, khách hàng tiềm năng',
    systemPrompt: `Bạn là trợ lý Sales.
Hỗ trợ tìm phòng trống, báo giá, giữ chỗ. Tất cả hành động giữ chỗ/tạo thông báo đều là DRAFT.`,
    allowedTools: ['searchRooms', 'getRoomDetail'],
    requiredPermissions: ['customer.read'],
    safetyRules: ['Không được thu tiền', 'Tất cả hành động tạo mới phải là DRAFT']
  };

  getTools(): AiTool[] {
    return [new SearchRoomsTool(), new GetRoomDetailTool()];
  }
}
