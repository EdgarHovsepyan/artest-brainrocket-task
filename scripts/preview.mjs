/**
 * Zero-dependency preview server for the shipped game builds.
 *
 *   node scripts/preview.mjs     (or: pnpm preview)
 *
 * Serves each playable build at its own root (the PixiJS single-file build
 * resolves /spine/... assets from the server root, so a shared root with
 * sub-paths would 404 them):
 *
 *   PixiJS  shining-pop     http://localhost:5180
 *   Cocos   shining-pop-v2  http://localhost:8200
 *
 * Needs only Node >= 20 — no install, no toolchain.
 */
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const GAMES = [
  {
    name: 'PixiJS  — shining-pop   ',
    root: path.join(REPO_ROOT, 'games', 'shining-pop', 'dist'),
    port: 5180,
  },
  {
    name: 'Cocos   — shining-pop-v2',
    root: path.join(REPO_ROOT, 'games', 'shining-pop-v2', 'build', 'web-mobile'),
    port: 8200,
  },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.wasm': 'application/wasm',
  '.atlas': 'text/plain',
  '.txt': 'text/plain',
};

function serve(root, req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let filePath = path.normalize(path.join(root, urlPath));
  if (!filePath.startsWith(root)) {
    res.writeHead(403).end('403');
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!existsSync(filePath)) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('404 ' + urlPath);
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
}

console.log('\n  ARTEST | BrainRocket — game preview\n');

for (const game of GAMES) {
  if (!existsSync(path.join(game.root, 'index.html'))) {
    console.error(`  ✗ ${game.name}  build not found at ${game.root}`);
    continue;
  }
  http
    .createServer((req, res) => serve(game.root, req, res))
    .once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(
          `  ✗ ${game.name}  port ${game.port} is already in use — close the other server or edit scripts/preview.mjs`,
        );
      } else {
        console.error(`  ✗ ${game.name}  ${err.message}`);
      }
    })
    .listen(game.port, () => {
      console.log(`  ▶ ${game.name}  http://localhost:${game.port}`);
    });
}

console.log('\n  Ctrl+C to stop.\n');
