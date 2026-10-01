vi.mock('../../../lib/api', async (orig) => {
  const real = await orig<typeof import('../../../lib/api')>();
  return {
    ...real,
    bandwidths: vi.fn(async (mode: string) => (mode === 'ardop'
      ? { mode, bandwidths: ['500MAX', '2000MAX'], default: '500MAX' }
      : { mode, bandwidths: [] })),
    qsy: vi.fn(async () => ''),
    connect: vi.fn(async () => ({ NumReceived: 0 })),
    connectAliases: vi.fn(async () => ({ home: 'telnet://N0CALL:pw@cms.example.invalid:8772/wl2k' })),
    putAlias: vi.fn(async () => ''),
    deleteAlias: vi.fn(async () => ''),
    config: vi.fn(async () => ({ ardop: { connect_requests: 10 } })),
    rmslist: vi.fn(async () => []),
  };
});
vi.mock('../../../ui/Toast', async (orig) => ({ ...(await orig<typeof import('../../../ui/Toast')>()), toast: vi.fn() }));
import { render, screen, fireEvent, waitFor, within } from '@testing-library/preact';
import * as api from '../../../lib/api';
import { change, commit } from '../../../test/events';
import * as store from '../store';
import { ConnectDialog } from '../ConnectDialog';
import { toast } from '../../../ui/Toast';

const urlField = () => screen.getByLabelText('Connect URL') as HTMLInputElement;
const mock = (f: unknown) => f as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  store.mycall.value = 'N0CALL';
  store.connectOpen.value = true;
});

test('opens on the last URL used and shows only the fields its transport uses', async () => {
  localStorage.setItem('pat_connect_url_N0CALL', 'telnet://N0CALL:pw@cms.example.invalid:8772/wl2k');
  render(<ConnectDialog />);
  expect((screen.getByLabelText('Transport') as HTMLSelectElement).value).toBe('telnet');
  expect((screen.getByLabelText('Address') as HTMLInputElement).value).toBe('N0CALL:pw@cms.example.invalid:8772');
  expect((screen.getByLabelText('Target') as HTMLInputElement).value).toBe('wl2k');
  expect(screen.queryByLabelText('Frequency')).toBeNull();
  expect(screen.queryByLabelText('Tries')).toBeNull();
  expect(urlField().value).toBe('telnet://N0CALL:pw@cms.example.invalid:8772/wl2k');
});

test('switching to ARDOP clears the address, shows frequency in kHz, tries and bandwidth', async () => {
  localStorage.setItem('pat_connect_url_N0CALL', 'telnet://N0CALL:pw@cms.example.invalid:8772/wl2k');
  render(<ConnectDialog />);
  change(screen.getByLabelText('Transport'), 'ardop');
  expect(screen.queryByLabelText('Address')).toBeNull();
  expect(screen.getByLabelText('Frequency')).toBeInTheDocument();
  expect(screen.getByText('kHz')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText('Tries')).toHaveAttribute('placeholder', '10'));
  await waitFor(() => expect(urlField().value).toBe('ardop:///wl2k?bw=500MAX'));
  expect((screen.getByLabelText('Bandwidth') as HTMLSelectElement).value).toBe('500MAX');
});

test('AX.25 hides Radio only; telnet hides bandwidth when the mode has none', async () => {
  render(<ConnectDialog />);
  change(screen.getByLabelText('Transport'), 'ax25');
  expect(screen.queryByLabelText('Radio only')).toBeNull();
  change(screen.getByLabelText('Transport'), 'telnet');
  await waitFor(() => expect(api.bandwidths).toHaveBeenLastCalledWith('telnet'));
  expect(screen.queryByLabelText('Bandwidth')).toBeNull();
  expect(screen.getByLabelText('Radio only')).toBeInTheDocument();
});

test('a frequency the rig took goes into the URL', async () => {
  localStorage.setItem('pat_connect_url_N0CALL', 'varahf:///W6EOC');
  render(<ConnectDialog />);
  commit(screen.getByLabelText('Frequency'), '7102.2');
  await waitFor(() => expect(api.qsy).toHaveBeenCalledWith('varahf', 7102.2));
  await waitFor(() => expect(urlField().value).toBe('varahf:///W6EOC?freq=7102.2'));
});

test('without rig control the frequency is struck through, explained, and left out of the URL', async () => {
  mock(api.qsy).mockRejectedValueOnce(new api.ApiError(503, 'rig control not configured'));
  localStorage.setItem('pat_connect_url_N0CALL', 'varahf:///W6EOC');
  render(<ConnectDialog />);
  const freq = screen.getByLabelText('Frequency');
  commit(freq, '7102.2');
  expect(await screen.findByText(/Rig control is not configured/)).toBeInTheDocument();
  expect(freq).toHaveClass('struck');
  expect(urlField().value).toBe('varahf:///W6EOC');
});

test('a failed QSY warns', async () => {
  mock(api.qsy).mockRejectedValueOnce(new api.ApiError(500, 'rig timeout'));
  localStorage.setItem('pat_connect_url_N0CALL', 'varahf:///W6EOC');
  render(<ConnectDialog />);
  commit(screen.getByLabelText('Frequency'), '7102.2');
  expect(await screen.findByText('QSY failure')).toBeInTheDocument();
});

test('Connect remembers the URL, closes, connects, and says when nothing came in', async () => {
  localStorage.setItem('pat_connect_url_N0CALL', 'telnet://N0CALL:pw@cms.example.invalid:8772/wl2k');
  render(<ConnectDialog />);
  fireEvent.input(screen.getByLabelText('Target'), { target: { value: 'WL2K' } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  expect(api.connect).toHaveBeenCalledWith('telnet://N0CALL:pw@cms.example.invalid:8772/WL2K');
  expect(localStorage.getItem('pat_connect_url_N0CALL')).toBe('telnet://N0CALL:pw@cms.example.invalid:8772/WL2K');
  expect(store.connectOpen.value).toBe(false);
  await waitFor(() => expect(toast).toHaveBeenCalledWith('No new messages'));
});

test('a failed connect says so', async () => {
  mock(api.connect).mockRejectedValueOnce(new api.ApiError(500, 'Session failure'));
  localStorage.setItem('pat_connect_url_N0CALL', 'varahf:///W6EOC');
  render(<ConnectDialog />);
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  await waitFor(() => expect(mock(toast).mock.calls[0]![0]).toMatch(/^Connect failed/));
});

test('a hand-edited URL fills the fields, keeping parameters the dialog has no field for', async () => {
  render(<ConnectDialog />);
  commit(urlField(), 'ardop:///LA3F?freq=3590&host=10.0.0.5');
  expect((screen.getByLabelText('Target') as HTMLInputElement).value).toBe('LA3F');
  expect((screen.getByLabelText('Frequency') as HTMLInputElement).value).toBe('3590');
  await waitFor(() => expect(api.qsy).toHaveBeenCalled());
  await waitFor(() => expect(urlField().value).toContain('host=10.0.0.5'));
});

test('choosing an alias fills the dialog; editing a field clears the alias', async () => {
  render(<ConnectDialog />);
  const alias = screen.getByLabelText('Alias') as HTMLSelectElement;
  await waitFor(() => expect(within(alias).getByRole('option', { name: 'home' })).toBeInTheDocument());
  change(alias, 'home');
  expect(urlField().value).toBe('telnet://N0CALL:pw@cms.example.invalid:8772/wl2k');
  expect(screen.getByRole('button', { name: 'Delete alias home' })).toBeInTheDocument();
  fireEvent.input(screen.getByLabelText('Target'), { target: { value: 'other' } });
  expect(alias.value).toBe('');
});

test('saving an alias checks the name, then stores the URL with its frequency', async () => {
  localStorage.setItem('pat_connect_url_N0CALL', 'varahf:///W6EOC');
  render(<ConnectDialog />);
  await waitFor(() => expect(api.connectAliases).toHaveBeenCalled());
  commit(screen.getByLabelText('Frequency'), '7102.2');
  fireEvent.click(screen.getByRole('button', { name: 'Save as alias' }));
  const name = await screen.findByLabelText('Alias name');
  fireEvent.input(name, { target: { value: 'bad name' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText(/only letters, numbers/)).toBeInTheDocument();
  fireEvent.input(name, { target: { value: 'home' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('An alias with this name already exists.')).toBeInTheDocument();
  fireEvent.input(name, { target: { value: 'eoc-hf' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.putAlias).toHaveBeenCalledWith('eoc-hf', 'varahf:///W6EOC?freq=7102.2'));
});

test('deleting an alias asks first', async () => {
  render(<ConnectDialog />);
  const alias = screen.getByLabelText('Alias') as HTMLSelectElement;
  await waitFor(() => expect(within(alias).getByRole('option', { name: 'home' })).toBeInTheDocument());
  change(alias, 'home');
  fireEvent.click(screen.getByRole('button', { name: 'Delete alias home' }));
  expect(api.deleteAlias).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(api.deleteAlias).toHaveBeenCalledWith('home'));
});

test('a name typed the moment the alias dialog opens is kept', async () => {
  render(<ConnectDialog />);
  await waitFor(() => expect(api.connectAliases).toHaveBeenCalled());
  // Raw events, outside act, so the dialog's effects run after the typing
  // the way a browser runs them a frame later.
  screen.getByRole('button', { name: 'Save as alias' }).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  const name = screen.getByLabelText('Alias name') as HTMLInputElement;
  name.value = 'fast';
  name.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));
  expect(name.value).toBe('fast');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.putAlias).toHaveBeenCalledWith('fast', expect.any(String)));
});

test('reopening the alias dialog starts empty', async () => {
  render(<ConnectDialog />);
  fireEvent.click(screen.getByRole('button', { name: 'Save as alias' }));
  fireEvent.input(await screen.findByLabelText('Alias name'), { target: { value: 'bad name' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText(/only letters, numbers/)).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('dialog', { name: 'New connection alias' })).getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save as alias' }));
  expect((await screen.findByLabelText('Alias name') as HTMLInputElement).value).toBe('');
  expect(screen.queryByText(/only letters, numbers/)).toBeNull();
});

test('with no default bandwidth the select says so and the URL leaves bw out', async () => {
  mock(api.bandwidths).mockImplementation(async (mode: string) => ({ mode, bandwidths: mode === 'ardop' ? ['500MAX', '2000MAX'] : [] }));
  render(<ConnectDialog />);
  change(screen.getByLabelText('Transport'), 'ardop');
  const bw = await screen.findByLabelText('Bandwidth') as HTMLSelectElement;
  expect(bw.selectedOptions[0]?.textContent).toBe('(default)');
  expect(urlField().value).not.toContain('bw=');
  change(bw, '2000MAX');
  await waitFor(() => expect(urlField().value).toContain('bw=2000MAX'));
  change(bw, '');
  await waitFor(() => expect(urlField().value).not.toContain('bw='));
});
