vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  move: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  setLabels: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  star: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  list: vi.fn(async () => []),
  folders: vi.fn(async () => []),
  labels: vi.fn(async () => []),
}));
import * as api from '../../../lib/api';
import { selected } from '../store';
import { MIDS_TYPE, dropTarget, startDrag } from '../dnd';

function fakeDataTransfer() {
  const data = new Map<string, string>();
  return {
    get types() { return [...data.keys()]; },
    setData: (t: string, v: string) => { data.set(t, v); },
    getData: (t: string) => data.get(t) ?? '',
    setDragImage: vi.fn(),
    effectAllowed: 'all',
    dropEffect: 'none',
  };
}
const dropEvent = (mids: string[]) => {
  const dt = fakeDataTransfer();
  dt.setData(MIDS_TYPE, JSON.stringify(mids));
  return { preventDefault: vi.fn(), dataTransfer: dt, currentTarget: document.createElement('a') } as unknown as DragEvent;
};

beforeEach(() => vi.clearAllMocks());

test('dragging an unselected row moves only that row', () => {
  selected.value = new Set(['b', 'c', 'd']);
  const dt = fakeDataTransfer();
  startDrag({ dataTransfer: dt } as unknown as DragEvent, 'a');
  expect(JSON.parse(dt.getData(MIDS_TYPE))).toEqual(['a']);
  expect(dt.setDragImage).toHaveBeenCalled();
});

test('dragging a selected row moves the selection', () => {
  selected.value = new Set(['b', 'c']);
  const dt = fakeDataTransfer();
  startDrag({ dataTransfer: dt } as unknown as DragEvent, 'b');
  expect(JSON.parse(dt.getData(MIDS_TYPE)).sort()).toEqual(['b', 'c']);
});

test('drop on a folder moves, on a label labels, on Starred stars', async () => {
  await dropTarget('folder', 'Club').onDrop(dropEvent(['a', 'b']));
  expect(api.move).toHaveBeenCalledWith(['a', 'b'], 'Club');
  await dropTarget('label', 'net').onDrop(dropEvent(['a']));
  expect(api.setLabels).toHaveBeenCalledWith(['a'], ['net'], []);
  await dropTarget('starred').onDrop(dropEvent(['b']));
  expect(api.star).toHaveBeenCalledWith(['b'], true);
});

test('only a message drag is accepted; other drags fall through', () => {
  const t = dropTarget('folder', 'Club');
  const files = { preventDefault: vi.fn(), dataTransfer: { types: ['Files'] }, currentTarget: document.createElement('a') } as unknown as DragEvent;
  t.onDragOver(files);
  expect(files.preventDefault).not.toHaveBeenCalled();
  const ours = dropEvent(['a']);
  t.onDragOver(ours);
  expect(ours.preventDefault).toHaveBeenCalled();
});

test('a drop with a broken payload does nothing', async () => {
  const dt = fakeDataTransfer();
  dt.setData(MIDS_TYPE, 'not json');
  await dropTarget('folder', 'Club').onDrop({ preventDefault() {}, dataTransfer: dt, currentTarget: document.createElement('a') } as unknown as DragEvent);
  expect(api.move).not.toHaveBeenCalled();
});

// A browser cancels the drop when a target's dropEffect isn't among the
// drag's effectAllowed.
test('every target asks for an effect the drag allows', () => {
  selected.value = new Set();
  const dt = fakeDataTransfer();
  startDrag({ dataTransfer: dt } as unknown as DragEvent, 'a');
  const allowed: Record<string, string[]> = {
    move: ['move'], copy: ['copy'], link: ['link'], copyMove: ['copy', 'move'], copyLink: ['copy', 'link'],
    linkMove: ['link', 'move'], all: ['copy', 'link', 'move'],
  };
  for (const [kind, name] of [['folder', 'Club'], ['label', 'net'], ['starred', undefined]] as const) {
    const e = { preventDefault() {}, dataTransfer: dt, currentTarget: document.createElement('a') } as unknown as DragEvent;
    dropTarget(kind, name).onDragOver(e);
    expect(allowed[dt.effectAllowed]).toContain(dt.dropEffect);
  }
});
