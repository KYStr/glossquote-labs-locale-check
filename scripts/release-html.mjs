// A tokenizer for this fixed, local static head. It is not a browser HTML parser.
// Attribute values, comments and raw-text content are consumed before looking for tags.
export function readHead(html) {
  const openings = [...html.matchAll(/<head(?:\s[^>]*)?>/gi)];
  const closings = [...html.matchAll(/<\/head\s*>/gi)];
  if (openings.length !== 1 || closings.length !== 1) throw new Error('HTML_HEAD_COUNT');
  const start = openings[0].index + openings[0][0].length;
  const end = closings[0].index;
  if (end < start) throw new Error('HTML_HEAD_ORDER');
  const content = html.slice(start, end);
  const tags = [];
  let index = 0;
  const whitespace = char => char !== undefined && /[\t\n\f\r ]/.test(char);
  const decode = value => value.replace(/&(?:amp|quot|apos|lt|gt);/g, entity => new Map([['&amp;', '&'], ['&quot;', '"'], ['&apos;', "'"], ['&lt;', '<'], ['&gt;', '>']]).get(entity));
  while (index < content.length) {
    if (content[index] !== '<') { index++; continue; }
    if (content.startsWith('<!--', index)) {
      const close = content.indexOf('-->', index + 4);
      if (close < 0) throw new Error('HTML_COMMENT_UNCLOSED');
      index = close + 3;
      continue;
    }
    const tokenStart = index++;
    if (content[index] === '/') { const close = content.indexOf('>', index); if (close < 0) throw new Error('HTML_TAG_UNCLOSED'); index = close + 1; continue; }
    const nameStart = index;
    while (index < content.length && /[A-Za-z0-9:-]/.test(content[index])) index++;
    if (index === nameStart) throw new Error('HTML_TAG_NAME');
    const name = content.slice(nameStart, index).toLowerCase();
    const attributes = new Map();
    while (index < content.length) {
      while (whitespace(content[index])) index++;
      if (content[index] === '>' || content.startsWith('/>', index)) break;
      const attributeStart = index;
      while (index < content.length && !whitespace(content[index]) && !['=', '/', '>'].includes(content[index])) index++;
      if (index === attributeStart) throw new Error('HTML_ATTRIBUTE_NAME');
      const attribute = content.slice(attributeStart, index).toLowerCase();
      if (attributes.has(attribute)) throw new Error('HTML_DUPLICATE_ATTRIBUTE');
      while (whitespace(content[index])) index++;
      let value = '';
      if (content[index] === '=') {
        index++;
        while (whitespace(content[index])) index++;
        const quote = content[index];
        if (quote === '"' || quote === "'") {
          const valueStart = ++index;
          while (index < content.length && content[index] !== quote) index++;
          if (index === content.length) throw new Error('HTML_ATTRIBUTE_UNCLOSED');
          value = content.slice(valueStart, index++);
        } else {
          const valueStart = index;
          while (index < content.length && !whitespace(content[index]) && content[index] !== '>') index++;
          value = content.slice(valueStart, index);
        }
      }
      attributes.set(attribute, decode(value));
    }
    if (index >= content.length) throw new Error('HTML_TAG_UNCLOSED');
    if (content[index] === '/') index++;
    index++;
    const token = { name, attributes, start: tokenStart, end: index, raw: content.slice(tokenStart, index) };
    tags.push(token);
    if (['script', 'style', 'title'].includes(name)) {
      const expression = new RegExp(`</${name}\\s*>`, 'gi');
      expression.lastIndex = index;
      const close = expression.exec(content);
      if (!close) throw new Error('HTML_RAW_TEXT_UNCLOSED');
      token.text = content.slice(index, close.index);
      index = expression.lastIndex;
    }
  }
  return { start, end, content, tags };
}

export function seoTags(html) {
  const head = readHead(html);
  const links = head.tags.filter(tag => tag.name === 'link');
  const hasRel = (tag, name) => (tag.attributes.get('rel') || '').toLowerCase().split(/\s+/).includes(name);
  return {
    head,
    robots: head.tags.filter(tag => tag.name === 'meta' && (tag.attributes.get('name') || '').toLowerCase() === 'robots'),
    canonical: links.filter(tag => hasRel(tag, 'canonical')),
    alternates: links.filter(tag => hasRel(tag, 'alternate') && tag.attributes.has('hreflang')),
  };
}

// Exact reviewed nodes only. Public preview sources remain byte-pinned; the
// release removes the intro notice and keeps the footer's family attribution.
const NOTICES = Object.freeze({
  'zh-Hant': Object.freeze({
    intro: '<div class="intro"><p class="preview">本地候選預覽</p>',
    footer: '<footer>Gloss Tools by GlossQuote · 預覽版本，尚待瀏覽器驗收</footer>',
  }),
  en: Object.freeze({
    intro: '<div class="intro"><p class="preview">Local candidate preview</p>',
    footer: '<footer>Gloss Tools by GlossQuote · Preview awaiting browser acceptance</footer>',
  }),
});
export function removeCandidateNotices(html, language) {
  if (!Object.hasOwn(NOTICES, language)) throw new Error('RELEASE_NOTICE_LANGUAGE');
  const notices = NOTICES[language];
  const head = readHead(html);
  const prefix = html.slice(0, head.end);
  let body = html.slice(head.end);
  for (const [node, replacement] of [[notices.intro, '<div class="intro">'], [notices.footer, '<footer>Gloss Tools by GlossQuote</footer>']]) {
    if (body.split(node).length !== 2 || prefix.includes(node)) throw new Error('RELEASE_CANDIDATE_NOTICE_MISMATCH');
    body = body.replace(node, replacement);
  }
  return prefix + body;
}
