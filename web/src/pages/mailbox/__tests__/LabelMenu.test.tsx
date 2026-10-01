vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  setLabels: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  list: vi.fn(async () => []),
  folders: vi.fn(async () => []),
  labels: vi.fn(async () => []),
}));
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import * as api from '../../../lib/api';
import * as store from '../store';
import { LabelMenu } from '../LabelMenu';

beforeEach(() => {
  vi.clearAllMocks();
  store.labels.value = [{ name: 'net', color: '#2563eb', count: 1 }, { name: 'urgent', color: '#dc2626', count: 0 }];
});

function open(rows: { MID: string; Labels: string[] }[]) {
  store.rows.value = rows as never;
  store.selected.value = new Set(rows.map((r) => r.MID));
  render(<LabelMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'Label' }));
}

test('a label some selected rows carry is mixed, and clicking adds it to all', async () => {
  open([{ MID: 'a', Labels: ['net'] }, { MID: 'b', Labels: [] }]);
  const net = screen.getByRole('menuitemcheckbox', { name: 'net' });
  expect(net).toHaveAttribute('aria-checked', 'mixed');
  expect(screen.getByRole('menuitemcheckbox', { name: 'urgent' })).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(net);
  await waitFor(() => expect(api.setLabels).toHaveBeenCalledWith(['a', 'b'], ['net'], []));
});

test('a label every selected row carries is removed from all', async () => {
  open([{ MID: 'a', Labels: ['net'] }, { MID: 'b', Labels: ['net'] }]);
  const net = screen.getByRole('menuitemcheckbox', { name: 'net' });
  expect(net).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(net);
  await waitFor(() => expect(api.setLabels).toHaveBeenCalledWith(['a', 'b'], [], ['net']));
});

test('New label opens the label editor', () => {
  open([{ MID: 'a', Labels: [] }]);
  fireEvent.click(screen.getByRole('menuitem', { name: 'New label' }));
  expect(screen.getByRole('dialog', { name: 'New label' })).toBeInTheDocument();
});
