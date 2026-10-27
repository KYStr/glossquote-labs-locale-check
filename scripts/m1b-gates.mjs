import { readFile, writeFile, readdir, lstat, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ROOT } from './files.mjs';

const evidence = join(ROOT, 'evidence/m1b');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const encoded = object => JSON.stringify(object, null, 2) + '\n';
const permitted = path => ['package.json', '.gitignore', 'HANDOFF.md', 'TASK-ENTRY.md', 'M1B-RELEASE.md'].includes(path) || /^(?:scripts|test)\//.test(path);
async function scan() {
  const files = [];
  async function walk(directory = '') {
    for (const name of (await readdir(join(ROOT, directory))).sort()) {
      const path = directory ? `${directory}/${name}` : name;
      if (['evidence/m1b', 'release-artifacts'].includes(path)) continue;
      const stat = await lstat(join(ROOT, path));
      if (stat.isSymbolicLink()) throw new Error('M1B_SCOPE_LINK');
      if (stat.isDirectory()) await walk(path);
      else {
        const bytes = await readFile(join(ROOT, path));
        files.push({ path, bytes: bytes.length, sha256: sha(bytes) });
      }
    }
  }
  await walk();
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
const entry = JSON.parse(await readFile(join(evidence, 'entry-files.json'), 'utf8'));
async function verifyScope() {
  const current = await scan();
  const before = new Map(entry.map(file => [file.path, file]));
  const after = new Map(current.map(file => [file.path, file]));
  const changes = [];
  for (const path of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const a = before.get(path), b = after.get(path);
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (!permitted(path)) throw new Error(`M1B_SCOPE_DRIFT:${path}`);
    changes.push({ path, before: a || null, after: b || null });
  }
  for (const path of ['HANDOFF.md', 'TASK-ENTRY.md']) {
    const bytes = await readFile(join(ROOT, path));
    if (sha(bytes.subarray(0, before.get(path).bytes)) !== before.get(path).sha256) throw new Error('M1B_HISTORICAL_TEXT_CHANGED');
  }
  return { current, changes, protectedFiles: entry.filter(file => !permitted(file.path)).length };
}
function sourceOnly(files) { return files.filter(file => !file.path.startsWith('evidence/') && !file.path.startsWith('dist/') && file.path !== 'HANDOFF.md'); }
const mode = process.argv[2];
if (process.argv.length !== 3 || !['gates', 'verify'].includes(mode)) throw new Error('M1B_EXPECT_GATES_OR_VERIFY');
if (mode === 'gates') {
  const guard = JSON.parse(await readFile(join(evidence, 'environment-before.json'), 'utf8'));
  if (guard.Status !== 'PASS') throw new Error('M1B_ENVIRONMENT_BASELINE_FAILED');
  const initial = await verifyScope();
  const before = sourceOnly(initial.current);
  let prefix = 'final';
  let attempt = 1;
  while (await access(join(evidence, `${prefix}-summary.json`)).then(() => true, () => false)) prefix = `final-attempt${++attempt}`;
  await writeFile(join(evidence, `${prefix}-source-before.json`), encoded(before));
  const npm = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const commands = [['test'], ['run', 'check'], ['run', 'build:release'], ['run', 'check:release']];
  const results = [];
  for (const args of commands) {
    const result = spawnSync(process.execPath, [npm, ...args], { cwd: ROOT, shell: false, windowsHide: true, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
    const label = args.at(-1).replace(':', '-');
    const log = `${prefix}-${label}.log`;
    await writeFile(join(evidence, log), `${result.stdout || ''}${result.stderr || ''}`);
    const total = /^(?:ℹ|#)\s+tests\s+(\d+)/m.exec(result.stdout || '');
    const pass = /^(?:ℹ|#)\s+pass\s+(\d+)/m.exec(result.stdout || '');
    const fail = /^(?:ℹ|#)\s+fail\s+(\d+)/m.exec(result.stdout || '');
    const record = { command: `npm ${args.join(' ')}`, exit: result.status, signal: result.signal, error: result.error?.code || null, log, ...(args[0] === 'test' ? { tests: total ? Number(total[1]) : null, passed: pass ? Number(pass[1]) : null, failed: fail ? Number(fail[1]) : null } : {}) };
    results.push(record);
    console.log(JSON.stringify(record));
    if (result.status !== 0) break;
  }
  const final = await verifyScope();
  const after = sourceOnly(final.current);
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  await writeFile(join(evidence, `${prefix}-source-after.json`), encoded(after));
  const summary = {
    status: unchanged && results.length === 4 && results.every(result => result.exit === 0) ? 'PASS' : 'FAIL',
    prefix, node: process.version, commands: results, sourceUnchanged: unchanged,
    sourceFiles: after.length, sourceBytes: after.reduce((sum, file) => sum + file.bytes, 0), sourceManifestSha256: sha(encoded(after)),
    protectedFilesUnchanged: final.protectedFiles, browser: 'NOT_RUN_USER_FOCUS_INCIDENT', sourcePublication: 'NOT_RUN_M2_NOT_AUTHORIZED', hosting: 'NOT_DEPLOYED',
  };
  if (summary.status === 'PASS') summary.releaseManifestSha256 = sha(await readFile(join(ROOT, 'release-artifacts/manifest.json')));
  await writeFile(join(evidence, `${prefix}-summary.json`), encoded(summary));
  await writeFile(join(evidence, 'latest-gates.json'), encoded({ prefix }));
  console.log(JSON.stringify(summary));
  if (summary.status !== 'PASS') process.exitCode = 1;
} else {
  const { prefix } = JSON.parse(await readFile(join(evidence, 'latest-gates.json'), 'utf8'));
  const summary = JSON.parse(await readFile(join(evidence, `${prefix}-summary.json`), 'utf8'));
  if (summary.status !== 'PASS') throw new Error('M1B_FINAL_GATES_REQUIRED');
  const scope = await verifyScope();
  const source = sourceOnly(scope.current);
  if (sha(encoded(source)) !== summary.sourceManifestSha256) throw new Error('M1B_SOURCE_CHANGED_AFTER_GATES');
  const environmentBefore = JSON.parse(await readFile(join(evidence, 'environment-before.json'), 'utf8'));
  const environmentAfter = JSON.parse(await readFile(join(evidence, 'environment-after.json'), 'utf8'));
  if (environmentBefore.Status !== 'PASS' || JSON.stringify(environmentBefore) !== JSON.stringify(environmentAfter)) throw new Error('M1B_PERSISTENT_ENVIRONMENT_DRIFT');
  const artifactBytes = await readFile(join(ROOT, 'release-artifacts/manifest.json'));
  if (sha(artifactBytes) !== summary.releaseManifestSha256) throw new Error('M1B_ARTIFACT_MANIFEST_CHANGED');
  const manifest = JSON.parse(artifactBytes);
  for (const [key, directory] of [['files', 'release-artifacts/site'], ['sourceFiles', 'public']]) for (const file of manifest[key]) {
    if (file.path.includes('..') || file.path.includes(':') || file.path.startsWith('/')) throw new Error('M1B_UNSAFE_PATH');
    const bytes = await readFile(join(ROOT, directory, file.path));
    if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) throw new Error('M1B_ARTIFACT_BYTES_CHANGED');
  }
  const fullSource = scope.current.filter(file => !file.path.startsWith('evidence/') && !file.path.startsWith('dist/'));
  await writeFile(join(evidence, 'source-all-manifest.json'), encoded(fullSource));
  await writeFile(join(evidence, 'scope-diff.json'), encoded({ protectedFilesUnchanged: scope.protectedFiles, changedFiles: scope.changes }));
  const result = {
    status: 'PASS', finalGates: prefix, node: process.version, commands: summary.commands,
    checkedSource: { files: source.length, bytes: summary.sourceBytes, manifestSha256: summary.sourceManifestSha256, unchangedAcrossGates: true },
    fullSource: { files: fullSource.length, bytes: fullSource.reduce((sum, file) => sum + file.bytes, 0), manifestSha256: sha(encoded(fullSource)), manifest: 'source-all-manifest.json' },
    artifact: { origin: manifest.origin, toolSlug: manifest.toolSlug, mode: manifest.mode, files: manifest.files.length, siteBytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0), manifestBytes: artifactBytes.length, manifestSha256: sha(artifactBytes), sourceFiles: manifest.sourceFiles.length, sourceBytes: manifest.sourceFiles.reduce((sum, file) => sum + file.bytes, 0) },
    scopeChanges: scope.changes.map(file => file.path), protectedFilesUnchanged: scope.protectedFiles, environment: 'PASS_UNCHANGED',
    browser: 'NOT_RUN_USER_FOCUS_INCIDENT', sourcePublication: 'NOT_RUN_M2_NOT_AUTHORIZED', hosting: 'NOT_DEPLOYED',
  };
  await writeFile(join(evidence, 'candidate-verification.json'), encoded(result));
  console.log(JSON.stringify(result));
}
