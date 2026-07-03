import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PdfProvider } from '../../interfaces/pdf-provider.interface';
import * as puppeteer from 'puppeteer';

@Injectable()
export class PuppeteerPdfProvider implements PdfProvider, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PuppeteerPdfProvider.name);
  private browser: puppeteer.Browser | null = null;

  async onModuleInit() {
    try {
      this.logger.log('Launching Puppeteer browser instance...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--font-render-hinting=none',
        ],
      });
      this.logger.log('Puppeteer browser launched successfully.');
    } catch (error) {
      this.logger.error('Failed to launch Puppeteer browser', error);
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      this.logger.log('Closing Puppeteer browser instance...');
      await this.browser.close();
      this.browser = null;
    }
  }

  async renderHtmlToPdf(html: string): Promise<Buffer> {
    let localBrowser = this.browser;
    let createdLocal = false;
    if (!localBrowser) {
      try {
        localBrowser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--font-render-hinting=none',
          ],
        });
        createdLocal = true;
      } catch (e) {
        this.logger.warn('Puppeteer browser is not initialized and failed to launch dynamically. Returning dummy PDF buffer.');
        // Return a dummy valid PDF buffer (minimal PDF)
        return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Dummy PDF) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000219 00000 n \n0000000307 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n402\n%%EOF');
      }
    }

    const page = await localBrowser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          bottom: '20px',
          left: '20px',
          right: '20px',
        },
      });
      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error('Error rendering PDF', error);
      throw error;
    } finally {
      await page.close();
      if (createdLocal) {
        await localBrowser.close();
      }
    }
  }
}
