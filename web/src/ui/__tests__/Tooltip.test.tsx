import { render, screen, fireEvent } from '@testing-library/preact';
import { Tooltip } from '../Tooltip';

function setup() {
  render(<Tooltip id="tip" content={<><b>P</b>hat</>}><span>Name</span></Tooltip>);
  const trigger = screen.getByText('Name').parentElement as HTMLElement;
  return { trigger, tip: screen.getByRole('tooltip', { hidden: true }) };
}

test('the tooltip starts hidden and opens on hover', () => {
  const { trigger, tip } = setup();
  expect(tip).not.toBeVisible();
  fireEvent.mouseEnter(trigger);
  expect(tip).toBeVisible();
  fireEvent.mouseLeave(trigger);
  expect(tip).not.toBeVisible();
});

test('keyboard focus opens it and Escape closes it', () => {
  const { trigger, tip } = setup();
  fireEvent.focus(trigger);
  expect(tip).toBeVisible();
  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(tip).not.toBeVisible();
  fireEvent.focus(trigger);
  expect(tip).toBeVisible();
  fireEvent.blur(trigger);
  expect(tip).not.toBeVisible();
});

test('Escape closes a tooltip opened by hover while focus is elsewhere', () => {
  const { trigger, tip } = setup();
  fireEvent.mouseEnter(trigger);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(tip).not.toBeVisible();
});

test('the mouse leaving does not hide a tooltip the name still has focus for', () => {
  const { trigger, tip } = setup();
  fireEvent.focus(trigger);
  fireEvent.mouseEnter(trigger);
  fireEvent.mouseLeave(trigger);
  expect(tip).toBeVisible();
});

test('after Escape, hovering again reopens it', () => {
  const { trigger, tip } = setup();
  fireEvent.mouseEnter(trigger);
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.mouseLeave(trigger);
  fireEvent.mouseEnter(trigger);
  expect(tip).toBeVisible();
});

test('the trigger is focusable and described by the tooltip', () => {
  const { trigger, tip } = setup();
  expect(trigger).toHaveAttribute('tabindex', '0');
  expect(trigger).toHaveAttribute('aria-describedby', 'tip');
  expect(tip).toHaveAttribute('id', 'tip');
});
