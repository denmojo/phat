vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  list: vi.fn(async () => []),
}));
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
