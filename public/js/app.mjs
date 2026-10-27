import { createController, PAGE_SIZE } from './controller.mjs';
import zh from './locales/zh-Hant.mjs';
import en from './locales/en.mjs';

export function mountApp(document, window) {
  const t = document.documentElement.lang === 'en' ? en : zh;
  const byId = id => document.getElementById(id);
  const number = value => value.toLocaleString(t.language);
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  let previousReport = null;
  let confirmExample = false;
  const controller = createController({ onChange: render });
  function render(state) {
    for (const side of ['reference', 'target']) {
      if (byId(side).value !== state.sources[side]) byId(side).value = state.sources[side];
      const error = state.errors.find(item => item.side === side);
      byId(side).setAttribute('aria-invalid', error ? 'true' : 'false');
      byId(`${side}-error`).hidden = !error;
      byId(`${side}-error`).textContent = error ? `${t.errors[error.code] || t.errors.UNEXPECTED_ERROR} ${t.errorPath(JSON.stringify(error.path), error.offset)} [${error.code}]` : '';
    }
    const settingsError = state.errors.find(item => item.side === 'settings');
    byId('settings-error').hidden = !settingsError;
    byId('settings-error').textContent = settingsError ? t.errors[settingsError.code] : '';
    byId('syntax').value = state.syntax;
    byId('cancel-read').hidden = !state.readingSide;
    byId('check').disabled = !!state.readingSide || !!state.pending || confirmExample;
    byId('import-confirm').hidden = !state.pending;
    if (state.pending) byId('import-message').textContent = t.importConfirm(t.sides[state.pending.side], number(state.pending.characters));
    byId('status').textContent = state.pending ? t.status.pending : state.state === 'ready' ? t.ready(number(state.report.counts.errors), number(state.report.counts.review), number(state.report.counts.referenceLeaves), number(state.report.counts.targetLeaves)) : t.status[state.state];
    byId('status').className = state.state === 'error' ? 'status is-error' : state.state === 'ready' ? 'status is-ready' : 'status';
    byId('results').hidden = !state.report;
    for (const id of ['filter', 'download-json', 'download-txt', 'select-report']) byId(id).disabled = !state.report;
    if (state.report !== previousReport) {
      byId('report-text').value = controller.getReportText();
      byId('export-status').textContent = '';
      previousReport = state.report;
    }
    if (state.exportError) byId('export-status').textContent = t.errors[state.exportError];
    byId('issue-rows').replaceChildren();
    if (!state.report) {
      byId('report-text').value = '';
      return;
    }
    for (const [id, key] of [['missing', 'missing'], ['extra', 'extra'], ['types', 'typeConflicts'], ['variables', 'variables'], ['review', 'review']]) byId(`count-${id}`).textContent = number(state.report.counts[key]);
    byId('filter').value = state.filter;
    byId('visible-count').textContent = t.shown(number(state.visibleCount ? state.page * PAGE_SIZE + 1 : 0), number(Math.min((state.page + 1) * PAGE_SIZE, state.visibleCount)), number(state.visibleCount));
    byId('no-matches').hidden = state.visibleCount !== 0;
    byId('no-matches').textContent = state.report.counts.total === 0 ? t.noIssues : t.noMatching;
    byId('table-region').hidden = state.visibleCount === 0;
    byId('previous-page').disabled = state.page === 0;
    byId('next-page').disabled = state.page >= state.pageCount - 1;
    byId('page-label').textContent = t.page(number(state.page + 1), number(state.pageCount));
    const fragment = document.createDocumentFragment();
    for (const issue of state.rows) {
      const row = node('tr');
      const description = node('td');
      description.append(node('span', `${t.severity[issue.severity]} · ${t.kinds[issue.kind]}`, `issue-label ${issue.severity}`), node('p', t.codes[issue.code]));
      if (issue.side) description.append(node('p', t.sides[issue.side], 'muted small'));
      if (issue.kind === 'variables') {
        for (const [key, label] of [['missingVariables', t.missingVariables], ['extraVariables', t.extraVariables]]) {
          description.append(node('p', `${label}: ${issue[key].length ? issue[key].map(item => `${item.name} × ${number(item.count)}`).join(', ') : t.none}`, 'data'));
        }
      }
      const path = node('td');
      const segments = node('div', undefined, 'path-segments');
      segments.setAttribute('aria-label', JSON.stringify(issue.path));
      for (const segment of issue.path) segments.append(node('code', JSON.stringify(segment)));
      path.append(segments);
      row.append(description, path);
      for (const side of ['reference', 'target']) {
        const cell = node('td');
        const type = issue[`${side}Type`];
        if (type === 'object') cell.append(node('span', t.types.object, 'type-label'));
        else if (Object.hasOwn(issue, `${side}Value`)) cell.append(node('pre', JSON.stringify(issue[`${side}Value`]), 'source-value'));
        else cell.append(node('span', t.absent, 'muted small'));
        row.append(cell);
      }
      fragment.append(row);
    }
    byId('issue-rows').append(fragment);
  }
  function closeExample() { confirmExample = false; byId('example-confirm').hidden = true; }
  function edit(side) { closeExample(); controller.editSource(side, byId(side).value); }
  for (const side of ['reference', 'target']) {
    byId(side).addEventListener('input', () => edit(side));
    byId(`${side}-clear`).addEventListener('click', () => { closeExample(); controller.editSource(side, ''); byId(`${side}-file`).value = ''; });
    byId(`${side}-file`).addEventListener('change', () => {
      closeExample();
      const file = byId(`${side}-file`).files[0];
      byId(`${side}-file`).value = '';
      if (file) void controller.loadFile(side, file);
    });
  }
  byId('check-form').addEventListener('submit', event => {
    event.preventDefault();
    if (byId('check').disabled) return;
    controller.check();
    const error = controller.snapshot().errors[0];
    if (error) byId(error.side === 'settings' ? 'syntax' : error.side).focus();
  });
  byId('syntax').addEventListener('change', () => { closeExample(); controller.setSyntax(byId('syntax').value); });
  byId('clear-all').addEventListener('click', () => { closeExample(); controller.clear(); for (const side of ['reference', 'target']) byId(`${side}-file`).value = ''; });
  byId('load-example').addEventListener('click', () => {
    const state = controller.snapshot();
    if (state.sources.reference || state.sources.target) {
      confirmExample = true;
      controller.cancelImport();
      byId('example-confirm').hidden = false;
      byId('accept-example').focus();
    } else controller.loadExample();
  });
  byId('accept-example').addEventListener('click', () => { closeExample(); controller.loadExample(); byId('check').focus(); });
  byId('keep-example').addEventListener('click', () => { closeExample(); render(controller.snapshot()); byId('load-example').focus(); });
  byId('cancel-read').addEventListener('click', () => controller.cancelImport());
  byId('accept-import').addEventListener('click', () => { controller.acceptImport(); byId('check').focus(); });
  byId('keep-import').addEventListener('click', () => { controller.cancelImport(); byId('check').focus(); });
  byId('filter').addEventListener('change', () => controller.setFilter(byId('filter').value));
  byId('previous-page').addEventListener('click', () => controller.setPage(controller.snapshot().page - 1));
  byId('next-page').addEventListener('click', () => controller.setPage(controller.snapshot().page + 1));
  for (const format of ['json', 'txt']) byId(`download-${format}`).addEventListener('click', () => {
    const download = controller.prepareDownload(format);
    if (!download) return;
    const anchor = node('a');
    anchor.href = download.url;
    anchor.download = download.filename;
    anchor.hidden = true;
    document.body.append(anchor);
    try { anchor.click(); byId('export-status').textContent = t.downloaded(download.filename); }
    catch { byId('export-status').textContent = t.errors.DOWNLOAD_UNSUPPORTED; }
    finally { anchor.remove(); }
  });
  byId('select-report').addEventListener('click', () => { byId('report-text').focus(); byId('report-text').select(); });
  window.addEventListener('pagehide', () => { closeExample(); controller.dispose(); for (const side of ['reference', 'target']) byId(`${side}-file`).value = ''; });
  if (typeof TextEncoder !== 'function' || typeof TextDecoder !== 'function') {
    byId('boot-notice').textContent = t.unsupported;
    return controller;
  }
  for (const id of ['reference', 'target', 'reference-file', 'target-file', 'reference-clear', 'target-clear', 'syntax', 'check', 'clear-all', 'load-example']) byId(id).disabled = false;
  byId('boot-notice').hidden = true;
  render(controller.snapshot());
  return controller;
}
if (typeof document !== 'undefined' && typeof window !== 'undefined') mountApp(document, window);
