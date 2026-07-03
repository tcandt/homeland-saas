import { Injectable, BadRequestException } from '@nestjs/common';
import { ExcelExportProvider } from './excel-export.provider';
import { CsvExportProvider } from './csv-export.provider';
import { PdfExportProvider } from './pdf-export.provider';

@Injectable()
export class ExportService {
  constructor(
    private readonly excelProvider: ExcelExportProvider,
    private readonly csvProvider: CsvExportProvider,
    private readonly pdfProvider: PdfExportProvider
  ) {}

  async exportData(format: string, title: string, data: any[]): Promise<{ buffer: Buffer, contentType: string, extension: string }> {
    if (!data || data.length === 0) {
      throw new BadRequestException('No data available to export');
    }

    const headers = Object.keys(data[0]);

    if (format === 'xlsx') {
      const buffer = await this.excelProvider.generateBuffer(headers, data);
      return { buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' };
    }
    
    if (format === 'csv') {
      const buffer = this.csvProvider.generateBuffer(headers, data);
      return { buffer, contentType: 'text/csv', extension: 'csv' };
    }

    if (format === 'pdf') {
      // Very basic HTML table generation for the PDF abstraction
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: sans-serif; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <h2>${title}</h2>
            <table>
              <thead>
                <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${data.map(row => `<tr>${headers.map(h => `<td>${row[h]}</td>`).join('')}</tr>`).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;
      const buffer = await this.pdfProvider.generateBuffer(htmlContent);
      return { buffer, contentType: 'application/pdf', extension: 'pdf' };
    }

    if (format === 'json') {
      const buffer = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
      return { buffer, contentType: 'application/json', extension: 'json' };
    }

    throw new BadRequestException(`Unsupported export format: ${format}`);
  }
}
