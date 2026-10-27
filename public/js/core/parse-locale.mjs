export const LIMITS = Object.freeze({ bytes: 1048576, depth: 32, key: 200, string: 16384, leaves: 5000, properties: 10000 });
export const ERROR_CODES = Object.freeze(['INPUT_TYPE', 'EMPTY_INPUT', 'SIZE_LIMIT', 'INVALID_JSON', 'TYPE', 'DUPLICATE_KEY', 'UNSAFE_KEY', 'DEPTH_LIMIT', 'KEY_LIMIT', 'STRING_LIMIT', 'LEAF_LIMIT', 'PROPERTY_LIMIT', 'INVALID_UNICODE']);

export class LocaleError extends Error {
  constructor(code, path = [], offset = 0) {
    super(code);
    this.name = 'LocaleError';
    this.code = code;
    this.path = [...path];
    this.offset = offset;
  }
}
function validUnicode(value) {
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}
const ESCAPES = new Map([['"', '"'], ['\\', '\\'], ['/', '/'], ['b', '\b'], ['f', '\f'], ['n', '\n'], ['r', '\r'], ['t', '\t']]);

// Bounded JSON grammar. Decoded user keys never become object properties.
export function parseLocale(text) {
  if (typeof text !== 'string') throw new LocaleError('INPUT_TYPE');
  if (text.length > LIMITS.bytes || new TextEncoder().encode(text).byteLength > LIMITS.bytes) throw new LocaleError('SIZE_LIMIT');
  if (!text.trim()) throw new LocaleError('EMPTY_INPUT');
  let cursor = 0;
  let properties = 0;
  const leaves = [];
  const entries = [];
  const fail = (code, path) => { throw new LocaleError(code, path, cursor); };
  const space = () => { while (cursor < text.length && /[\x20\t\n\r]/.test(text[cursor])) cursor++; };
  function string(path, isKey = false) {
    if (text[cursor++] !== '"') fail('INVALID_JSON', path);
    let value = '';
    while (cursor < text.length) {
      let char = text[cursor++];
      if (char === '"') {
        if (!validUnicode(value)) fail('INVALID_UNICODE', path);
        return value;
      }
      if (char === '\\') {
        char = text[cursor++];
        if (char === 'u') {
          const hex = text.slice(cursor, cursor + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('INVALID_JSON', path);
          value += String.fromCharCode(Number.parseInt(hex, 16));
          cursor += 4;
        } else if (ESCAPES.has(char)) value += ESCAPES.get(char);
        else fail('INVALID_JSON', path);
      } else {
        if (char.charCodeAt(0) < 32) fail('INVALID_JSON', path);
        value += char;
      }
      if (value.length > (isKey ? LIMITS.key : LIMITS.string)) fail(isKey ? 'KEY_LIMIT' : 'STRING_LIMIT', path);
    }
    fail('INVALID_JSON', path);
  }
  function value(path, depth) {
    space();
    if (text[cursor] === '{') return object(path, depth);
    if (text[cursor] === '"') {
      const decoded = string(path);
      if (leaves.length >= LIMITS.leaves) fail('LEAF_LIMIT', path);
      entries.push({ path: [...path], type: 'string', value: decoded });
      leaves.push({ path: [...path], value: decoded });
      return;
    }
    if (/[\[\]ntf\-0-9]/.test(text[cursor] || '\u0000')) fail('TYPE', path);
    fail('INVALID_JSON', path);
  }
  function object(path, depth) {
    if (depth > LIMITS.depth) fail('DEPTH_LIMIT', path);
    entries.push({ path: [...path], type: 'object' });
    cursor++;
    space();
    if (text[cursor] === '}') { cursor++; return; }
    const keys = new Set();
    while (cursor < text.length) {
      space();
      if (text[cursor] !== '"') fail('INVALID_JSON', path);
      const key = string(path, true);
      const child = [...path, key];
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('UNSAFE_KEY', child);
      if (keys.has(key)) fail('DUPLICATE_KEY', child);
      keys.add(key);
      if (++properties > LIMITS.properties) fail('PROPERTY_LIMIT', child);
      space();
      if (text[cursor++] !== ':') fail('INVALID_JSON', child);
      value(child, depth + 1);
      space();
      const delimiter = text[cursor++];
      if (delimiter === '}') return;
      if (delimiter !== ',') fail('INVALID_JSON', path);
    }
    fail('INVALID_JSON', path);
  }
  space();
  if (text[cursor] !== '{') fail(/["\[ntf\-0-9]/.test(text[cursor] || '\u0000') ? 'TYPE' : 'INVALID_JSON', []);
  object([], 1);
  space();
  if (cursor !== text.length) fail('INVALID_JSON', []);
  return { leaves, entries, warnings: [] };
}
