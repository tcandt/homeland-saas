import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PdfExportProvider } from './pdf-export.provider';

describe('PdfExportProvider', () => {
  it('fails closed instead of returning placeholder bytes as a PDF', async () => {
    await expect(new PdfExportProvider().generateBuffer('<html><body>report</body></html>'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(new PdfExportProvider().generateBuffer('<html></html>'))
      .rejects.toThrow('REPORT_PDF_EXPORT_UNAVAILABLE');
  });
});
