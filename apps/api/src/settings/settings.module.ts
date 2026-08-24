import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { AuditModule } from '../shared/audit/audit.module';
import { StorageModule } from '../documents/providers/storage/storage.module';

@Module({
  imports: [AuditModule, StorageModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
