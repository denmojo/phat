vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  move: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  setLabels: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  star: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  setRead: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  message: vi.fn(async () => null),
  remove: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  list: vi.fn(async () => []),
  folders: vi.fn(async () => []),
  labels: vi.fn(async () => []),
}));
import { render, screen, fireEvent, waitFor, within } from '@testing-library/preact';
import * as api from '../../../lib/api';
import * as store from '../store';
import { MessagePane } from '../MessagePane';

const msg = {
  MID: 'm1', Folder: 'in', From: { Addr: 'EOC-1' }, To: [{ Addr: 'N0CALL' }], Cc: null, Subject: 'Shelter status',
  Date: '2026-09-30T15:31:00Z', Size: 1, Unread: false, P2POnly: false, Starred: false, Labels: ['net'],
  Body: 'All good.', BodyHTML: '', Files: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  store.view.value = { kind: 'folder', name: 'in' };
  store.labels.value = [{ name: 'net', color: '#2563eb', count: 1 }, { name: 'urgent', color: '#dc2626', count: 0 }];
  store.folders.value = [{ name: 'in', system: true, count: 1, unread: 0 }, { name: 'Club', system: false, count: 0, unread: 0 }];
  store.openMessage.value = msg as never;
  store.selected.value = new Set(['other']);
});

test('shows subject, sender and label chips', () => {
  render(<MessagePane />);
  expect(screen.getByRole('heading', { name: /Shelter status/ })).toBeInTheDocument();
  expect(screen.getByText('EOC-1')).toBeInTheDocument();
  expect(screen.getByText('net')).toBeInTheDocument();
});

test('Archive moves this message, not the selection, and closes it', async () => {
  render(<MessagePane />);
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
  await waitFor(() => expect(api.move).toHaveBeenCalledWith(['m1'], 'archive'));
  await waitFor(() => expect(store.openMessage.value).toBeNull());
});

test('the label menu acts on this message', async () => {
  render(<MessagePane />);
  fireEvent.click(screen.getByRole('button', { name: 'Label' }));
  const net = screen.getByRole('menuitemcheckbox', { name: 'net' });
  expect(net).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'urgent' }));
  await waitFor(() => expect(api.setLabels).toHaveBeenCalledWith(['m1'], ['urgent'], []));
});

test('Back closes the message', () => {
  render(<MessagePane />);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(store.openMessage.value).toBeNull();
});

test('the body renders the server-sanitized HTML, with P2P only and Cc in the headers', () => {
  store.openMessage.value = { ...msg, P2POnly: true, Cc: [{ Addr: 'N5CALL' }], BodyHTML: '<p>All <blockquote>quoted</blockquote></p>' } as never;
  render(<MessagePane />);
  expect(document.querySelector('.msg .body blockquote')).toHaveTextContent('quoted');
  expect(screen.getByText('P2P only')).toBeInTheDocument();
  expect(screen.getByText(/Cc N5CALL/)).toBeInTheDocument();
});

test('opening an unread message marks it read', async () => {
  (api.message as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...msg, Unread: true });
  store.rows.value = [{ MID: 'm1', Unread: true } as never];
  await store.openMsg('in', 'm1');
  expect(api.setRead).toHaveBeenCalledWith(['m1'], true);
});

test('a form attachment is a button that opens the rendered form; images preview inline', () => {
  store.openMessage.value = { ...msg, Files: [
    { Name: 'RMS_Express_Form_ICS213_Initial_Viewer.xml', Size: 900 },
    { Name: 'map.jpg', Size: 2048 },
    { Name: 'log.txt', Size: 10 },
  ] } as never;
  render(<MessagePane />);
  const form = screen.getByRole('button', { name: /ICS213 Initial Viewer/ });
  expect(form.getAttribute('href')).toMatch(/rendertohtml=true$/);
  expect(document.querySelector('img[alt="map.jpg"]')?.getAttribute('src')).toBe('/api/mailbox/in/m1/map.jpg');
  expect(screen.getByRole('link', { name: /log\.txt/ }).getAttribute('href')).toBe('/api/mailbox/in/m1/log.txt');
});

test('Reply opens the composer addressed to the sender', () => {
  render(<MessagePane />);
  fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
  expect(store.composerOpen.value).toBe(true);
  expect(store.draft.value.to).toEqual(['EOC-1']);
  store.composerOpen.value = false;
});

test('Delete asks first, and only Delete in the dialog deletes', async () => {
  render(<MessagePane />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  const dialog = screen.getByRole('dialog');
  expect(api.remove).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(api.remove).toHaveBeenCalledWith(['m1']));
});

test('in the archive, Archive becomes Move to Inbox', async () => {
  store.openMessage.value = { ...msg, Folder: 'archive' } as never;
  render(<MessagePane />);
  expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Move to Inbox' }));
  await waitFor(() => expect(api.move).toHaveBeenCalledWith(['m1'], 'in'));
});
