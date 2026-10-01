// Mailbox page state: signals the components read, and the actions that
// change them. Every server change is followed by a refresh of the list
// and the sidebar counts.
import { signal } from '@preact/signals';
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

function report(err: unknown) {
  toast(err instanceof Error ? err.message : String(err), { kind: 'error' });
}

export async function refresh(): Promise<void> {
  const v = view.value;
  try {
    const got = await api.list(v);
    if (view.value === v) rows.value = got;
  } catch (err) {
    report(err);
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

export async function setView(v: View): Promise<void> {
  view.value = v;
  selected.value = new Set();
  openMessage.value = null;
  rows.value = [];
  await refresh();
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
      toast(`${plural(failed.length)} could not be changed: ${why}`, { kind: 'error' });
    }
  }
  await Promise.all([refresh(), refreshSidebar()]);
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
