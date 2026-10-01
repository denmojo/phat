// The forms host page: renders a text-only Winlink template (one with no
// HTML form) as its header and message with inline fields for each <Var>,
// <Ask> and <Select>, and posts the answers to /api/form. Ported from the
// old jQuery template.js function for function; it builds DOM nodes rather
// than HTML strings, so template text always shows as text.

export class TemplateNode {
  name: string;
  type: 'var' | 'ask' | 'select';
  description: string;
  value = '';
  parents = new Set<string>();
  children = new Set<string>();
  options: { label: string; value: string }[] = [];

  constructor(name: string, type: TemplateNode['type'], description = '') {
    this.name = name;
    this.type = type;
    this.description = description;
  }
}

export class TemplateState {
  nodes = new Map<string, TemplateNode>();
  domElements = new Map<string, Element[]>();
  templateName = '';
  root: ParentNode = document;
  // Ask and Select tags from Def: lines, by variable name.
  prompts = new Map<string, string>();

  getPrompt(name: string) { return this.prompts.get(name); }
  setPrompt(name: string, originalTag: string) { this.prompts.set(name, originalTag); }
  addNode(node: TemplateNode) { this.nodes.set(node.name, node); }
  getNode(name: string) { return this.nodes.get(name); }

  // collectFormData gathers every answered prompt, keyed by its original tag.
  collectFormData(): { responses: Record<string, string> } {
    const responses: Record<string, string> = {};
    this.root.querySelectorAll<HTMLInputElement>('[data-original-tag]').forEach((el) => {
      const tag = el.dataset.originalTag;
      if (tag && el.value) responses[tag] = el.value;
    });
    return { responses };
  }

  updateValue(name: string, value: string) {
    const node = this.getNode(name);
    if (!node) return;
    node.value = value;
    this.updateDependents(node);
  }

  updateDependents(node: TemplateNode) {
    node.children.forEach((childName) => {
      const child = this.getNode(childName);
      if (child) this.domElements.get(childName)?.forEach((el) => { el.textContent = child.value; });
    });
  }
}

// Header commands and the labels they show with; variants share a label.
const COMMAND_LABELS: Record<string, string> = {
  Type: 'Message Type', To: 'To', CC: 'CC', Cc: 'CC', Subj: 'Subject', Subject: 'Subject', Attach: 'Attachments',
  SeqSet: 'Sequence Number', SeqInc: 'Increment Sequence', Def: 'Define Variable', Define: 'Define Variable',
  Readonly: 'Read Only', Form: 'Form Names', ReplyTemplate: 'Reply Template', Msg: 'Message Body',
};

export function parseTemplate(content: string): TemplateState {
  const state = new TemplateState();
  const lines = content.split('\n');

  // First pass: variable definitions and the prompts that fill them.
  for (const line of lines) {
    if (!line.toLowerCase().startsWith('def:')) continue;
    const def = parseDef(line);
    if (!def) continue;
    state.addNode(new TemplateNode(def.name, 'var', def.description));
    const prompt = line.match(/<(Ask|Select)[^>]+>/);
    if (prompt) state.setPrompt(def.name, prompt[0]);
  }

  // Second pass: references, prompts and selects.
  for (const line of lines) {
    for (const m of line.matchAll(/<Var\s+([^>]+)>/gi)) {
      if (!state.getNode(m[1]!)) state.addNode(new TemplateNode(m[1]!, 'var'));
    }
    for (const m of line.matchAll(/<Ask\s+([^>]+)>/gi)) {
      const [prompt, options] = parseAskPrompt(m[1]!);
      const node = new TemplateNode(prompt, 'ask');
      node.options = options.map((o) => ({ label: o, value: o }));
      state.addNode(node);
    }
    for (const m of line.matchAll(/<Select\s+([^:>]+):([^>]+)>/gi)) {
      const [name, options] = parseSelectOptions(m[1]!, m[2]!);
      const node = new TemplateNode(name, 'select');
      node.options = options;
      state.addNode(node);
    }
  }
  return state;
}

function parseDef(line: string) {
  const m = /Def:\s*([^=]+)=<([^>]+)>/i.exec(line);
  return m ? { name: m[1]!.trim(), description: m[2]!.trim() } : null;
}

function parseAskPrompt(text: string): [string, string[]] {
  const parts = text.split(',');
  return [parts[0]!.trim(), parts.slice(1)];
}

function extractDescription(text: string): string | null {
  return text.match(/\((.*?)\)/)?.[1] ?? null;
}

function parseSelectOptions(name: string, optionsStr: string): [string, { label: string; value: string }[]] {
  const options = optionsStr.split(',').map((opt) => {
    const [label, value] = opt.split('=');
    return { label: label!.trim(), value: value ? value.trim() : label!.trim() };
  });
  return [name.trim(), options];
}

let seq = 0;
const uniqueId = (prefix: string) => `${prefix}${++seq}`;

function setAttrs(el: Element, attrs: Record<string, string>) {
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
}

export function renderPrompt(originalTag: string, name: string, id: string, extraAttrs: Record<string, string> = {}): HTMLElement {
  if (originalTag.startsWith('<Select')) {
    const m = originalTag.match(/<Select\s+([^:>]+):([^>]+)>/);
    if (m) return renderSelect(name, id, originalTag, parseSelectOptions(m[1]!, m[2]!)[1], extraAttrs);
  }
  const uppercase = originalTag.includes(',UP') || originalTag.includes(',UPPERCASE');
  const description = extractDescription(originalTag);
  if (originalTag.includes(',MU')) return renderTextarea(name, id, originalTag, description, uppercase, extraAttrs);
  return renderInput(name, id, originalTag, description, uppercase, extraAttrs);
}

export function renderSelect(name: string, id: string, originalTag: string, options: { label: string; value: string }[], extraAttrs: Record<string, string> = {}) {
  const el = document.createElement('select');
  el.className = 'th-select';
  el.id = id;
  el.dataset.node = name;
  el.dataset.originalTag = originalTag;
  setAttrs(el, extraAttrs);
  el.append(new Option(`Choose ${name}`, ''), ...options.map((o) => new Option(o.label, o.value)));
  return el;
}

export function renderTextarea(name: string, id: string, originalTag: string, description: string | null, uppercase: boolean, extraAttrs: Record<string, string> = {}) {
  const el = document.createElement('textarea');
  el.className = 'th-textarea';
  el.id = id;
  el.dataset.node = name;
  el.dataset.originalTag = originalTag;
  el.title = description || name;
  el.placeholder = description || name;
  el.rows = 3;
  if (uppercase) el.dataset.uppercase = 'true';
  setAttrs(el, extraAttrs);
  return el;
}

export function renderInput(name: string, id: string, originalTag: string, description: string | null, uppercase: boolean, extraAttrs: Record<string, string> = {}) {
  const el = document.createElement('input');
  el.type = 'text';
  el.className = 'th-input';
  el.id = id;
  el.dataset.node = name;
  el.dataset.originalTag = originalTag;
  el.title = description || name;
  el.placeholder = description || name;
  if (uppercase) el.dataset.uppercase = 'true';
  // Keep password managers and autofill away from form fields.
  setAttrs(el, { autocomplete: 'off', 'data-form-type': 'other', 'data-lpignore': 'true', 'data-1p-ignore': 'true', ...extraAttrs });
  if (extraAttrs.value !== undefined) el.value = extraAttrs.value;
  fitWidth(el);
  return el;
}

// fitWidth sizes an inline field to its text or placeholder; CSS caps it.
function fitWidth(el: HTMLInputElement) {
  el.size = Math.max(4, (el.value || el.placeholder).length + 1);
}

// processSection turns one part of the template into text with inline
// fields. In the header, commands show with their readable labels.
export function processSection(content: string, state: TemplateState, isHeader = false): DocumentFragment {
  const text = content.split('\n').map((line) => {
    if (!line.trim()) return line;
    const colon = line.indexOf(':');
    if (colon > 0 && isHeader) {
      const label = COMMAND_LABELS[line.substring(0, colon).trim()];
      if (label) return `${label}: ${line.substring(colon + 1)}`;
    }
    return line;
  }).join('\n');

  const frag = document.createDocumentFragment();
  const tags = /<Ask\s+([^>]+)>|<Select\s+([^:>]+):([^>]+)>|<Var\s+([^>]+)>/gi;
  let last = 0;
  for (const m of text.matchAll(tags)) {
    frag.append(text.slice(last, m.index));
    last = m.index! + m[0].length;
    if (m[1] !== undefined) {
      const [prompt] = parseAskPrompt(m[1]);
      if (!state.getNode(prompt)) state.addNode(new TemplateNode(prompt, 'ask'));
      frag.append(renderPrompt(m[0], prompt, uniqueId('ask_')));
    } else if (m[2] !== undefined) {
      const [name, options] = parseSelectOptions(m[2], m[3]!);
      const node = state.getNode(name) ?? new TemplateNode(name, 'select');
      node.options = options;
      state.addNode(node);
      frag.append(renderSelect(name, uniqueId('select_'), m[0], options));
    } else {
      const name = m[4]!;
      const node = state.getNode(name) ?? new TemplateNode(name, 'var');
      state.addNode(node);
      // A Def: line's prompt decides how the variable is asked for.
      frag.append(renderPrompt(state.getPrompt(name) ?? m[0], name, uniqueId('var_'), { 'data-var': name, value: node.value || '' }));
    }
  }
  frag.append(text.slice(last));
  return frag;
}

// templateToHtml fills the header list and message from the template. The
// To and Subject lines lead the header; Def: lines are not shown.
export function templateToHtml(content: string, state: TemplateState, headersEl: Element, messageEl: Element) {
  content = content.replace(/\r\n/g, '\n');
  const parts = content.split(/Msg:\s*\n/i);
  const headers = parts[0]!.split('\n').filter((l) => !l.trim().startsWith('Def:'));
  const first = headers.filter((l) => l.startsWith('To:') || l.startsWith('Subj:'));
  const rest = headers.filter((l) => !(l.startsWith('To:') || l.startsWith('Subj:')));
  headersEl.replaceChildren(processSection([...first, ...rest].join('\n').trim(), state, true));
  messageEl.replaceChildren(processSection(parts.length > 1 ? parts[1]! : '', state, false));
}

// setupVariableHandlers keeps every field of one variable in step and
// marks them together while one has focus.
export function setupVariableHandlers(root: HTMLElement, state: TemplateState) {
  const peers = (el: HTMLElement) => root.querySelectorAll<HTMLInputElement>(`input[data-var="${CSS.escape(el.dataset.var!)}"]`);
  root.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement;
    if (el.dataset?.var) peers(el).forEach((p) => p.classList.add('linked-active'));
  });
  root.addEventListener('focusout', (e) => {
    const el = e.target as HTMLElement;
    if (el.dataset?.var) peers(el).forEach((p) => p.classList.remove('linked-active'));
  });
  const onEdit = (e: Event) => {
    const el = e.target as HTMLInputElement;
    if (!el.dataset?.node) return;
    if (el.dataset.uppercase && el.value !== el.value.toUpperCase()) el.value = el.value.toUpperCase();
    if (el.dataset.var) {
      peers(el).forEach((p) => { if (p !== el) p.value = el.value; fitWidth(p); });
    } else if (el instanceof HTMLInputElement) {
      fitWidth(el);
    }
    state.updateValue(el.dataset.node, el.value);
  };
  root.addEventListener('input', onEdit);
  root.addEventListener('change', onEdit);
}

// checkAllPromptsFilled enables Submit once every field has a value.
export function checkAllPromptsFilled(root: HTMLElement, submit: HTMLButtonElement) {
  const fields = Array.from(root.querySelectorAll<HTMLInputElement>('[data-original-tag]'));
  submit.disabled = fields.some((f) => !f.value || f.value.trim() === '');
}

export async function submitTemplate(state: TemplateState, search: string): Promise<void> {
  const res = await fetch(`/api/form?${new URLSearchParams(search)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state.collectFormData()),
  });
  if (!res.ok) throw new Error((await res.text()).trim() || res.statusText);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) {
  const e = document.createElement(tag);
  setAttrs(e, attrs);
  if (text !== undefined) e.textContent = text;
  return e;
}

// mount builds the page in root for the given query string and resolves
// once the template is on screen, with the state behind it.
export async function mount(root: HTMLElement, search: string): Promise<TemplateState> {
  const query = new URLSearchParams(search);
  const name = query.get('template') ?? '';
  let state = new TemplateState();
  state.root = root;

  const form = el('form', { class: 'th-page', novalidate: '' });
  const bar = el('header', { class: 'th-bar' });
  const title = el('h1', {}, name || 'Template');
  const cancel = el('button', { type: 'button', class: 'ui-btn ui-btn-default ui-btn-md' }, 'Cancel');
  const submit = el('button', { type: 'submit', class: 'ui-btn ui-btn-primary ui-btn-md' }, 'Submit');
  submit.disabled = true;
  bar.append(title, el('span', { class: 'th-spacer' }), cancel, submit);
  const alert = el('p', { class: 'th-alert', role: 'alert', hidden: '' });
  const status = el('p', { class: 'th-status', role: 'status' });
  const card = el('section', { class: 'th-card' });
  const headers = el('div', { class: 'th-headers' });
  const message = el('div', { class: 'th-message' });
  card.append(headers, el('h2', {}, 'Message'), message);
  form.append(bar, el('main', { class: 'th-main' }));
  form.lastElementChild!.append(alert, status, card);
  root.replaceChildren(form);
  if (name) document.title = name;

  const fail = (text: string) => { alert.textContent = text; alert.hidden = false; };
  cancel.addEventListener('click', () => window.close());

  if (!name) {
    fail('No template specified.');
    return state;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    alert.hidden = true;
    submitTemplate(state, search).then(() => {
      status.textContent = 'Message posted to the outbox.';
      window.close();
    }).catch((err: Error) => {
      fail(`Failed to submit the form: ${err.message}`);
      checkAllPromptsFilled(root, submit);
    });
  });

  try {
    const res = await fetch(`/api/template?${query}`);
    if (!res.ok) throw new Error((await res.text()).trim() || res.statusText);
    const content = await res.text();
    state = parseTemplate(content);
    state.templateName = name;
    state.root = root;
    templateToHtml(content, state, headers, message);
    setupVariableHandlers(root, state);
    checkAllPromptsFilled(root, submit);
    root.addEventListener('input', () => checkAllPromptsFilled(root, submit));
    root.addEventListener('change', () => checkAllPromptsFilled(root, submit));
  } catch (err) {
    fail(`Failed to process the template: ${err instanceof Error ? err.message : String(err)}`);
  }
  return state;
}
