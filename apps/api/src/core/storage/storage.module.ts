import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { GoogleDriveStorageProvider } from './google-drive-storage.provider';

@Global()
@Module({
  controllers: [StorageController],
  providers: [StorageService, GoogleDriveStorageProvider],
  exports: [StorageService, GoogleDriveStorageProvider],
})
export class StorageModule {}
