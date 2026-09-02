import { Module } from '@nestjs/common';
import { STORAGE_PROVIDER } from '../../interfaces/storage-provider.interface';
import { LocalStorageProvider } from './local-storage.provider';

@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useClass: LocalStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
