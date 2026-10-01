vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  send: vi.fn(async () => 'Message posted (0.00 kB)'),
  list: vi.fn(async () => []),
  folders: vi.fn(async () => []),
  labels: vi.fn(async () => []),
  pollForm: vi.fn(async () => { throw new Error('not yet'); }),
}));
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import * as api from '../../../lib/api';
import * as store from '../store';
import { Composer, compose, editAsNew, forward, reply } from '../Composer';
import type { Message } from '../../../lib/types';

const msg: Message = {
  MID: 'm1', Folder: 'in', From: { Addr: 'W6EOC' }, To: [{ Addr: 'N0CALL' }, { Addr: 'K6ABC' }], Cc: [{ Addr: 'W6EOC' }, { Addr: 'KJ6XYZ' }],
  Subject: 'Shelter status', Date: '2026-09-30T15:31:00Z', Size: 1, Unread: false, P2POnly: false, Starred: false, Labels: [],
  Body: 'All good.\nTwo cots left.', BodyHTML: '', Files: null,
};

// pickFiles fires a real change event; @testing-library/preact turns
// fireEvent.change into an input event, which a file picker never sends.
function pickFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

const sent = () => (api.send as unknown as { mock: { calls: [FormData][] } }).mock.calls[0]![0];

beforeEach(() => {
  vi.clearAllMocks();
  store.mycall.value = 'N0CALL';
  store.composerOpen.value = false;
  store.draft.value = store.emptyDraft();
  vi.stubGlobal('open', vi.fn());
});

test('reply all addresses the sender, copies everyone else but me and the sender, and quotes the body', () => {
  reply(msg, true);
  const d = store.draft.value;
  expect(store.composerOpen.value).toBe(true);
  expect(d.to).toEqual(['W6EOC']);
  expect(d.cc).toEqual(['K6ABC', 'KJ6XYZ']);
  expect(d.subject).toBe('Re: Shelter status');
  expect(d.body).toBe('\n\n--- 2026-09-30T15:31:00Z W6EOC wrote: ---\n>All good.\n>Two cots left.\n');
  expect(d.inReplyTo).toBe('in/m1');
});

test('reply leaves Cc empty and never doubles Re:', () => {
  reply({ ...msg, Subject: 're: Shelter status' }, false);
  expect(store.draft.value.cc).toEqual([]);
  expect(store.draft.value.subject).toBe('re: Shelter status');
});

test('forward has no recipients, a Fw: subject, the quote, and refetches the attachments', async () => {
  const fetchMock = vi.fn(async () => new Response(new Blob(['x'], { type: 'image/png' })));
  vi.stubGlobal('fetch', fetchMock);
  forward({ ...msg, Files: [{ Name: 'map.png', Size: 1 }] });
  expect(store.draft.value.to).toEqual([]);
  expect(store.draft.value.subject).toBe('Fw: Shelter status');
  expect(store.draft.value.body.startsWith('--- 2026-09-30T15:31:00Z W6EOC wrote: ---\n>All good.')).toBe(true);
  expect(fetchMock).toHaveBeenCalledWith('/api/mailbox/in/m1/map.png');
  await waitFor(() => expect(store.draft.value.files.map((f) => f.name)).toEqual(['map.png']));
  vi.unstubAllGlobals();
});

test('edit as new copies recipients, subject and body as they were', () => {
  vi.stubGlobal('fetch', vi.fn());
  editAsNew(msg);
  expect(store.draft.value.to).toEqual(['N0CALL', 'K6ABC']);
  expect(store.draft.value.cc).toEqual(['W6EOC', 'KJ6XYZ']);
  expect(store.draft.value.subject).toBe('Shelter status');
  expect(store.draft.value.body).toBe('All good.\nTwo cots left.');
  vi.unstubAllGlobals();
});

test('Send with an empty body and subject posts the defaults, a date, and closes', async () => {
  compose();
  render(<Composer />);
  store.draft.value = { ...store.draft.value, to: ['W6EOC', 'K6ABC'] };
  fireEvent.click(await screen.findByRole('button', { name: 'Send' }));
  await waitFor(() => expect(api.send).toHaveBeenCalled());
  const f = sent();
  expect(f.get('to')).toBe('W6EOC,K6ABC');
  expect(f.get('body')).toBe('<No message body>');
  expect(f.get('subject')).toBe('<No subject>');
  expect(Number.isNaN(Date.parse(String(f.get('date'))))).toBe(false);
  expect(f.get('in_reply_to')).toBeNull();
  expect(f.get('p2ponly')).toBeNull();
  await waitFor(() => expect(store.composerOpen.value).toBe(false));
});

test('Send carries attachments, the reply reference and P2P only', async () => {
  reply(msg, false);
  store.draft.value = { ...store.draft.value, files: [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')] };
  render(<Composer />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'P2P only' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(api.send).toHaveBeenCalled());
  const f = sent();
  expect((f.getAll('files') as File[]).map((x) => x.name)).toEqual(['a.txt', 'b.txt']);
  expect(f.get('in_reply_to')).toBe('in/m1');
  expect(f.get('p2ponly')).toBe('on');
});

test('picked files accumulate across picks and each can be removed', async () => {
  compose();
  render(<Composer />);
  const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
  pickFiles(input, [new File(['a'], 'a.txt')]);
  pickFiles(input, [new File(['b'], 'b.txt')]);
  expect(store.draft.value.files.map((f) => f.name)).toEqual(['a.txt', 'b.txt']);
  fireEvent.click(await screen.findByRole('button', { name: 'Remove a.txt' }));
  expect(store.draft.value.files.map((f) => f.name)).toEqual(['b.txt']);
});

test('Escape on a typed draft asks before discarding, and Keep editing keeps it', async () => {
  compose();
  render(<Composer />);
  store.draft.value = { ...store.draft.value, subject: 'Net check-in' };
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(await screen.findByText('Discard this message?')).toBeInTheDocument();
  expect(store.composerOpen.value).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  await waitFor(() => expect(screen.queryByText('Discard this message?')).not.toBeInTheDocument());
  expect(store.composerOpen.value).toBe(true);
  expect(store.draft.value.subject).toBe('Net check-in');
});

test('Cancel on a typed draft discards only after Discard is pressed', async () => {
  compose();
  render(<Composer />);
  store.draft.value = { ...store.draft.value, body: 'Two cots left.' };
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
  expect(store.composerOpen.value).toBe(false);
  expect(store.draft.value.body).toBe('');
});

test('an untouched reply closes on Escape without asking', async () => {
  reply(msg, false);
  render(<Composer />);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(store.composerOpen.value).toBe(false);
  expect(screen.queryByText('Discard this message?')).not.toBeInTheDocument();
});

test('a refused send keeps the composer open and shows the server error', async () => {
  (api.send as unknown as { mockRejectedValueOnce: (e: unknown) => void })
    .mockRejectedValueOnce(new api.ApiError(400, 'Validation error: no recipients'));
  compose();
  render(<Composer />);
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Validation error: no recipients');
  expect(store.composerOpen.value).toBe(true);
});
