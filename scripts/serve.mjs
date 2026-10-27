import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, PUBLIC_FILES, validateTree } from './files.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' };
export function route(method, host, rawPath) {
  if (!['127.0.0.1:4232', 'localhost:4232'].includes(host)) return { status: 403 };
  if (method !== 'GET' && method !== 'HEAD') return { status: 405 };
  if (typeof rawPath !== 'string' || /[%\\?#\u0000-\u0020]/.test(rawPath)) return { status: 404, file: '404.html' };
  const file = rawPath === '/' ? 'index.html' : rawPath === '/en/' ? 'en/index.html' : rawPath.slice(1);
  if (!rawPath.startsWith('/') || !PUBLIC_FILES.includes(file) || file === '_headers') return { status: 404, file: '404.html' };
  return { status: 200, file };
}
export async function startServer() {
  await validateTree(join(ROOT, 'dist'));
  const server = createServer(async (request, response) => {
    const result = route(request.method, request.headers.host, request.url);
    const extension = result.file?.slice(result.file.lastIndexOf('.'));
    const headers = {
      'Content-Type': MIME[extension] || 'text/plain; charset=utf-8',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store',
    };
    if (result.status === 405) headers.Allow = 'GET, HEAD';
    try {
      const bytes = result.file ? await readFile(join(ROOT, 'dist', result.file)) : Buffer.from(result.status === 405 ? 'Method not allowed' : 'Forbidden');
      response.writeHead(result.status, { ...headers, 'Content-Length': bytes.length });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch { response.writeHead(500, headers); response.end('Unavailable'); }
  });
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'PORT_4232_IN_USE; no process stopped' : 'SERVER_ERROR'); process.exitCode = 1; });
  server.listen(4232, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4232 (no browser opened)'));
  return server;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await startServer();
