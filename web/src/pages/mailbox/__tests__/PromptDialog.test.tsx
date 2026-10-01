import { render, screen, fireEvent } from '@testing-library/preact';
import * as store from '../store';
import { PromptDialog } from '../PromptDialog';
import type { Prompt } from '../../../lib/types';

let sent: unknown[];
beforeEach(() => {
  sent = [];
  store.socket.send = (o: unknown) => { sent.push(o); };
  store.prompt.value = null;
});

const ask = (p: Partial<Prompt>) => { store.prompt.value = { id: 'p1', message: 'Question', ...p } as Prompt; };

test('a password prompt sends the typed password and closes', () => {
  ask({ kind: 'password', message: 'Secure login password' });
  render(<PromptDialog />);
  expect(screen.getByText('Secure login password')).toBeInTheDocument();
  fireEvent.input(screen.getByLabelText('Password'), { target: { value: 's3cret' } });
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  expect(sent).toEqual([{ prompt_response: { id: 'p1', value: 's3cret' } }]);
  expect(store.prompt.value).toBeNull();
});

test('Enter in the password field submits', () => {
  ask({ kind: 'password' });
  render(<PromptDialog />);
  const input = screen.getByLabelText('Password');
  fireEvent.input(input, { target: { value: 'pw' } });
  fireEvent.submit(input.closest('form')!);
  expect(sent).toEqual([{ prompt_response: { id: 'p1', value: 'pw' } }]);
});

test('multi-select sends the checked values joined by commas; Select All toggles', () => {
  ask({ kind: 'multi-select', options: [
    { value: 'A1', desc: 'First', checked: true },
    { value: 'B2', desc: '', checked: false },
    { value: 'C3', desc: 'Third', checked: true },
  ] });
  render(<PromptDialog />);
  expect(screen.getByLabelText('First (A1)')).toBeChecked();
  fireEvent.click(screen.getByLabelText('Third (C3)'));
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  expect(sent).toEqual([{ prompt_response: { id: 'p1', value: 'A1' } }]);
});

test('multi-select Select All checks everything, then Deselect All clears', () => {
  ask({ kind: 'multi-select', options: [{ value: 'A1', desc: '', checked: false }, { value: 'B2', desc: '', checked: true }] });
  render(<PromptDialog />);
  fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  expect(sent).toEqual([{ prompt_response: { id: 'p1', value: 'A1,B2' } }]);
});

test.each([
  ['busy-channel', 'Continue anyway', 'continue'],
  ['busy-channel', 'Abort', 'abort'],
  ['pre-account-activation', 'Continue anyway', 'confirmed'],
  ['pre-account-activation', 'Abort', 'abort'],
  ['account-activation', 'Postpone to Next Connection', 'defer'],
  ['account-activation', 'Yes, Download Now', 'accept'],
] as const)('%s: %s answers %s', (kind, button, value) => {
  ask({ kind });
  render(<PromptDialog />);
  fireEvent.click(screen.getByRole('button', { name: button }));
  expect(sent).toEqual([{ prompt_response: { id: 'p1', value } }]);
});

test('Create new account aborts the session and goes to account setup', () => {
  const assign = vi.fn();
  vi.stubGlobal('location', { ...location, assign });
  ask({ kind: 'pre-account-activation' });
  render(<PromptDialog />);
  fireEvent.click(screen.getByRole('button', { name: 'Create new account' }));
  expect(sent).toEqual([{ prompt_response: { id: 'p1', value: 'abort' } }]);
  expect(assign).toHaveBeenCalledWith('/ui/config?action=create-account');
  vi.unstubAllGlobals();
});

test('a prompt cannot be dismissed with Escape; the server is waiting for an answer', () => {
  ask({ kind: 'busy-channel' });
  render(<PromptDialog />);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
});

test('answering closes the desktop notification raised for the prompt', () => {
  const close = vi.fn();
  ask({ kind: 'busy-channel' });
  store.promptNotice.current = { close } as unknown as Notification;
  render(<PromptDialog />);
  fireEvent.click(screen.getByRole('button', { name: 'Abort' }));
  expect(close).toHaveBeenCalled();
});
