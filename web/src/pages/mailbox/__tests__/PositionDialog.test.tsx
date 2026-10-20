vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  gpsPosition: vi.fn(),
  posReport: vi.fn(async () => 'Position update posted'),
}));
vi.mock('../../../ui/Toast', async (orig) => ({ ...(await orig<typeof import('../../../ui/Toast')>()), toast: vi.fn() }));
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import * as api from '../../../lib/api';
import * as store from '../store';
import { toast } from '../../../ui/Toast';
import { PositionDialog } from '../PositionDialog';

const gps = api.gpsPosition as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  store.positionOpen.value = true;
  store.geoError.value = null;
});

test('uses the GPS device when there is one, and posts the report', async () => {
  gps.mockResolvedValue({ Lat: 38.5, Lon: -121.4, Time: '2026-09-30T22:00:00Z' });
  render(<PositionDialog />);
  await waitFor(() => expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe('38.5'));
  expect((screen.getByLabelText('Longitude') as HTMLInputElement).value).toBe('-121.4');
  fireEvent.input(screen.getByLabelText('Comment'), { target: { value: 'At the EOC' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post report' }));
  await waitFor(() => expect(api.posReport).toHaveBeenCalledWith({
    lat: 38.5, lon: -121.4, comment: 'At the EOC', date: new Date('2026-09-30T22:00:00Z'),
  }));
  expect(toast).toHaveBeenCalledWith('Position update posted');
  expect(store.positionOpen.value).toBe(false);
});

test('falls back to browser geolocation and stops watching on close', async () => {
  gps.mockRejectedValue(new Error('no gps'));
  const clearWatch = vi.fn();
  const watchPosition = vi.fn((ok: (p: unknown) => void) => {
    ok({ coords: { latitude: 38.6, longitude: -121.5 }, timestamp: Date.parse('2026-09-30T21:00:00Z') });
    return 7;
  });
  vi.stubGlobal('navigator', { ...navigator, geolocation: { watchPosition, clearWatch } });
  const { unmount } = render(<PositionDialog />);
  await waitFor(() => expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe('38.6'));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(clearWatch).toHaveBeenCalledWith(7);
  unmount();
  vi.unstubAllGlobals();
});

test('a geolocation error is shown and raised in the status panel', async () => {
  gps.mockRejectedValue(new Error('no gps'));
  vi.stubGlobal('navigator', { ...navigator, geolocation: {
    watchPosition: (_ok: unknown, err: (e: { message: string }) => void) => { err({ message: 'User denied Geolocation' }); return 1; },
    clearWatch: () => {},
  } });
  render(<PositionDialog />);
  expect(await screen.findByText('Geolocation unavailable.')).toBeInTheDocument();
  expect(store.geoError.value).toBe('User denied Geolocation');
  vi.unstubAllGlobals();
});

test('typing a position by hand keeps focus in the field', async () => {
  gps.mockRejectedValue(new Error('no gps'));
  vi.stubGlobal('navigator', { ...navigator, geolocation: undefined });
  render(<PositionDialog />);
  await screen.findByText('No GPS device, and this browser has no geolocation.');
  for (const name of ['Latitude', 'Longitude', 'Comment']) {
    const field = screen.getByLabelText(name) as HTMLInputElement;
    field.focus();
    for (const v of ['3', '38', '38.']) {
      fireEvent.input(field, { target: { value: v } });
      expect(document.activeElement).toBe(field);
    }
  }
  vi.unstubAllGlobals();
});

test('a browser fix arriving after manual typing does not overwrite it', async () => {
  gps.mockRejectedValue(new Error('no gps'));
  let ok: (p: unknown) => void = () => {};
  const clearWatch = vi.fn();
  vi.stubGlobal('navigator', { ...navigator, geolocation: {
    watchPosition: (cb: (p: unknown) => void) => { ok = cb; return 3; },
    clearWatch,
  } });
  render(<PositionDialog />);
  await screen.findByText('Waiting for a position from the browser…');
  fireEvent.input(screen.getByLabelText('Latitude'), { target: { value: '40.1' } });
  expect(clearWatch).toHaveBeenCalledWith(3);
  ok({ coords: { latitude: 38.6, longitude: -121.5 }, timestamp: Date.now() });
  expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe('40.1');
  vi.unstubAllGlobals();
});
