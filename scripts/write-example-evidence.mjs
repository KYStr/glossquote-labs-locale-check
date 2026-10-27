import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT } from './files.mjs';
import { createController } from '../public/js/controller.mjs';

const directory = join(ROOT, 'evidence/m1/example-output');
await mkdir(directory, { recursive: true });
const blobs = [];
const controller = createController({ createUrl: blob => { blobs.push(blob); return `blob:offline-example-${blobs.length}`; }, revokeUrl() {}, setTimer: () => 0, clearTimer() {} });
controller.loadExample();
await writeFile(join(directory, 'reference.fake.json'), controller.snapshot().sources.reference + '\n');
await writeFile(join(directory, 'translation.fake.json'), controller.snapshot().sources.target + '\n');
controller.check();
controller.setFilter('missing');
for (const format of ['json', 'txt']) {
  const output = controller.prepareDownload(format);
  const bytes = Buffer.from(await blobs.at(-1).arrayBuffer());
  if (bytes.length !== output.bytes) throw new Error('BYTE_COUNT_MISMATCH');
  await writeFile(join(directory, output.filename), bytes);
}
const report = JSON.parse(await readFile(join(directory, 'locale-check-report.json'), 'utf8'));
const expected = { referenceLeaves: 6, targetLeaves: 6, missing: 1, extra: 1, typeConflicts: 1, variables: 2, review: 2, errors: 5, missingVariables: 2, extraVariables: 1, total: 7 };
if (JSON.stringify(report.counts) !== JSON.stringify(expected)) throw new Error(`FAKE_EXAMPLE_COUNTS:${JSON.stringify(report.counts)}`);
const manifest = [];
for (const file of ['reference.fake.json', 'translation.fake.json', 'locale-check-report.json', 'locale-check-report.txt']) {
  const bytes = await readFile(join(directory, file));
  manifest.push({ path: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(join(directory, 'manifest.json'), JSON.stringify({ scope: 'Actual offline Blob bytes from the real controller; fictional inputs only. Not a browser download gate.', expectedCounts: expected, files: manifest }, null, 2) + '\n');
controller.dispose();
console.log(JSON.stringify({ files: manifest.length, status: 'PASS', scope: 'offline Blob output only' }));
