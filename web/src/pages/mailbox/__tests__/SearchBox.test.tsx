vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  list: vi.fn(async () => []),
}));
import { render, screen, fireEvent, act } from '@testing-library/preact';
import * as api from '../../../lib/api';
import { ApiError } from '../../../lib/api';
import * as store from '../store';
import { SearchBox } from '../SearchBox';
import { Toasts } from '../../../ui/Toast';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  store.view.value = { kind: 'folder', name: 'in' };
});
afterEach(() => vi.useRealTimers());

test('typing searches after 250 ms of quiet, and Escape goes back', async () => {
  render(<SearchBox />);
  const box = screen.getByRole('searchbox', { name: 'Search mail' });
  fireEvent.input(box, { target: { value: 'gen' } });
  fireEvent.input(box, { target: { value: 'genset' } });
  await act(async () => { vi.advanceTimersByTime(249); });
  expect(store.view.value).toEqual({ kind: 'folder', name: 'in' });
  await act(async () => { vi.advanceTimersByTime(1); });
  expect(store.view.value).toEqual({ kind: 'search', q: 'genset' });
  expect(api.list).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(box, { key: 'Escape' });
  expect(store.view.value).toEqual({ kind: 'folder', name: 'in' });
  expect((box as HTMLInputElement).value).toBe('');
});

test('a search the server rejects keeps the previous rows and says so', async () => {
  store.view.value = { kind: 'search', q: 'genset' };
  store.rows.value = [{ MID: 'x' }] as never;
  vi.mocked(api.list).mockRejectedValueOnce(new ApiError(400, 'fts5: syntax error'));
  render(<><SearchBox /><Toasts /></>);
  fireEvent.input(screen.getByRole('searchbox', { name: 'Search mail' }), { target: { value: 'genset AND' } });
  await act(async () => { vi.advanceTimersByTime(250); });
  expect(store.rows.value).toHaveLength(1);
  expect(screen.getByRole('alert')).toHaveTextContent('Search syntax error');
});

test('/ goes to the search box, but not behind a dialog or with a modifier held', () => {
  render(<SearchBox />);
  const box = screen.getByRole('searchbox', { name: 'Search mail' });
  const modal = document.createElement('div');
  modal.setAttribute('aria-modal', 'true');
  document.body.appendChild(modal);
  fireEvent.keyDown(document.body, { key: '/' });
  expect(document.activeElement).not.toBe(box);
  modal.remove();
  fireEvent.keyDown(document.body, { key: '/', ctrlKey: true });
  expect(document.activeElement).not.toBe(box);
  fireEvent.keyDown(document.body, { key: '/' });
  expect(document.activeElement).toBe(box);
});
