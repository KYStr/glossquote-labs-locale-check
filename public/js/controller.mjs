import { createSession, invalidate, checkSession, filterIssues, serializeReport } from './core/session.mjs';
import { LIMITS } from './core/parse-locale.mjs';

export const PAGE_SIZE = 50;
export const EXPORTS = Object.freeze({
  json: { filename: 'locale-check-report.json', mime: 'application/json;charset=utf-8' },
  txt: { filename: 'locale-check-report.txt', mime: 'text/plain;charset=utf-8' },
});
export function createFileReadJob(file, Reader = globalThis.FileReader) {
  if (typeof Reader !== 'function') throw new Error('FILE_UNSUPPORTED');
  const reader = new Reader();
  let settled = false;
  let rejectJob;
  const release = () => { reader.onload = null; reader.onerror = null; reader.onabort = null; };
  const promise = new Promise((resolve, reject) => {
    rejectJob = reject;
    reader.onload = () => {
      if (settled) return;
      settled = true;
      try {
        if (!(reader.result instanceof ArrayBuffer) || reader.result.byteLength > LIMITS.bytes) throw new Error('SIZE_LIMIT');
        // Preserve BOM so the JSON parser can reject it rather than silently discard it.
        const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(reader.result);
        release();
        resolve(text);
      } catch (error) { release(); reject(new Error(error.message === 'SIZE_LIMIT' ? 'SIZE_LIMIT' : 'INVALID_ENCODING')); }
    };
    reader.onerror = () => { if (!settled) { settled = true; release(); reject(new Error('FILE_READ_ERROR')); } };
    reader.onabort = () => { if (!settled) { settled = true; release(); reject(new Error('READ_CANCELLED')); } };
    try { reader.readAsArrayBuffer(file); }
    catch { settled = true; release(); reject(new Error('FILE_READ_ERROR')); }
  });
  return {
    promise,
    cancel() {
      if (settled) return;
      settled = true;
      release();
      try { reader.abort(); } catch { /* The generation check also rejects late completion. */ }
      rejectJob(new Error('READ_CANCELLED'));
    },
  };
}

export function createController({ onChange = () => {}, readJob = createFileReadJob,
  createUrl = blob => globalThis.URL.createObjectURL(blob), revokeUrl = url => globalThis.URL.revokeObjectURL(url),
  makeBlob = (text, mime) => new Blob([text], { type: mime }),
  setTimer = (callback, delay) => setTimeout(callback, delay), clearTimer = timer => clearTimeout(timer),
} = {}) {
  const session = createSession();
  let filter = 'all';
  let page = 0;
  let reader = null;
  let readingSide = null;
  let pending = null;
  let exportError = null;
  const urls = new Map();
  const emit = () => onChange(snapshot());
  function revokeDownloads() {
    for (const [url, resource] of urls) { clearTimer(resource.timer); revokeUrl(url); }
    urls.clear();
  }
  function reset() {
    invalidate(session);
    const previous = reader;
    reader = null;
    readingSide = null;
    pending = null;
    exportError = null;
    page = 0;
    revokeDownloads();
    if (previous) previous.cancel();
  }
  function snapshot() {
    const visible = filterIssues(session.report, filter);
    return { ...session, filter, page, readingSide, pending: pending ? { side: pending.side, characters: pending.text.length } : null, exportError,
      visibleCount: visible.length, pageCount: Math.max(1, Math.ceil(visible.length / PAGE_SIZE)), rows: visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) };
  }
  function editSource(side, text) {
    if (!['reference', 'target'].includes(side) || typeof text !== 'string') return;
    reset();
    session.sources[side] = text;
    session.state = text || session.sources[side === 'reference' ? 'target' : 'reference'] ? 'editing' : 'idle';
    emit();
  }
  function setSyntax(syntax) {
    reset();
    session.syntax = syntax;
    emit();
  }
  function check() {
    reset();
    checkSession(session);
    emit();
  }
  function clear() {
    reset();
    session.sources = { reference: '', target: '' };
    session.syntax = 'single';
    filter = 'all';
    session.state = 'idle';
    emit();
  }
  function loadExample() {
    reset();
    session.syntax = 'single';
    session.sources = {
      reference: '{\n  "welcome": "Hello {name}",\n  "menu": { "save": "Save", "cancel": "Cancel" },\n  "brand": "Demo Brand",\n  "count": "{n} + {n}",\n  "profile": "Profile"\n}',
      target: '{\n  "welcome": "你好 {user}",\n  "menu": { "save": "" },\n  "brand": "Demo Brand",\n  "count": "{n}",\n  "profile": { "name": "姓名" },\n  "old": "舊文字"\n}',
    };
    session.state = 'editing';
    emit();
  }
  function setFilter(value) {
    if (!['all', 'needs-fix', 'missing', 'extra', 'type-conflict', 'variables', 'review'].includes(value)) return;
    filter = value;
    page = 0;
    emit();
  }
  function setPage(value) {
    page = Math.max(0, Math.min(snapshot().pageCount - 1, value));
    emit();
  }
  async function loadFile(side, file) {
    if (!['reference', 'target'].includes(side)) return;
    reset();
    const generation = session.revision;
    readingSide = side;
    session.state = 'running';
    emit();
    try {
      if (!file || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > LIMITS.bytes) throw new Error('SIZE_LIMIT');
      reader = readJob(file);
      const text = await reader.promise;
      if (generation !== session.revision) return;
      reader = null;
      readingSide = null;
      if (typeof text !== 'string' || text.length > LIMITS.bytes || new TextEncoder().encode(text).byteLength > LIMITS.bytes) throw new Error('SIZE_LIMIT');
      session.state = 'editing';
      if (session.sources[side]) pending = { side, text };
      else session.sources[side] = text;
      emit();
    } catch (error) {
      if (generation !== session.revision) return;
      reader = null;
      readingSide = null;
      session.state = 'error';
      const code = ['SIZE_LIMIT', 'FILE_UNSUPPORTED', 'INVALID_ENCODING'].includes(error.message) ? error.message : 'FILE_READ_ERROR';
      session.errors = [{ side, code, path: [], offset: 0 }];
      emit();
    }
  }
  function acceptImport() {
    if (!pending) return;
    const replacement = pending;
    reset();
    session.sources[replacement.side] = replacement.text;
    session.state = 'editing';
    emit();
  }
  function cancelImport() { reset(); emit(); }
  function prepareDownload(format) {
    if (!session.report || session.state !== 'ready' || !Object.hasOwn(EXPORTS, format)) return null;
    exportError = null;
    let allocatedUrl = null;
    try {
      const definition = EXPORTS[format];
      const text = serializeReport(session.report, format);
      const url = createUrl(makeBlob(text, definition.mime));
      allocatedUrl = url;
      // Retain at most one prepared link per format; a later explicit download replaces it.
      for (const [oldUrl, resource] of urls) {
        if (resource.format === format) { clearTimer(resource.timer); revokeUrl(oldUrl); urls.delete(oldUrl); }
      }
      const timer = setTimer(() => { if (urls.has(url)) { revokeUrl(url); urls.delete(url); } }, 30000);
      urls.set(url, { timer, format });
      return { url, filename: definition.filename, mime: definition.mime, bytes: new TextEncoder().encode(text).byteLength };
    } catch {
      if (allocatedUrl && !urls.has(allocatedUrl)) revokeUrl(allocatedUrl);
      exportError = 'DOWNLOAD_UNSUPPORTED'; emit(); return null;
    }
  }
  function getReportText(format = 'json') { return session.report ? serializeReport(session.report, format) : ''; }
  function dispose() {
    reset();
    session.sources = { reference: '', target: '' };
    session.state = 'idle';
    emit();
  }
  return { snapshot, editSource, setSyntax, check, clear, loadExample, setFilter, setPage, loadFile, acceptImport, cancelImport, prepareDownload, getReportText, dispose };
}
