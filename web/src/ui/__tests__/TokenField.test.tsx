import { render, fireEvent, screen } from '@testing-library/preact';
import { TokenField } from '../TokenField';
test('splits on comma, semicolon and space, and removes on backspace', () => {
  const onChange = vi.fn();
  render(<TokenField label="To" tokens={[]} onChange={onChange} />);
  const input = screen.getByLabelText('To');
  fireEvent.input(input, { target: { value: 'N5CALL, N7CALL;N0CALL ' } });
  expect(onChange).toHaveBeenLastCalledWith(['N5CALL', 'N7CALL', 'N0CALL']);
});
test('backspace on an empty input removes the last token', () => {
  const onChange = vi.fn();
  render(<TokenField label="To" tokens={['N5CALL', 'N7CALL']} onChange={onChange} />);
  fireEvent.keyDown(screen.getByLabelText('To'), { key: 'Backspace' });
  expect(onChange).toHaveBeenLastCalledWith(['N5CALL']);
});
test('blur commits the pending token', () => {
  const onChange = vi.fn();
  render(<TokenField label="To" tokens={['N5CALL']} onChange={onChange} />);
  const input = screen.getByLabelText('To');
  fireEvent.input(input, { target: { value: 'N7CALL' } });
  fireEvent.blur(input);
  expect(onChange).toHaveBeenLastCalledWith(['N5CALL', 'N7CALL']);
});
test('a token chip has a remove button', () => {
  const onChange = vi.fn();
  render(<TokenField label="To" tokens={['N5CALL', 'N7CALL']} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Remove N5CALL' }));
  expect(onChange).toHaveBeenLastCalledWith(['N7CALL']);
});
