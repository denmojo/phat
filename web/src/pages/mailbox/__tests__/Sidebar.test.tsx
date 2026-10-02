vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  list: vi.fn(async () => []),
  folders: vi.fn(async () => []),
  labels: vi.fn(async () => []),
  deleteFolder: vi.fn(),
}));
import { waitFor } from '@testing-library/preact';
import * as api from '../../../lib/api';
import { ApiError } from '../../../lib/api';
import { render, screen, fireEvent, within } from '@testing-library/preact';
import * as store from '../store';
import { Sidebar } from '../Sidebar';

beforeEach(() => {
  store.folders.value = [
    { name: 'Club', system: false, count: 2, unread: 1 },
    { name: 'archive', system: true, count: 5, unread: 0 },
    { name: 'in', system: true, count: 9, unread: 3 },
    { name: 'out', system: true, count: 2, unread: 0 },
    { name: 'sent', system: true, count: 4, unread: 0 },
  ];
  store.labels.value = [{ name: 'Radio Club/ARES', color: '#2563eb', count: 1 }];
  store.view.value = { kind: 'folder', name: 'in' };
});

test('system folders first, then custom folders, then Starred, then labels', () => {
  render(<Sidebar />);
  const nav = screen.getByRole('navigation', { name: 'Mailbox' });
  const names = within(nav).getAllByRole('link').map((a) => a.querySelector('.name')?.textContent);
  expect(names).toEqual(['Inbox', 'Outbox', 'Sent', 'Archive', 'Starred', 'Club', 'Radio Club/ARES']);
});

test('hovering the name spells out the acronym with the initials in bold', () => {
  render(<Sidebar />);
  fireEvent.mouseEnter(screen.getByText('Phat').parentElement as HTMLElement);
  const tip = screen.getByRole('tooltip');
  expect(tip).toHaveTextContent('Polished Ham Airmail Tool');
  expect([...tip.querySelectorAll('b')].map((b) => b.textContent)).toEqual(['P', 'H', 'A', 'T']);
});

test('Inbox shows its unread count and is marked current', () => {
  render(<Sidebar />);
  const inbox = screen.getByRole('link', { name: /Inbox/ });
  expect(inbox).toHaveAttribute('aria-current', 'page');
  expect(inbox).toHaveTextContent('3');
});

test('clicking a label sets the label view with its raw name', () => {
  render(<Sidebar />);
  fireEvent.click(screen.getByRole('link', { name: /Radio Club\/ARES/ }));
  expect(store.view.value).toEqual({ kind: 'label', name: 'Radio Club/ARES' });
});

test('clicking a custom folder sets its folder view', () => {
  render(<Sidebar />);
  fireEvent.click(screen.getByRole('link', { name: /^Club/ }));
  expect(store.view.value).toEqual({ kind: 'folder', name: 'Club' });
});

test('the + beside Folders opens the inline editor', () => {
  render(<Sidebar />);
  fireEvent.click(screen.getByRole('button', { name: 'New folder' }));
  expect(screen.getByRole('textbox', { name: 'New folder name' })).toBeInTheDocument();
});

test('a custom folder offers Rename and Delete; a non-empty delete explains itself', async () => {
  vi.mocked(api.deleteFolder).mockRejectedValue(new ApiError(409, 'folder not empty'));
  render(<Sidebar />);
  expect(screen.queryByRole('button', { name: 'Folder actions for Inbox' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Folder actions for Club' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete folder Club?' })).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(screen.getByText(/still holds messages/)).toBeInTheDocument());
  expect(api.deleteFolder).toHaveBeenCalledWith('Club');
});

test('right-click on a custom folder opens its menu', () => {
  render(<Sidebar />);
  fireEvent.contextMenu(screen.getByRole('link', { name: /^Club/ }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
  expect(screen.getByRole('textbox', { name: 'Rename folder Club' })).toBeInTheDocument();
});

test('a label offers Edit and Delete', () => {
  render(<Sidebar />);
  fireEvent.click(screen.getByRole('button', { name: 'Label actions for Radio Club/ARES' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
  expect(screen.getByRole('dialog', { name: 'Edit label' })).toBeInTheDocument();
});

test('Escape closes the label dialog', async () => {
  render(<Sidebar />);
  fireEvent.click(screen.getByRole('button', { name: 'Label actions for Radio Club/ARES' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
  const input = screen.getByRole('textbox', { name: 'Name' });
  fireEvent.keyDown(input, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
