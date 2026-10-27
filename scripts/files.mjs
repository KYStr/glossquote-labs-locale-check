import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { resolve, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const PUBLIC_FILES = Object.freeze([
  'index.html', 'en/index.html', '404.html', '_headers', 'styles/app.css',
  'js/app.mjs', 'js/controller.mjs', 'js/locales/zh-Hant.mjs', 'js/locales/en.mjs',
  'js/core/parse-locale.mjs', 'js/core/placeholders.mjs', 'js/core/compare.mjs', 'js/core/session.mjs',
]);

export async function inventory(directory, { optional = false } = {}) {
  let info;
  try { info = await lstat(directory); } catch (error) {
    if (optional && error.code === 'ENOENT') return [];
    throw error;
  }
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('UNSAFE_DIRECTORY');
  const base = resolve(directory);
  if ((await realpath(base)).toLowerCase() !== base.toLowerCase()) throw new Error('INDIRECT_DIRECTORY');
  const files = [];
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      const stat = await lstat(child);
      if (stat.isSymbolicLink()) throw new Error('SYMLINK_REJECTED');
      if (stat.isDirectory()) await walk(child);
      else if (stat.isFile()) files.push(relative(base, child).split(sep).join('/'));
      else throw new Error('UNSUPPORTED_FILE');
    }
  }
  await walk(base);
  return files.sort();
}

export async function validateTree(directory, { optional = false } = {}) {
  const files = await inventory(directory, { optional });
  if (files.some(file => !PUBLIC_FILES.includes(file))) throw new Error('UNKNOWN_PUBLIC_FILE');
  if (!optional && PUBLIC_FILES.some(file => !files.includes(file))) throw new Error('MISSING_PUBLIC_FILE');
  return files;
}

export async function readPublic(root = ROOT) {
  const directory = join(root, 'public');
  await validateTree(directory);
  return new Map(await Promise.all(PUBLIC_FILES.map(async file => [file, await readFile(join(directory, file), 'utf8')])));
}
