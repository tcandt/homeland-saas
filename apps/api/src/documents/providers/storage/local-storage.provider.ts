import { Injectable, Logger } from '@nestjs/common';
import { StorageProvider, StorageSaveResult } from '../../interfaces/storage-provider.interface';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { normalizeStorageReference, toDocumentStorageUrl } from './storage-path.util';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly baseStoragePath = path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'));

  constructor() {
    this.initStorage();
  }

  private initStorage() {
    try {
      fsSync.mkdirSync(this.baseStoragePath, { recursive: true });
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
    const tenantSegment = this.sanitizePathSegment(tenantId || 'tenant');
    const folderPath = this.normalizeFolderPath(folder || 'uploads');
    const tenantFolder = path.join(this.baseStoragePath, tenantSegment, folderPath);
    this.ensureInsideStorage(tenantFolder);
    
    // Ensure the folder exists
    await fs.mkdir(tenantFolder, { recursive: true });

    // Prefix with random string to avoid overwriting, since versioning uses this
    const safeFileName = `${randomBytes(8).toString('hex')}-${this.sanitizePathSegment(fileName || 'file')}`;
    const filePath = path.join(tenantFolder, safeFileName);
    this.ensureInsideStorage(filePath);
    const relativePath = path.join(tenantSegment, folderPath, safeFileName).replace(/\\/g, '/');

    await fs.writeFile(filePath, buffer);

    return {
      url: toDocumentStorageUrl(relativePath),
      size: buffer.length,
      mimeType,
    };
  }

  resolvePath(url: string): string {
    const decodedUrl = normalizeStorageReference(url);
    
    if (decodedUrl.includes('\0')) {
      throw new Error('Invalid path: null byte detected');
    }

    const base = path.resolve(this.baseStoragePath);
    const safeRelativePath = decodedUrl.startsWith(path.sep)
      ? decodedUrl.slice(1)
      : decodedUrl;
    const target = path.resolve(base, safeRelativePath);

    this.ensureInsideStorage(target);

    return target;
  }

  async read(url: string): Promise<Buffer> {
    const filePath = this.resolvePath(url);
    return await fs.readFile(filePath);
  }

  async delete(url: string): Promise<void> {
    try {
      const filePath = this.resolvePath(url);
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.error(`Failed to delete file at ${url}`, error);
    }
  }

  getDownloadUrl(url: string): string {
    const normalized = normalizeStorageReference(url);
    return toDocumentStorageUrl(normalized);
  }

  private ensureInsideStorage(targetPath: string): void {
    const base = path.resolve(this.baseStoragePath);
    const target = path.resolve(targetPath);

    if (!target.startsWith(base + path.sep) && target !== base) {
      throw new Error('Forbidden: Invalid storage path');
    }
  }

  private normalizeFolderPath(folder: string): string {
    const segments = String(folder)
      .split(/[\\/]+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment && segment !== '.' && segment !== '..')
      .map((segment) => this.sanitizePathSegment(segment))
      .filter(Boolean);

    return segments.length > 0 ? path.join(...segments) : 'uploads';
  }

  private sanitizePathSegment(segment: string): string {
    const sanitized = String(segment || '')
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^\.+/, '')
      .replace(/\.+$/, '')
      .slice(0, 160);

    return sanitized || 'file';
  }
}
