// Mailbox page state: signals the components read, and the actions that
// change them. Every server change is followed by a refresh of the list
// and the sidebar counts.
import { computed, signal } from '@preact/signals';
import * as api from '../../lib/api';
import { ApiError } from '../../lib/api';
import { connectWs } from '../../lib/ws';
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
// composerOpen is set by the composer (web Task 7); a config change while it
// is open waits for the user instead of reloading the page under them.
export const composerOpen = signal(false);
// drawerOpen shows the sidebar as a drawer on narrow screens.
export const drawerOpen = signal(false);

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
// relevance order; the toolbar hides the sort menu there.
export const sortedRows = computed<Row[]>(() => {
  if (view.value.kind === 'search') return rows.value;
  const { key, asc } = sort.value;
  const out = [...rows.value];
  const cmp = (a: Row, b: Row) => {
    if (key === 'date') return Date.parse(a.Date) - Date.parse(b.Date);
    const x = key === 'from' ? correspondent(a) : a.Subject;
    const y = key === 'from' ? correspondent(b) : b.Subject;
    return x.localeCompare(y, undefined, { sensitivity: 'base' });
  };
  out.sort((a, b) => (asc ? cmp(a, b) : cmp(b, a)));
  return out;
});

function report(err: unknown) {
  toast(err instanceof Error ? err.message : String(err), { kind: 'error' });
}

export async function refresh(): Promise<void> {
  const v = view.value;
  try {
    const got = await api.list(v);
    if (view.value === v) rows.value = got;
  } catch (err) {
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
  openMessage.value = null;
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

export async function openMsg(folder: string, mid: string): Promise<void> {
  try {
    openMessage.value = await api.message(folder, mid);
  } catch (err) {
    report(err);
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
  openMessage.value = null;
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
    selected.value = new Set([...selected.value].filter((m) => !ok.has(m)));
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
      if (fresh) openMessage.value = fresh;
    }
  }
  return res;
}

let lastHash: string | null = null;

// startWs connects the websocket and routes its messages into the store.
export function startWs() {
  return connectWs({
    onOpen: () => {
      wsUp.value = true;
      // Anything may have changed while the socket was down.
      void refreshSidebar();
      void refresh();
    },
    onClose: () => { wsUp.value = false; },
    onStatus: (s) => {
      status.value = s;
      if (lastHash !== null && s.config_hash !== lastHash) {
        if (composerOpen.value) configChanged.value = true;
        else location.reload();
      }
      lastHash = s.config_hash;
    },
    onProgress: (p) => { progress.value = p.done ? null : p; },
    onNotification: (n) => {
      if ('Notification' in window && Notification.permission === 'granted') new Notification(n.title, { body: n.body });
      else toast(`${n.title}: ${n.body}`);
    },
    onPrompt: (p) => { prompt.value = p; },
    onPromptAbort: () => { prompt.value = null; },
    onUpdateMailbox: () => {
      void refresh();
      void refreshSidebar();
    },
    onMyCall: (c) => { mycall.value = c; },
  });
}
