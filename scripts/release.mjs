import { lstat, readdir, readFile, realpath, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, dirname, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { ROOT, PUBLIC_FILES } from './files.mjs';
import { seoTags, removeCandidateNotices } from './release-html.mjs';
import { validateReleaseConfig } from './release-config.mjs';

export const ORIGIN = 'https://locale-check.glossquote.com';
export const TOOL_SLUG = 'locale-check';
export const SITE_FILES = Object.freeze([...new Set([...PUBLIC_FILES, 'robots.txt', '_headers', '_redirects', 'sitemap.xml'])].sort());
// Reviewed M1 public input pins, copied from its fixed source manifest. Updating
// these requires a separately reviewed runtime candidate; no environment override.
const SOURCE_PINS = [
  ['404.html', 538, '574b89e0cbdf14a9e061d228c13ddd2ed31c7b2c2422c8d79b08539eb1f1a680'],
  ['_headers', 410, '62bd302426ddbb960c7d4d62aefc5816931cbba48c4b81eb0f98679c6dee18a6'],
  ['en/index.html', 10054, '7c5bb08d57bd29edd36c06a3b493b273c8e209d8fa5b08e6444eb35bfc394d39'],
  ['index.html', 9665, '67cd132f47d5093755d9c63f69d278b21a6a2a74f0e95e5ae4e287a481292e86'],
  ['js/app.mjs', 9213, 'f7bab2732cf4c15e6bb8e6de9a59838f8fa2538ebd00cb1a5f407f569d1f9169'],
  ['js/controller.mjs', 7824, '7fc1ddad98e465574da91b50862724da125ce268b5bf6912026302049ab2586d'],
  ['js/core/compare.mjs', 4462, '1d992b9f99f7700c092aa259a71319759bc17d576fc214e3761ca0e70261a0a3'],
  ['js/core/parse-locale.mjs', 4407, 'e9a02fa9178c1443f920c95a724770e90d6bc41f628acbcb8c1f82ddae1ff3dc'],
  ['js/core/placeholders.mjs', 1065, '64d68af91ce3b67ec1228e3741ced6fc0e86ad9ed92c16197580c0a1f53e4970'],
  ['js/core/session.mjs', 2676, 'c782e715cb8080133c60c065c07139a051e00bfbfb6fd26c7455059af9716620'],
  ['js/locales/en.mjs', 4574, 'ce3dac2f5714e5bc19c8a02dc35f024f11606193d2f2a8abab7cb4421fffdfb3'],
  ['js/locales/zh-Hant.mjs', 4291, 'c0277f48276b73e8a838c55ff837f848a75c3a9c91b8222ffff42e0c7f8fdd3d'],
  ['styles/app.css', 9267, '4d2e266b19de1d6e53c893d48bd7a8f2ffa9cf8dee60514df38805033b9c1cdb'],
].map(([path, bytes, sha256]) => Object.freeze({ path, bytes, sha256 }));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const encodedJson = object => Buffer.from(JSON.stringify(object, null, 2) + '\n');
const sourceSizes = new Map(SOURCE_PINS.map(file => [file.path, file.bytes]));
const fail = code => { throw new Error(code); };
const urls = Object.freeze({ 'zh-Hant': `${ORIGIN}/index.html`, en: `${ORIGIN}/en/index.html`, 'x-default': `${ORIGIN}/index.html` });

async function assertDirectory(path) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail('RELEASE_UNSAFE_DIRECTORY');
  if ((await realpath(path)).toLowerCase() !== resolve(path).toLowerCase()) fail('RELEASE_INDIRECT_DIRECTORY');
}
function requiredDirectories(paths) {
  const directories = new Set();
  for (const path of paths) {
    const parts = path.split('/');
    for (let index = 1; index < parts.length; index++) directories.add(parts.slice(0, index).join('/'));
  }
  return directories;
}
async function readClosedTree(directory, expectedSizes, { optional = false } = {}) {
  try { await assertDirectory(directory); }
  catch (error) { if (optional && error.code === 'ENOENT') return null; throw error; }
  const directories = requiredDirectories([...expectedSizes.keys()]);
  const paths = [];
  async function walk(path = '') {
    for (const name of (await readdir(join(directory, path))).sort()) {
      const local = path ? `${path}/${name}` : name;
      const full = join(directory, local);
      const stat = await lstat(full);
      if (stat.isSymbolicLink()) fail('RELEASE_LINK_REJECTED');
      if (stat.isDirectory()) {
        if (!directories.has(local)) fail('RELEASE_UNKNOWN_DIRECTORY');
        await assertDirectory(full);
        await walk(local);
      } else if (stat.isFile()) {
        if (!expectedSizes.has(local)) fail('RELEASE_UNKNOWN_FILE');
        if (stat.nlink !== 1) fail('RELEASE_MULTIPLE_FILE_LINKS');
        if (stat.size !== expectedSizes.get(local)) fail('RELEASE_FILE_SIZE_MISMATCH');
        paths.push(local);
      } else fail('RELEASE_SPECIAL_FILE_REJECTED');
    }
  }
  await walk();
  if (paths.length !== expectedSizes.size || [...expectedSizes.keys()].some(path => !paths.includes(path))) fail('RELEASE_MISSING_FILE');
  return new Map(await Promise.all(paths.sort().map(async path => [path, await readFile(join(directory, path))])));
}

function releasePage(bytes, language) {
  const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const input = seoTags(html);
  if (input.robots.length !== 1 || input.robots[0].attributes.get('content') !== 'noindex,nofollow' || input.canonical.length || input.alternates.length) fail('RELEASE_PREVIEW_SEO_MISMATCH');
  const token = input.robots[0];
  const links = `<link rel="canonical" href="${urls[language]}">\n` + Object.entries(urls).map(([lang, href]) => `<link rel="alternate" hreflang="${lang}" href="${href}">`).join('\n');
  const head = input.head.content.slice(0, token.start) + '<meta name="robots" content="index,follow">' + input.head.content.slice(token.end) + links + '\n';
  const result = html.slice(0, input.head.start) + head + html.slice(input.head.end);
  const actual = seoTags(result);
  if (actual.robots.length !== 1 || actual.robots[0].attributes.get('content') !== 'index,follow' || actual.canonical.length !== 1 || actual.canonical[0].attributes.get('href') !== urls[language]) fail('RELEASE_CANONICAL_INVALID');
  if (actual.alternates.length !== 3 || new Set(actual.alternates.map(tag => tag.attributes.get('hreflang'))).size !== 3 || actual.alternates.some(tag => urls[tag.attributes.get('hreflang')] !== tag.attributes.get('href'))) fail('RELEASE_ALTERNATES_INVALID');
  if (html.slice(input.head.end) !== result.slice(actual.head.end) || html.slice(0, input.head.start) !== result.slice(0, actual.head.start)) fail('RELEASE_VISIBLE_HTML_CHANGED');
  return Buffer.from(removeCandidateNotices(result, language));
}
function releaseHeaders(bytes) {
  const text = bytes.toString('utf8');
  const matches = [...text.matchAll(/^[ \t]*X-Robots-Tag:[^\r\n]*/gim)];
  if (matches.length !== 1 || !/X-Robots-Tag:[ \t]*noindex,[ \t]*nofollow$/.test(matches[0][0])) fail('RELEASE_SOURCE_HEADERS_MISMATCH');
  return Buffer.from(text.slice(0, matches[0].index) + matches[0][0].replace(/noindex,[ \t]*nofollow$/, 'index, follow') + text.slice(matches[0].index + matches[0][0].length));
}
function records(files) { return [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: digest(bytes) })); }

async function expectedRelease(root) {
  if (Number(process.versions.node.split('.')[0]) < 24) fail('NODE_24_REQUIRED');
  await assertDirectory(root);
  await validateReleaseConfig(root);
  const origin = new URL(ORIGIN);
  if (origin.protocol !== 'https:' || origin.origin !== ORIGIN || origin.port || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') fail('RELEASE_ORIGIN_INVALID');
  if (JSON.stringify([...PUBLIC_FILES].sort()) !== JSON.stringify(SOURCE_PINS.map(file => file.path))) fail('RELEASE_SOURCE_ALLOWLIST_CHANGED');
  const source = await readClosedTree(join(root, 'public'), sourceSizes);
  const sourceFiles = records(source);
  if (JSON.stringify(sourceFiles) !== JSON.stringify(SOURCE_PINS)) fail('RELEASE_SOURCE_PIN_MISMATCH');
  const site = new Map(source);
  site.set('index.html', releasePage(source.get('index.html'), 'zh-Hant'));
  site.set('en/index.html', releasePage(source.get('en/index.html'), 'en'));
  site.set('_headers', releaseHeaders(source.get('_headers')));
  site.set('_redirects', Buffer.from('/ /index.html 301\n/en /en/index.html 301\n/en/ /en/index.html 301\n'));
  site.set('robots.txt', Buffer.from(`User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`));
  site.set('sitemap.xml', Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + [urls['zh-Hant'], urls.en].map(url => `  <url><loc>${url}</loc></url>`).join('\n') + '\n</urlset>\n'));
  if (JSON.stringify([...site.keys()].sort()) !== JSON.stringify(SITE_FILES)) fail('RELEASE_SITE_ALLOWLIST_CHANGED');
  const manifest = { schemaVersion: 1, mode: 'release-candidate', origin: ORIGIN, toolSlug: TOOL_SLUG, files: records(site), sourceFiles };
  const manifestBytes = encodedJson(manifest);
  const output = new Map([['manifest.json', manifestBytes], ...[...site].map(([path, bytes]) => [`site/${path}`, bytes])]);
  return { site, manifest, manifestBytes, output };
}
async function compareOutput(directory, expected, optional) {
  const actual = await readClosedTree(directory, new Map([...expected.output].map(([path, bytes]) => [path, bytes.length])), { optional });
  if (!actual) return false;
  // Check independently rebuilds all bytes from pinned source, without trusting
  // manifest hash entries. Editing a file and its manifest together cannot pass.
  for (const [path, bytes] of expected.output) if (!actual.get(path).equals(bytes)) fail(path === 'manifest.json' ? 'RELEASE_MANIFEST_MISMATCH' : 'RELEASE_ASSET_MISMATCH');
  return true;
}
function result(expected, action) {
  return { status: 'PASS', mode: 'release-candidate', action, origin: ORIGIN, toolSlug: TOOL_SLUG, files: expected.manifest.files.length, siteBytes: expected.manifest.files.reduce((sum, file) => sum + file.bytes, 0), sourceFiles: expected.manifest.sourceFiles.length, sourceBytes: expected.manifest.sourceFiles.reduce((sum, file) => sum + file.bytes, 0), manifestSha256: digest(expected.manifestBytes), site: 'release-artifacts/site', live: false, browser: 'NOT_RUN_USER_FOCUS_INCIDENT' };
}
export async function buildRelease(root = ROOT) {
  const base = resolve(root);
  const expected = await expectedRelease(base);
  const directory = join(base, 'release-artifacts');
  if (await compareOutput(directory, expected, true)) return result(expected, 'verified-existing-without-writes');
  // Source and all existing output have been checked before mutation. Exclusive
  // creation never overwrites an unmanaged or altered file. No recursive delete.
  await mkdir(directory);
  for (const path of [...requiredDirectories([...expected.output.keys()])].sort((a, b) => a.split('/').length - b.split('/').length || (a < b ? -1 : 1))) {
    await assertDirectory(dirname(join(directory, path)));
    await mkdir(join(directory, path));
  }
  for (const [path, bytes] of expected.output) {
    if (path === 'manifest.json') continue;
    const destination = join(directory, path);
    if (relative(directory, destination).startsWith('..') || destination.split(sep).includes('..')) fail('RELEASE_OUTPUT_ESCAPE');
    await assertDirectory(dirname(destination));
    await writeFile(destination, bytes, { flag: 'wx' });
  }
  await writeFile(join(directory, 'manifest.json'), expected.manifestBytes, { flag: 'wx' });
  await compareOutput(directory, expected, false);
  return result(expected, 'created');
}
export async function checkRelease(root = ROOT) {
  const base = resolve(root);
  const expected = await expectedRelease(base);
  await compareOutput(join(base, 'release-artifacts'), expected, false);
  return result(expected, 'checked-without-writes');
}
export async function main(args) {
  if (args.length !== 1 || !['build', 'check'].includes(args[0])) fail('RELEASE_USAGE_EXPECT_EXACTLY_BUILD_OR_CHECK');
  return args[0] === 'build' ? buildRelease() : checkRelease();
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try { console.log(JSON.stringify(await main(process.argv.slice(2)))); }
  catch (error) { console.error(error.message.startsWith('RELEASE_') || error.message === 'NODE_24_REQUIRED' || error.message.startsWith('HTML_') ? error.message : 'RELEASE_IO_ERROR'); process.exitCode = 1; }
}
