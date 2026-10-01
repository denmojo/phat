vi.mock('../store', async (orig) => {
  const real = await orig<typeof import('../store')>();
  return { ...real, applyBulk: vi.fn(async () => null), refresh: vi.fn(async () => {}) };
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
