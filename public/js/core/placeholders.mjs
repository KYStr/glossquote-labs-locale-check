export function analyzePlaceholders(text, syntax) {
  if (!['single', 'double'].includes(syntax)) {
    const error = new Error('INVALID_SYNTAX');
    error.code = 'INVALID_SYNTAX';
    throw error;
  }
  const variables = new Map();
  let unsupported = false;
  const expression = syntax === 'single' ? /^\{([A-Za-z_][A-Za-z0-9_]*)\}$/ : /^\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}$/;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '}') { unsupported = true; continue; }
    if (text[index] !== '{') continue;
    let end = index + 1;
    let depth = 1;
    for (; end < text.length && depth > 0; end++) {
      if (text[end] === '{') depth++;
      if (text[end] === '}') depth--;
    }
    const match = depth === 0 ? expression.exec(text.slice(index, end)) : null;
    if (match) variables.set(match[1], (variables.get(match[1]) || 0) + 1);
    else unsupported = true;
    index = end - 1;
  }
  return { variables, unsupported };
}
export function extractVariables(text, syntax) {
  return analyzePlaceholders(text, syntax).variables;
}
