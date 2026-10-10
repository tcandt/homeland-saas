import { afterEach, describe, expect, it, vi } from 'vitest';
import { BarcodeFormat, EncodeHintType, QRCodeWriter } from '@zxing/library';
import { BrowserQRCodeReader } from '@zxing/browser';
import { isLikelyCccdQrPayload, parseCccdQrPayload, scanImageForCccdQr } from './cccd-qr';

// Force the application's ZXing fallback; do not mock the ZXing decoder.
vi.mock('jsqr', () => ({ default: vi.fn(() => null) }));

const syntheticPayload = '000000000001||KHÁCH THỬ NGHIỆM|01012000|Nam|ĐỊA CHỈ GIẢ LẬP|01012020';

function imageHarness(quarterTurn: boolean) {
  const size = 800;
  const hints = new Map([[EncodeHintType.CHARACTER_SET, 'UTF-8']]);
  const matrix = new QRCodeWriter().encode(syntheticPayload, BarcodeFormat.QR_CODE, size, size, hints);
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const black = quarterTurn ? matrix.get(y, size - 1 - x) : matrix.get(x, y);
      const index = (y * size + x) * 4;
      data[index] = data[index + 1] = data[index + 2] = black ? 0 : 255;
      data[index + 3] = 255;
    }
  }
  const context = {
    imageSmoothingEnabled: false, clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
    translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn(),
    getImageData: () => ({ data, width: size, height: size }),
  };
  const canvas = { width: size, height: size, getContext: () => context };
  class SyntheticImage {
    width = size;
    height = size;
    naturalWidth = size;
    naturalHeight = size;
    onload?: () => void;
    set src(value: string) {
      expect(value).toBe('blob:synthetic-qr');
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal('Image', SyntheticImage);
  vi.stubGlobal('document', { createElement: () => canvas });
  vi.stubGlobal('window', { setTimeout });
  const fetchMock = vi.fn().mockRejectedValue(new Error('External AI disabled in compatibility tests'));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic-qr');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const decode = vi.spyOn(BrowserQRCodeReader.prototype, 'decodeFromCanvas');
  return { fetchMock, revoke, decode };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('CCCD QR compatibility with the pinned ZXing pair', () => {
  it.each([false, true])('decodes synthetic Vietnamese pixels through the actual application fallback (quarterTurn=%s)', async (quarterTurn) => {
    const { fetchMock, revoke, decode } = imageHarness(quarterTurn);
    const file = new File([], 'synthetic-cccd.png', { type: 'image/png' });
    const result = await scanImageForCccdQr(file);
    expect(decode).toHaveBeenCalled();
    expect(result?.decodedText).toBe(syntheticPayload);
    expect(parseCccdQrPayload(result!.decodedText)).toMatchObject({
      citizenId: '000000000001', fullName: 'KHÁCH THỬ NGHIỆM', birthDate: '2000-01-01',
      gender: 'Nam', address: 'ĐỊA CHỈ GIẢ LẬP',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:synthetic-qr');
  });

  it.each(['https://example.invalid', 'not a CCCD payload', '123||INCOMPLETE'])('rejects unsupported QR content: %s', (value) => {
    expect(isLikelyCccdQrPayload(value)).toBe(false);
  });
});
