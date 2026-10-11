import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import path from 'node:path';
import { POST } from '../../app/api/export-compiled-pdf/route';

const state = vi.hoisted(() => ({
  files: new Map<string, Buffer>(),
  missing: '',
  conversionFails: false,
  pdf: Buffer.alloc(0),
  image: Buffer.alloc(0),
  removedDirs: [] as string[],
  renders: [] as any[],
}));

vi.mock('fs', () => ({ default: {
  existsSync: (file: string) => !file.endsWith(state.missing || 'never-missing') &&
    (state.files.has(file) || /[\\/]tai-lieu[\\/]/.test(file)),
  readFileSync: (file: string) => state.files.get(file) || (/\.jpg$/.test(file) ? state.image : Buffer.from('template')),
  writeFileSync: (file: string, bytes: Buffer) => state.files.set(file, Buffer.from(bytes)),
  statSync: (file: string) => ({ size: state.files.get(file)?.length || 0 }),
  mkdtempSync: () => { state.files.set('/isolated/homeland-pdf-test', Buffer.alloc(0)); return '/isolated/homeland-pdf-test'; },
  unlinkSync: (file: string) => state.files.delete(file),
  rmdirSync: (dir: string) => { state.removedDirs.push(dir); state.files.delete(dir); },
} }));
vi.mock('child_process', () => ({ execSync: () => {
  if (state.conversionFails) throw new Error('synthetic converter unavailable');
  for (const file of [...state.files.keys()]) {
    if (file.endsWith('.docx')) state.files.set(path.join(path.dirname(file), path.basename(file, '.docx') + '.pdf'), state.pdf);
  }
} }));
vi.mock('pizzip', () => ({ default: class {} }));
vi.mock('docxtemplater', () => ({ default: class {
  render(data: any) { state.renders.push(data); }
  getZip() { return { generate: () => Buffer.from('synthetic docx') }; }
} }));
vi.mock('../../lib/server/route-auth', () => ({
  requireRoutePermission: async () => ({ authorization: 'Bearer synthetic-secret', user: {} }),
  getInternalApiBaseUrl: () => 'https://internal.example/api/v1',
}));

let contract: any;
let assetStatus = 200;
let corruptCccd = false;
let fetcher: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  state.pdf = Buffer.from(await pdf.save());
  state.image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2f8AAAAASUVORK5CYII=', 'base64');
});
beforeEach(() => {
  state.files.clear(); state.removedDirs = []; state.renders = []; state.missing = ''; state.conversionFails = false;
  assetStatus = 200; corruptCccd = false;
  contract = { id: 'contract-1', signedAt: '2026-10-01T00:00:00+07:00',
    attachments: ['document-storage://tenant/lease.pdf'],
    customer: { fullName: 'Synthetic tenant', idImages: ['document-storage://tenant/front.png', 'document-storage://tenant/back.png'], idImageProvenance: [
      { url: 'document-storage://tenant/front.png', side: 'front', source: 'scan', status: 'APPROVED', approvedBy: 'reviewer-1' },
      { url: 'document-storage://tenant/back.png', side: 'back', source: 'upload', status: 'APPROVED', approvedBy: 'reviewer-1' },
    ] },
    room: { code: 'TEST', building: { address: 'Synthetic address' } },
  };
  fetcher = vi.fn(async (url: string) => {
    if (url.includes('/contracts/')) return Response.json({ data: contract });
    const storagePath = new URL(url).searchParams.get('path') || '';
    const bytes = storagePath.endsWith('.pdf') ? state.pdf : corruptCccd ? Buffer.from('corrupt') : state.image;
    return new Response(new Uint8Array(bytes), { status: assetStatus });
  });
  vi.stubGlobal('fetch', fetcher);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const request = () => new Request('http://local/api/export-compiled-pdf', { method: 'POST', body: JSON.stringify({ contractId: 'contract-1' }) });

describe('complete compiled dossier export', () => {
  it('returns all seven required synthetic sections, with private caching and own temp cleanup', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    const result = await PDFDocument.load(await response.arrayBuffer());
    expect(result.getPageCount()).toBe(7);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(state.files.size).toBe(0);
    expect(state.removedDirs).toEqual(['/isolated/homeland-pdf-test']);
    for (const [url, options] of fetcher.mock.calls) {
      expect(new URL(url).origin).toBe('https://internal.example');
      expect(options).toMatchObject({ redirect: 'error', cache: 'no-store' });
    }
  });

  it.each([[], ['document-storage://tenant/front.png'], ['document-storage://tenant/front.png', 'document-storage://tenant/front.png'],
    ['document-storage://tenant/front.png', 'document-storage://tenant/%66ront.png'],
    ['document-storage://tenant/front.png', 'document-storage://tenant/back.png', 'document-storage://tenant/extra.png']])('denies legacy or incomplete CCCD metadata: %j', async (images) => {
    contract.customer.idImages = images;
    contract.customer.idImageProvenance = undefined;
    const response = await POST(request());
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'CCCD_PROVENANCE_REQUIRED' });
    expect(state.renders).toHaveLength(0);
    expect(state.files.size).toBe(0);
  });

  it('rejects a legacy two-item array instead of inferring front/back by position', async () => {
    contract.customer.idImageProvenance = undefined;
    const response = await POST(request());
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'CCCD_PROVENANCE_REQUIRED' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects forged JSON metadata stored in the legacy URL array', async () => {
    contract.customer.idImageProvenance = undefined;
    contract.customer.idImages = ['{"url":"document-storage://tenant/front.png","side":"front","approved":true}', '{"url":"document-storage://tenant/back.png","side":"back","approved":true}'];
    const response = await POST(request());
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'CCCD_PROVENANCE_REQUIRED' });
  });

  it('uses explicit side metadata even when storage array order is reversed', async () => {
    contract.customer.idImages.reverse();
    const response = await POST(request());
    expect(response.status).toBe(200);
    const assetPaths = fetcher.mock.calls
      .map(([url]) => new URL(url as string).searchParams.get('path'))
      .filter((path): path is string => path !== null && path.endsWith('.png'));
    expect(assetPaths).toEqual(['tenant/front.png', 'tenant/back.png']);
  });

  it('denies external CCCD before fetching it or rendering', async () => {
    contract.customer.idImages[0] = 'https://external.test/front.png';
    contract.customer.idImageProvenance = undefined;
    const response = await POST(request());
    expect(response.status).toBe(422);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await response.text()).not.toContain('synthetic-secret');
  });

  it.each(['Giay-phep-KD.jpg', 'so-do-MT.jpg', 'so-do-MS.jpg'])('denies missing mandatory static asset: %s', async (file) => {
    state.missing = file;
    const response = await POST(request());
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'STATIC_ASSET_MISSING' });
    expect(state.renders).toHaveLength(0);
  });

  it('fails closed if CT01 conversion is unavailable', async () => {
    state.conversionFails = true;
    const response = await POST(request());
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'CT01_CONVERSION_FAILED' });
    expect(state.files.size).toBe(0);
  });

  it('never substitutes a generated unsigned copy for a missing signed contract', async () => {
    contract.attachments = [];
    const response = await POST(request());
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'SIGNED_CONTRACT_MISSING' });
    expect(state.renders).toHaveLength(1); // only CT01; never a replacement contract
  });

  it('never substitutes a template when a linked contract asset cannot be loaded', async () => {
    assetStatus = 404;
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'ASSET_FETCH_FAILED' });
    expect(state.renders).toHaveLength(1);
  });

  it('rejects corrupt CCCD rather than silently removing its page', async () => {
    corruptCccd = true;
    const response = await POST(request());
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'INVALID_IMAGE' });
    expect(state.files.size).toBe(0);
  });
});
