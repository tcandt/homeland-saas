import { Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { ExcelExportProvider } from './excel-export.provider';
import { CsvExportProvider } from './csv-export.provider';
import { PdfExportProvider } from './pdf-export.provider';

@Module({
  providers: [ExportService, ExcelExportProvider, CsvExportProvider, PdfExportProvider],
  exports: [ExportService],
})
export class ExportModule {}
