vi.mock('../store', async (orig) => {
  const real = await orig<typeof import('../store')>();
  return { ...real, applyBulk: vi.fn(async () => null), refresh: vi.fn(async () => {}), openMsg: vi.fn(async () => {}), openSelected: vi.fn(async () => {}) };
});
import { render, screen, fireEvent, within } from '@testing-library/preact';
import * as store from '../store';
import { Toolbar } from '../Toolbar';

beforeEach(() => {
  vi.clearAllMocks();
  store.view.value = { kind: 'folder', name: 'in' };
  store.rows.value = [{ MID: 'a' }, { MID: 'b' }, { MID: 'c' }] as never;
  store.folders.value = [{ name: 'in', system: true, count: 3, unread: 0 }, { name: 'Club', system: false, count: 0, unread: 0 }];
});

test('with nothing selected: select-all checkbox, title and refresh, no bulk actions', () => {
  store.selected.value = new Set();
  render(<Toolbar />);
  expect(screen.getByRole('checkbox', { name: 'Select all' })).not.toBeChecked();
  expect(screen.getByText('Inbox')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
});

test('with two selected: count and Archive, which moves to archive', () => {
  store.selected.value = new Set(['a', 'b']);
  render(<Toolbar />);
  expect(document.querySelector('.toolbar .sel')).toHaveTextContent('2 selected');
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
  expect(store.applyBulk).toHaveBeenCalledWith('move', 'archive');
});

test('the select-all checkbox selects every row, then clears', () => {
  store.selected.value = new Set();
  render(<Toolbar />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
  expect(store.selected.value.size).toBe(3);
});

test('Move to lists folders other than the current one', () => {
  store.selected.value = new Set(['a']);
  render(<Toolbar />);
  fireEvent.click(screen.getByRole('button', { name: 'Move to' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Club' }));
  expect(store.applyBulk).toHaveBeenCalledWith('move', 'Club');
  expect(screen.queryByRole('menuitem', { name: 'Inbox' })).toBeNull();
});

test('Delete asks first, since Phat keeps no trash', async () => {
  store.selected.value = new Set(['a', 'b']);
  render(<Toolbar />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(store.applyBulk).not.toHaveBeenCalled();
  const dlg = await screen.findByRole('dialog', { name: 'Delete 2 messages?' });
  fireEvent.click(within(dlg).getByRole('button', { name: 'Cancel' }));
  expect(store.applyBulk).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
  expect(store.applyBulk).toHaveBeenCalledWith('delete');
});

describe('list keys', () => {
  const key = (k: string) => fireEvent.keyDown(document.body, { key: k });
  afterEach(() => { store.composerOpen.value = false; });

  test('n starts a new message', () => {
    store.selected.value = new Set();
    render(<Toolbar />);
    key('n');
    expect(store.composerOpen.value).toBe(true);
  });

  test('t asks to delete the selection with Delete focused', () => {
    store.selected.value = new Set(['a', 'b']);
    render(<Toolbar />);
    key('t');
    const dialog = screen.getByRole('dialog', { name: 'Delete 2 messages?' });
    const del = within(dialog).getByRole('button', { name: 'Delete' });
    expect(document.activeElement).toBe(del);
    fireEvent.click(del);
    expect(store.applyBulk).toHaveBeenCalledWith('delete');
  });

  test('t with nothing selected does nothing', () => {
    store.selected.value = new Set();
    render(<Toolbar />);
    key('t');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Enter on the list', () => {
  const enter = () => fireEvent.keyDown(document.body, { key: 'Enter' });

  test('with one message ticked, Enter opens it', () => {
    store.rows.value = [{ MID: 'a', Folder: 'in' }, { MID: 'b', Folder: 'Club' }] as never;
    store.selected.value = new Set(['b']);
    render(<Toolbar />);
    enter();
    expect(store.openSelected).toHaveBeenCalled();
  });

  test('with two ticked, Enter does nothing', () => {
    store.selected.value = new Set(['a', 'b']);
    render(<Toolbar />);
    enter();
    expect(store.openSelected).not.toHaveBeenCalled();
  });
});

describe('selection keys', () => {
  const key = (k: string) => fireEvent.keyDown(document.body, { key: k });
  const tick = (...rows: { MID: string; Unread?: boolean; Starred?: boolean }[]) => {
    store.rows.value = rows.map((r) => ({ Folder: 'in', Unread: false, Starred: false, Labels: [], ...r })) as never;
    store.selected.value = new Set(rows.map((r) => r.MID));
  };

  test('a archives, and in the Archive folder moves to the Inbox', () => {
    tick({ MID: 'a' }, { MID: 'b' });
    const { unmount } = render(<Toolbar />);
    key('a');
    expect(store.applyBulk).toHaveBeenCalledWith('move', 'archive');
    unmount();
    vi.mocked(store.applyBulk).mockClear();
    store.view.value = { kind: 'folder', name: 'archive' };
    render(<Toolbar />);
    key('a');
    expect(store.applyBulk).toHaveBeenCalledWith('move', 'in');
  });

  test('u marks a mixed batch unread, and an all-unread batch read', () => {
    tick({ MID: 'a', Unread: true }, { MID: 'b' });
    const { unmount } = render(<Toolbar />);
    key('u');
    expect(store.applyBulk).toHaveBeenCalledWith('read', false);
    unmount();
    vi.mocked(store.applyBulk).mockClear();
    tick({ MID: 'a', Unread: true }, { MID: 'b', Unread: true });
    render(<Toolbar />);
    key('u');
    expect(store.applyBulk).toHaveBeenCalledWith('read', true);
  });

  test('s stars a mixed batch, and unstars an all-starred one', () => {
    tick({ MID: 'a', Starred: true }, { MID: 'b' });
    const { unmount } = render(<Toolbar />);
    key('s');
    expect(store.applyBulk).toHaveBeenCalledWith('star', true);
    unmount();
    vi.mocked(store.applyBulk).mockClear();
    tick({ MID: 'a', Starred: true }, { MID: 'b', Starred: true });
    render(<Toolbar />);
    key('s');
    expect(store.applyBulk).toHaveBeenCalledWith('star', false);
  });

  test('l opens the label menu and m the move menu', () => {
    store.labels.value = [{ name: 'net', color: '#2563eb', count: 1 }];
    tick({ MID: 'a' });
    render(<Toolbar />);
    key('l');
    expect(screen.getByRole('menuitemcheckbox', { name: 'net' })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    key('m');
    expect(screen.getByRole('menuitem', { name: 'Club' })).toBeInTheDocument();
  });

  test('with nothing ticked they do nothing', () => {
    store.selected.value = new Set();
    render(<Toolbar />);
    for (const k of ['a', 'u', 's', 'l', 'm']) key(k);
    expect(store.applyBulk).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
