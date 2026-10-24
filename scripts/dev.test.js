const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { waitForBackendReady } = require('./dev');

async function serverFor(t, handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return server.address().port;
}

test('probes readiness rather than liveness', async t => {
  const paths = [];
  const port = await serverFor(t, (req, res) => {
    paths.push(req.url);
    res.writeHead(req.url === '/api/v1/health/ready' ? 200 : 404).end('{}');
  });
  assert.equal(await waitForBackendReady(port, 1000), true);
  assert.deepEqual(paths, ['/api/v1/health/ready']);
});

test('healthy liveness cannot mask unavailable dependencies', async t => {
  const port = await serverFor(t, (req, res) => res.writeHead(req.url.endsWith('/ready') ? 503 : 200).end('{}'));
  assert.equal(await waitForBackendReady(port, 100), false);
});

test('retries transient readiness failure', async t => {
  let attempts = 0;
  const port = await serverFor(t, (_req, res) => res.writeHead(++attempts === 1 ? 503 : 200).end('{}'));
  assert.equal(await waitForBackendReady(port, 2000), true);
  assert.equal(attempts, 2);
});

test('hanging connections respect the overall deadline', async t => {
  const port = await serverFor(t, () => {});
  const start = Date.now();
  assert.equal(await waitForBackendReady(port, 100), false);
  assert.ok(Date.now() - start < 1000);
});

test('closed port fails without an uncaught error', async () => {
  // Reserve a concrete port, then close it before probing.
  const reservation = http.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const closedPort = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  assert.equal(await waitForBackendReady(closedPort, 100), false);
});

test('launcher fails closed before starting the frontend', () => {
  const source = fs.readFileSync(path.join(__dirname, 'dev.js'), 'utf8');
  assert.match(source, /if \(!await waitForBackendReady\(3001, 30000\)\) \{\s*throw new Error/);
  assert.ok(source.indexOf('if (!await waitForBackendReady') < source.indexOf("start('web'"));
});
