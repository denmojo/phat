vi.mock('../../../lib/api', async (orig) => {
  const real = await orig<typeof import('../../../lib/api')>();
  return {
    ...real,
    list: vi.fn(async () => []),
    folders: vi.fn(async () => []),
    labels: vi.fn(async () => []),
    move: vi.fn(async () => ({ ok: ['a'], failed: { b: 'not found' } })),
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
