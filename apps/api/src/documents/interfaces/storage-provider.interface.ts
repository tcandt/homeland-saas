export interface StorageSaveResult {
  url: string; // The URL/path to download or access the file
  size: number;
  mimeType: string;
}

export interface StorageProvider {
  /**
   * Save a file buffer to storage
   * @param tenantId The tenant ID
   * @param folder The target folder (e.g., 'contracts', 'invoices')
   * @param fileName The name of the file
   * @param buffer The file content
   * @param mimeType The file mime type
   */
  save(
    tenantId: string,
    folder: string,
    fileName: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StorageSaveResult>;

  /**
   * Read a file from storage
   * @param url The storage URL/path
   */
  read(url: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   * @param url The storage URL/path
   */
  delete(url: string): Promise<void>;

  /**
   * Build a direct download URL when the provider supports it.
   * Providers without direct URLs may return the original storage URL or a proxied URL.
   */
  getDownloadUrl?(url: string, expiresInSeconds?: number): Promise<string> | string;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
