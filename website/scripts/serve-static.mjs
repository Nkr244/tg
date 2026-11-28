import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../.output/public');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};
createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(
      new URL(request.url || '/', 'http://localhost').pathname,
    );
    let file = resolve(root, `.${path}`);
    if (file !== root && !file.startsWith(root + sep))
      throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': `${mime[extname(file)] || 'application/octet-stream'}; charset=utf-8`,
    });
    response.end(body);
  } catch {
    const body = await readFile(join(root, '404.html'));
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(body);
  }
}).listen(3000, '127.0.0.1', () =>
  console.log('Static preview at http://127.0.0.1:3000'),
);
