vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  disconnect: vi.fn(async () => '{}'),
}));
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import * as api from '../../../lib/api';
import * as store from '../store';
import { Topbar } from '../Toolbar';
import type { Status } from '../../../lib/types';

const st = (extra: Partial<Status> = {}) =>
  ({ active_listeners: [], connected: false, dialing: false, remote_addr: '', http_clients: [], config_hash: 'x', ...extra } as Status);

beforeEach(() => {
  vi.clearAllMocks();
  store.wsUp.value = true;
  store.connectOpen.value = false;
});

test('idle: Ready, or the listeners, and Connect opens the dialog', () => {
  store.status.value = st({ active_listeners: ['telnet', 'ardop'] });
  render(<Topbar />);
  expect(screen.getByText('Listening telnet, ardop')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  expect(store.connectOpen.value).toBe(true);
});

test('dialing: Abort disconnects, and a second press forces it', async () => {
  store.status.value = st({ dialing: true });
  render(<Topbar />);
  expect(screen.getByText('Dialing…')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Abort' }));
  await waitFor(() => expect(api.disconnect).toHaveBeenCalledWith(false));
  fireEvent.click(await screen.findByRole('button', { name: 'Force disconnect' }));
  await waitFor(() => expect(api.disconnect).toHaveBeenLastCalledWith(true));
});

test('connected: shows the remote and offers Disconnect', async () => {
  store.status.value = st({ connected: true, remote_addr: 'W6EOC' });
  render(<Topbar />);
  expect(screen.getByText('Connected W6EOC')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
  await waitFor(() => expect(api.disconnect).toHaveBeenCalledWith(false));
});

test('the force option resets once the session ends', async () => {
  store.status.value = st({ connected: true, remote_addr: 'W6EOC' });
  render(<Topbar />);
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
  await screen.findByRole('button', { name: 'Force disconnect' });
  store.status.value = st();
  expect(await screen.findByRole('button', { name: 'Connect' })).toBeInTheDocument();
  store.status.value = st({ connected: true, remote_addr: 'W6EOC' });
  expect(await screen.findByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
});

test('the session button keeps its name when narrow screens hide the text', async () => {
  store.status.value = st();
  const { rerender } = render(<Topbar />);
  expect(screen.getByRole('button', { name: 'Connect' })).toHaveAttribute('aria-label', 'Connect');
  store.status.value = st({ dialing: true });
  rerender(<Topbar />);
  const abort = screen.getByRole('button', { name: 'Abort' });
  expect(abort).toHaveAttribute('aria-label', 'Abort');
  fireEvent.click(abort);
  expect(await screen.findByRole('button', { name: 'Force disconnect' })).toHaveAttribute('aria-label', 'Force disconnect');
});
