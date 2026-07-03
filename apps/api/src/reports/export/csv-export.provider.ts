import { Injectable } from '@nestjs/common';

@Injectable()
export class CsvExportProvider {
  generateBuffer(headers: string[], data: any[]): Buffer {
    const headerRow = headers.join(',') + '\n';
    
    const bodyRows = data.map(row => {
      return headers.map(header => {
        let value = row[header];
        if (value === null || value === undefined) value = '';
        value = String(value).replace(/"/g, '""');
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          value = `"${value}"`;
        }
        return value;
      }).join(',');
    }).join('\n');

    const csvContent = headerRow + bodyRows;
    return Buffer.from(csvContent, 'utf-8');
  }
}
