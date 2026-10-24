import 'reflect-metadata';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { PuppeteerPdfProvider } from '../../apps/api/src/documents/providers/pdf/puppeteer-pdf.provider';

async function main() {
  const parserUrl = pathToFileURL(path.resolve('node_modules/chromium-bidi/out/Default/gen/src/protocol-parser/protocol-parser.js'));
  const { Browser } = await import(parserUrl.href);
  assert.deepEqual(Browser.parseRemoveUserContextParameters({ userContext: 'compat-test' }), { userContext: 'compat-test' });
  assert.throws(() => Browser.parseRemoveUserContextParameters({ userContext: 42 }),
    (error: Error) => error.constructor.name === 'InvalidArgumentException');
  assert.ok(process.env.PUPPETEER_EXECUTABLE_PATH, 'Set an installed browser executable explicitly');
  const provider = new PuppeteerPdfProvider();
  await provider.onModuleInit();
  try {
    const pdf = await provider.renderHtmlToPdf('<!doctype html><h1>Homeland compatibility test</h1><p>Real browser PDF</p>');
    assert.ok(pdf.length > 2000, 'Reject dummy/fallback PDF');
    assert.ok(!pdf.includes(Buffer.from('Dummy PDF')));
    const document = await PDFDocument.load(pdf);
    assert.equal(document.getPageCount(), 1);
    const { width, height } = document.getPage(0).getSize();
    assert.ok(Math.abs(width - 595.28) < 2 && Math.abs(height - 841.89) < 2, 'Expected real A4 PDF');
    console.log(JSON.stringify({ bidiValidation: 'PASS', realPdf: 'PASS', bytes: pdf.length, width, height }));
  } finally { await provider.onModuleDestroy(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
