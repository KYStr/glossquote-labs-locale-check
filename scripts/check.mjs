import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readPublic, inventory } from './files.mjs';
import { readFile } from 'node:fs/promises';

export async function check(root = ROOT) {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('NODE_24_REQUIRED');
  const files = await readPublic(root);
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  if (pkg.private !== true || pkg.type !== 'module' || pkg.engines?.node !== '>=24' || Object.keys(pkg.dependencies || {}).length || Object.keys(pkg.devDependencies || {}).length) throw new Error('PACKAGE_CONTRACT');
  for (const [file, source] of files) {
    if (/\.(?:mjs|html|css)$/.test(file) && source.includes('\uFFFD')) throw new Error('INVALID_UTF8_SOURCE');
    if (file.endsWith('.mjs')) {
      const result = spawnSync(process.execPath, ['--check', join(root, 'public', file)], { shell: false, windowsHide: true, encoding: 'utf8' });
      if (result.status !== 0) throw new Error(`ESM_SYNTAX:${file}`);
      if (/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|serviceWorker|eval)\b|\bconsole\s*\.|\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|new\s+Function\b|document\.cookie|location\.(?:search|hash)|history\./.test(source)) throw new Error(`UNSAFE_JS:${file}`);
      if (/\bimport\s*\(/.test(source)) throw new Error('DYNAMIC_IMPORT');
      for (const match of source.matchAll(/^\s*(?:import|export)\s+(?:[^;\n]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) {
        if (!match[1].startsWith('./') && !match[1].startsWith('../')) throw new Error('EXTERNAL_IMPORT');
        const resolved = new URL(match[1], pathToFileURL(join(root, 'public', file)));
        const base = pathToFileURL(join(root, 'public') + '/').href;
        if (!resolved.href.startsWith(base)) throw new Error('IMPORT_OUTSIDE_PUBLIC');
        if (!files.has(decodeURIComponent(resolved.pathname.slice(new URL(base).pathname.length)))) throw new Error('MISSING_IMPORT');
      }
    }
    if (file.endsWith('.css') && /@import|url\s*\(/i.test(source)) throw new Error('EXTERNAL_CSS');
    if (file.endsWith('.html')) {
      if (!/<meta name="robots" content="noindex,nofollow">/.test(source)) throw new Error('PREVIEW_NOINDEX_REQUIRED');
      if (/rel="canonical"|application\/ld\+json|<script(?![^>]*\bsrc=)|\son\w+\s*=|<iframe|<base\b|<form[^>]+action=/i.test(source)) throw new Error('UNSAFE_HTML');
      if (/(?:src|href)\s*=\s*['"](?:https?:|\/\/)/i.test(source.replaceAll(/<a\b[^>]*href="https:\/\/glossquote\.com\/(?:en\/)?index\.html"[^>]*>/g, ''))) throw new Error('REMOTE_RESOURCE');
      for (const match of source.matchAll(/(?:src|href)="([^"#]+)"/g)) {
        if (match[1].startsWith('https://glossquote.com/')) continue;
        const url = new URL(match[1], `https://preview.invalid/${file}`);
        if (url.origin !== 'https://preview.invalid' || !files.has(url.pathname.slice(1))) throw new Error(`BROKEN_ASSET:${file}`);
      }
    }
  }
  const zh = files.get('index.html');
  const en = files.get('en/index.html');
  for (const [html, language, home, alternate] of [[zh, 'zh-Hant', 'https://glossquote.com/index.html', '/en/index.html'], [en, 'en', 'https://glossquote.com/en/index.html', '/index.html']]) {
    if (!html.includes(`<html lang="${language}">`) || !/<title>[^<]+<\/title>/.test(html) || !/<meta name="description" content="[^"]+">/.test(html) || (html.match(/<h1[ >]/g) || []).length !== 1 || !html.includes(`href="${home}"`) || !html.includes(`href="${alternate}"`)) throw new Error('BILINGUAL_STRUCTURE');
  }
  const ids = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (JSON.stringify(ids(zh)) !== JSON.stringify(ids(en)) || new Set(ids(zh)).size !== ids(zh).length) throw new Error('BILINGUAL_IDS');
  for (const html of [zh, en]) {
    for (const field of ['reference', 'target', 'reference-file', 'target-file', 'syntax', 'filter', 'report-text']) {
      if (!html.includes(`for="${field}"`) || !ids(html).includes(field)) throw new Error('FIELD_LABEL');
    }
    if (!html.includes('role="status"') || !html.includes('aria-live="polite"') || !html.includes('id="check" type="submit" class="primary" disabled')) throw new Error('INITIAL_STATE_CONTRACT');
  }
  for (const directory of ['scripts', 'test']) {
    const paths = await inventory(join(root, directory), { optional: true });
    for (const file of paths.filter(file => file.endsWith('.mjs'))) {
      const result = spawnSync(process.execPath, ['--check', join(root, directory, file)], { shell: false, windowsHide: true, encoding: 'utf8' });
      if (result.status !== 0) throw new Error(`TOOL_SYNTAX:${file}`);
    }
  }
  const headers = files.get('_headers');
  for (const required of ["default-src 'self'", "connect-src 'none'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", 'X-Content-Type-Options: nosniff', 'Referrer-Policy: no-referrer', 'X-Robots-Tag: noindex, nofollow']) {
    if (!headers.includes(required)) throw new Error('SECURITY_HEADERS');
  }
  return { files: files.size, status: 'PASS', scope: 'ESM/static structure/safety scan; not browser verification' };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try { console.log(JSON.stringify(await check())); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
