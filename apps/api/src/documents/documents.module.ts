import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { SignatureRequestsController } from './signature-requests.controller';
import { PuppeteerPdfProvider } from './providers/pdf/puppeteer-pdf.provider';
import { InternalSignatureProvider } from './providers/signature/internal-signature.provider';
import { StorageModule } from './providers/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [DocumentsController, SignatureRequestsController],
  providers: [
    DocumentsService,
    PuppeteerPdfProvider,
    InternalSignatureProvider,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
