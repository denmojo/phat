import { render, screen, fireEvent } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { Interface } from '../sections/Interface';
import type { Appearance } from '../../../ui/theme';

function Host() {
  const [a, setA] = useState<Appearance>('light');
  return <Interface appearance={a} onChange={setA} />;
}

test('picking Dark switches the page to dark at once', () => {
  document.documentElement.dataset.theme = 'light';
  render(<Host />);
  fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
  expect(document.documentElement.dataset.theme).toBe('light');
});
