vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  patChoice: vi.fn(),
  answerPatChoice: vi.fn(async () => '"OK"'),
  reload: vi.fn(async () => ''),
  status: vi.fn(async () => ({})),
}));
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import * as api from '../../../lib/api';
import { PatDialog, askAboutPat, patOffer } from '../PatDialog';

const mock = <T,>(f: T) => f as unknown as ReturnType<typeof vi.fn>;
const offer = { ask: true, pat_url: 'http://localhost:8080', mailbox: '/pat/mailbox', forms: '/pat/Standard_Forms' };

beforeEach(() => {
  vi.clearAllMocks();
  patOffer.value = null;
});

test('asks only when the server says to', async () => {
  mock(api.patChoice).mockResolvedValueOnce({ ask: false });
  await askAboutPat();
  expect(patOffer.value).toBeNull();

  mock(api.patChoice).mockResolvedValueOnce(offer);
  await askAboutPat();
  expect(patOffer.value).toEqual(offer);
});

test('names Pat\'s address', () => {
  patOffer.value = offer;
  render(<PatDialog />);
  expect(screen.getByText(/http:\/\/localhost:8080/)).toBeInTheDocument();
});

test('Use Phat on its own answers no and closes without a restart', async () => {
  patOffer.value = offer;
  render(<PatDialog />);
  fireEvent.click(screen.getByRole('button', { name: 'Use Phat on its own' }));
  await waitFor(() => expect(patOffer.value).toBeNull());
  expect(api.answerPatChoice).toHaveBeenCalledWith(false);
  expect(api.reload).not.toHaveBeenCalled();
});

test('Connect through Pat answers yes, restarts Phat and reloads the page', async () => {
  const reloadPage = vi.fn();
  vi.stubGlobal('location', { ...location, reload: reloadPage });
  patOffer.value = offer;
  render(<PatDialog />);
  fireEvent.click(screen.getByRole('button', { name: 'Connect through Pat' }));
  await waitFor(() => expect(reloadPage).toHaveBeenCalled(), { timeout: 3000 });
  expect(api.answerPatChoice).toHaveBeenCalledWith(true);
  expect(api.reload).toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test('a failed answer stays open and says why', async () => {
  mock(api.answerPatChoice).mockRejectedValueOnce(new Error('no Pat install found'));
  patOffer.value = offer;
  render(<PatDialog />);
  fireEvent.click(screen.getByRole('button', { name: 'Connect through Pat' }));
  expect(await screen.findByText(/no Pat install found/)).toBeInTheDocument();
  expect(patOffer.value).toEqual(offer);
});

test('closing the dialog only hides it: no answer, so the next visit asks again', async () => {
  patOffer.value = offer;
  render(<PatDialog />);
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(patOffer.value).toBeNull());
  expect(api.answerPatChoice).not.toHaveBeenCalled();
});

test('a slow restart is waited out instead of reloading onto a dead page', async () => {
  vi.useFakeTimers();
  const reloadPage = vi.fn();
  vi.stubGlobal('location', { ...location, reload: reloadPage });
  let up = false;
  mock(api.status).mockImplementation(async () => { if (!up) throw new Error('down'); return {}; });
  patOffer.value = offer;
  render(<PatDialog />);
  fireEvent.click(screen.getByRole('button', { name: 'Connect through Pat' }));
  await vi.advanceTimersByTimeAsync(10_000);
  expect(reloadPage).not.toHaveBeenCalled();
  expect(screen.getByText(/Restarting Phat/)).toBeInTheDocument();
  up = true;
  await vi.advanceTimersByTimeAsync(1_000);
  expect(reloadPage).toHaveBeenCalled();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
