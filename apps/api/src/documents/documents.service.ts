import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LocalStorageProvider } from './providers/storage/local-storage.provider';
import { PuppeteerPdfProvider } from './providers/pdf/puppeteer-pdf.provider';
import { InternalSignatureProvider } from './providers/signature/internal-signature.provider';
import * as handlebars from 'handlebars';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageProvider: LocalStorageProvider,
    private readonly pdfProvider: PuppeteerPdfProvider,
    private readonly signatureProvider: InternalSignatureProvider,
  ) {
    // Register handlebars helpers
    handlebars.registerHelper('formatCurrency', (amount: number, currency: string) => {
      if (!amount) return '0 ' + currency;
      return new Intl.NumberFormat('vi-VN').format(amount) + ' ' + currency;
    });
    handlebars.registerHelper('formatDate', (date: string | Date) => {
      if (!date) return '';
      const d = new Date(date);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.document.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        folder: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
        shares: true,
        signatures: { include: { parties: true } },
      },
    });

    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async getDownloadStream(tenantId: string, id: string, versionId?: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });

    if (!doc) throw new NotFoundException('Document not found');

    let targetVersion = doc.versions[0];
    if (versionId) {
      targetVersion = doc.versions.find((v) => v.id === versionId);
      if (!targetVersion) throw new NotFoundException('Version not found');
    }

    if (!targetVersion || !targetVersion.filePath) {
      throw new BadRequestException('Document file not generated yet');
    }

    const buffer = await this.storageProvider.read(targetVersion.filePath);
    return {
      buffer,
      fileName: targetVersion.fileName,
      mimeType: targetVersion.mimeType,
    };
  }

  async generateDocument(tenantId: string, templateCode: string, payload: any, metadata: any) {
    const template = await this.prisma.documentTemplate.findUnique({
      where: { tenantId_code: { tenantId, code: templateCode } },
    });

    if (!template) {
      throw new NotFoundException(`Template ${templateCode} not found`);
    }

    // Generate HTML
    const compiled = handlebars.compile(template.content);
    const html = compiled(payload);

    // Generate PDF
    const pdfBuffer = await this.pdfProvider.renderHtmlToPdf(html);

    // Save to storage
    const fileName = `${templateCode.toLowerCase()}_${Date.now()}.pdf`;
    const folder = template.type.toLowerCase() + 's';
    const storageResult = await this.storageProvider.save(tenantId, folder, fileName, pdfBuffer, 'application/pdf');

    // Create DB Records
    const doc = await this.prisma.document.create({
      data: {
        tenantId,
        code: `DOC-${Date.now()}`,
        title: metadata.title || template.name,
        type: template.type,
        status: 'GENERATED' as any,
        sourceType: metadata.sourceType,
        sourceId: metadata.sourceId,
        createdBy: metadata.createdBy,
        versions: {
          create: {
            versionNumber: 1,
            fileName: fileName,
            filePath: storageResult.url,
            mimeType: storageResult.mimeType,
            size: storageResult.size,
            createdBy: metadata.createdBy,
          },
        },
      },
      include: { versions: true },
    });

    // Update currentVersionId
    await this.prisma.document.update({
      where: { id: doc.id },
      data: { currentVersionId: doc.versions[0].id },
    });

    return doc;
  }

  async requestSignature(tenantId: string, documentId: string, payload: any) {
    const doc = await this.findOne(tenantId, documentId);

    const providerResult = await this.signatureProvider.requestSignature({
      tenantId,
      documentId,
      documentUrl: doc.versions[0].filePath,
      title: payload.title || `Request signature for ${doc.title}`,
      message: payload.message || '',
      parties: payload.parties,
    });

    // Create DB Record
    const req = await this.prisma.signatureRequest.create({
      data: {
        tenantId,
        documentId,
        provider: 'INTERNAL' as any,
        status: 'PENDING' as any,
        title: payload.title,
        message: payload.message,
        parties: {
          create: payload.parties.map((p: any) => ({
            name: p.name,
            email: p.email,
            role: p.role,
            status: 'PENDING' as any,
          })),
        },
      },
      include: {
        parties: true
      }
    });

    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'PENDING_SIGNATURE' as any },
    });

    return req;
  }

  async applySignature(tenantId: string, requestId: string, partyId: string, signatureData: string, ipAddress: string) {
    const req = await this.prisma.signatureRequest.findFirst({
      where: { id: requestId, tenantId },
      include: { document: { include: { versions: { orderBy: { versionNumber: 'desc' } } } }, parties: true },
    });

    if (!req) throw new NotFoundException('Signature request not found');

    const party = req.parties.find(p => p.id === partyId);
    if (!party) throw new NotFoundException('Party not found');

    if (party.status === 'SIGNED' as any) {
      throw new BadRequestException('Party already signed');
    }

    const currentVersion = req.document.versions[0];
    const pdfBuffer = await this.storageProvider.read(currentVersion.filePath);

    // Apply signature to PDF
    const signedPdfBuffer = await this.signatureProvider.applySignature(pdfBuffer, signatureData, {
      name: party.name,
      role: party.role,
      email: party.email,
      signedAt: new Date(),
      ipAddress,
    });

    // Save new version
    const newVersionNumber = currentVersion.versionNumber + 1;
    const fileName = `signed_${currentVersion.fileName}`;
    const folder = 'signatures';
    const storageResult = await this.storageProvider.save(tenantId, folder, fileName, signedPdfBuffer, 'application/pdf');

    const newVersion = await this.prisma.documentVersion.create({
      data: {
        documentId: req.document.id,
        versionNumber: newVersionNumber,
        fileName: fileName,
        filePath: storageResult.url,
        mimeType: storageResult.mimeType,
        size: storageResult.size,
        createdBy: party.email,
      },
    });

    // Update Document & Signature Status
    const allSigned = req.parties.every(p => p.id === partyId || p.status === ('SIGNED' as any));
    
    await this.prisma.$transaction([
      this.prisma.document.update({
        where: { id: req.document.id },
        data: {
          currentVersionId: newVersion.id,
          status: allSigned ? ('SIGNED' as any) : ('PARTIALLY_SIGNED' as any),
          signedAt: allSigned ? new Date() : undefined,
        },
      }),
      this.prisma.signatureParty.update({
        where: { id: partyId },
        data: {
          status: 'SIGNED' as any,
          signedAt: new Date(),
          ipAddress,
          signatureData, // Storing base64 for record
        },
      }),
      this.prisma.signatureLog.create({
        data: {
          partyId,
          action: 'SIGNED',
          ipAddress,
        },
      }),
      this.prisma.signatureRequest.update({
        where: { id: requestId },
        data: {
          status: allSigned ? ('SIGNED' as any) : ('PENDING' as any),
        },
      }),
    ]);

    return { success: true };
  }

  async saveFile(tenantId: string, folder: string, fileName: string, buffer: Buffer, mimeType: string) {
    return this.storageProvider.save(tenantId, folder, fileName, buffer, mimeType);
  }
}
