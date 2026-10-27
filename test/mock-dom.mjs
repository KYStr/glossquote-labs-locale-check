// Deliberately small offline wiring harness. It has no layout, parser security,
// browser permissions, networking, native dialogs, or real accessibility tree.
export function mockDocument(html) {
  const elements = new Map();
  let document;
  class Element {
    constructor(tag = 'div', attributes = '') {
      this.tagName = tag.toUpperCase();
      this.attributes = new Map();
      this.children = [];
      this.listeners = new Map();
      this.hidden = /\bhidden(?:\s|$)/.test(attributes);
      this.disabled = /\bdisabled(?:\s|$)/.test(attributes);
      this.value = '';
      this.files = [];
      for (const match of attributes.matchAll(/([\w-]+)="([^"]*)"/g)) this.attributes.set(match[1], match[2]);
    }
    set textContent(text) { this.text = String(text); this.children = []; }
    get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
    append(...nodes) {
      for (const child of nodes) {
        if (child.tagName === '#FRAGMENT') this.append(...child.children);
        else { child.parent = this; this.children.push(child); }
      }
    }
    replaceChildren(...nodes) { this.children = []; this.text = ''; this.append(...nodes); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    addEventListener(name, handler) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(handler); }
    dispatch(name, properties = {}) {
      const event = { preventDefault() { this.prevented = true; }, ...properties };
      for (const handler of this.listeners.get(name) || []) handler(event);
      return event;
    }
    focus() { document.activeElement = this; }
    select() { this.selected = true; }
    click() {
      if (this.tagName === 'A' && this.download) document.downloads.push({ href: this.href, filename: this.download });
      else if (!this.disabled) this.dispatch('click');
    }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  }
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) elements.set(match[3], new Element(match[1], match[2]));
  document = {
    documentElement: { lang: /<html lang="([^"]+)"/.exec(html)[1] },
    activeElement: null, downloads: [], body: new Element('body'),
    getElementById: id => { if (!elements.has(id)) throw new Error(`MISSING_TEST_ELEMENT:${id}`); return elements.get(id); },
    createElement: tag => new Element(tag), createDocumentFragment: () => new Element('#fragment'),
  };
  const events = new Map();
  const window = { addEventListener: (name, handler) => events.set(name, handler), dispatch: name => events.get(name)?.() };
  return { document, window, get: id => document.getElementById(id) };
}
