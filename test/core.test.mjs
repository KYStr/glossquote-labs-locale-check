import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocale, LIMITS } from '../public/js/core/parse-locale.mjs';
import { extractVariables, analyzePlaceholders } from '../public/js/core/placeholders.mjs';
import { compareLocales } from '../public/js/core/compare.mjs';
import { createSession, checkSession, invalidate, filterIssues, serializeReport } from '../public/js/core/session.mjs';

const compare = (a, b, syntax = 'single') => compareLocales(parseLocale(a), parseLocale(b), { syntax });
const reject = (text, code) => assert.throws(() => parseLocale(text), error => error.code === code && error.message === code);
test('A01 identical strings have no confirmed errors, just a review warning', () => {
  const result = compare('{"x":"Hi {name}"}', '{"x":"Hi {name}"}');
  assert.equal(result.counts.errors, 0);
  assert.equal(result.counts.missing, 0);
  assert.equal(result.counts.extra, 0);
  assert.equal(result.counts.review, 1);
  assert.equal(result.issues[0].code, 'SAME_AS_REFERENCE');
});
test('A02 exact variable mismatch and product example', () => {
  const result = compare('{"a":{"x":"Hi {name}"},"b":"B"}', '{"a":{"x":"嗨 {user}"},"c":"C"}');
  assert.deepEqual(result.issues.map(issue => [issue.kind, issue.path]), [['variables', ['a', 'x']], ['missing', ['b']], ['extra', ['c']]]);
  assert.deepEqual(result.issues[0].missingVariables, [{ name: 'name', count: 1 }]);
  assert.deepEqual(result.issues[0].extraVariables, [{ name: 'user', count: 1 }]);
});
test('A03 variable multiplicity and case matter, literal order does not', () => {
  const result = compare('{"x":"{x} {x}"}', '{"x":"{x}"}');
  assert.deepEqual(result.issues[0].missingVariables, [{ name: 'x', count: 1 }]);
  assert.deepEqual(result.issues[0].extraVariables, []);
  assert.equal(compare('{"x":"{a} {b}"}', '{"x":"{b} {a}"}').counts.errors, 0);
  assert.equal(compare('{"x":"{X}"}', '{"x":"{x}"}').counts.variables, 1);
});
test('A04 empty translation is a warning, not a missing key', () => {
  const result = compare('{"x":"Hi"}', '{"x":""}');
  assert.deepEqual(result.issues.map(issue => issue.code), ['EMPTY_TRANSLATION']);
  assert.equal(result.counts.missing, 0);
  assert.equal(result.counts.errors, 0);
});
test('A05 duplicate keys are rejected after decoding at every object level', () => {
  reject('{"a":"1","\\u0061":"2"}', 'DUPLICATE_KEY');
  reject('{"nested":{"\\u0078":"a","x":"b"}}', 'DUPLICATE_KEY');
  assert.equal(parseLocale('{"x":"a","nested":{"x":"b"}}').leaves.length, 2);
});
test('A06 literal dots and JSON pointer-looking keys never collide with nested paths', () => {
  const source = '{"a.b":"X","a":{"b":"Y"},"/a~b":"Z","":"empty key"}';
  assert.deepEqual(parseLocale(source).leaves.map(item => item.path), [['a.b'], ['a', 'b'], ['/a~b'], ['']]);
  assert.deepEqual(compare(source, '{"a":{"b":"譯"}}').issues.map(issue => issue.path), [['a.b'], ['/a~b'], ['']]);
});
test('A07 type conflicts suppress the entire descendant subtree in both directions', () => {
  for (const [a, b, types] of [['{"a":"x"}', '{"a":{"b":"y"}}', ['string', 'object']], ['{"a":{"b":"x","c":"z"}}', '{"a":"y"}', ['object', 'string']], ['{"a":{}}', '{"a":"y"}', ['object', 'string']], ['{"a":"x"}', '{"a":{}}', ['string', 'object']]]) {
    const result = compare(a, b);
    assert.equal(result.issues.length, 1);
    assert.deepEqual([result.issues[0].kind, result.issues[0].path, result.issues[0].referenceType, result.issues[0].targetType], ['type-conflict', ['a'], ...types]);
  }
  assert.equal(compare('{"a":{}}', '{}').counts.errors, 0);
});
test('A08 unsafe keys never alter object prototypes', () => {
  const before = Object.getOwnPropertyDescriptors(Object.prototype);
  for (const key of ['__proto__', 'constructor', 'prototype', '\\u005f_proto__']) reject(`{"${key}":"x"}`, 'UNSAFE_KEY');
  assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), before);
});
test('A09 root object depth is one: 32 accepts, 33 rejects', () => {
  const nested = depth => '{"x":'.repeat(depth - 1) + '{"leaf":"x"}' + '}'.repeat(depth - 1);
  assert.equal(parseLocale(nested(32)).leaves.length, 1);
  reject(nested(33), 'DEPTH_LIMIT');
});
test('A10 reject escaped or literal unpaired surrogates, accept pairs', () => {
  for (const text of ['{"x":"\\ud800"}', '{"x":"\\udc00"}', '{"\\ud800":"x"}', '{"x":"\ud800"}']) reject(text, 'INVALID_UNICODE');
  assert.equal(parseLocale('{"x":"\\ud83d\\ude00"}').leaves[0].value, '😀');
});
test('A11 selected brace syntax only; nested/different/ICU/unmatched syntax flagged', () => {
  assert.deepEqual([...extractVariables('{{name}}', 'single')], []);
  assert.deepEqual(analyzePlaceholders('{{name}}', 'single'), { variables: new Map(), unsupported: true });
  assert.deepEqual([...extractVariables('{{name}}', 'double')], [['name', 1]]);
  for (const input of ['{n, plural, one {x} other {y}}', '{ bad }', '{1}', '{x', 'x}', '{{{name}}}', '{}']) assert.equal(analyzePlaceholders(input, 'single').unsupported, true);
  assert.deepEqual([...extractVariables('Hello {_name2} {X} {_name2}', 'single')], [['_name2', 2], ['X', 1]]);
  assert.equal(analyzePlaceholders('%s', 'single').variables.size, 0);
  assert.throws(() => extractVariables('', 'icu'), /INVALID_SYNTAX/);
});
test('A12 visible filter never narrows full JSON/TXT report', () => {
  const result = compare('{"missing":"Hi","x":"{n}"}', '{"extra":"hey","x":"{v}"}');
  const report = { schemaVersion: 1, syntax: 'single', ...result };
  assert.equal(filterIssues(report, 'missing').length, 1);
  assert.equal(filterIssues(report, 'needs-fix').length, 3);
  assert.deepEqual(JSON.parse(serializeReport(report, 'json')).issues.map(issue => issue.code), ['MISSING_KEY', 'VARIABLE_MISMATCH', 'EXTRA_KEY']);
  assert.match(serializeReport(report, 'txt'), /EXTRA_KEY/);
  assert.match(serializeReport(report, 'txt'), /VARIABLE_MISMATCH/);
});
test('only objects and string leaves accepted, malformed JSON never partially succeeds', () => {
  for (const value of ['[]', 'null', '123', 'true', 'false']) { reject(`{"x":${value}}`, 'TYPE'); reject(value, 'TYPE'); }
  for (const text of ['{"x":"ok",}', '{"x":"a" "y":"b"}', '{"x":"\\x20"}', '{"x":"raw\nline"}', '{} trailing', '{', '{"x":}', '\ufeff{}']) reject(text, 'INVALID_JSON');
  reject('', 'EMPTY_INPUT');
  reject(' \n ', 'EMPTY_INPUT');
  reject(null, 'INPUT_TYPE');
  assert.deepEqual(parseLocale('{}').leaves, []);
  assert.equal(parseLocale('{"2":"two","1":"one"}').leaves[0].path[0], '2');
});
test('decoded key, string, leaf, property and UTF8 byte caps include exact boundaries', () => {
  assert.equal(parseLocale(JSON.stringify({ ['a'.repeat(200)]: 'x' })).leaves.length, 1);
  reject(JSON.stringify({ ['a'.repeat(201)]: 'x' }), 'KEY_LIMIT');
  assert.equal(parseLocale(JSON.stringify({ x: 'a'.repeat(16384) })).leaves[0].value.length, 16384);
  reject(JSON.stringify({ x: 'a'.repeat(16385) }), 'STRING_LIMIT');
  const leaves = count => '{' + Array.from({ length: count }, (_, i) => `"k${i}":"x"`).join(',') + '}';
  assert.equal(parseLocale(leaves(5000)).leaves.length, 5000);
  reject(leaves(5001), 'LEAF_LIMIT');
  const objects = count => '{' + Array.from({ length: count }, (_, i) => `"k${i}":{}`).join(',') + '}';
  assert.equal(parseLocale(objects(10000)).entries.length, 10001);
  reject(objects(10001), 'PROPERTY_LIMIT');
  assert.equal(parseLocale('{}' + ' '.repeat(LIMITS.bytes - 2)).leaves.length, 0);
  reject('{}' + ' '.repeat(LIMITS.bytes - 1), 'SIZE_LIMIT');
  const multibyte = '{' + Array.from({ length: 70 }, (_, i) => `"k${i}":"${'中'.repeat(5000)}"`).join(',') + '}';
  reject(multibyte, 'SIZE_LIMIT');
});
test('session clears successful output before edits or parse failure, preserves source', () => {
  const session = createSession();
  session.sources = { reference: '{"x":"a"}', target: '{"x":"b"}' };
  checkSession(session);
  assert.equal(session.state, 'ready');
  const previousRevision = session.revision;
  session.sources.target = '{"x":false}';
  invalidate(session);
  assert.equal(session.report, null);
  assert.ok(session.revision > previousRevision);
  checkSession(session);
  assert.equal(session.report, null);
  assert.equal(session.state, 'error');
  assert.equal(session.errors[0].code, 'TYPE');
  assert.equal(session.sources.target, '{"x":false}');
});
test('reports quote hostile text and controls without evaluating or mutating input', () => {
  const a = parseLocale('{"</script><img src=x>":"first\\nsecond {x}"}');
  const b = parseLocale('{}');
  const before = JSON.stringify([a, b]);
  const report = { schemaVersion: 1, syntax: 'single', ...compareLocales(a, b, { syntax: 'single' }) };
  assert.match(serializeReport(report, 'txt'), /first\\nsecond/);
  assert.equal(JSON.stringify([a, b]), before);
  assert.equal(serializeReport(report, 'json').endsWith('\n'), true);
  assert.equal(serializeReport(report, 'json').charCodeAt(0), 123);
});

test('suppressed conflict descendants still flag unknown brace syntax and empty text', () => {
  const result = compare('{"a":"Hello"}', '{"a":{"x":"{{name}}","y":""}}');
  assert.deepEqual(result.issues.map(issue => [issue.code, issue.path]), [
    ['TYPE_CONFLICT', ['a']], ['UNSUPPORTED_PLACEHOLDER_SYNTAX', ['a', 'x']], ['EMPTY_TRANSLATION', ['a', 'y']],
  ]);
  assert.equal(result.counts.extra, 0);
  assert.equal(result.counts.errors, 1);
  assert.equal(compare('{"a":{"x":"{{name}}"}}', '{"a":"Hello"}').counts.review, 1);
});
