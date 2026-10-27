import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, cp, rm, readFile, symlink } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { ROOT, PUBLIC_FILES } from '../scripts/files.mjs';
import { check } from '../scripts/check.mjs';
import { build } from '../scripts/build.mjs';
import { route } from '../scripts/serve.mjs';

const FIXTURE_ROOT = resolve(ROOT, 'evidence/m1b/toolchain-fixtures');
await mkdir(FIXTURE_ROOT, { recursive: true });

async function removeFixture(path) {
  const within = relative(FIXTURE_ROOT, resolve(path));
  assert.ok(within && !within.startsWith('..') && !isAbsolute(within));
  await rm(path, { recursive: true });
}

test('check/build reject unknown source and preserve unknown old output', async () => {
  const temp = await mkdtemp(join(FIXTURE_ROOT, 'toolchain-'));
  try {
    await cp(join(ROOT, 'public'), join(temp, 'public'), { recursive: true });
    await cp(join(ROOT, 'package.json'), join(temp, 'package.json'));
    await writeFile(join(temp, 'public', 'unexpected.txt'), 'fake');
    await assert.rejects(check(temp), /UNKNOWN_PUBLIC_FILE/);
    await assert.rejects(build(temp), /UNKNOWN_PUBLIC_FILE/);
    await rm(join(temp, 'public', 'unexpected.txt'));
    await mkdir(join(temp, 'dist'));
    await writeFile(join(temp, 'dist', 'unknown.txt'), 'preserve me');
    await assert.rejects(build(temp), /UNKNOWN_PUBLIC_FILE/);
    assert.equal(await readFile(join(temp, 'dist', 'unknown.txt'), 'utf8'), 'preserve me');
  } finally { await removeFixture(temp); }
});

test('check rejects unsafe executable DOM', async () => {
  const temp = await mkdtemp(join(FIXTURE_ROOT, 'toolchain-'));
  try {
    await cp(join(ROOT, 'public'), join(temp, 'public'), { recursive: true });
    await cp(join(ROOT, 'package.json'), join(temp, 'package.json'));
    const source = await readFile(join(temp, 'public', 'js/app.mjs'), 'utf8');
    await writeFile(join(temp, 'public', 'js/app.mjs'), source + '\ndocument.body.innerHTML = "fake";\n');
    await assert.rejects(check(temp), /UNSAFE_JS/);
  } finally { await removeFixture(temp); }
});

test('check/build reject a directory junction inside public', async () => {
  const temp = await mkdtemp(join(FIXTURE_ROOT, 'toolchain-'));
  try {
    await cp(join(ROOT, 'public'), join(temp, 'public'), { recursive: true });
    await cp(join(ROOT, 'package.json'), join(temp, 'package.json'));
    await mkdir(join(temp, 'fake-target'));
    await symlink(join(temp, 'fake-target'), join(temp, 'public', 'alias'), 'junction');
    await assert.rejects(check(temp), /SYMLINK_REJECTED/);
    await assert.rejects(build(temp), /SYMLINK_REJECTED/);
    await rm(join(temp, 'public', 'alias'));
  } finally { await removeFixture(temp); }
});

test('build rejects a junction destination without changing its target', async () => {
  const temp = await mkdtemp(join(FIXTURE_ROOT, 'toolchain-'));
  try {
    await cp(join(ROOT, 'public'), join(temp, 'public'), { recursive: true });
    await cp(join(ROOT, 'package.json'), join(temp, 'package.json'));
    await mkdir(join(temp, 'fake-target'));
    await writeFile(join(temp, 'fake-target', 'keep.txt'), 'untouched');
    await symlink(join(temp, 'fake-target'), join(temp, 'dist'), 'junction');
    await assert.rejects(build(temp), /UNSAFE_DIRECTORY/);
    assert.equal(await readFile(join(temp, 'fake-target', 'keep.txt'), 'utf8'), 'untouched');
    await rm(join(temp, 'dist'));
  } finally { await removeFixture(temp); }
});

test('routing is a closed public allowlist; no server is started', () => {
  assert.deepEqual(route('GET', '127.0.0.1:4232', '/'), { status: 200, file: 'index.html' });
  assert.equal(route('HEAD', 'localhost:4232', '/en/index.html').status, 200);
  assert.equal(route('GET', 'evil.invalid', '/').status, 403);
  assert.equal(route('POST', '127.0.0.1:4232', '/').status, 405);
  for (const path of ['/../PRODUCT.md', '/%2e%2e/PRODUCT.md', '/js/../../package.json', '//index.html', '/missing', '/_headers', '/index.html?data=fake']) {
    assert.equal(route('GET', '127.0.0.1:4232', path).status, 404);
  }
  assert.equal(PUBLIC_FILES.length, 13);
});
