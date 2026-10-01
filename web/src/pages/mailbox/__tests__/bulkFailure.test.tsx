vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  remove: vi.fn(async () => ({ ok: ['a'], failed: { b: 'locked' } })),
  list: vi.fn(),
  folders: vi.fn(async () => []),
  labels: vi.fn(async () => []),
}));
import { render, screen, act } from '@testing-library/preact';
import * as api from '../../../lib/api';
import * as store from '../store';
import { MessageList } from '../MessageList';
import { Toasts } from '../../../ui/Toast';
import type { Row } from '../../../lib/types';

const row = (mid: string): Row => ({
  MID: mid, Folder: 'in', From: 'EOC-1', To: 'N0CALL', Cc: '', Subject: `Subject ${mid}`, Date: '2026-09-30T15:31:00Z',
  Size: 1, Attachments: 0, Unread: false, P2POnly: false, Starred: false, Labels: [],
});

test('a partial delete keeps the failure selected, says so, and drops the deleted row', async () => {
  store.view.value = { kind: 'folder', name: 'in' };
  store.rows.value = [row('a'), row('b')];
  store.selected.value = new Set(['a', 'b']);
  vi.mocked(api.list).mockResolvedValue([row('b')]);
  render(<><MessageList /><Toasts /></>);
  await act(async () => { await store.applyBulk('delete'); });
  expect([...store.selected.value]).toEqual(['b']);
  expect(screen.getByRole('alert')).toHaveTextContent('1 of 2 failed');
  expect(screen.getByRole('alert')).toHaveTextContent('locked');
  expect(screen.queryByText('Subject a')).toBeNull();
  expect(screen.getByText('Subject b')).toBeInTheDocument();
});
