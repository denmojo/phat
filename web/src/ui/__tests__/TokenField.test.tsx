import { render, fireEvent, screen } from '@testing-library/preact';
import { TokenField } from '../TokenField';
test('splits on comma, semicolon and space, and removes on backspace', () => {
  const onChange = vi.fn();
  render(<TokenField label="To" tokens={[]} onChange={onChange} />);
  const input = screen.getByLabelText('To');
  fireEvent.input(input, { target: { value: 'K6ABC, W6XYZ;N0CALL ' } });
  expect(onChange).toHaveBeenLastCalledWith(['K6ABC', 'W6XYZ', 'N0CALL']);
});
test('backspace on an empty input removes the last token', () => {
  const onChange = vi.fn();
  render(<TokenField label="To" tokens={['K6ABC', 'W6XYZ']} onChange={onChange} />);
  fireEvent.keyDown(screen.getByLabelText('To'), { key: 'Backspace' });
  expect(onChange).toHaveBeenLastCalledWith(['K6ABC']);
});
test('blur commits the pending token', () => {
  const onChange = vi.fn();
  render(<TokenField label="To" tokens={['K6ABC']} onChange={onChange} />);
  const input = screen.getByLabelText('To');
  fireEvent.input(input, { target: { value: 'W6XYZ' } });
  fireEvent.blur(input);
  expect(onChange).toHaveBeenLastCalledWith(['K6ABC', 'W6XYZ']);
});
test('a token chip has a remove button', () => {
  const onChange = vi.fn();
  render(<TokenField label="To" tokens={['K6ABC', 'W6XYZ']} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Remove K6ABC' }));
  expect(onChange).toHaveBeenLastCalledWith(['W6XYZ']);
});
