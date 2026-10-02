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

const listOf = (...mids: string[]) => mids.map((MID) => ({ MID })) as never;

test('applyBulk keeps the failed MIDs selected and refreshes', async () => {
  vi.mocked(api.list).mockResolvedValueOnce(listOf('b'));
  store.selected.value = new Set(['a', 'b']);
  await store.applyBulk('move', 'Club');
  expect(api.move).toHaveBeenCalledWith(['a', 'b'], 'Club');
  expect([...store.selected.value]).toEqual(['b']);
  expect(api.list).toHaveBeenCalled();
  expect(api.folders).toHaveBeenCalled();
});

test('a bulk call where everything failed keeps the whole selection', async () => {
  vi.mocked(api.list).mockResolvedValueOnce(listOf('a', 'b'));
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
    vi.mocked(api.list).mockResolvedValueOnce(listOf('a', 'b'));
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

describe('stepping between messages', () => {
  const five = ['r1', 'r2', 'r3', 'r4', 'r5'].map((MID) => ({ MID, Folder: 'in', Unread: false })) as never;
  const opened = (MID: string, Folder = 'in') => ({ MID, Folder }) as never;

  test('neighbors are the rows on either side of the open message', () => {
    store.rows.value = five;
    store.openMessage.value = opened('r3');
    expect(store.neighbors.value.prev?.MID).toBe('r2');
    expect(store.neighbors.value.next?.MID).toBe('r4');
  });

  test('the first and last rows have no neighbor past the end', () => {
    store.rows.value = five;
    store.openMessage.value = opened('r1');
    expect(store.neighbors.value.prev).toBeNull();
    store.openMessage.value = opened('r5');
    expect(store.neighbors.value.next).toBeNull();
  });

  test('a message missing from the list, or none open, has no neighbors', () => {
    store.rows.value = five;
    store.openMessage.value = opened('gone');
    expect(store.neighbors.value).toEqual({ prev: null, next: null });
    store.openMessage.value = opened('r3', 'archive');
    expect(store.neighbors.value).toEqual({ prev: null, next: null });
    store.openMessage.value = null;
    expect(store.neighbors.value).toEqual({ prev: null, next: null });
  });

  test('stepping down opens the next row and marks it read when unread', async () => {
    store.rows.value = [
      { MID: 'r3', Folder: 'in', Unread: false },
      { MID: 'r4', Folder: 'Club', Unread: true },
    ] as never;
    store.openMessage.value = opened('r3');
    vi.mocked(api.message).mockResolvedValueOnce({ MID: 'r4' } as never);
    await store.stepMsg(1);
    expect(api.message).toHaveBeenCalledWith('Club', 'r4');
    expect(api.setRead).toHaveBeenCalledWith(['r4'], true);
    expect(store.openMessage.value).toMatchObject({ MID: 'r4', Folder: 'Club' });
  });

  test('stepping past the end does nothing', async () => {
    store.rows.value = five;
    store.openMessage.value = opened('r1');
    await store.stepMsg(-1);
    expect(api.message).not.toHaveBeenCalled();
    store.openMessage.value = null;
  });

  test('the arrows follow the order the list shows, not the server order', () => {
    const before = store.sort.value;
    store.view.value = { kind: 'folder', name: 'in' };
    store.rows.value = [
      { MID: 'c', Folder: 'in', Subject: 'Charlie', Date: '2026-09-03T00:00:00Z' },
      { MID: 'a', Folder: 'in', Subject: 'Alpha', Date: '2026-09-02T00:00:00Z' },
      { MID: 'b', Folder: 'in', Subject: 'Bravo', Date: '2026-09-01T00:00:00Z' },
    ] as never;
    store.sort.value = { key: 'subject', asc: true };
    store.openMessage.value = opened('a');
    expect(store.neighbors.value.prev).toBeNull();
    expect(store.neighbors.value.next?.MID).toBe('b');
    store.sort.value = before;
    store.openMessage.value = null;
  });

  test('a refresh that drops the open message switches both arrows off', () => {
    store.rows.value = five;
    store.openMessage.value = opened('r3');
    store.rows.value = (five as unknown as { MID: string }[]).filter((r) => r.MID !== 'r3') as never;
    expect(store.neighbors.value).toEqual({ prev: null, next: null });
    store.openMessage.value = null;
  });

  function deferred<T>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => { resolve = r; });
    return { promise, resolve };
  }

  test('only the last step requested opens, whatever order the replies come in', async () => {
    store.rows.value = five;
    store.openMessage.value = opened('r3');
    const down = deferred<never>();
    const up = deferred<never>();
    vi.mocked(api.message).mockImplementationOnce(() => down.promise).mockImplementationOnce(() => up.promise);
    const first = store.stepMsg(1);
    const second = store.stepMsg(-1);
    up.resolve({ MID: 'r2' } as never);
    await second;
    down.resolve({ MID: 'r4' } as never);
    await first;
    expect(store.openMessage.value).toMatchObject({ MID: 'r2' });
    store.openMessage.value = null;
  });

  test('a reply that arrives after Back or a view change does not reopen the message', async () => {
    store.rows.value = five;
    store.openMessage.value = opened('r3');
    const late = deferred<never>();
    vi.mocked(api.message).mockImplementationOnce(() => late.promise);
    const step = store.stepMsg(1);
    store.closeMsg();
    late.resolve({ MID: 'r4' } as never);
    await step;
    expect(store.openMessage.value).toBeNull();

    store.openMessage.value = opened('r3');
    const late2 = deferred<never>();
    vi.mocked(api.message).mockImplementationOnce(() => late2.promise);
    const step2 = store.stepMsg(1);
    const switched = store.setView({ kind: 'folder', name: 'sent' });
    late2.resolve({ MID: 'r4' } as never);
    await Promise.all([step2, switched]);
    expect(store.openMessage.value).toBeNull();
    expect(api.setRead).not.toHaveBeenCalled();
    store.view.value = { kind: 'folder', name: 'in' };
  });
});

describe('back from a message opened with Enter', () => {
  const rowsAB = [{ MID: 'a', Folder: 'in', Unread: false }, { MID: 'b', Folder: 'in', Unread: false }] as never;
  beforeEach(() => {
    store.view.value = { kind: 'folder', name: 'in' };
    store.rows.value = rowsAB;
    store.selected.value = new Set(['a']);
    store.returnFocus.value = null;
    vi.mocked(api.message).mockImplementation(async (_f: string, mid: string) => ({ MID: mid }) as never);
  });
  afterEach(() => { vi.mocked(api.message).mockReset(); store.openMessage.value = null; store.selected.value = new Set(); });

  test('back from the same message keeps the tick and focuses its row', async () => {
    await store.openSelected();
    expect(store.openMessage.value).toMatchObject({ MID: 'a', Folder: 'in' });
    store.closeMsg();
    expect([...store.selected.value]).toEqual(['a']);
    expect(store.returnFocus.value).toEqual({ Folder: 'in', MID: 'a' });
  });

  test('back after stepping away clears the tick and focuses the message last shown', async () => {
    await store.openSelected();
    await store.stepMsg(1);
    store.closeMsg();
    expect(store.selected.value.size).toBe(0);
    expect(store.returnFocus.value).toEqual({ Folder: 'in', MID: 'b' });
  });

  test('stepping back to the original before leaving keeps the tick', async () => {
    await store.openSelected();
    await store.stepMsg(1);
    await store.stepMsg(-1);
    store.closeMsg();
    expect([...store.selected.value]).toEqual(['a']);
  });

  test('archiving the message Enter opened focuses the row beside it', async () => {
    await store.openSelected();
    await store.applyBulkTo(['a'], 'move', 'archive');
    expect(store.openMessage.value).toBeNull();
    expect(store.returnFocus.value).toEqual({ Folder: 'in', MID: 'b' });
  });

  test('a step still in flight does not reopen a message archived meanwhile', async () => {
    await store.openSelected();
    let resolve!: (m: never) => void;
    vi.mocked(api.message).mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const step = store.stepMsg(1);
    await store.applyBulkTo(['a'], 'move', 'archive');
    resolve({ MID: 'b' } as never);
    await step;
    expect(store.openMessage.value).toBeNull();
  });

  test('a message opened by clicking its row leaves ticks and focus alone', async () => {
    await store.openSelected();
    store.closeMsg();
    store.returnFocus.value = null;
    await store.openMsg('in', 'b');
    store.closeMsg();
    expect([...store.selected.value]).toEqual(['a']);
    expect(store.returnFocus.value).toBeNull();
  });
});
