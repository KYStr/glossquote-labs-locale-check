import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, PUBLIC_FILES, validateTree } from './files.mjs';
import { check } from './check.mjs';

export async function build(root = ROOT) {
  await check(root);
  await validateTree(join(root, 'dist'), { optional: true });
  for (const file of PUBLIC_FILES) {
    const destination = join(root, 'dist', file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(root, 'public', file), destination);
  }
  await validateTree(join(root, 'dist'));
  return { status: 'PASS', files: PUBLIC_FILES.length, output: 'dist', mode: 'preview-noindex' };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try { console.log(JSON.stringify(await build())); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
