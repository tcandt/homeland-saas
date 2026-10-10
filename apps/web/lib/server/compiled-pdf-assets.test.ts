import { describe, expect, it, vi } from 'vitest';
import {
  CompiledPdfAssetError,
  fetchCompiledPdfAsset,
  resolveCompiledPdfAssetUrl,
  COMPILED_PDF_MAX_ASSET_BYTES,
} from './compiled-pdf-assets';

const api = 'https://internal.example/api/v1';

describe('compiled PDF asset safety', () => {
  it('rejects external, malformed and traversal references before fetch', async () => {
    const fetcher = vi.fn();
    for (const ref of ['https://evil.test/a?token=secret', '//evil.test/a', 'document-storage://../secret', 'document-storage://%2e%2e%2fsecret', 'document-storage://a\u0000b']) {
      await expect(fetchCompiledPdfAsset(ref, api, 'Bearer secret', fetcher)).rejects.toBeInstanceOf(CompiledPdfAssetError);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('resolves canonical refs under the internal API prefix and sends safe fetch options', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    const resolved = resolveCompiledPdfAssetUrl('document-storage://tenant/file.pdf', api);
    expect(resolved).toBe('https://internal.example/api/v1/documents/storage?path=tenant%2Ffile.pdf');
    await expect(fetchCompiledPdfAsset('document-storage://tenant/file.pdf', api, 'Bearer secret', fetcher)).resolves.toEqual(Buffer.from([1, 2, 3]));
    expect(fetcher).toHaveBeenCalledWith(resolved, expect.objectContaining({ redirect: 'error', cache: 'no-store', headers: { Authorization: 'Bearer secret' } }));
  });

  it('rejects non-success, empty and declared oversized responses without echoing secrets', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('nope', { status: 404 }))
      .mockResolvedValueOnce(new Response(new Uint8Array()))
      .mockResolvedValueOnce(new Response(new Uint8Array([1]), { headers: { 'content-length': String(COMPILED_PDF_MAX_ASSET_BYTES + 1) } }));
    for (let i = 0; i < 3; i += 1) {
      const error = await fetchCompiledPdfAsset('document-storage://tenant/file.pdf', api, 'Bearer secret', fetcher).catch((e) => e);
      expect(error).toBeInstanceOf(CompiledPdfAssetError);
      expect(String(error.message)).not.toContain('secret');
    }
  });

  it('bounds streaming bodies and cancels an oversized stream', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(COMPILED_PDF_MAX_ASSET_BYTES));
        controller.enqueue(new Uint8Array([1]));
      },
      cancel() { cancelled = true; },
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(stream));
    await expect(fetchCompiledPdfAsset('document-storage://tenant/file.pdf', api, null, fetcher)).rejects.toMatchObject({ code: 'ASSET_TOO_LARGE' });
    expect(cancelled).toBe(true);
  });
});
