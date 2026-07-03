import { Controller, Get, Post, Body, Param, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Signature Requests')
@ApiBearerAuth()
@Controller('signature-requests')
export class SignatureRequestsController {
  constructor(private readonly documentsService: DocumentsService) {}

  private getTenantId(req: any): string {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant ID missing');
    return tenantId;
  }

  @Post()
  async createRequest(@Req() req: any, @Body() body: any) {
    if (!body.documentId || !body.parties || !body.parties.length) {
      throw new BadRequestException('Invalid signature request payload');
    }
    return this.documentsService.requestSignature(this.getTenantId(req), body.documentId, body);
  }

  @Post(':id/sign')
  async sign(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    if (!body.partyId || !body.signatureData) {
      throw new BadRequestException('Missing partyId or signatureData');
    }
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.documentsService.applySignature(this.getTenantId(req), id, body.partyId, body.signatureData, ipAddress);
  }
}
