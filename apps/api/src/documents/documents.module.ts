import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { SignatureRequestsController } from './signature-requests.controller';
import { LocalStorageProvider } from './providers/storage/local-storage.provider';
import { PuppeteerPdfProvider } from './providers/pdf/puppeteer-pdf.provider';
import { InternalSignatureProvider } from './providers/signature/internal-signature.provider';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [],
  controllers: [DocumentsController, SignatureRequestsController],
  providers: [
    DocumentsService,
    LocalStorageProvider,
    PuppeteerPdfProvider,
    InternalSignatureProvider,
    PrismaService,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
