vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  list: vi.fn(async () => []),
  folders: vi.fn(async () => []),
  labels: vi.fn(async () => []),
  message: vi.fn(async () => ({ MID: 'm1' })),
  setRead: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
}));
import { render, screen, fireEvent, act } from '@testing-library/preact';
import * as api from '../../../lib/api';
import * as store from '../store';
import { MessageList } from '../MessageList';
import type { Row } from '../../../lib/types';

const row = (mid: string): Row => ({
  MID: mid, Folder: 'in', From: 'EOC-1', To: 'N0CALL', Cc: '', Subject: `Subject ${mid}`, Date: '2026-09-30T15:31:00Z',
  Size: 1, Attachments: 0, Unread: false, P2POnly: false, Starred: false, Labels: [],
});
function phone(matches: boolean) {
  window.matchMedia = ((q: string) => ({ matches, media: q, addEventListener() {}, removeEventListener() {} })) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  phone(true);
  store.view.value = { kind: 'folder', name: 'in' };
  store.selected.value = new Set();
  store.rows.value = [row('m1'), row('m2'), row('m3')];
});
afterEach(() => vi.useRealTimers());

test('a long press selects the row and the click that follows does not open it', () => {
  render(<MessageList />);
  const r = screen.getAllByRole('row')[1]!;
  fireEvent.pointerDown(r, { pointerId: 1, clientX: 10, clientY: 10 });
  act(() => { vi.advanceTimersByTime(500); });
  expect([...store.selected.value]).toEqual(['m2']);
  fireEvent.pointerUp(r, { pointerId: 1 });
  fireEvent.click(r);
  expect(api.message).not.toHaveBeenCalled();
  expect([...store.selected.value]).toEqual(['m2']);
});

test('a short tap opens the message', () => {
  render(<MessageList />);
  const r = screen.getAllByRole('row')[0]!;
  fireEvent.pointerDown(r, { pointerId: 1, clientX: 10, clientY: 10 });
  act(() => { vi.advanceTimersByTime(200); });
  fireEvent.pointerUp(r, { pointerId: 1 });
  fireEvent.click(r);
  expect(api.message).toHaveBeenCalledWith('in', 'm1');
  expect(store.selected.value.size).toBe(0);
});

test('a press that moves (a scroll) selects nothing', () => {
  render(<MessageList />);
  const r = screen.getAllByRole('row')[0]!;
  fireEvent.pointerDown(r, { pointerId: 1, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(r, { pointerId: 1, clientX: 10, clientY: 40 });
  act(() => { vi.advanceTimersByTime(600); });
  expect(store.selected.value.size).toBe(0);
});

test('on a phone, while anything is selected, a tap toggles instead of opening', () => {
  store.selected.value = new Set(['m1']);
  render(<MessageList />);
  fireEvent.click(screen.getAllByRole('row')[2]!);
  expect([...store.selected.value].sort()).toEqual(['m1', 'm3']);
  fireEvent.click(screen.getAllByRole('row')[0]!);
  expect([...store.selected.value]).toEqual(['m3']);
  expect(api.message).not.toHaveBeenCalled();
});

test('on a desktop a click with a selection still opens the message', () => {
  phone(false);
  store.selected.value = new Set(['m1']);
  render(<MessageList />);
  fireEvent.click(screen.getAllByRole('row')[2]!);
  expect(api.message).toHaveBeenCalledWith('in', 'm3');
});
