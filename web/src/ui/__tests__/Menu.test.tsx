import { render, fireEvent, screen } from '@testing-library/preact';
import { Menu } from '../Menu';

function setup() {
  const archive = vi.fn();
  const del = vi.fn();
  render(
    <Menu
      trigger={<button type="button">More</button>}
      items={[
        { label: 'Archive', onSelect: archive },
        { label: 'Delete', onSelect: del, danger: true },
      ]}
    />,
  );
  return { archive, del };
}

test('opens on click and runs the chosen item', () => {
  const { archive } = setup();
  expect(screen.queryByRole('menu')).toBeNull();
  fireEvent.click(screen.getByText('More'));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Archive' }));
  expect(archive).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('menu')).toBeNull();
});

test('closes on Escape and on an outside click', () => {
  setup();
  fireEvent.click(screen.getByText('More'));
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  fireEvent.click(screen.getByText('More'));
  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole('menu')).toBeNull();
});

test('arrow keys move focus and Enter selects', () => {
  const { del } = setup();
  fireEvent.click(screen.getByText('More'));
  const menu = screen.getByRole('menu');
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Archive' }));
  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete' }));
  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Archive' }));
  fireEvent.keyDown(menu, { key: 'ArrowUp' });
  fireEvent.click(document.activeElement!);
  expect(del).toHaveBeenCalledTimes(1);
});
