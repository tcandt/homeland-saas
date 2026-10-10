const MAX_ASSET_BYTES = 20 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;

export class CompiledPdfAssetError extends Error {
  readonly code: string;
  readonly label: string;
  readonly status: number;

  constructor(code: string, label: string, status = 422) {
    super(label);
    this.name = 'CompiledPdfAssetError';
    this.code = code;
    this.label = label;
    this.status = status;
  }
}

function rejectRef(code: string, label: string): never {
  throw new CompiledPdfAssetError(code, label);
}

/** Resolve only the storage reference form emitted by the documents service. */
export function resolveCompiledPdfAssetUrl(assetRef: unknown, apiBaseUrl: string): string {
  if (typeof assetRef !== 'string' || !assetRef || /[\u0000-\u001f\u007f]/.test(assetRef)) {
    return rejectRef('INVALID_ASSET_REF', 'Tài liệu đính kèm không hợp lệ');
  }
  if (assetRef.includes('..') || /(?:^|[?&])(?:url|redirect|next)=/i.test(assetRef)) {
    return rejectRef('UNSAFE_ASSET_REF', 'Tài liệu đính kèm không an toàn');
  }
  let storagePath: string;
  if (assetRef.startsWith('document-storage://')) {
    storagePath = assetRef.slice('document-storage://'.length);
  } else if (assetRef.startsWith('/storage/')) {
    storagePath = assetRef.slice(1);
  } else {
    return rejectRef('UNSUPPORTED_ASSET_REF', 'Tài liệu đính kèm phải thuộc kho lưu trữ nội bộ');
  }
  let decodedStoragePath = storagePath;
  try { decodedStoragePath = decodeURIComponent(storagePath); } catch {
    return rejectRef('INVALID_ASSET_REF', 'Tài liệu đính kèm không hợp lệ');
  }
  if (!decodedStoragePath || /[\u0000-\u001f\u007f]/.test(decodedStoragePath) || decodedStoragePath.startsWith('/') || decodedStoragePath.includes('\\') || decodedStoragePath.includes('..') || /[?#]/.test(decodedStoragePath)) {
    return rejectRef('INVALID_ASSET_REF', 'Tài liệu đính kèm không hợp lệ');
  }
  let base: URL;
  try {
    base = new URL(apiBaseUrl);
  } catch {
    return rejectRef('INVALID_INTERNAL_ORIGIN', 'Không thể xác định kho lưu trữ nội bộ');
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    return rejectRef('INVALID_INTERNAL_ORIGIN', 'Không thể xác định kho lưu trữ nội bộ');
  }
  const prefix = base.pathname.replace(/\/+$/, '');
  const endpoint = new URL(`${prefix}/documents/storage`, base.origin);
  endpoint.searchParams.set('path', decodedStoragePath);
  return endpoint.toString();
}

export type AssetFetcher = typeof fetch;

export async function fetchCompiledPdfAsset(
  assetRef: unknown,
  apiBaseUrl: string,
  authHeader?: string | null,
  fetcher: AssetFetcher = fetch,
): Promise<Buffer> {
  const resolvedUrl = resolveCompiledPdfAssetUrl(assetRef, apiBaseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetcher(resolvedUrl, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new CompiledPdfAssetError('ASSET_FETCH_FAILED', 'Không thể tải tài liệu đính kèm', response.status >= 400 ? response.status : 502);
    }
    const declaredLength = response.headers.get('content-length');
    if (declaredLength && Number(declaredLength) > MAX_ASSET_BYTES) {
      throw new CompiledPdfAssetError('ASSET_TOO_LARGE', 'Tài liệu đính kèm vượt quá giới hạn kích thước');
    }
    if (!response.body) {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) throw new CompiledPdfAssetError('ASSET_EMPTY', 'Tài liệu đính kèm trống');
      if (bytes.length > MAX_ASSET_BYTES) throw new CompiledPdfAssetError('ASSET_TOO_LARGE', 'Tài liệu đính kèm vượt quá giới hạn kích thước');
      return bytes;
    }
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_ASSET_BYTES) throw new CompiledPdfAssetError('ASSET_TOO_LARGE', 'Tài liệu đính kèm vượt quá giới hạn kích thước');
        chunks.push(Buffer.from(value));
      }
    } catch (error) {
      try { await reader.cancel(); } catch { /* best effort */ }
      throw error;
    } finally {
      reader.releaseLock();
    }
    if (!total) throw new CompiledPdfAssetError('ASSET_EMPTY', 'Tài liệu đính kèm trống');
    return Buffer.concat(chunks, total);
  } catch (error) {
    if (error instanceof CompiledPdfAssetError) throw error;
    throw new CompiledPdfAssetError('ASSET_FETCH_FAILED', 'Không thể tải tài liệu đính kèm');
  } finally {
    clearTimeout(timer);
  }
}

export const COMPILED_PDF_MAX_ASSET_BYTES = MAX_ASSET_BYTES;
