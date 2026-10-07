// Typed client for the Go API. Every call throws ApiError on a non-2xx
// response; bulk calls attach their per-MID result to the error too.
import type { BulkResult, Config, Folder, Label, Message, Row, Status, View } from './types';

export class ApiError extends Error {
  constructor(public status: number, public body: string, public result?: BulkResult) {
    super(body.trim() || `HTTP ${status}`);
    this.name = 'ApiError';
  }
}

const enc = encodeURIComponent;

async function call(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    let result: BulkResult | undefined;
    try {
      const j = JSON.parse(text);
      if (j && Array.isArray(j.ok) && j.failed) result = j;
    } catch { /* plain-text error */ }
    throw new ApiError(res.status, text, result);
  }
  return text;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const text = await call(url, init);
  return (text ? JSON.parse(text) : undefined) as T;
}

const req = (method: string, body?: unknown): RequestInit =>
  body === undefined
    ? { method }
    : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };

// Folders and labels
export const folders = () => json<Folder[]>('/api/folders');
export const createFolder = (name: string) => json<Folder>('/api/folders', req('POST', { name }));
export const renameFolder = (old: string, name: string) => call(`/api/folders/${enc(old)}`, req('PATCH', { name }));
export const deleteFolder = (name: string) => call(`/api/folders/${enc(name)}`, req('DELETE'));
export const labels = () => json<Label[]>('/api/labels');
export const createLabel = (name: string, color: string) => json<Label>('/api/labels', req('POST', { name, color }));
export const updateLabel = (name: string, patch: { name?: string; color?: string }) =>
  call(`/api/labels/${enc(name)}`, req('PATCH', patch));
export const deleteLabel = (name: string) => call(`/api/labels/${enc(name)}`, req('DELETE'));

// Messages
export function list(view: View): Promise<Row[]> {
  switch (view.kind) {
    case 'folder': return json(`/api/mailbox/${enc(view.name)}`);
    case 'label': return json(`/api/mailbox/all?label=${enc(view.name)}`);
    case 'starred': return json('/api/starred');
    case 'search': return json(`/api/search?q=${enc(view.q)}`);
  }
}
// message fetches one message. The server's JSON has no folder field, so
// the folder it was read from is filled in here.
export const message = async (folder: string, mid: string): Promise<Message> => ({
  ...(await json<Message>(`/api/mailbox/${enc(folder)}/${enc(mid)}`)),
  Folder: folder,
});
export const attachmentUrl = (folder: string, mid: string, name: string, renderToHtml?: boolean) =>
  `/api/mailbox/${enc(folder)}/${enc(mid)}/${enc(name)}${renderToHtml ? '?rendertohtml=true' : ''}`;
export const move = (mids: string[], to: string) => json<BulkResult>('/api/messages/move', req('POST', { mids, to }));
export const setRead = (mids: string[], read: boolean) => json<BulkResult>('/api/messages/read', req('POST', { mids, read }));
export const star = (mids: string[], starred: boolean) => json<BulkResult>('/api/messages/star', req('POST', { mids, starred }));
export const setLabels = (mids: string[], add: string[], remove: string[]) =>
  json<BulkResult>('/api/messages/labels', req('POST', { mids, add, remove }));
export const remove = (mids: string[]) => json<BulkResult>('/api/messages/delete', req('POST', { mids }));

// Download: one message comes back as its own file, several as one zip.
export type DownloadFormat = 'b2f' | 'eml' | 'txt';
export const downloadUrl = (mids: string[], format: DownloadFormat) =>
  `/api/messages/download?format=${format}${mids.map((m) => `&mid=${enc(m)}`).join('')}`;

// download follows a link to the file. The download attribute keeps the
// page where it is, even when the server answers with an error.
export function download(mids: string[], format: DownloadFormat): void {
  const a = document.createElement('a');
  a.href = downloadUrl(mids, format);
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
export const send = (form: FormData) => call('/api/mailbox/out', { method: 'POST', body: form });

// Config and session
export const config = () => json<Config>('/api/config');
export const saveConfig = (c: Config) => call('/api/config', req('PUT', c));
export const reload = () => call('/api/reload', req('POST'));
// The first-run question "Connect through your Pat?" and what Yes would set.
export interface PatChoice { ask: boolean; pat_url?: string; mailbox?: string; forms?: string }
export const patChoice = () => json<PatChoice>('/api/pat-choice');
export const answerPatChoice = (use: boolean) => call('/api/pat-choice', req('POST', { use }));
export const status = () => json<Status>('/api/status');
// connect runs a session; viaPat hands it to the Pat named in connect_via.
export const connect = (url: string, viaPat = false) =>
  json<{ NumReceived: number }>(`/api/connect?url=${enc(url)}${viaPat ? '&via=pat' : ''}`);
export const disconnect = (dirty: boolean) => call(`/api/disconnect?dirty=${dirty}`);
export const qsy = (transport: string, freq: number | string) => call('/api/qsy', req('POST', { transport, freq }));
export const bandwidths = (mode: string) => json<{ mode: string; bandwidths: string[]; default?: string }>(`/api/bandwidths?mode=${enc(mode)}`);
export function rmslist(params: { mode?: string; band?: string; prefix?: string }, forceDownload = false) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  if (forceDownload) q.set('force-download', 'true');
  return json<unknown[]>(`/api/rmslist?${q}`);
}
export const connectAliases = () => json<Record<string, string>>('/api/config/connect_aliases');
export const putAlias = (name: string, url: string) => call(`/api/config/connect_aliases/${enc(name)}`, req('PUT', url));
export const deleteAlias = (name: string) => call(`/api/config/connect_aliases/${enc(name)}`, req('DELETE'));

// Position
export const posReport = (pos: Record<string, unknown>) => call('/api/posreport', req('POST', pos));
export const gpsPosition = () => json<Record<string, unknown>>('/api/current_gps_position');
export const coordsToLocator = (lat: number, lon: number) => json<{ locator: string }>('/api/coords_to_locator', req('POST', { lat, lon }));

// Forms
export const formCatalog = () => json<unknown>('/api/formcatalog');
export const formsUpdate = () => json<unknown>('/api/formsUpdate', req('POST'));
export const pollForm = () => json<Record<string, unknown>>('/api/form');

// Winlink account and release check
export const recoveryEmail = () => json<{ recovery_email: string }>('/api/winlink-account/password-recovery-email');
export const putRecoveryEmail = (email: string) =>
  call('/api/winlink-account/password-recovery-email', req('PUT', { recovery_email: email }));
export const registration = (callsign: string) => json<unknown>(`/api/winlink-account/registration?callsign=${enc(callsign)}`);
export const register = (body: { callsign: string; password: string; password_recovery_email?: string }) =>
  call('/api/winlink-account/registration', req('POST', body));
export const newReleaseCheck = () => json<unknown>('/api/new-release-check');
