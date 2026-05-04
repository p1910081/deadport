// Minimal HTTP server spawned as a subprocess by E2E tests.
// Listens on a random port, writes "PORT:<n>\n" to stdout so the parent can read it.
import http from 'http';

const server = http.createServer((_req, res) => res.end('ok'));
server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  process.stdout.write(`PORT:${addr.port}\n`);
});
