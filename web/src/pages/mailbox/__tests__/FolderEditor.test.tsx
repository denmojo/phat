vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  createFolder: vi.fn(),
  renameFolder: vi.fn(),
  folders: vi.fn(async () => []),
  labels: vi.fn(async () => []),
}));
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import * as api from '../../../lib/api';
import { ApiError } from '../../../lib/api';
import { FolderEditor } from '../FolderEditor';

beforeEach(() => vi.clearAllMocks());

test('Enter creates the folder, refreshes the sidebar and closes', async () => {
  vi.mocked(api.createFolder).mockResolvedValue({ name: 'Club', system: false, count: 0, unread: 0 });
  const onDone = vi.fn();
  render(<FolderEditor onDone={onDone} />);
  const input = screen.getByRole('textbox', { name: 'New folder name' });
  fireEvent.input(input, { target: { value: 'Club' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(api.createFolder).toHaveBeenCalledWith('Club');
  expect(api.folders).toHaveBeenCalled();
});

test('a 409 shows the exists message and keeps the field open', async () => {
  vi.mocked(api.createFolder).mockRejectedValue(new ApiError(409, 'folder exists'));
  const onDone = vi.fn();
  render(<FolderEditor onDone={onDone} />);
  const input = screen.getByRole('textbox', { name: 'New folder name' });
  fireEvent.input(input, { target: { value: 'Club' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(await screen.findByText('A folder with that name exists')).toBeInTheDocument();
  expect(onDone).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: 'New folder name' })).toBeInTheDocument();
});

test('a 400 explains the allowed characters', async () => {
  vi.mocked(api.createFolder).mockRejectedValue(new ApiError(400, 'invalid folder name'));
  render(<FolderEditor onDone={() => {}} />);
  const input = screen.getByRole('textbox', { name: 'New folder name' });
  fireEvent.input(input, { target: { value: 'a/b' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(await screen.findByText('Letters, digits, space, - and _ only, 32 max')).toBeInTheDocument();
});

test('rename starts prefilled and calls renameFolder; Escape cancels', async () => {
  vi.mocked(api.renameFolder).mockResolvedValue('');
  const onDone = vi.fn();
  render(<FolderEditor rename="Club" onDone={onDone} />);
  const input = screen.getByRole('textbox', { name: 'Rename folder Club' }) as HTMLInputElement;
  expect(input.value).toBe('Club');
  fireEvent.input(input, { target: { value: 'ARES' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(api.renameFolder).toHaveBeenCalledWith('Club', 'ARES');

  const onCancel = vi.fn();
  render(<FolderEditor onDone={onCancel} />);
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'New folder name' }), { key: 'Escape' });
  expect(onCancel).toHaveBeenCalled();
  expect(api.createFolder).not.toHaveBeenCalled();
});
