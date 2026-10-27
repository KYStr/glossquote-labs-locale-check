import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, cp, readFile, writeFile, readdir, lstat, rm, symlink, access } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { ROOT, PUBLIC_FILES } from '../scripts/files.mjs';
import { buildRelease, checkRelease, ORIGIN, TOOL_SLUG } from '../scripts/release.mjs';
import { readHead, seoTags } from '../scripts/release-html.mjs';

const FIXTURES = resolve(ROOT, 'evidence/m2a/release-fixtures');
await mkdir(FIXTURES, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(task) {
  const root = await mkdtemp(join(FIXTURES, 'copy-'));
  try {
    await cp(join(ROOT, 'public'), join(root, 'public'), { recursive: true });
    await cp(join(ROOT, 'wrangler.jsonc'), join(root, 'wrangler.jsonc'));
    return await task(root);
  }
  finally {
    const within = relative(FIXTURES, resolve(root));
    assert.ok(within && !within.startsWith('..') && !isAbsolute(within));
    await rm(root, { recursive: true });
  }
}
async function snapshot(directory) {
  const entries = [];
  async function walk(path = '') {
    for (const name of (await readdir(join(directory, path))).sort()) {
      const local = path ? `${path}/${name}` : name;
      const info = await lstat(join(directory, local));
      if (info.isDirectory()) { entries.push([local, 'directory']); await walk(local); }
      else { assert.equal(info.isSymbolicLink(), false); entries.push([local, sha(await readFile(join(directory, local)))]); }
    }
  }
  await walk();
  return entries;
}
const text = (root, path) => readFile(join(root, path), 'utf8');
async function rejectUnchanged(root) {
  const before = await snapshot(join(root, 'release-artifacts'));
  await assert.rejects(checkRelease(root), /RELEASE_/);
  await assert.rejects(buildRelease(root), /RELEASE_/);
  assert.deepEqual(await snapshot(join(root, 'release-artifacts')), before);
}
async function coherentTamper(root, path, bytes) {
  await writeFile(join(root, 'release-artifacts/site', path), bytes);
  const manifestPath = join(root, 'release-artifacts/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const entry = manifest.files.find(file => file.path === path);
  entry.bytes = Buffer.byteLength(bytes);
  entry.sha256 = sha(bytes);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

test('release: exact two-language SEO; body changes only at two reviewed candidate notices', async () => fixture(async root => {
  const before = await snapshot(join(root, 'public'));
  const result = await buildRelease(root);
  assert.equal(ORIGIN, 'https://locale-check.glossquote.com');
  assert.equal(TOOL_SLUG, 'locale-check');
  assert.equal(result.files, 16);
  assert.equal(result.live, false);
  for (const [path, language, canonical, candidate] of [
    ['index.html', 'zh-Hant', 'https://locale-check.glossquote.com/index.html', '本地候選預覽'],
    ['en/index.html', 'en', 'https://locale-check.glossquote.com/en/index.html', 'Local candidate preview'],
  ]) {
    const original = await text(root, `public/${path}`);
    const html = await text(root, `release-artifacts/site/${path}`);
    const expected = [['zh-Hant', 'https://locale-check.glossquote.com/index.html'], ['en', 'https://locale-check.glossquote.com/en/index.html'], ['x-default', 'https://locale-check.glossquote.com/index.html']];
    const parsed = seoTags(html);
    assert.match(html, new RegExp(`<html lang="${language}">`));
    assert.equal(parsed.robots.length, 1);
    assert.equal(parsed.robots[0].attributes.get('content'), 'index,follow');
    assert.equal(parsed.canonical.length, 1);
    assert.equal(parsed.canonical[0].attributes.get('href'), canonical);
    assert.deepEqual(parsed.alternates.map(tag => [tag.attributes.get('hreflang'), tag.attributes.get('href')]), expected);
    const footer = language === 'zh-Hant'
      ? '<footer>Gloss Tools by GlossQuote · 預覽版本，尚待瀏覽器驗收</footer>'
      : '<footer>Gloss Tools by GlossQuote · Preview awaiting browser acceptance</footer>';
    const expectedBody = original.slice(readHead(original).end)
      .replace(`<div class="intro"><p class="preview">${candidate}</p>`, '<div class="intro">')
      .replace(footer, '<footer>Gloss Tools by GlossQuote</footer>');
    assert.equal(html.slice(parsed.head.end), expectedBody);
    assert.equal(html.slice(0, parsed.head.start), original.slice(0, readHead(original).start));
    assert.equal(html.includes(candidate), false);
    assert.equal(html.includes(footer), false);
    assert.ok(html.includes('<footer>Gloss Tools by GlossQuote</footer>'));
    assert.equal(seoTags(original).robots[0].attributes.get('content'), 'noindex,nofollow');
    assert.equal(seoTags(original).canonical.length, 0);
  }
  assert.deepEqual(await snapshot(join(root, 'public')), before);
  await assert.rejects(access(join(root, 'public/sitemap.xml')), { code: 'ENOENT' });
  await assert.rejects(access(join(root, 'public/robots.txt')), { code: 'ENOENT' });
}));

test('release: runtime, CSS and 404 bytes preserved; exact robots, sitemap and original security headers', async () => fixture(async root => {
  await buildRelease(root);
  for (const path of PUBLIC_FILES.filter(path => !['index.html', 'en/index.html', '_headers'].includes(path))) {
    assert.deepEqual(await readFile(join(root, 'release-artifacts/site', path)), await readFile(join(root, 'public', path)));
  }
  const headers = await text(root, 'release-artifacts/site/_headers');
  assert.equal(headers, (await text(root, 'public/_headers')).replace('X-Robots-Tag: noindex, nofollow', 'X-Robots-Tag: index, follow'));
  assert.match(headers, /connect-src 'none'/);
  assert.match(headers, /script-src 'self'/);
  assert.equal(await text(root, 'release-artifacts/site/robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://locale-check.glossquote.com/sitemap.xml\n');
  const sitemap = await text(root, 'release-artifacts/site/sitemap.xml');
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]), ['https://locale-check.glossquote.com/index.html', 'https://locale-check.glossquote.com/en/index.html']);
  assert.equal(sitemap.includes('lastmod'), false);
  assert.match(await text(root, 'release-artifacts/site/404.html'), /noindex,nofollow/);
}));

test('release: manifest is exact-schema, sorted, complete, deterministic and outside site', async () => fixture(async root => {
  const first = await buildRelease(root);
  const original = await snapshot(join(root, 'release-artifacts'));
  const mtime = (await lstat(join(root, 'release-artifacts/manifest.json'))).mtimeMs;
  const second = await buildRelease(root);
  assert.equal(second.action, 'verified-existing-without-writes');
  assert.equal(first.manifestSha256, second.manifestSha256);
  assert.deepEqual(await snapshot(join(root, 'release-artifacts')), original);
  assert.equal((await lstat(join(root, 'release-artifacts/manifest.json'))).mtimeMs, mtime);
  const manifest = JSON.parse(await text(root, 'release-artifacts/manifest.json'));
  assert.deepEqual(Object.keys(manifest), ['schemaVersion', 'mode', 'origin', 'toolSlug', 'files', 'sourceFiles']);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.mode, 'release-candidate');
  assert.equal(manifest.origin, 'https://locale-check.glossquote.com');
  assert.equal(manifest.toolSlug, 'locale-check');
  assert.equal(manifest.sourceFiles.length, 13);
  assert.equal(manifest.files.length, 16);
  for (const [key, directory] of [['files', 'release-artifacts/site'], ['sourceFiles', 'public']]) {
    assert.deepEqual(manifest[key].map(file => file.path), manifest[key].map(file => file.path).sort());
    assert.equal(new Set(manifest[key].map(file => file.path)).size, manifest[key].length);
    for (const file of manifest[key]) {
      assert.deepEqual(Object.keys(file), ['path', 'bytes', 'sha256']);
      assert.equal(file.path.includes('..') || file.path.includes(':') || file.path.startsWith('/'), false);
      const bytes = await readFile(join(root, directory, file.path));
      assert.equal(bytes.length, file.bytes);
      assert.equal(sha(bytes), file.sha256);
    }
  }
  await assert.rejects(access(join(root, 'release-artifacts/site/manifest.json')), { code: 'ENOENT' });
  assert.equal((await checkRelease(root)).action, 'checked-without-writes');
}));

test('release: altered asset is rejected and build does not overwrite it', async () => fixture(async root => {
  await buildRelease(root);
  const path = join(root, 'release-artifacts/site/js/app.mjs');
  const bytes = await readFile(path); bytes[0] ^= 1; await writeFile(path, bytes);
  await rejectUnchanged(root);
}));

test('release: coherent asset plus manifest tamper still rejected independently', async () => fixture(async root => {
  await buildRelease(root);
  const bytes = await readFile(join(root, 'release-artifacts/site/js/app.mjs')); bytes[0] ^= 1;
  await coherentTamper(root, 'js/app.mjs', bytes);
  await rejectUnchanged(root);
}));

for (const [label, edit] of [
  ['wrong canonical origin', html => html.replace('https://locale-check.glossquote.com/index.html', 'https://locate-check.glossquote.com/index.html')],
  ['missing language alternative', html => html.replace(/<link rel="alternate" hreflang="en"[^>]+>\n/, '')],
  ['extra robots directive', html => html.replace('</head>', '<meta name="robots" content="noindex,nofollow">\n</head>')],
  ['changed visible copy', html => html.replace('<h1>翻譯檔缺漏檢查</h1>', '<h1>已上線</h1>')],
]) test(`release: ${label} and matching manifest are refused`, async () => fixture(async root => {
  await buildRelease(root);
  await coherentTamper(root, 'index.html', edit(await text(root, 'release-artifacts/site/index.html')));
  await rejectUnchanged(root);
}));

test('release: wrong manifest origin, mode or unknown fields rejected', async () => fixture(async root => {
  await buildRelease(root);
  const path = join(root, 'release-artifacts/manifest.json');
  const original = JSON.parse(await readFile(path, 'utf8'));
  for (const patch of [{ origin: 'https://locate-check.glossquote.com' }, { mode: 'production' }, { extra: true }, { sourceFiles: [] }]) {
    await writeFile(path, JSON.stringify({ ...original, ...patch }, null, 2) + '\n');
    await rejectUnchanged(root);
  }
}));

test('release: missing, extra file and unknown empty output directories are refused', async () => fixture(async root => {
  await buildRelease(root);
  const path = join(root, 'release-artifacts/site/robots.txt');
  const original = await readFile(path);
  await rm(path);
  await rejectUnchanged(root);
  await writeFile(path, original);
  await writeFile(join(root, 'release-artifacts/site/unmanaged.txt'), 'fake sentinel');
  await rejectUnchanged(root);
  await rm(join(root, 'release-artifacts/site/unmanaged.txt'));
  await mkdir(join(root, 'release-artifacts/site/unknown-empty'));
  await rejectUnchanged(root);
}));

test('release: changed public source, even with coherently changed artifact and source manifest, is refused', async () => fixture(async root => {
  await buildRelease(root);
  const path = 'js/core/placeholders.mjs';
  const bytes = await readFile(join(root, 'public', path)); bytes[0] ^= 1;
  await writeFile(join(root, 'public', path), bytes);
  await coherentTamper(root, path, bytes);
  const manifestPath = join(root, 'release-artifacts/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.sourceFiles.find(file => file.path === path).sha256 = sha(bytes);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  await assert.rejects(checkRelease(root), /RELEASE_SOURCE_PIN_MISMATCH/);
  await rejectUnchanged(root);
}));

test('release: bad source fails before creating output; unknown files and directories are rejected', async () => fixture(async root => {
  await writeFile(join(root, 'public/extra.txt'), 'fictional');
  await assert.rejects(buildRelease(root), /RELEASE_UNKNOWN_FILE/);
  await assert.rejects(access(join(root, 'release-artifacts')), { code: 'ENOENT' });
  await rm(join(root, 'public/extra.txt'));
  await mkdir(join(root, 'public/unknown-empty'));
  await assert.rejects(buildRelease(root), /RELEASE_UNKNOWN_DIRECTORY/);
  await assert.rejects(access(join(root, 'release-artifacts')), { code: 'ENOENT' });
}));

test('release: source and destination junctions are refused without following them', async () => fixture(async root => {
  await mkdir(join(root, 'fake-target'));
  await writeFile(join(root, 'fake-target/sentinel.txt'), 'unchanged');
  await symlink(join(root, 'fake-target'), join(root, 'public/alias'), 'junction');
  await assert.rejects(buildRelease(root), /RELEASE_LINK_REJECTED/);
  await rm(join(root, 'public/alias'));
  await symlink(join(root, 'fake-target'), join(root, 'release-artifacts'), 'junction');
  await assert.rejects(buildRelease(root), /RELEASE_UNSAFE_DIRECTORY/);
  await assert.rejects(checkRelease(root), /RELEASE_UNSAFE_DIRECTORY/);
  assert.equal(await text(root, 'fake-target/sentinel.txt'), 'unchanged');
  await rm(join(root, 'release-artifacts'));
}));

test('release: unmanaged or incomplete existing output remains untouched', async () => fixture(async root => {
  await mkdir(join(root, 'release-artifacts'));
  await writeFile(join(root, 'release-artifacts/sentinel.txt'), 'preserve me');
  await rejectUnchanged(root);
  await rm(join(root, 'release-artifacts/sentinel.txt'));
  await mkdir(join(root, 'release-artifacts/site'));
  await rejectUnchanged(root);
}));

test('release: CLI accepts only one exact mode; bad args never touch source or output', async () => fixture(async root => {
  await mkdir(join(root, 'scripts'));
  for (const path of ['release.mjs', 'release-html.mjs', 'release-config.mjs', 'files.mjs']) await cp(join(ROOT, 'scripts', path), join(root, 'scripts', path));
  const original = await snapshot(root);
  for (const args of [[], ['deploy'], ['BUILD'], ['build', 'extra'], ['check', 'extra'], ['build', '--origin=https://invalid.example']]) {
    const result = spawnSync(process.execPath, [join(root, 'scripts/release.mjs'), ...args], { cwd: root, shell: false, windowsHide: true, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /RELEASE_USAGE_EXPECT_EXACTLY_BUILD_OR_CHECK/);
    assert.deepEqual(await snapshot(root), original);
  }
  for (const mode of ['build', 'check']) {
    const result = spawnSync(process.execPath, [join(root, 'scripts/release.mjs'), mode], { cwd: root, shell: false, windowsHide: true, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).origin, 'https://locale-check.glossquote.com');
  }
}));

test('release: head tokenizer ignores fake SEO inside comments, quoted values and raw text', () => {
  const html = `<html><head><!-- <link rel="canonical" href="wrong"> --><title><link rel="canonical" href="wrong"></title><script>const fake = '<meta name="robots" content="noindex">';</script><meta name='robots' content='index,follow' data-note='> <link rel="canonical" href="wrong">'><link rel='canonical' href='https://locale-check.glossquote.com/index.html'></head><body></body></html>`;
  const parsed = seoTags(html);
  assert.equal(parsed.canonical.length, 1);
  assert.equal(parsed.canonical[0].attributes.get('href'), 'https://locale-check.glossquote.com/index.html');
  assert.equal(parsed.robots.length, 1);
  assert.equal(parsed.robots[0].attributes.get('content'), 'index,follow');
  assert.throws(() => readHead('<html><head><meta name="robots" name="robots"></head></html>'), /HTML_DUPLICATE_ATTRIBUTE/);
});
