// Mailbox page state: signals the components read, and the actions that
// change them. Every server change is followed by a refresh of the list
// and the sidebar counts.
import { computed, signal } from '@preact/signals';
import * as api from '../../lib/api';
import { ApiError } from '../../lib/api';
import { connectWs } from '../../lib/ws';
import * as notify from '../../lib/notify';
import { checkRecovery } from '../../lib/recovery';
import type { BulkResult, Config, Folder, Label, Message, Progress, Prompt, Row, Status, View } from '../../lib/types';
import { toast } from '../../ui/Toast';

export const folders = signal<Folder[]>([]);
export const labels = signal<Label[]>([]);
export const view = signal<View>({ kind: 'folder', name: 'in' });
export const rows = signal<Row[]>([]);
export const selected = signal<Set<string>>(new Set());
export const openMessage = signal<Message | null>(null);
export const status = signal<Status | null>(null);
export const progress = signal<Progress | null>(null);
export const prompt = signal<Prompt | null>(null);
export const config = signal<Config | null>(null);
export const mycall = signal<string>(document.documentElement.dataset.mycall ?? '');
export const wsUp = signal(false);
export const configChanged = signal(false);
// composerOpen is set by the composer; a config change while it is open
// waits for the user instead of reloading the page under them.
export const composerOpen = signal(false);

// Draft is the message being written in the composer.
export interface Draft {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  files: File[];
  // inReplyTo is "<folder>/<mid>" of the message being answered.
  inReplyTo: string | null;
  p2pOnly: boolean;
}
export const emptyDraft = (): Draft => ({ to: [], cc: [], subject: '', body: '', files: [], inReplyTo: null, p2pOnly: false });
export const draft = signal<Draft>(emptyDraft());
// drawerOpen shows the sidebar as a drawer on narrow screens.
export const drawerOpen = signal(false);
export const connectOpen = signal(false);
export const positionOpen = signal(false);
export const logOpen = signal(false);
// keysOpen shows the keyboard shortcut sheet.
export const keysOpen = signal(false);

// logLines is the server's session log as the websocket streams it.
export const logLines = signal<string[]>([]);
const LOG_MAX = 1000;
export function addLogLine(line: string): void {
  const next = [...logLines.value, line];
  logLines.value = next.length > LOG_MAX ? next.slice(next.length - LOG_MAX) : next;
}

// Issues the status popover lists besides the connection itself.
export const notifyState = signal<notify.NotifyState | 'pending'>('pending');
export const geoError = signal<string | null>(null);
export const recoveryWarning = signal(false);

// socket is the open websocket's sender; startWs fills it in.
export const socket: { send: (o: unknown) => void } = { send: () => {} };
// promptNotice is the desktop notification raised for the open prompt.
export const promptNotice: { current: Notification | null } = { current: null };

// answerPrompt sends the user's answer to the open prompt and closes it.
export function answerPrompt(value: string): void {
  const p = prompt.value;
  if (!p) return;
  socket.send({ prompt_response: { id: p.id, value } });
  closePrompt();
}

function closePrompt(): void {
  prompt.value = null;
  promptNotice.current?.close();
  promptNotice.current = null;
}

// Progress stays up for 3 s after a transfer finishes, unless another starts.
let progressTimer: ReturnType<typeof setTimeout> | null = null;
export function handleProgress(p: Progress): void {
  if (progressTimer) clearTimeout(progressTimer);
  progressTimer = null;
  if (p.done) {
    if (!progress.value) return;
    progress.value = { ...progress.value, done: true };
    progressTimer = setTimeout(() => { progress.value = null; }, 3000);
    return;
  }
  if (p.receiving || p.sending) progress.value = p;
}

export type SortKey = 'date' | 'from' | 'subject';
export type Sort = { key: SortKey; asc: boolean };
const SORT_KEY = 'phat.sort';
function loadSort(): Sort {
  try {
    const s = JSON.parse(localStorage.getItem(SORT_KEY) ?? '');
    if (['date', 'from', 'subject'].includes(s.key)) return { key: s.key, asc: !!s.asc };
  } catch { /* nothing stored */ }
  return { key: 'date', asc: false };
}
export const sort = signal<Sort>(loadSort());
export function setSort(s: Sort): void {
  sort.value = s;
  try { localStorage.setItem(SORT_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
}

// correspondent is the address a row is shown under: the recipient for
// mail this station wrote, the sender otherwise.
export function correspondent(r: Row): string {
  return r.Folder === 'out' || r.Folder === 'sent' ? r.To : r.From;
}

// sortedRows is rows in display order. Search results keep the server's
// relevance order; the toolbar hides the sort menu there. Each column sorts
// one way (dates as numbers, text with numeric-aware collation), keys are
// computed once per row, and ties fall back to the message ID so the order
// doesn't shuffle between refreshes.
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
export const sortedRows = computed<Row[]>(() => {
  if (view.value.kind === 'search') return rows.value;
  const { key, asc } = sort.value;
  const dir = asc ? 1 : -1;
  const keyed = rows.value.map((r) => ({
    r,
    k: key === 'date' ? Date.parse(r.Date) || 0 : key === 'from' ? correspondent(r) : r.Subject,
  }));
  keyed.sort((a, b) => {
    const c = typeof a.k === 'number' ? (a.k as number) - (b.k as number) : collator.compare(a.k as string, b.k as string);
    return c * dir || (a.r.MID < b.r.MID ? -1 : a.r.MID > b.r.MID ? 1 : 0);
  });
  return keyed.map((x) => x.r);
});

function report(err: unknown) {
  toast(err instanceof Error ? err.message : String(err), { kind: 'error' });
}

let refreshSeq = 0;

// refresh reloads the current view. Only the newest request's answer is
// used, so a slow response for an earlier view or an earlier refresh can't
// overwrite a newer list. The selection is trimmed to what the list now
// shows, so a bulk action can never touch a message the user can't see.
export async function refresh(): Promise<void> {
  const v = view.value;
  const seq = ++refreshSeq;
  try {
    const got = await api.list(v);
    if (seq !== refreshSeq || view.value !== v) return;
    rows.value = got;
    const shown = new Set(got.map((r) => r.MID));
    if ([...selected.value].some((m) => !shown.has(m))) {
      selected.value = new Set([...selected.value].filter((m) => shown.has(m)));
    }
  } catch (err) {
    if (seq !== refreshSeq) return;
    // A query the index can't parse leaves the last results on screen.
    if (v.kind === 'search' && err instanceof ApiError && err.status === 400) toast('Search syntax error', { kind: 'error' });
    else report(err);
  }
}

export async function refreshSidebar(): Promise<void> {
  try {
    const [f, l] = await Promise.all([api.folders(), api.labels()]);
    folders.value = f;
    labels.value = l;
  } catch (err) {
    report(err);
  }
}

// browseView is the last view that wasn't a search, where clearing the
// search box returns to.
export const browseView = signal<View>(view.value);

export async function setView(v: View): Promise<void> {
  const wasSearch = view.value.kind === 'search';
  view.value = v;
  if (v.kind !== 'search') browseView.value = v;
  drawerOpen.value = false;
  selected.value = new Set();
  closeMsg();
  // Refining a search keeps the old results up until the new ones arrive.
  if (!(wasSearch && v.kind === 'search')) rows.value = [];
  await refresh();
}

export function endSearch(): Promise<void> {
  return setView(browseView.value);
}

export function toggleSelect(mid: string): void {
  const s = new Set(selected.value);
  if (s.has(mid)) s.delete(mid);
  else s.add(mid);
  selected.value = s;
}

export function selectAll(): void {
  selected.value = new Set(rows.value.map((r) => r.MID));
}

// selectRange adds every row between two MIDs, in display order.
export function selectRange(from: string, to: string): void {
  const ids = sortedRows.value.map((r) => r.MID);
  let i = ids.indexOf(from);
  let j = ids.indexOf(to);
  if (i < 0 || j < 0) return;
  if (i > j) [i, j] = [j, i];
  selected.value = new Set([...selected.value, ...ids.slice(i, j + 1)]);
}

export function clearSelection(): void {
  selected.value = new Set();
}

let openSeq = 0;

// openMsg opens a message. Only the newest request's answer is used, and
// closing the message or changing the view retires any request still in
// flight, so a slow reply can't replace a newer message or reopen a closed
// one.
export async function openMsg(folder: string, mid: string): Promise<void> {
  const seq = ++openSeq;
  try {
    const got = await api.message(folder, mid);
    if (seq !== openSeq) return;
    openMessage.value = { ...got, Folder: folder };
  } catch (err) {
    if (seq === openSeq) report(err);
    return;
  }
  const row = rows.value.find((r) => r.MID === mid);
  if (row?.Unread) {
    try {
      await api.setRead([mid], true);
    } catch (err) {
      report(err);
    }
    await Promise.all([refresh(), refreshSidebar()]);
  }
}

export function closeMsg(): void {
  openSeq++;
  openMessage.value = null;
}

// neighbors are the rows on either side of the open message in the list
// in display order; both are null when no message is open or it has left
// the list.
export const neighbors = computed<{ prev: Row | null; next: Row | null }>(() => {
  const m = openMessage.value;
  const list = sortedRows.value;
  const i = m ? list.findIndex((r) => r.MID === m.MID && r.Folder === m.Folder) : -1;
  if (i < 0) return { prev: null, next: null };
  return { prev: list[i - 1] ?? null, next: list[i + 1] ?? null };
});

// stepMsg opens the message above (-1) or below (1) the open one, the
// same way a click on its row would.
export async function stepMsg(dir: -1 | 1): Promise<void> {
  const row = dir < 0 ? neighbors.value.prev : neighbors.value.next;
  if (row) await openMsg(row.Folder, row.MID);
}

type Bulk =
  | ['move', string]
  | ['read', boolean]
  | ['star', boolean]
  | ['labels', string[], string[]]
  | ['delete'];

const plural = (n: number) => `${n} message${n === 1 ? '' : 's'}`;

function done(kind: Bulk[0], n: number, arg: unknown): string {
  switch (kind) {
    case 'move': return `Moved ${plural(n)} to ${arg}`;
    case 'read': return `Marked ${plural(n)} as ${arg ? 'read' : 'unread'}`;
    case 'star': return `${arg ? 'Starred' : 'Unstarred'} ${plural(n)}`;
    case 'labels': return `Updated labels on ${plural(n)}`;
    case 'delete': return `Deleted ${plural(n)}`;
  }
}

// applyBulk runs one bulk action on the selection (or on mids given
// explicitly). Messages that succeed leave the selection; the ones that
// failed stay selected so the user can see and retry them.
export async function applyBulk(...args: Bulk): Promise<BulkResult | null> {
  return applyBulkTo([...selected.value], ...args);
}

export async function applyBulkTo(mids: string[], ...args: Bulk): Promise<BulkResult | null> {
  if (mids.length === 0) return null;
  let res: BulkResult | null = null;
  try {
    switch (args[0]) {
      case 'move': res = await api.move(mids, args[1]); break;
      case 'read': res = await api.setRead(mids, args[1]); break;
      case 'star': res = await api.star(mids, args[1]); break;
      case 'labels': res = await api.setLabels(mids, args[1], args[2]); break;
      case 'delete': res = await api.remove(mids); break;
    }
  } catch (err) {
    if (err instanceof ApiError && err.result) res = err.result;
    else report(err);
  }
  if (res) {
    const ok = new Set(res.ok);
    const failed = Object.keys(res.failed);
    // Moved and deleted messages leave the list, so they leave the
    // selection; read, star and label changes keep it for the next action.
    if (args[0] === 'move' || args[0] === 'delete') selected.value = new Set([...selected.value].filter((m) => !ok.has(m)));
    if (res.ok.length) toast(done(args[0], res.ok.length, args[1]));
    if (failed.length) {
      const why = [...new Set(Object.values(res.failed))].join('; ');
      toast(`${failed.length} of ${mids.length} failed: ${why}`, { kind: 'error' });
    }
  }
  await Promise.all([refresh(), refreshSidebar()]);
  // Keep an open message in step with what just happened to it.
  const m = openMessage.value;
  if (m && res?.ok.includes(m.MID)) {
    if (args[0] === 'move' || args[0] === 'delete') openMessage.value = null;
    else {
      const fresh = await api.message(m.Folder, m.MID).catch(() => null);
      if (fresh) openMessage.value = { ...fresh, Folder: m.Folder };
    }
  }
  return res;
}

let lastHash: string | null = null;

// handleStatus records a status push. A changed config hash reloads the
// page, unless the composer is open; then a banner asks first.
export function handleStatus(s: Status): void {
  status.value = s;
  if (lastHash !== null && s.config_hash !== lastHash) {
    if (composerOpen.value) configChanged.value = true;
    else location.reload();
  }
  lastHash = s.config_hash;
}

// startWs connects the websocket and routes its messages into the store.
export function startWs() {
  const ws = connectWs({
    onOpen: () => {
      wsUp.value = true;
      // Anything may have changed while the socket was down.
      void refreshSidebar();
      void refresh();
      // The old client checked the recovery email 3 s after connecting.
      setTimeout(() => {
        void checkRecovery(mycall.value).then((r) => {
          if (r === 'warn') recoveryWarning.value = true;
          if (r === 'ok') recoveryWarning.value = false;
        });
      }, 3000);
    },
    onClose: () => { wsUp.value = false; },
    onStatus: handleStatus,
    onProgress: handleProgress,
    onNotification: (n) => {
      if (!notify.show(n.title, n.body)) toast(`${n.title}: ${n.body}`);
    },
    onPrompt: (p) => {
      promptNotice.current?.close();
      prompt.value = p;
      promptNotice.current = notify.show(p.message);
    },
    onPromptAbort: closePrompt,
    onLogLine: addLogLine,
    onUpdateMailbox: () => {
      void refresh();
      void refreshSidebar();
    },
    onMyCall: (c) => { mycall.value = c; },
  });
  socket.send = ws.send;
  return ws;
}
