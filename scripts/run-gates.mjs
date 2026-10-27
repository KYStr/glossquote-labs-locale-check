import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, inventory } from './files.mjs';

const stage = process.argv[2];
if (!/^T0[0-4]$/.test(stage || '')) throw new Error('EXPECTED_MILESTONE_T00_TO_T04');
const evidence = join(ROOT, 'evidence/m1');
await mkdir(evidence, { recursive: true });
let prefix = stage;
let attempt = 1;
while (await access(join(evidence, `${prefix}-summary.json`)).then(() => true, () => false)) prefix = `${stage}-attempt${++attempt}`;
const guard = JSON.parse(await readFile(join(evidence, 'environment-before.json'), 'utf8'));
if (guard.Status !== 'PASS') throw new Error('ENVIRONMENT_BASELINE_FAILED');
async function manifest() {
  const paths = ['package.json', '.gitignore', 'TASK-ENTRY.md'];
  for (const directory of ['public', 'scripts', 'test']) {
    paths.push(...(await inventory(join(ROOT, directory))).map(file => `${directory}/${file}`));
  }
  return Promise.all(paths.sort().map(async path => {
    const bytes = await readFile(join(ROOT, path));
    return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }));
}
const before = await manifest();
await writeFile(join(evidence, `${prefix}-source-before.json`), JSON.stringify(before, null, 2) + '\n');
const npm = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const commands = [['test'], ['run', 'check'], ...(stage === 'T01' ? [] : [['run', 'build']])];
const results = [];
for (const args of commands) {
  const result = spawnSync(process.execPath, [npm, ...args], { cwd: ROOT, shell: false, windowsHide: true, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  const command = `npm ${args.join(' ')}`;
  const log = `${prefix}-${args.at(-1)}.log`;
  await writeFile(join(evidence, log), `${result.stdout || ''}${result.stderr || ''}`, 'utf8');
  const output = result.stdout || '';
  const total = /^(?:ℹ|#)\s+tests\s+(\d+)/m.exec(output);
  const passed = /^(?:ℹ|#)\s+pass\s+(\d+)/m.exec(output);
  const failed = /^(?:ℹ|#)\s+fail\s+(\d+)/m.exec(output);
  results.push({ command, exit: result.status, signal: result.signal, error: result.error?.code || null, log,
    ...(args[0] === 'test' ? { tests: total ? Number(total[1]) : null, passed: passed ? Number(passed[1]) : null, failed: failed ? Number(failed[1]) : null } : {}),
  });
  console.log(JSON.stringify(results.at(-1)));
  if (result.status !== 0) break;
}
const after = await manifest();
const unchanged = JSON.stringify(before) === JSON.stringify(after);
await writeFile(join(evidence, `${prefix}-source-after.json`), JSON.stringify(after, null, 2) + '\n');
const summary = { stage, node: process.version, commands: results, sourceUnchanged: unchanged, sourceFiles: after.length, sourceBytes: after.reduce((n, file) => n + file.bytes, 0), sourceManifestSha256: createHash('sha256').update(JSON.stringify(after, null, 2) + '\n').digest('hex'), status: unchanged && results.length === commands.length && results.every(result => result.exit === 0) ? 'PASS' : 'FAIL', browser: 'NOT_RUN_USER_FOCUS_INCIDENT' };
await writeFile(join(evidence, `${prefix}-summary.json`), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary));
if (summary.status !== 'PASS') process.exitCode = 1;
