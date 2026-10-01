import { render, screen, act } from '@testing-library/preact';
import { Toasts, toast } from '../Toast';

test('a toast shows and goes away after its time', () => {
  vi.useFakeTimers();
  render(<Toasts />);
  act(() => { toast('Moved 2 messages to Club', { ms: 1000 }); });
  expect(screen.getByText('Moved 2 messages to Club')).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(1001); });
  expect(screen.queryByText('Moved 2 messages to Club')).toBeNull();
  vi.useRealTimers();
});

test('an error toast is announced assertively', () => {
  render(<Toasts />);
  act(() => { toast('2 messages could not be moved', { kind: 'error' }); });
  expect(screen.getByRole('alert')).toHaveTextContent('2 messages could not be moved');
});
