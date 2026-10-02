import { render, screen, fireEvent } from '@testing-library/preact';
import * as store from '../store';
import { KeysDialog } from '../KeysDialog';
import { Topbar } from '../Toolbar';
import { Sidebar } from '../Sidebar';

beforeEach(() => { store.keysOpen.value = false; });

test('? opens the sheet and Escape closes it', () => {
  render(<KeysDialog />);
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.keyDown(document.body, { key: '?', shiftKey: true });
  expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  fireEvent.keyDown(document.body, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});

const shown = () => [...screen.getByRole('dialog').querySelectorAll('kbd')].map((k) => k.textContent);

test('over the list it shows the list keys and the ones that work anywhere', () => {
  store.openMessage.value = null;
  store.keysOpen.value = true;
  render(<KeysDialog />);
  expect(shown().sort()).toEqual(['/', '?', 'Enter', 'c', 'n', 't']);
});

test('over an open message it shows the message keys and the ones that work anywhere', () => {
  store.openMessage.value = { MID: 'm1', Folder: 'in' } as never;
  store.keysOpen.value = true;
  render(<KeysDialog />);
  expect(shown().sort()).toEqual(['/', '?', 'R', 'a', 'c', 'f', 'h', 'j', 'k', 'l', 'm', 'r', 's', 't', 'u']);
  store.openMessage.value = null;
});

test('the top bar and the sidebar each have a button that opens it', () => {
  const { unmount } = render(<Topbar />);
  fireEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
  expect(store.keysOpen.value).toBe(true);
  unmount();
  store.keysOpen.value = false;
  render(<Sidebar />);
  fireEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
  expect(store.keysOpen.value).toBe(true);
});
