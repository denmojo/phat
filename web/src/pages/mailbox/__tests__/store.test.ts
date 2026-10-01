vi.mock('../../../lib/api', async (orig) => {
  const real = await orig<typeof import('../../../lib/api')>();
  return {
    ...real,
    list: vi.fn(async () => []),
    folders: vi.fn(async () => []),
    labels: vi.fn(async () => []),
    move: vi.fn(async () => ({ ok: ['a'], failed: { b: 'not found' } })),
    setLabels: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
    setRead: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
    star: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
    message: vi.fn(),
  };
});
import * as api from '../../../lib/api';
import * as store from '../store';

beforeEach(() => vi.clearAllMocks());

test('applyBulk keeps the failed MIDs selected and refreshes', async () => {
  store.selected.value = new Set(['a', 'b']);
  await store.applyBulk('move', 'Club');
  expect(api.move).toHaveBeenCalledWith(['a', 'b'], 'Club');
  expect([...store.selected.value]).toEqual(['b']);
  expect(api.list).toHaveBeenCalled();
  expect(api.folders).toHaveBeenCalled();
});

test('a bulk call where everything failed keeps the whole selection', async () => {
  vi.mocked(api.move).mockRejectedValueOnce(
    new api.ApiError(404, '', { ok: [], failed: { a: 'not found', b: 'not found' } }),
  );
  store.selected.value = new Set(['a', 'b']);
  await store.applyBulk('move', 'Club');
  expect([...store.selected.value].sort()).toEqual(['a', 'b']);
});

test('setView clears the selection and loads the view', async () => {
  store.selected.value = new Set(['a']);
  await store.setView({ kind: 'starred' });
  expect(store.selected.value.size).toBe(0);
  expect(api.list).toHaveBeenCalledWith({ kind: 'starred' });
  expect(store.view.value).toEqual({ kind: 'starred' });
});

test('toggleSelect, selectAll and clearSelection', () => {
  store.rows.value = [{ MID: 'x' }, { MID: 'y' }] as never;
  store.clearSelection();
  store.toggleSelect('x');
  expect([...store.selected.value]).toEqual(['x']);
  store.toggleSelect('x');
  expect(store.selected.value.size).toBe(0);
  store.selectAll();
  expect([...store.selected.value]).toEqual(['x', 'y']);
  store.clearSelection();
  expect(store.selected.value.size).toBe(0);
});

test('an open message knows its folder and picks up a label change', async () => {
  // The server's message JSON carries no Folder field.
  vi.mocked(api.message).mockResolvedValueOnce({ MID: 'm1', Labels: [] } as never);
  await store.openMsg('Club', 'm1');
  expect(store.openMessage.value?.Folder).toBe('Club');
  vi.mocked(api.message).mockResolvedValueOnce({ MID: 'm1', Labels: ['follow up'] } as never);
  await store.applyBulkTo(['m1'], 'labels', ['follow up'], []);
  expect(api.message).toHaveBeenLastCalledWith('Club', 'm1');
  expect(store.openMessage.value?.Labels).toEqual(['follow up']);
  expect(store.openMessage.value?.Folder).toBe('Club');
});

test('read, star and label changes keep the selection; the rows stay in view', async () => {
  store.openMessage.value = null;
  store.view.value = { kind: 'folder', name: 'in' };
  for (const args of [['read', true], ['star', true], ['labels', ['x'], []]] as const) {
    store.selected.value = new Set(['a', 'b']);
    await store.applyBulk(...(args as unknown as Parameters<typeof store.applyBulk>));
    expect([...store.selected.value].sort()).toEqual(['a', 'b']);
  }
});

test('unstarring in the Starred view drops the rows from the selection', async () => {
  store.view.value = { kind: 'starred' };
  store.selected.value = new Set(['a', 'b']);
  await store.applyBulk('star', false);
  expect(store.selected.value.size).toBe(0);
  store.view.value = { kind: 'folder', name: 'in' };
});
