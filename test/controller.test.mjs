import test from 'node:test';
import assert from 'node:assert/strict';
import { createController, createFileReadJob, PAGE_SIZE } from '../public/js/controller.mjs';
import { ERROR_CODES } from '../public/js/core/parse-locale.mjs';
import zh from '../public/js/locales/zh-Hant.mjs';
import en from '../public/js/locales/en.mjs';

function ready(controller = createController()) {
  controller.editSource('reference', '{"missing":"m","x":"Hello {name}"}');
  controller.editSource('target', '{"extra":"e","x":"你好 {user}"}');
  controller.check();
  assert.equal(controller.snapshot().state, 'ready');
  return controller;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject, cancelled: false, cancel() { this.cancelled = true; } };
}
test('controller starts empty; source and syntax edits invalidate full report synchronously', () => {
  const controller = createController();
  assert.equal(controller.snapshot().state, 'idle');
  assert.equal(controller.getReportText(), '');
  ready(controller);
  controller.editSource('target', '{"broken":false}');
  assert.equal(controller.snapshot().report, null);
  assert.equal(controller.getReportText(), '');
  assert.equal(controller.prepareDownload('json'), null);
  controller.check();
  assert.equal(controller.snapshot().errors[0].code, 'TYPE');
  assert.equal(controller.snapshot().sources.target, '{"broken":false}');
  ready(controller);
  controller.setSyntax('double');
  assert.equal(controller.snapshot().report, null);
});
test('filter and pagination change only visible rows, never complete output', () => {
  const controller = ready();
  const full = controller.getReportText();
  controller.setFilter('missing');
  assert.equal(controller.snapshot().rows.length, 1);
  assert.equal(controller.getReportText(), full);
  const source = JSON.stringify(Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`k${i}`, 'text'])));
  controller.editSource('reference', source);
  controller.editSource('target', '{}');
  controller.check();
  assert.equal(PAGE_SIZE, 50);
  assert.equal(controller.snapshot().rows.length, 50);
  controller.setPage(1);
  assert.equal(controller.snapshot().rows.length, 1);
  assert.deepEqual(controller.snapshot().rows[0].path, ['k50']);
  assert.equal(JSON.parse(controller.getReportText()).issues.length, 51);
});
test('late file read cannot restore cleared or edited data', async () => {
  const job = deferred();
  const controller = ready(createController({ readJob: () => job }));
  const load = controller.loadFile('target', { size: 2 });
  assert.equal(controller.snapshot().state, 'running');
  assert.equal(controller.snapshot().report, null);
  controller.clear();
  assert.equal(job.cancelled, true);
  job.resolve('{"late":"must not appear"}');
  await load;
  assert.equal(controller.snapshot().state, 'idle');
  assert.equal(controller.snapshot().sources.target, '');
  assert.equal(controller.snapshot().report, null);
});
test('rapid reselect rejects the first result; import overwrites only after confirmation', async () => {
  const first = deferred(), second = deferred();
  let next = 0;
  const controller = ready(createController({ readJob: () => next++ === 0 ? first : second }));
  const oldText = controller.snapshot().sources.target;
  const load1 = controller.loadFile('target', { size: 2 });
  const load2 = controller.loadFile('target', { size: 2 });
  first.resolve('{"wrong":"late"}');
  second.resolve('{"right":"new"}');
  await Promise.all([load1, load2]);
  assert.equal(first.cancelled, true);
  assert.equal(controller.snapshot().sources.target, oldText);
  assert.deepEqual(controller.snapshot().pending, { side: 'target', characters: 15 });
  controller.acceptImport();
  assert.equal(controller.snapshot().sources.target, '{"right":"new"}');
  assert.equal(controller.snapshot().pending, null);
});
test('file limits reject before read; rejected imports and invalid UTF8 preserve text', async () => {
  let reads = 0;
  const controller = ready(createController({ readJob: () => { reads++; throw new Error('private raw detail'); } }));
  const old = controller.snapshot().sources.target;
  await controller.loadFile('target', { size: 1048577 });
  assert.equal(reads, 0);
  assert.equal(controller.snapshot().errors[0].code, 'SIZE_LIMIT');
  await controller.loadFile('target', { size: 2 });
  assert.equal(controller.snapshot().errors[0].code, 'FILE_READ_ERROR');
  assert.equal(controller.snapshot().sources.target, old);
  assert.equal(JSON.stringify(controller.snapshot()).includes('private raw detail'), false);
});
test('cancel staged import keeps existing content and cannot revive results', async () => {
  const controller = ready(createController({ readJob: () => ({ promise: Promise.resolve('{}'), cancel() {} }) }));
  const old = controller.snapshot().sources.reference;
  await controller.loadFile('reference', { size: 2 });
  assert.ok(controller.snapshot().pending);
  controller.cancelImport();
  controller.acceptImport();
  assert.equal(controller.snapshot().sources.reference, old);
  assert.equal(controller.snapshot().report, null);
});
test('download adapter receives true complete UTF8 Blob bytes, safe filenames; URLs owned and revoked', async () => {
  const blobs = [], revoked = [], timers = new Map();
  let id = 0;
  const controller = ready(createController({
    createUrl: blob => { blobs.push(blob); return `blob:fake-${blobs.length}`; }, revokeUrl: url => revoked.push(url),
    setTimer: (callback, delay) => { assert.equal(delay, 30000); timers.set(++id, callback); return id; }, clearTimer: key => timers.delete(key),
  }));
  controller.setFilter('missing');
  const json = controller.prepareDownload('json');
  const txt = controller.prepareDownload('txt');
  assert.equal(json.filename, 'locale-check-report.json');
  assert.equal(txt.filename, 'locale-check-report.txt');
  assert.equal(blobs[0].type, 'application/json;charset=utf-8');
  assert.equal(blobs[1].type, 'text/plain;charset=utf-8');
  assert.deepEqual(JSON.parse(await blobs[0].text()).issues.map(issue => issue.code), ['MISSING_KEY', 'VARIABLE_MISMATCH', 'EXTRA_KEY']);
  assert.match(await blobs[1].text(), /EXTRA_KEY/);
  assert.equal(json.bytes, blobs[0].size);
  assert.equal(revoked.length, 0);
  controller.editSource('target', '{}');
  assert.deepEqual(revoked, [json.url, txt.url]);
  assert.equal(timers.size, 0);
  assert.equal(controller.prepareDownload('json'), null);
});
test('download unsupported retains selectable complete text and uses a fixed error', () => {
  const controller = ready(createController({ createUrl() { throw new Error('private detail'); } }));
  assert.equal(controller.prepareDownload('json'), null);
  assert.equal(controller.snapshot().exportError, 'DOWNLOAD_UNSUPPORTED');
  assert.match(controller.getReportText(), /VARIABLE_MISMATCH/);
});
test('pagehide disposal aborts reads, revokes all links, clears source/report references', async () => {
  const job = deferred();
  const controller = ready(createController({ readJob: () => job }));
  const load = controller.loadFile('target', { size: 2 });
  controller.dispose();
  job.resolve('{}');
  await load;
  assert.deepEqual(controller.snapshot().sources, { reference: '', target: '' });
  assert.equal(controller.snapshot().report, null);
  assert.equal(controller.snapshot().pending, null);
});
test('both locales cover every parser, file, export and comparison error', () => {
  const shape = object => Object.keys(object).sort().map(key => [key, object[key] && typeof object[key] === 'object' ? shape(object[key]) : typeof object[key]]);
  assert.deepEqual(shape(zh), shape(en));
  for (const locale of [zh, en]) {
    for (const code of [...ERROR_CODES, 'INVALID_SYNTAX', 'INVALID_ENCODING', 'FILE_READ_ERROR', 'FILE_UNSUPPORTED', 'UNEXPECTED_ERROR', 'DOWNLOAD_UNSUPPORTED']) assert.equal(typeof locale.errors[code], 'string');
    assert.equal(Object.keys(locale.codes).length, 7);
  }
});
test('file read job decodes strict UTF8, preserves BOM for rejection and really aborts', async () => {
  let instance;
  class FakeReader {
    constructor() { instance = this; }
    readAsArrayBuffer() {}
    abort() { this.aborted = true; }
  }
  let job = createFileReadJob({ size: 2 }, FakeReader);
  instance.result = Uint8Array.from([0xff]).buffer;
  instance.onload();
  await assert.rejects(job.promise, /INVALID_ENCODING/);
  job = createFileReadJob({ size: 5 }, FakeReader);
  instance.result = Uint8Array.from([0xef, 0xbb, 0xbf, 123, 125]).buffer;
  instance.onload();
  assert.equal(await job.promise, '\ufeff{}');
  job = createFileReadJob({ size: 2 }, FakeReader);
  job.cancel();
  await assert.rejects(job.promise, /READ_CANCELLED/);
  assert.equal(instance.aborted, true);
  assert.equal(instance.onload, null);
});

test('download links are bounded, expire at 30 seconds and are disposed exactly once', () => {
  const timers = new Map(), revoked = [];
  let allocated = 0, timerId = 0;
  const controller = ready(createController({
    createUrl: () => `blob:fake-${++allocated}`, revokeUrl: url => revoked.push(url),
    setTimer: (callback, delay) => { assert.equal(delay, 30000); timers.set(++timerId, callback); return timerId; },
    clearTimer: id => timers.delete(id),
  }));
  const first = controller.prepareDownload('json');
  const second = controller.prepareDownload('json');
  assert.deepEqual(revoked, [first.url]);
  assert.equal(timers.size, 1);
  [...timers.values()][0]();
  assert.deepEqual(revoked, [first.url, second.url]);
  const third = controller.prepareDownload('txt');
  controller.dispose();
  assert.deepEqual(revoked, [first.url, second.url, third.url]);
});
test('download preparation failure releases a URL and keeps report selectable', () => {
  const revoked = [];
  const controller = ready(createController({ createUrl: () => 'blob:fake', revokeUrl: url => revoked.push(url), setTimer: () => { throw new Error('scheduling failed'); } }));
  assert.equal(controller.prepareDownload('json'), null);
  assert.deepEqual(revoked, ['blob:fake']);
  assert.equal(controller.snapshot().exportError, 'DOWNLOAD_UNSUPPORTED');
  assert.ok(controller.getReportText().length);
});
test('late read errors after edits cannot replace current field errors or source', async () => {
  const job = deferred();
  const controller = createController({ readJob: () => job });
  const load = controller.loadFile('reference', { size: 2 });
  controller.editSource('reference', '{"now":"current"}');
  job.reject(new Error('late private error'));
  await load;
  assert.equal(controller.snapshot().sources.reference, '{"now":"current"}');
  assert.deepEqual(controller.snapshot().errors, []);
  assert.equal(controller.snapshot().state, 'editing');
});
test('synchronous file reader failure cleans its handlers and reports only a fixed code', async () => {
  let instance;
  class ThrowReader {
    constructor() { instance = this; }
    readAsArrayBuffer() { throw new Error('private read detail'); }
  }
  const job = createFileReadJob({ size: 2 }, ThrowReader);
  await assert.rejects(job.promise, /FILE_READ_ERROR/);
  assert.equal(instance.onload, null);
  assert.equal(instance.onerror, null);
  assert.equal(instance.onabort, null);
});
