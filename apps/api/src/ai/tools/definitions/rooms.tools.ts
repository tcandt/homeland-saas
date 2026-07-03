import { AiTool, AiToolContext, AiToolDefinition } from '../tool.interface';

export class SearchRoomsTool implements AiTool {
  definition: AiToolDefinition = {
    name: 'searchRooms',
    description: 'Tìm kiếm phòng theo trạng thái (ví dụ: đang trống, sắp hết hạn, đang nợ)',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Trạng thái phòng: VACANT, RENTED, MAINTENANCE' }
      },
      required: ['status']
    },
    isSafe: true,
    requiredPermissions: ['room.read']
  };

  async execute(args: any, context: AiToolContext): Promise<any> {
    return {
      message: `Tìm thấy 3 phòng với trạng thái ${args.status}`,
      data: [
        { id: 'room-1', name: 'A101', status: args.status },
        { id: 'room-2', name: 'B202', status: args.status },
        { id: 'room-3', name: 'C303', status: args.status }
      ]
    };
  }
}

export class GetRoomDetailTool implements AiTool {
  definition: AiToolDefinition = {
    name: 'getRoomDetail',
    description: 'Lấy thông tin chi tiết của một phòng cụ thể',
    parameters: {
      type: 'object',
      properties: {
        roomId: { type: 'string', description: 'ID của phòng' }
      },
      required: ['roomId']
    },
    isSafe: true,
    requiredPermissions: ['room.read']
  };

  async execute(args: any, context: AiToolContext): Promise<any> {
    return {
      message: `Lấy thông tin phòng ${args.roomId} thành công`,
      data: { id: args.roomId, name: 'A101', tenantName: 'Nguyễn Văn A', contractEndDate: '2027-01-01' }
    };
  }
}
