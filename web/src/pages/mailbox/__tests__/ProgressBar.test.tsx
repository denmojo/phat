import { render, screen, act } from '@testing-library/preact';
import * as store from '../store';
import { ProgressBar } from '../ProgressBar';
import type { Progress } from '../../../lib/types';

const p = (extra: Partial<Progress>) =>
  ({ bytes_transferred: 0, bytes_total: 2000, mid: 'ABC123', subject: '', receiving: true, sending: false, done: false, ...extra } as Progress);

beforeEach(() => { store.progress.value = null; });

test('shows direction, MID, size, subject and percent', () => {
  render(<ProgressBar />);
  act(() => store.handleProgress(p({ bytes_transferred: 500, subject: 'Shelter status' })));
  expect(screen.getByText('Receiving ABC123 (2000 bytes) - Shelter status')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
  expect(screen.getByText('25%')).toBeInTheDocument();
});

test('hides 3 s after the transfer is done, unless another starts', () => {
  vi.useFakeTimers();
  render(<ProgressBar />);
  act(() => store.handleProgress(p({ sending: true, receiving: false, bytes_transferred: 2000 })));
  act(() => store.handleProgress(p({ done: true })));
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(2000); });
  act(() => store.handleProgress(p({ bytes_transferred: 100 })));
  act(() => { vi.advanceTimersByTime(3000); });
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
  act(() => store.handleProgress(p({ done: true })));
  act(() => { vi.advanceTimersByTime(3000); });
  expect(screen.queryByRole('progressbar')).toBeNull();
  vi.useRealTimers();
});
