vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  rmslist: vi.fn(async () => []),
}));
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import * as api from '../../../lib/api';
import { change } from '../../../test/events';
import { RmsList, type Rms } from '../RmsList';

const rms = (call: string, extra: Partial<Rms> = {}): Rms => ({
  callsign: call, distance: 51.3, modes: 'ARDOP 2000', dial: { desc: '7.102.20 MHz' }, url: `ardop:///${call}?freq=7102.2`, prediction: null, ...extra,
});
const list = api.rmslist as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

test('loads for the mode and band, and a row click hands back its URL', async () => {
  list.mockResolvedValue([rms('N9CALL'), rms('EOC-1')]);
  const pick = vi.fn();
  render(<RmsList mode="ardop" onPick={pick} />);
  await waitFor(() => expect(api.rmslist).toHaveBeenCalledWith({ mode: 'ardop', band: '' }, false));
  expect(await screen.findByText('N9CALL')).toBeInTheDocument();
  expect(screen.getAllByText('51 km')).toHaveLength(2);
  expect(screen.queryByText('Quality')).toBeNull();
  fireEvent.click(screen.getByText('EOC-1'));
  expect(pick).toHaveBeenCalledWith('ardop:///EOC-1?freq=7102.2');
  change(screen.getByLabelText('Band'), '40m');
  await waitFor(() => expect(api.rmslist).toHaveBeenLastCalledWith({ mode: 'ardop', band: '40m' }, false));
});

test('the callsign filter matches prefixes', async () => {
  list.mockResolvedValue([rms('N9CALL'), rms('EOC-1'), rms('N5CALL')]);
  render(<RmsList mode="ardop" onPick={() => {}} />);
  await screen.findByText('N9CALL');
  fireEvent.input(screen.getByLabelText('Callsign'), { target: { value: 'n' } });
  expect(screen.queryByText('EOC-1')).toBeNull();
  expect(screen.getByText('N5CALL')).toBeInTheDocument();
});

test('shows 100 rows at a time', async () => {
  list.mockResolvedValue(Array.from({ length: 230 }, (_, i) => rms(`W${String(i).padStart(3, '0')}X`)));
  render(<RmsList mode="" onPick={() => {}} />);
  await screen.findByText('W000X');
  expect(screen.getByText('Showing 100 of 230')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  expect(screen.getByText('Showing 230 of 230')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
});

test('Update cache forces a download', async () => {
  render(<RmsList mode="varahf" onPick={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Update cache' }));
  await waitFor(() => expect(api.rmslist).toHaveBeenLastCalledWith({ mode: 'varahf', band: '' }, true));
});

test('link quality shows when predictions exist, with details on hover and the raw output on click', async () => {
  list.mockResolvedValue([
    rms('N9CALL', { prediction: { link_quality: 78, output_values: { SNR: '12 dB', MUF: '9.1' }, output_raw: 'RAW VOACAP' } }),
    rms('EOC-1'),
  ]);
  const pick = vi.fn();
  render(<RmsList mode="ardop" onPick={pick} />);
  expect(await screen.findByText('Quality')).toBeInTheDocument();
  expect(screen.getByText('N/A')).toBeInTheDocument();
  const q = screen.getByRole('button', { name: '78%' });
  expect(q.getAttribute('title')).toBe('SNR: 12 dB\nMUF: 9.1');
  fireEvent.click(q);
  expect(pick).not.toHaveBeenCalled();
  expect(await screen.findByText('RAW VOACAP')).toBeInTheDocument();
  expect(screen.getByText('Propagation prediction: N9CALL')).toBeInTheDocument();
});
