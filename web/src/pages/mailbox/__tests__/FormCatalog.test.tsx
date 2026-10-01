vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  formCatalog: vi.fn(async () => ({
    path: '/forms', version: '1.0.200', name: '', form_count: 3,
    folders: [
      { name: 'ICS USA Forms', form_count: 2, folders: [], forms: [
        { name: 'ICS213 General Message', template_path: 'ICS USA Forms/ICS213.txt' },
        { name: 'ICS205 Radio Plan', template_path: 'ICS USA Forms/ICS205.txt' },
      ] },
      { name: 'Empty', form_count: 0, folders: [], forms: [] },
    ],
    forms: [{ name: 'Quick Message', template_path: 'Quick.txt' }],
  })),
  formsUpdate: vi.fn(async () => ({ action: 'update', newestVersion: '1.0.201' })),
  pollForm: vi.fn(async () => { throw new Error('404'); }),
}));
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import * as api from '../../../lib/api';
import * as store from '../store';
import { FormCatalog } from '../FormCatalog';

beforeEach(() => {
  vi.clearAllMocks();
  store.composerOpen.value = true;
  store.draft.value = { ...store.emptyDraft(), inReplyTo: 'in/m1' };
  vi.stubGlobal('open', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

test('lists folders that hold forms, and a filter narrows to matching forms', async () => {
  render(<FormCatalog open onClose={() => {}} />);
  expect(await screen.findByText('ICS USA Forms')).toBeInTheDocument();
  expect(screen.queryByText('Empty')).toBeNull();
  expect(screen.getByText('1.0.200', { exact: false })).toBeInTheDocument();
  fireEvent.input(screen.getByRole('searchbox', { name: 'Filter forms' }), { target: { value: '205' } });
  expect(screen.getByRole('button', { name: 'ICS205 Radio Plan' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'ICS213 General Message' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Quick Message' })).toBeNull();
});

test('choosing a form opens it with the reply reference and closes the catalog', async () => {
  const onClose = vi.fn();
  render(<FormCatalog open onClose={onClose} />);
  fireEvent.click(await screen.findByText('ICS USA Forms'));
  fireEvent.click(screen.getByRole('button', { name: 'ICS213 General Message' }));
  expect(window.open).toHaveBeenCalledWith('/api/forms?template=ICS%20USA%20Forms%2FICS213.txt&in-reply-to=in%2Fm1');
  expect(document.cookie).toMatch(/forminstance=\d+/);
  expect(onClose).toHaveBeenCalled();
});

test('Update reports the new version', async () => {
  render(<FormCatalog open onClose={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Update forms' }));
  await waitFor(() => expect(api.formsUpdate).toHaveBeenCalled());
  expect(await screen.findByText('Updated forms to 1.0.201')).toBeInTheDocument();
});
