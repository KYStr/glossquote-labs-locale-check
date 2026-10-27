import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ROOT, PUBLIC_FILES, inventory } from './files.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const evidence = join(ROOT, 'evidence/m1');
const prefix = process.argv[2] || 'T04';
if (!/^T04(?:-attempt\d+)?$/.test(prefix)) throw new Error('EXPECTED_FINAL_GATE_PREFIX');
const summary = JSON.parse(await readFile(join(evidence, `${prefix}-summary.json`), 'utf8'));
if (summary.status !== 'PASS' || !summary.sourceUnchanged || summary.commands.some(command => command.exit !== 0)) throw new Error('FINAL_GATES_REQUIRED');
const manifestBytes = await readFile(join(evidence, `${prefix}-source-after.json`));
if (digest(manifestBytes) !== summary.sourceManifestSha256) throw new Error('MANIFEST_CHANGED');
const implementation = JSON.parse(manifestBytes);
async function verifyFile(file, directory = ROOT) {
  if (file.path.startsWith('/') || file.path.includes(':') || file.path.split('/').some(segment => ['..', '.'].includes(segment))) throw new Error('UNSAFE_MANIFEST_PATH');
  const bytes = await readFile(join(directory, file.path));
  if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error(`SOURCE_CHANGED:${file.path}`);
}
for (const file of implementation) await verifyFile(file);
const dist = [];
for (const path of PUBLIC_FILES) {
  const source = await readFile(join(ROOT, 'public', path));
  const output = await readFile(join(ROOT, 'dist', path));
  if (!source.equals(output)) throw new Error('DIST_BYTES_MISMATCH');
  dist.push({ path, bytes: output.length, sha256: digest(output) });
}
const example = JSON.parse(await readFile(join(evidence, 'example-output/manifest.json'), 'utf8'));
for (const file of example.files) await verifyFile(file, join(evidence, 'example-output'));
const before = JSON.parse(await readFile(join(evidence, 'environment-before.json'), 'utf8'));
const after = JSON.parse(await readFile(join(evidence, 'environment-after.json'), 'utf8'));
if (before.Status !== 'PASS' || JSON.stringify(before) !== JSON.stringify(after)) throw new Error('PERSISTENT_ENVIRONMENT_DRIFT');
const contracts = JSON.parse(await readFile(join(evidence, 'protected-contracts-before-final.json'), 'utf8'));
for (const file of contracts) await verifyFile(file);
const allPaths = ['package.json', '.gitignore', 'TASK-ENTRY.md', 'HANDOFF.md', 'README.md', 'START-HERE.md', 'AGENTS.md', 'PRODUCT.md', 'TECHNICAL.md', 'UX-SEO.md', 'ACCEPTANCE.md', 'TASKS.md'];
for (const directory of ['public', 'scripts', 'test', 'docs']) allPaths.push(...(await inventory(join(ROOT, directory))).map(path => `${directory}/${path}`));
const all = await Promise.all(allPaths.sort().map(async path => {
  const bytes = await readFile(join(ROOT, path));
  return { path, bytes: bytes.length, sha256: digest(bytes) };
}));
const allBytes = JSON.stringify(all, null, 2) + '\n';
await writeFile(join(evidence, 'source-all-manifest.json'), allBytes);
await writeFile(join(evidence, 'dist-manifest.json'), JSON.stringify(dist, null, 2) + '\n');
const result = {
  status: 'PASS', finalGate: prefix, node: process.version,
  implementation: { files: implementation.length, bytes: summary.sourceBytes, manifestSha256: summary.sourceManifestSha256, unchangedBeforeAfterGates: true },
  selfContainedSource: { files: all.length, bytes: all.reduce((sum, file) => sum + file.bytes, 0), manifestSha256: digest(allBytes), manifest: 'source-all-manifest.json' },
  protectedContracts: { files: contracts.length, unchangedAcrossFinalGates: true },
  dist: { files: dist.length, bytes: dist.reduce((sum, file) => sum + file.bytes, 0), matchesPublicByteForByte: true, mode: 'preview-noindex' },
  exampleOutput: { files: example.files.length, bytesAndHashesVerified: true, scope: 'offline Blob output, not a real browser download' },
  environment: 'PASS_UNCHANGED', browser: 'NOT_RUN_USER_FOCUS_INCIDENT', github: 'NOT_PUBLISHED_M2_NOT_AUTHORIZED', hosting: 'NOT_DEPLOYED_M3_OWNER_PRIMARY',
};
await writeFile(join(evidence, 'candidate-verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
