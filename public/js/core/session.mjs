import { parseLocale, LocaleError } from './parse-locale.mjs';
import { compareLocales } from './compare.mjs';

export function createSession() {
  return { revision: 0, state: 'idle', sources: { reference: '', target: '' }, syntax: 'single', report: null, errors: [] };
}
export function invalidate(session) {
  session.revision++;
  session.report = null;
  session.errors = [];
  session.state = session.sources.reference || session.sources.target ? 'editing' : 'idle';
}
export function checkSession(session) {
  invalidate(session);
  const parsed = new Map();
  for (const side of ['reference', 'target']) {
    try { parsed.set(side, parseLocale(session.sources[side])); }
    catch (error) {
      session.errors.push(error instanceof LocaleError ? { side, code: error.code, path: error.path, offset: error.offset } : { side, code: 'UNEXPECTED_ERROR', path: [], offset: 0 });
    }
  }
  if (session.errors.length) { session.state = 'error'; return; }
  try {
    const { issues, counts } = compareLocales(parsed.get('reference'), parsed.get('target'), { syntax: session.syntax });
    session.report = { schemaVersion: 1, syntax: session.syntax, counts, issues };
    session.state = 'ready';
  } catch {
    session.errors = [{ side: 'settings', code: ['single', 'double'].includes(session.syntax) ? 'UNEXPECTED_ERROR' : 'INVALID_SYNTAX', path: [], offset: 0 }];
    session.state = 'error';
  }
}
export function filterIssues(report, filter = 'all') {
  if (!report) return [];
  if (filter === 'all') return report.issues;
  if (filter === 'needs-fix') return report.issues.filter(issue => issue.severity === 'error');
  return report.issues.filter(issue => issue.kind === filter);
}
export function serializeReport(report, format) {
  if (!report) throw new Error('NO_REPORT');
  if (format === 'json') return JSON.stringify(report, null, 2) + '\n';
  if (format !== 'txt') throw new Error('INVALID_EXPORT_FORMAT');
  const lines = ['GlossQuote translation file completeness report', 'Schema: 1', `Syntax: ${report.syntax}`, 'Scope: complete report; display filters do not apply.', 'Warnings require human review; this report does not assess linguistic quality.', ...Object.entries(report.counts).map(([key, value]) => `${key}: ${value}`), ''];
  // JSON quoting makes newlines/control characters and path segments unambiguous.
  for (const issue of report.issues) {
    lines.push(`${issue.severity.toUpperCase()} ${issue.code} ${JSON.stringify(issue.path)}`);
    for (const [key, value] of Object.entries(issue)) if (!['severity', 'code', 'path', 'kind'].includes(key)) lines.push(`  ${key}: ${JSON.stringify(value)}`);
  }
  return lines.join('\n') + '\n';
}
