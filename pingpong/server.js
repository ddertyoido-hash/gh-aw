// Dependency-free static dev server for the 3D table tennis game.
//
// It serves the game straight from the working tree (never a prebuilt bundle)
// with `cache-control: no-store`, and pushes a Server-Sent Event to every open
// page whenever a file changes so the browser reloads itself. That gives the
// same edit-and-see-it-update loop a bundler dev server would.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/* ---------------------------------------------------------------- live reload */
const reloadClients = new Set();
let reloadTimer = null;

function broadcastReload() {
  for (const res of reloadClients) {
    try {
      res.write('data: reload\n\n');
    } catch {
      reloadClients.delete(res);
    }
  }
}

try {
  fs.watch(ROOT, { recursive: true }, (_event, file) => {
    if (!file || file.startsWith('.') || file.includes('node_modules')) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(broadcastReload, 60);
  });
} catch (err) {
  console.warn('[pingpong] file watching unavailable:', err.message);
}

/* --------------------------------------------------------------------- server */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (url.pathname === '/__reload') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.write(': connected\n\n');
    reloadClients.add(res);
    req.on('close', () => reloadClients.delete(res));
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';

  const filePath = path.join(ROOT, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[pingpong] dev server listening on http://${HOST}:${PORT}`);
});
