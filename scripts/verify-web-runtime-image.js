const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const image = process.argv[2];
const expectedCommit = process.argv[3];
if (process.env.VERIFY_DISPOSABLE_WEB_IMAGE !== 'true' || !image || image.startsWith('-')) {
  throw new Error('Set VERIFY_DISPOSABLE_WEB_IMAGE=true and provide a locally built Web image.');
}
if (expectedCommit && !/^[a-f0-9]{40}$/.test(expectedCommit)) throw new Error('Expected commit must be a full SHA.');

const docker = args => execFileSync('docker', args, {
  encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const info = JSON.parse(docker(['image', 'inspect', image]))[0];
assert.match(info.Id, /^sha256:[a-f0-9]{64}$/);
assert.equal(info.Config.User, 'nextjs');
assert.equal(info.Config.WorkingDir, '/app/apps/web');
assert.deepEqual(info.Config.Cmd, ['node', '../../node_modules/next/dist/bin/next', 'start']);
if (expectedCommit) assert.ok(info.Config.Env.includes(`COMMIT_SHA=${expectedCommit}`));

const name = `homeland-web-runtime-${crypto.randomBytes(8).toString('hex')}`;
let exists = false;
try { docker(['container', 'inspect', name]); exists = true; } catch {}
assert.equal(exists, false, 'Disposable resource collision');
let created = false;
try {
  // No published ports, network, host paths, application env or persistent volumes.
  docker(['create', '--name', name, '--network', 'none', '--add-host', 'api:127.0.0.1', info.Id]);
  created = true;
  docker(['start', name]);
  const probe = String.raw`
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const path = require('node:path');
    const { execFileSync } = require('node:child_process');
    (async () => {
      assert.equal(process.versions.node.split('.')[0], '22');
      assert.equal(process.getuid(), 1001);
      assert.equal(process.cwd(), '/app/apps/web');
      assert.equal(fs.readlinkSync('/proc/1/exe'), '/usr/local/bin/node');
      for (const missing of ['/usr/local/lib/node_modules/npm', '/usr/local/bin/npm', '/usr/local/bin/npx', '/app/node_modules/npm', '/app/node_modules/eslint', '/app/node_modules/typescript', '/app/apps/web/.codex-backups', '/app/apps/web/.codex-update']) assert.equal(fs.existsSync(missing), false, missing);
      for (const dependency of ['next', '@homeland/shared', 'docxtemplater', 'pizzip', 'pdf-lib', 'sharp', '@zxing/browser', '@zxing/library']) require.resolve(dependency);
      for (const template of ['CT01.docx', 'HOP_DONG_1PN.docx', 'HOP_DONG_2PN.docx', 'HD-COC-GIU-PHONG.docx']) {
        const root = fs.readFileSync('/app/tai-lieu/' + template);
        assert.ok(root.length > 100);
        assert.deepEqual(fs.readFileSync(path.join('tai-lieu', template)), root);
      }
      let response;
      for (let attempt = 0; attempt < 60; attempt++) {
        try { response = await fetch('http://127.0.0.1:3000/login'); if (response.status === 200) break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      assert.equal(response?.status, 200, 'Login page');
      const html = await response.text();
      const assets = [...new Set([...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map(match => match[1]))].slice(0, 4);
      assert.ok(assets.length >= 2, 'Static assets');
      for (const asset of assets) assert.equal((await fetch(new URL(asset, 'http://127.0.0.1:3000'))).status, 200);
      const mockApi = require('node:http').createServer((request, response) => {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ path: request.url, synthetic: true }));
      });
      await new Promise(resolve => mockApi.listen(3001, '127.0.0.1', resolve));
      try {
        const proxied = await fetch('http://127.0.0.1:3000/api/v1/health');
        assert.equal(proxied.status, 200, 'Same-origin API proxy');
        assert.deepEqual(await proxied.json(), { path: '/api/v1/health', synthetic: true });
      } finally { await new Promise(resolve => mockApi.close(resolve)); }
      const dir = fs.mkdtempSync('/tmp/homeland-web-pdf-');
      try {
        const zip = new (require('pizzip'))();
        zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
        zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
        zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Homeland synthetic runtime PDF - th\u1eed nghi\u1ec7m</w:t></w:r></w:p><w:sectPr/></w:body></w:document>');
        fs.writeFileSync(path.join(dir, 'synthetic.docx'), zip.generate({ type: 'nodebuffer' }));
        execFileSync('libreoffice', ['-env:UserInstallation=file://' + dir + '/profile', '--headless', '--convert-to', 'pdf', '--outdir', dir, path.join(dir, 'synthetic.docx')], { timeout: 60000, stdio: 'pipe' });
        const pdf = fs.readFileSync(path.join(dir, 'synthetic.pdf'));
        assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
        assert.ok((await require('pdf-lib').PDFDocument.load(pdf)).getPageCount() > 0);
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
      console.log('PASS: Node22/non-root/direct startup, runtime dependencies/templates, login/static assets, same-origin mock API proxy and synthetic DOCX->PDF.');
    })().catch(error => { console.error(error.message); process.exit(1); });
  `;
  console.log(docker(['exec', name, 'node', '-e', probe]).trim());
  assert.equal(docker(['inspect', name, '--format', '{{.RestartCount}}']).trim(), '0');
} finally {
  if (created) docker(['rm', '-f', name]);
}
