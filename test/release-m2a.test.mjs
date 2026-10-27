import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, cp, readFile, writeFile, readdir, lstat, rm, symlink } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT } from '../scripts/files.mjs';
import { buildRelease, checkRelease, SITE_FILES } from '../scripts/release.mjs';
import { removeCandidateNotices, readHead } from '../scripts/release-html.mjs';

const FIXTURES = resolve(ROOT, 'evidence/m2a/config-redirect-fixtures');
await mkdir(FIXTURES, { recursive: true });
const REDIRECTS = '/ /index.html 301\n/en /en/index.html 301\n/en/ /en/index.html 301\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = (root, path) => readFile(join(root, path), 'utf8');
async function fixture(task) {
  const root = await mkdtemp(join(FIXTURES, 'copy-'));
  try {
    await cp(join(ROOT, 'public'), join(root, 'public'), { recursive: true });
    await cp(join(ROOT, 'wrangler.jsonc'), join(root, 'wrangler.jsonc'));
    return await task(root);
  } finally {
    const local = relative(FIXTURES, resolve(root));
    assert.ok(local && !local.startsWith('..') && !isAbsolute(local));
    await rm(root, { recursive: true });
  }
}
async function snapshot(root) {
  const files = [];
  async function walk(local = '') {
    for (const name of (await readdir(join(root, local))).sort()) {
      const path = local ? `${local}/${name}` : name;
      const info = await lstat(join(root, path));
      assert.equal(info.isSymbolicLink(), false);
      if (info.isDirectory()) { files.push([path, 'directory']); await walk(path); }
      else files.push([path, sha(await readFile(join(root, path)))]);
    }
  }
  await walk();
  return files;
}
async function rejectUnchanged(root) {
  const before = await snapshot(root);
  await assert.rejects(checkRelease(root), /RELEASE_/);
  await assert.rejects(buildRelease(root), /RELEASE_/);
  assert.deepEqual(await snapshot(root), before);
}
async function coherentTamper(root, path, text) {
  await writeFile(join(root, 'release-artifacts/site', path), text);
  const manifestPath = join(root, 'release-artifacts/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const entry = manifest.files.find(file => file.path === path);
  entry.bytes = Buffer.byteLength(text);
  entry.sha256 = sha(text);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

test('M2A: fixed assets-only config, exact three LF redirects and closed manifest', async () => fixture(async root => {
  const config = JSON.parse(await read(root, 'wrangler.jsonc'));
  assert.deepEqual(config, {
    name: 'glossquote-locale-check', compatibility_date: '2026-10-24',
    workers_dev: false, preview_urls: false, send_metrics: false,
    routes: [{ pattern: 'locale-check.glossquote.com', custom_domain: true }],
    observability: { enabled: false, logs: { enabled: false, invocation_logs: false }, traces: { enabled: false } },
    assets: { directory: './release-artifacts/site', run_worker_first: false, html_handling: 'none', not_found_handling: 'none' },
    build: { command: 'node scripts/release.mjs build' },
  });
  await buildRelease(root);
  const redirects = await readFile(join(root, 'release-artifacts/site/_redirects'));
  assert.deepEqual(redirects, Buffer.from(REDIRECTS));
  assert.equal(redirects.includes(13), false);
  assert.equal(redirects.at(-1), 10);
  const manifest = JSON.parse(await read(root, 'release-artifacts/manifest.json'));
  assert.deepEqual(manifest.files.map(file => file.path), SITE_FILES);
  assert.equal(manifest.files.length, 16);
  assert.deepEqual(manifest.files.find(file => file.path === '_redirects'), { path: '_redirects', bytes: 65, sha256: sha(REDIRECTS) });
  assert.equal(manifest.files.some(file => file.path === 'wrangler.jsonc'), false);
  assert.equal(manifest.sourceFiles.some(file => file.path === '_redirects'), false);
  assert.equal((await checkRelease(root)).status, 'PASS');
}));

for (const [label, edit] of [
  ['wrong worker', config => { config.name = 'glossquote-other'; }],
  ['wrong compatibility date', config => { config.compatibility_date = '2026-10-27'; }],
  ['workers.dev enabled', config => { config.workers_dev = true; }],
  ['preview URLs enabled', config => { config.preview_urls = true; }],
  ['metrics enabled', config => { config.send_metrics = true; }],
  ['wrong custom domain', config => { config.routes[0].pattern = 'wrong.glossquote.com'; }],
  ['custom domain disabled', config => { config.routes[0].custom_domain = false; }],
  ['additional route', config => { config.routes.push({ pattern: 'extra.glossquote.com', custom_domain: true }); }],
  ['observability enabled', config => { config.observability.enabled = true; }],
  ['logs enabled', config => { config.observability.logs.enabled = true; }],
  ['invocation logs enabled', config => { config.observability.logs.invocation_logs = true; }],
  ['traces enabled', config => { config.observability.traces.enabled = true; }],
  ['wrong assets directory', config => { config.assets.directory = './public'; }],
  ['worker-first enabled', config => { config.assets.run_worker_first = true; }],
  ['HTML auto handling', config => { config.assets.html_handling = 'auto-trailing-slash'; }],
  ['SPA fallback', config => { config.assets.not_found_handling = 'single-page-application'; }],
  ['wrong build', config => { config.build.command = 'node scripts/build.mjs'; }],
  ['runtime handler', config => { config.main = 'worker.mjs'; }],
  ['assets binding', config => { config.assets.binding = 'ASSETS'; }],
  ['vars', config => { config.vars = { EXAMPLE: 'fake' }; }],
  ['environment override', config => { config.env = { production: {} }; }],
  ['unknown field', config => { config.unreviewed = true; }],
]) test(`M2A: config rejects ${label} before writes`, async () => fixture(async root => {
  const config = JSON.parse(await read(root, 'wrangler.jsonc'));
  edit(config);
  await writeFile(join(root, 'wrangler.jsonc'), JSON.stringify(config, null, 2) + '\n');
  await rejectUnchanged(root);
}));

test('M2A: absent, duplicate-key and linked configuration are refused', async () => fixture(async root => {
  const path = join(root, 'wrangler.jsonc');
  const original = await readFile(path);
  await rm(path);
  await assert.rejects(buildRelease(root), { code: 'ENOENT' });
  assert.equal((await readdir(root)).includes('release-artifacts'), false);
  await writeFile(path, original.toString().replace('{', '{\n  "workers_dev": true,'));
  await rejectUnchanged(root);
  await rm(path);
  const target = join(root, 'config-target');
  await mkdir(target);
  await symlink(target, path, 'junction');
  await assert.rejects(buildRelease(root), /RELEASE_CONFIG_INVALID/);
  await rm(path);
  assert.deepEqual(await readdir(target), []);
}));

for (const [label, edit] of [
  ['wrong destination', text => text.replace('/en /en/index.html 301', '/en /en/other.html 301')],
  ['extra line', text => text + '/extra /index.html 301\n'],
  ['missing line', text => text.replace('/en /en/index.html 301\n', '')],
  ['wrong status', text => text.replace('301', '302')],
  ['CRLF instead of LF', text => text.replaceAll('\n', '\r\n')],
  ['missing final LF', text => text.slice(0, -1)],
]) test(`M2A: redirects ${label} plus matching manifest rejected without overwriting`, async () => fixture(async root => {
  await buildRelease(root);
  const changed = edit(REDIRECTS);
  assert.notEqual(changed, REDIRECTS);
  await coherentTamper(root, '_redirects', changed);
  await rejectUnchanged(root);
}));

test('M2A: missing redirects file plus removed manifest record rejected', async () => fixture(async root => {
  await buildRelease(root);
  await rm(join(root, 'release-artifacts/site/_redirects'));
  const path = join(root, 'release-artifacts/manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  manifest.files = manifest.files.filter(file => file.path !== '_redirects');
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
  await rejectUnchanged(root);
}));

test('M2A: notice transform is exact, two-language, head-preserving and context-bound', async () => {
  for (const [language, path, paragraph, footer] of [
    ['zh-Hant', 'index.html', '<p class="preview">本地候選預覽</p>', '<footer>Gloss Tools by GlossQuote · 預覽版本，尚待瀏覽器驗收</footer>'],
    ['en', 'en/index.html', '<p class="preview">Local candidate preview</p>', '<footer>Gloss Tools by GlossQuote · Preview awaiting browser acceptance</footer>'],
  ]) {
    const original = await read(ROOT, `public/${path}`);
    const result = removeCandidateNotices(original, language);
    assert.equal(result, original.replace(`<div class="intro">${paragraph}`, '<div class="intro">').replace(footer, '<footer>Gloss Tools by GlossQuote</footer>'));
    assert.equal(readHead(result).content, readHead(original).content);
    for (const altered of [
      original.replace(paragraph, ''),
      original.replace('<div class="intro">', '<div class="other">'),
      original.replace(footer, ''),
      original.replace(footer, footer + footer),
      original.replace(`<div class="intro">${paragraph}`, `<div class="intro">${paragraph}</div><div class="intro">${paragraph}`),
      original.replace('</head>', `${footer}</head>`),
    ]) assert.throws(() => removeCandidateNotices(altered, language), /RELEASE_CANDIDATE_NOTICE_MISMATCH/);
  }
  assert.throws(() => removeCandidateNotices('', 'unknown'), /RELEASE_NOTICE_LANGUAGE/);
});

test('M2A: coherent edits outside notice allowlist remain rejected', async () => fixture(async root => {
  await buildRelease(root);
  const path = 'en/index.html';
  const original = await read(root, `release-artifacts/site/${path}`);
  const altered = original.replace('<footer>Gloss Tools by GlossQuote</footer>', '<footer>Unreviewed release text</footer>');
  assert.notEqual(altered, original);
  await coherentTamper(root, path, altered);
  await rejectUnchanged(root);
}));
