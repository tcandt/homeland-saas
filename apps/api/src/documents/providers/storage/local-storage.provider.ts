import { Injectable, Logger } from '@nestjs/common';
import { StorageProvider, StorageSaveResult } from '../../interfaces/storage-provider.interface';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly baseStoragePath = path.join(process.cwd(), 'storage');

  constructor() {
    this.initStorage();
  }

  private async initStorage() {
    try {
      await fs.mkdir(this.baseStoragePath, { recursive: true });
      this.logger.log(`Storage initialized at ${this.baseStoragePath}`);
    } catch (error) {
      this.logger.error('Failed to initialize storage', error);
    }
  }

  async save(
    tenantId: string,
    folder: string,
    fileName: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StorageSaveResult> {
    const tenantFolder = path.join(this.baseStoragePath, tenantId, folder);
    
    // Ensure the folder exists
    await fs.mkdir(tenantFolder, { recursive: true });

    // Prefix with random string to avoid overwriting, since versioning uses this
    const safeFileName = `${randomBytes(8).toString('hex')}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(tenantFolder, safeFileName);
    const relativePath = path.join(tenantId, folder, safeFileName).replace(/\\/g, '/');

    await fs.writeFile(filePath, buffer);

    return {
      url: `/api/v1/documents/storage/${relativePath}`,
      size: buffer.length,
      mimeType,
    };
  }

  private validatePath(url: string): string {
    // Decode URI component in case it's url encoded
    const decodedUrl = decodeURIComponent(url);
    
    if (decodedUrl.includes('\0')) {
      throw new Error('Invalid path: null byte detected');
    }
    if (path.isAbsolute(decodedUrl)) {
      throw new Error('Invalid path: absolute path not allowed');
    }

    const base = path.resolve(this.baseStoragePath);
    const target = path.resolve(base, decodedUrl);

    if (!target.startsWith(base + path.sep) && target !== base) {
      throw new Error('Forbidden: Invalid storage path');
    }

    return target;
  }

  async read(url: string): Promise<Buffer> {
    const filePath = this.validatePath(url);
    return await fs.readFile(filePath);
  }

  async delete(url: string): Promise<void> {
    try {
      const filePath = this.validatePath(url);
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.error(`Failed to delete file at ${url}`, error);
    }
  }
}
