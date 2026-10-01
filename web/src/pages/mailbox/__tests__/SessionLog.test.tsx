import { render, screen, fireEvent } from '@testing-library/preact';
import * as store from '../store';
import { SessionLog } from '../SessionLog';

beforeEach(() => {
  store.logLines.value = [];
  store.logOpen.value = true;
});

test('shows the server log lines as they arrive, and Clear empties it', () => {
  store.addLogLine('Connecting to W6EOC (telnet)...');
  store.addLogLine('Connected to 127.0.0.1:8775 (tcp)');
  render(<SessionLog />);
  expect(screen.getByText(/Connecting to W6EOC/)).toBeInTheDocument();
  expect(screen.getByText(/Connected to 127.0.0.1/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear log' }));
  expect(store.logLines.value).toEqual([]);
});

test('keeps the last 1000 lines', () => {
  for (let i = 0; i < 1005; i++) store.addLogLine(`line ${i}`);
  expect(store.logLines.value).toHaveLength(1000);
  expect(store.logLines.value[0]).toBe('line 5');
});

test('Close hides it', () => {
  render(<SessionLog />);
  fireEvent.click(screen.getByRole('button', { name: 'Close log' }));
  expect(store.logOpen.value).toBe(false);
});
