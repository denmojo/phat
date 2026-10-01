vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  move: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  setLabels: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  star: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  setRead: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  message: vi.fn(),
  list: vi.fn(async () => []),
  folders: vi.fn(async () => []),
  labels: vi.fn(async () => []),
}));
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import * as api from '../../../lib/api';
import * as store from '../store';
import { MessagePane } from '../MessagePane';

const msg = {
  MID: 'm1', Folder: 'in', From: { Addr: 'W6EOC' }, To: [{ Addr: 'N0CALL' }], Cc: null, Subject: 'Shelter status',
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
  expect(screen.getByText('W6EOC')).toBeInTheDocument();
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
