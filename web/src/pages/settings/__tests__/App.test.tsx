vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  config: vi.fn(),
  saveConfig: vi.fn(async () => ''),
  reload: vi.fn(async () => ''),
  status: vi.fn(async () => ({})),
  registration: vi.fn(async () => ({ exists: true })),
  register: vi.fn(async () => ''),
  gpsPosition: vi.fn(async () => { throw new Error('no gps'); }),
  coordsToLocator: vi.fn(async () => ({ locator: 'FN31pr' })),
}));
import { render, screen, fireEvent, waitFor, within } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import * as api from '../../../lib/api';
import { App } from '../App';

const mock = (f: unknown) => f as ReturnType<typeof vi.fn>;
const base = () => ({
  mycall: 'N0CALL', secure_login_password: '', auxiliary_addresses: null, locator: 'FN31', auto_download_size_limit: -1,
  ui: { appearance: '' }, connect_aliases: null, listen: ['telnet'], hamlib_rigs: { ic7300: { network: 'tcp', address: 'localhost:4532', VFO: '' } },
  ax25: { engine: 'agwpe', rig: '', beacon: { every: 0, message: '', destination: '' } }, ax25_linux: { port: 'wl2k' },
  agwpe: { addr: 'localhost:8000', radio_port: 0 }, 'serial-tnc': { path: '', serial_baud: 9600, hbaud: 1200, type: '' },
  ardop: { addr: '', arq_bandwidth: { Forced: false, Max: 0 }, connect_requests: 10, rig: '', ptt_ctrl: false, beacon_interval: 0, cwid_enabled: false },
  pactor: { path: '', baudrate: 57600, rig: '', custom_init_script: '' }, telnet: { listen_addr: ':8774', password: '' },
  varahf: { addr: 'localhost:8300', rig: '', ptt_ctrl: false }, varafm: { addr: 'localhost:8300', rig: '', ptt_ctrl: false },
  gpsd: { enable_http: false, allow_forms: false, use_server_time: false, update_locator: false, addr: 'localhost:2947' },
  schedule: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  mock(api.config).mockResolvedValue(base());
  history.replaceState(null, '', '/ui/config');
});

test('Save writes only what changed, then offers a restart that waits for the server', async () => {
  render(<App />);
  const loc = await screen.findByLabelText(/Maidenhead locator/);
  expect((loc as HTMLInputElement).value).toBe('FN31');
  fireEvent.input(loc, { target: { value: 'FN31pr' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.saveConfig).toHaveBeenCalledWith({ ...base(), locator: 'FN31pr' }));
  const dlg = await screen.findByRole('dialog', { name: 'Restart required' });
  mock(api.status).mockRejectedValueOnce(new Error('down')).mockResolvedValue({});
  fireEvent.click(within(dlg).getByRole('button', { name: 'Restart now' }));
  await waitFor(() => expect(api.reload).toHaveBeenCalled());
  expect(await within(dlg).findByText('Restart successful.', {}, { timeout: 3000 })).toBeInTheDocument();
});

test('a blank callsign blocks the save', async () => {
  render(<App />);
  const call = await screen.findByLabelText(/Callsign/);
  fireEvent.input(call, { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Enter your callsign.')).toBeInTheDocument();
  expect(api.saveConfig).not.toHaveBeenCalled();
});

test('the transports pick from the rigs defined under rig control', async () => {
  render(<App />);
  await screen.findByLabelText(/Callsign/);
  const ardop = screen.getByText('ARDOP').closest('details')!;
  const rig = within(ardop).getByLabelText('Rig') as HTMLSelectElement;
  expect(within(rig).getAllByRole('option').map((o) => o.textContent)).toEqual(['None', 'ic7300']);
});

test('a callsign with no Winlink account offers to create one', async () => {
  mock(api.registration).mockResolvedValue({ exists: false });
  render(<App />);
  expect(await screen.findByText(/No Winlink account for N0CALL/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Create one' }));
  expect(await screen.findByRole('dialog', { name: 'Create Winlink account' })).toBeInTheDocument();
});

test('?action=create-account opens the account dialog', async () => {
  history.replaceState(null, '', '/ui/config?action=create-account');
  render(<App />);
  expect(await screen.findByRole('dialog', { name: 'Create Winlink account' })).toBeInTheDocument();
});

test('creating an account walks callsign, password, email and consent, then fills the password', async () => {
  history.replaceState(null, '', '/ui/config?action=create-account');
  render(<App />);
  const dlg = await screen.findByRole('dialog', { name: 'Create Winlink account' });
  expect((within(dlg).getByLabelText('Callsign') as HTMLInputElement).value).toBe('N0CALL');
  fireEvent.click(within(dlg).getByRole('button', { name: 'Next' }));
  const next = () => within(dlg).getByRole('button', { name: 'Next' });
  fireEvent.input(within(dlg).getByLabelText('Password'), { target: { value: 'abc' } });
  expect(next()).toBeDisabled();
  fireEvent.input(within(dlg).getByLabelText('Password'), { target: { value: 'abcdef' } });
  fireEvent.input(within(dlg).getByLabelText('Verify password'), { target: { value: 'abcdeg' } });
  expect(next()).toBeDisabled();
  fireEvent.input(within(dlg).getByLabelText('Verify password'), { target: { value: 'abcdef' } });
  fireEvent.click(next());
  fireEvent.input(within(dlg).getByLabelText('Recovery email'), { target: { value: 'nope' } });
  expect(next()).toBeDisabled();
  fireEvent.input(within(dlg).getByLabelText('Recovery email'), { target: { value: 'op@example.invalid' } });
  fireEvent.click(next());
  const create = within(dlg).getByRole('button', { name: 'Create account' });
  expect(create).toBeDisabled();
  fireEvent.click(within(dlg).getByRole('checkbox'));
  fireEvent.click(create);
  await waitFor(() => expect(api.register).toHaveBeenCalledWith({ callsign: 'N0CALL', password: 'abcdef', password_recovery_email: 'op@example.invalid' }));
  expect(await screen.findByText('Account N0CALL created.')).toBeInTheDocument();
  expect((screen.getByLabelText(/Secure login password/) as HTMLInputElement).value).toBe('abcdef');
});

test('a page restored from the back-forward cache reloads the config', async () => {
  render(<App />);
  await screen.findByLabelText(/Callsign/);
  mock(api.config).mockResolvedValue({ ...base(), locator: 'DM04' });
  const ev = new Event('pageshow') as Event & { persisted: boolean };
  Object.defineProperty(ev, 'persisted', { value: true });
  window.dispatchEvent(ev);
  await waitFor(() => expect((screen.getByLabelText(/Maidenhead locator/) as HTMLInputElement).value).toBe('DM04'));
});

test('a redacted password clears on focus and comes back if left empty', async () => {
  mock(api.config).mockResolvedValue({ ...base(), secure_login_password: '[REDACTED]' });
  render(<App />);
  const pw = await screen.findByLabelText(/Secure login password/) as HTMLInputElement;
  await waitFor(() => expect(pw.value).toBe('[REDACTED]'));
  act(() => pw.focus());
  expect(pw.value).toBe('');
  act(() => pw.blur());
  expect(pw.value).toBe('[REDACTED]');
});
