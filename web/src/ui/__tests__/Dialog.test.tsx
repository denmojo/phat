import { render, fireEvent, screen } from '@testing-library/preact';
import { Dialog } from '../Dialog';
test('renders nothing when closed', () => {
  render(<Dialog open={false} title="New message" onClose={() => {}}>body</Dialog>);
  expect(screen.queryByText('New message')).toBeNull();
  expect(screen.queryByText('body')).toBeNull();
});
test('renders title and children when open', () => {
  render(<Dialog open title="New message" onClose={() => {}}>body text</Dialog>);
  expect(screen.getByRole('dialog', { name: 'New message' })).toBeInTheDocument();
  expect(screen.getByText('body text')).toBeInTheDocument();
});
test('Escape and the close button call onClose', () => {
  const onClose = vi.fn();
  render(<Dialog open title="New message" onClose={onClose}>body</Dialog>);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledTimes(2);
});
test('a backdrop click closes, a click inside does not', () => {
  const onClose = vi.fn();
  render(<Dialog open title="New message" onClose={onClose}>body</Dialog>);
  fireEvent.click(screen.getByText('body'));
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(document.querySelector('.ui-scrim')!);
  expect(onClose).toHaveBeenCalledTimes(1);
});
