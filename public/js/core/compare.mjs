import { analyzePlaceholders } from './placeholders.mjs';

const identity = path => JSON.stringify(path);
function underConflict(path, conflicts) {
  for (let depth = 1; depth < path.length; depth++) if (conflicts.has(identity(path.slice(0, depth)))) return true;
  return false;
}
function difference(left, right) {
  const result = [];
  for (const [name, count] of left) {
    const remaining = count - (right.get(name) || 0);
    if (remaining > 0) result.push({ name, count: remaining });
  }
  return result;
}
export function compareLocales(reference, target, { syntax = 'single' } = {}) {
  analyzePlaceholders('', syntax);
  const referenceIndex = new Map(reference.entries.map(entry => [identity(entry.path), entry]));
  const targetIndex = new Map(target.entries.map(entry => [identity(entry.path), entry]));
  const issues = [];
  const conflicts = new Set();
  const add = (kind, code, entry, details = {}) => issues.push({ kind, severity: kind === 'review' ? 'warning' : 'error', code, path: [...entry.path], ...details });
  const review = (entry, side) => {
    const analyzed = analyzePlaceholders(entry.value, syntax);
    if (side === 'target' && entry.value.trim() === '') add('review', 'EMPTY_TRANSLATION', entry, { targetValue: entry.value });
    if (analyzed.unsupported) add('review', 'UNSUPPORTED_PLACEHOLDER_SYNTAX', entry, { side, [side === 'reference' ? 'referenceValue' : 'targetValue']: entry.value });
    return analyzed.variables;
  };
  for (const entry of reference.entries) {
    if (!entry.path.length) continue;
    if (underConflict(entry.path, conflicts)) {
      if (entry.type === 'string') review(entry, 'reference');
      continue;
    }
    const key = identity(entry.path);
    const translation = targetIndex.get(key);
    if (translation && entry.type !== translation.type) {
      conflicts.add(key);
      add('type-conflict', 'TYPE_CONFLICT', entry, { referenceType: entry.type, targetType: translation.type, ...(entry.type === 'string' ? { referenceValue: entry.value } : { targetValue: translation.value }) });
      if (entry.type === 'string') review(entry, 'reference');
      else review(translation, 'target');
      continue;
    }
    if (entry.type !== 'string') continue;
    if (!translation) {
      add('missing', 'MISSING_KEY', entry, { referenceValue: entry.value });
      review(entry, 'reference');
      continue;
    }
    const expected = analyzePlaceholders(entry.value, syntax);
    const actual = analyzePlaceholders(translation.value, syntax);
    const missingVariables = difference(expected.variables, actual.variables);
    const extraVariables = difference(actual.variables, expected.variables);
    if (missingVariables.length || extraVariables.length) add('variables', 'VARIABLE_MISMATCH', entry, { referenceValue: entry.value, targetValue: translation.value, missingVariables, extraVariables });
    if (translation.value.trim() === '') add('review', 'EMPTY_TRANSLATION', entry, { referenceValue: entry.value, targetValue: translation.value });
    if (entry.value === translation.value) add('review', 'SAME_AS_REFERENCE', entry, { referenceValue: entry.value, targetValue: translation.value });
    if (expected.unsupported) add('review', 'UNSUPPORTED_PLACEHOLDER_SYNTAX', entry, { side: 'reference', referenceValue: entry.value });
    if (actual.unsupported) add('review', 'UNSUPPORTED_PLACEHOLDER_SYNTAX', entry, { side: 'target', targetValue: translation.value });
  }
  for (const entry of target.leaves) {
    const key = identity(entry.path);
    if (underConflict(entry.path, conflicts)) { review(entry, 'target'); continue; }
    if (conflicts.has(key) || referenceIndex.has(key)) continue;
    add('extra', 'EXTRA_KEY', entry, { targetValue: entry.value });
    review(entry, 'target');
  }
  const counts = { referenceLeaves: reference.leaves.length, targetLeaves: target.leaves.length, missing: 0, extra: 0, typeConflicts: 0, variables: 0, review: 0, errors: 0, missingVariables: 0, extraVariables: 0, total: issues.length };
  for (const issue of issues) {
    counts[issue.kind === 'type-conflict' ? 'typeConflicts' : issue.kind]++;
    if (issue.severity === 'error') counts.errors++;
    if (issue.kind === 'variables') {
      counts.missingVariables += issue.missingVariables.reduce((sum, item) => sum + item.count, 0);
      counts.extraVariables += issue.extraVariables.reduce((sum, item) => sum + item.count, 0);
    }
  }
  return { issues, counts };
}
