import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { LocalStorageProvider } from '../documents/providers/storage/local-storage.provider';
import { AuditModule } from '../shared/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [SettingsController],
  providers: [SettingsService, LocalStorageProvider],
  exports: [SettingsService],
})
export class SettingsModule {}
