import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { LocalStorageProvider } from '../documents/providers/storage/local-storage.provider';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, PrismaService, LocalStorageProvider],
  exports: [SettingsService],
})
export class SettingsModule {}
