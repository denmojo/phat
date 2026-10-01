vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  putRecoveryEmail: vi.fn(async () => ''),
}));
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import * as api from '../../../lib/api';
import * as store from '../store';
import { StatusPopover, severity } from '../StatusPopover';
import type { Status } from '../../../lib/types';

const st = (extra: Partial<Status> = {}) =>
  ({ active_listeners: [], connected: false, dialing: false, remote_addr: '', http_clients: ['a', 'b'], config_hash: 'x', ...extra } as Status);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  store.mycall.value = 'N0CALL';
  store.wsUp.value = true;
  store.status.value = st();
  store.notifyState.value = 'granted';
  store.geoError.value = null;
  store.recoveryWarning.value = false;
});

test('with nothing wrong the light is green and the panel says so, with the client count', () => {
  expect(severity()).toBe('ok');
  render(<StatusPopover />);
  fireEvent.click(screen.getByRole('button', { name: /Status/ }));
  expect(screen.getByText('No issues')).toBeInTheDocument();
  expect(screen.getByText('2 clients connected.')).toBeInTheDocument();
});

test('the light follows the worst issue: info, then warning, then danger', () => {
  store.notifyState.value = 'denied';
  expect(severity()).toBe('info');
  store.recoveryWarning.value = true;
  expect(severity()).toBe('warning');
  store.wsUp.value = false;
  expect(severity()).toBe('danger');
});

test('issues list worst first', async () => {
  store.wsUp.value = false;
  store.notifyState.value = 'unsupported';
  store.geoError.value = 'User denied Geolocation';
  store.recoveryWarning.value = true;
  render(<StatusPopover />);
  // A missing recovery email opens the panel by itself.
  await screen.findByRole('dialog', { name: 'Status' });
  const heads = [...document.querySelectorAll('.sp-section h3')].map((h) => h.textContent);
  expect(heads).toEqual(['Websocket', 'Secure your account', 'Desktop notifications', 'Geolocation']);
  expect(screen.getByText('Not supported by this browser.')).toBeInTheDocument();
  expect(screen.getByText('User denied Geolocation')).toBeInTheDocument();
});

test('Later hides the recovery warning and remembers it for this callsign', async () => {
  store.recoveryWarning.value = true;
  render(<StatusPopover />);
  fireEvent.click(await screen.findByRole('button', { name: 'Later' }));
  expect(store.recoveryWarning.value).toBe(false);
  expect(Number(localStorage.getItem('passwordRecoveryDismissed_N0CALL'))).toBeGreaterThan(Date.now());
});

test('Add email submits the recovery address and clears the warning', async () => {
  store.recoveryWarning.value = true;
  render(<StatusPopover />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add email' }));
  fireEvent.input(screen.getByLabelText('Recovery email'), { target: { value: 'op@example.invalid' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(api.putRecoveryEmail).toHaveBeenCalledWith('op@example.invalid'));
  await waitFor(() => expect(store.recoveryWarning.value).toBe(false));
});

test('an address typed the moment the recovery dialog opens is kept', async () => {
  store.recoveryWarning.value = true;
  render(<StatusPopover />);
  const add = await screen.findByRole('button', { name: 'Add email' });
  // Raw events, outside act, so effects run after the typing as in a browser.
  add.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
  const email = screen.getByLabelText('Recovery email') as HTMLInputElement;
  email.value = 'op@example.invalid';
  email.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));
  expect(email.value).toBe('op@example.invalid');
});
