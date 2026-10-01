// Regression tests for the review of la5nta/pat#552, applied to Phat's store.
vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  list: vi.fn(),
  folders: vi.fn(async () => []),
  labels: vi.fn(async () => []),
  remove: vi.fn(),
}));
import * as api from '../../../lib/api';
import * as store from '../store';
import type { Row } from '../../../lib/types';

const row = (mid: string, extra: Partial<Row> = {}): Row => ({
  MID: mid, Folder: 'in', From: 'EOC-1', To: 'N0CALL', Cc: '', Subject: mid, Date: '2026-09-30T15:31:00Z',
  Size: 1, Attachments: 0, Unread: false, P2POnly: false, Starred: false, Labels: [], ...extra,
});
function deferred<T>() {
  let resolve!: (v: T) => void;
  const p = new Promise<T>((r) => { resolve = r; });
  return { p, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  store.view.value = { kind: 'folder', name: 'in' };
  store.rows.value = [];
  store.selected.value = new Set();
});

test('switching folders during a bulk action shows the new folder, not the old one', async () => {
  store.rows.value = [row('a'), row('b')];
  store.selected.value = new Set(['a']);
  const del = deferred<{ ok: string[]; failed: Record<string, string> }>();
  vi.mocked(api.remove).mockReturnValueOnce(del.p);
  vi.mocked(api.list).mockImplementation(async (v) => (v.kind === 'folder' && v.name === 'sent' ? [row('s1', { Folder: 'sent' })] : [row('b')]));
  const pending = store.applyBulk('delete');
  await store.setView({ kind: 'folder', name: 'sent' });
  del.resolve({ ok: ['a'], failed: {} });
  await pending;
  expect(store.view.value).toEqual({ kind: 'folder', name: 'sent' });
  expect(store.rows.value.map((r) => r.MID)).toEqual(['s1']);
  expect(store.selected.value.size).toBe(0);
});

test('a late response for an earlier refresh does not overwrite a newer one', async () => {
  const first = deferred<Row[]>();
  const second = deferred<Row[]>();
  vi.mocked(api.list).mockReturnValueOnce(first.p).mockReturnValueOnce(second.p);
  const r1 = store.refresh();
  const r2 = store.refresh();
  second.resolve([row('new')]);
  await r2;
  first.resolve([row('old')]);
  await r1;
  expect(store.rows.value.map((r) => r.MID)).toEqual(['new']);
});

test('the selection never holds messages that are no longer in the list', async () => {
  store.rows.value = [row('a'), row('b')];
  store.selected.value = new Set(['a', 'b']);
  // Another client deleted b; the websocket triggers a refresh.
  vi.mocked(api.list).mockResolvedValueOnce([row('a')]);
  await store.refresh();
  expect([...store.selected.value]).toEqual(['a']);
});

test('sorting is per column, stable, and survives bad dates', () => {
  store.rows.value = [
    row('m3', { Subject: 'Net 10', Date: 'garbage' }),
    row('m1', { Subject: 'Net 9', Date: '2026-09-01T00:00:00Z' }),
    row('m2', { Subject: 'net 9', Date: '2026-09-01T00:00:00Z' }),
    row('m4', { Subject: 'abc', Date: '2026-09-02T00:00:00Z' }),
  ];
  store.setSort({ key: 'subject', asc: true });
  expect(store.sortedRows.value.map((r) => r.MID)).toEqual(['m4', 'm1', 'm2', 'm3']);
  store.setSort({ key: 'date', asc: false });
  expect(store.sortedRows.value.map((r) => r.MID)).toEqual(['m4', 'm1', 'm2', 'm3']);
  store.setSort({ key: 'date', asc: false });
});
