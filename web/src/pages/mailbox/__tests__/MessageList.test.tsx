vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  list: vi.fn(async () => []),
  folders: vi.fn(async () => []),
  labels: vi.fn(async () => []),
  star: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  message: vi.fn(async () => ({ MID: 'm1' })),
  setRead: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  setLabels: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
}));
import { render, screen, fireEvent } from '@testing-library/preact';
import * as api from '../../../lib/api';
import * as store from '../store';
import { MessageList } from '../MessageList';
import type { Row } from '../../../lib/types';

const row = (mid: string, extra: Partial<Row> = {}): Row => ({
  MID: mid, Folder: 'in', From: 'EOC-1', To: 'N0CALL', Cc: '', Subject: `Subject ${mid}`, Date: '2026-09-30T15:31:00Z',
  Size: 100, Attachments: 0, Unread: false, P2POnly: false, Starred: false, Labels: [], ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  store.view.value = { kind: 'folder', name: 'in' };
  store.selected.value = new Set();
  store.openMessage.value = null;
  store.labels.value = [{ name: 'net', color: '#2563eb', count: 1 }];
  store.rows.value = [row('m1', { Unread: true, Labels: ['net'], Attachments: 2 }), row('m2'), row('m3'), row('m4')];
});

test('renders rows; unread rows are marked; labels and attachments show', () => {
  render(<MessageList />);
  const rows = screen.getAllByRole('row');
  expect(rows).toHaveLength(4);
  expect(rows[0]).toHaveClass('unread');
  expect(rows[1]).not.toHaveClass('unread');
  expect(rows[0]).toHaveTextContent('net');
  expect(rows[0]!.querySelector('[aria-label="2 attachments"]')).not.toBeNull();
});

test('shows To in the outbox and sent views', () => {
  store.view.value = { kind: 'folder', name: 'sent' };
  store.rows.value = [row('s1', { Folder: 'sent' })];
  render(<MessageList />);
  expect(screen.getAllByRole('row')[0]).toHaveTextContent('N0CALL');
});

test('Shift-click selects a range from the last checked row', () => {
  render(<MessageList />);
  const boxes = screen.getAllByRole('checkbox');
  fireEvent.click(boxes[0]!);
  fireEvent.click(boxes[2]!, { shiftKey: true });
  expect([...store.selected.value].sort()).toEqual(['m1', 'm2', 'm3']);
});

test('the star toggles without opening the message', () => {
  render(<MessageList />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Star' })[1]!);
  expect(api.star).toHaveBeenCalledWith(['m2'], true);
  expect(api.message).not.toHaveBeenCalled();
});

test('clicking a row opens the message', () => {
  render(<MessageList />);
  fireEvent.click(screen.getByText('Subject m1'));
  expect(api.message).toHaveBeenCalledWith('in', 'm1');
});

test('an empty view says so', () => {
  store.rows.value = [];
  render(<MessageList />);
  expect(screen.getByText('No messages')).toBeInTheDocument();
});

test('a label chip carries an x that removes that label from that row only, without opening it', async () => {
  render(<MessageList />);
  const x = screen.getByRole('button', { name: 'Remove label net' });
  fireEvent.pointerDown(x);
  fireEvent.click(x);
  await vi.waitFor(() => expect(api.setLabels).toHaveBeenCalledWith(['m1'], [], ['net']));
  expect(api.message).not.toHaveBeenCalled();
  expect(store.selected.value.size).toBe(0);
});

test('coming back to the list puts focus on the checkbox of the row named to return to', () => {
  store.returnFocus.value = { Folder: 'in', MID: 'm2' };
  render(<MessageList />);
  expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'Select Subject m2' }));
  expect(store.returnFocus.value).toBeNull();
});
