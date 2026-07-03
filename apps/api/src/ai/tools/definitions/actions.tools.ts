import { AiTool, AiToolContext, AiToolDefinition } from '../tool.interface';

export class CreateTaskDraftTool implements AiTool {
  definition: AiToolDefinition = {
    name: 'createTaskDraft',
    description: 'Tạo bản nháp công việc/task mới',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Tiêu đề công việc' },
        description: { type: 'string', description: 'Mô tả chi tiết' },
        assigneeId: { type: 'string', description: 'Người được giao' }
      },
      required: ['title']
    },
    isSafe: false, // Requires confirmation
    returnsDraft: true,
    requiredPermissions: ['task.create']
  };

  async execute(args: any, context: AiToolContext): Promise<any> {
    return {
      message: `Đã tạo bản nháp công việc: ${args.title}`,
      data: { draftId: 'draft-task-1', ...args, status: 'DRAFT' },
      actionRequired: 'CONFIRM_DRAFT'
    };
  }
}

export class CreateNotificationDraftTool implements AiTool {
  definition: AiToolDefinition = {
    name: 'createNotificationDraft',
    description: 'Tạo bản nháp thông báo gửi cho khách thuê',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Tiêu đề thông báo' },
        content: { type: 'string', description: 'Nội dung thông báo' },
        targetAudience: { type: 'string', description: 'Đối tượng nhận: ALL, DEBTORS' }
      },
      required: ['title', 'content']
    },
    isSafe: false, // Requires confirmation
    returnsDraft: true,
    requiredPermissions: ['notification.create']
  };

  async execute(args: any, context: AiToolContext): Promise<any> {
    return {
      message: `Đã tạo bản nháp thông báo: ${args.title}`,
      data: { draftId: 'draft-notif-1', ...args, status: 'DRAFT' },
      actionRequired: 'CONFIRM_DRAFT'
    };
  }
}
