vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  createLabel: vi.fn(async (name: string, color: string) => ({ name, color, count: 0 })),
  list: vi.fn(async () => []),
  folders: vi.fn(async () => []),
  labels: vi.fn(async () => []),
}));
import { render, screen, fireEvent, waitFor, within } from '@testing-library/preact';
import * as api from '../../../lib/api';
import * as store from '../store';
import { LabelEditor, LABEL_COLORS } from '../LabelEditor';

beforeEach(() => vi.clearAllMocks());

test('offers forty distinct named colors plus a custom one', () => {
  store.labels.value = [];
  render(<LabelEditor open onClose={() => {}} />);
  const group = screen.getByRole('radiogroup', { name: 'Color' });
  const swatches = within(group).getAllByRole('radio');
  expect(LABEL_COLORS).toHaveLength(40);
  expect(new Set(LABEL_COLORS.map((c) => c.hex)).size).toBe(40);
  expect(new Set(LABEL_COLORS.map((c) => c.name)).size).toBe(40);
  expect(swatches).toHaveLength(40);
  expect(within(group).getByRole('radio', { name: 'Pink' })).toBeInTheDocument();
  expect(within(group).getByRole('radio', { name: 'Cyan' })).toBeInTheDocument();
  expect(within(group).getByRole('radio', { name: 'Dark cyan' })).toBeInTheDocument();
  expect(screen.getByLabelText('Custom color')).toBeInTheDocument();
});

test('a new label starts on the first color no label uses', async () => {
  store.labels.value = LABEL_COLORS.slice(0, 3).map((c, i) => ({ name: `l${i}`, color: c.hex, count: 0 }));
  render(<LabelEditor open onClose={() => {}} />);
  expect(screen.getByRole('radio', { name: LABEL_COLORS[3]!.name })).toHaveAttribute('aria-checked', 'true');
  fireEvent.input(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'ops' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  await waitFor(() => expect(api.createLabel).toHaveBeenCalledWith('ops', LABEL_COLORS[3]!.hex));
});

test('a custom color is saved as picked', async () => {
  store.labels.value = [];
  render(<LabelEditor open onClose={() => {}} />);
  fireEvent.input(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'mine' } });
  fireEvent.input(screen.getByLabelText('Custom color'), { target: { value: '#123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  await waitFor(() => expect(api.createLabel).toHaveBeenCalledWith('mine', '#123456'));
});
