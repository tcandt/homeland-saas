import * as path from 'path';

export function normalizeStorageReference(url: string): string {
  if (!url) return '';
  if (url.startsWith('document-storage://')) {
    return url.replace('document-storage://', '');
  }
  return url;
}

export function toDocumentStorageUrl(relativePath: string): string {
  return `document-storage://${relativePath}`;
}

export function inferMimeTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
    '.webp': 'image/webp',
    '.json': 'application/json',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
