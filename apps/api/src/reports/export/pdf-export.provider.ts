import { Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class PdfExportProvider {
  async generateBuffer(_htmlContent: string): Promise<Buffer> {
    // A non-PDF byte stream must never be delivered with an application/pdf
    // response. Enable a real renderer before exposing this export format.
    throw new ServiceUnavailableException('REPORT_PDF_EXPORT_UNAVAILABLE');
  }
}
