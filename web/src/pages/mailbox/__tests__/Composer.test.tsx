vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  send: vi.fn(async () => 'Message posted (0.00 kB)'),
  remove: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  list: vi.fn(async () => []),
  folders: vi.fn(async () => []),
  labels: vi.fn(async () => []),
  pollForm: vi.fn(async () => { throw new Error('not yet'); }),
}));
vi.mock('../../../ui/Toast', async (orig) => ({ ...(await orig<typeof import('../../../ui/Toast')>()), toast: vi.fn() }));
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { toast } from '../../../ui/Toast';
import * as api from '../../../lib/api';
import * as store from '../store';
import { Composer, compose, editAsNew, editOutbox, forward, reply } from '../Composer';
import type { Message } from '../../../lib/types';

const msg: Message = {
  MID: 'm1', Folder: 'in', From: { Addr: 'EOC-1' }, To: [{ Addr: 'N0CALL' }, { Addr: 'N5CALL' }], Cc: [{ Addr: 'EOC-1' }, { Addr: 'N6CALL' }],
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
  expect(d.to).toEqual(['EOC-1']);
  expect(d.cc).toEqual(['N5CALL', 'N6CALL']);
  expect(d.subject).toBe('Re: Shelter status');
  expect(d.body).toBe('\n\n--- 2026-09-30T15:31:00Z EOC-1 wrote: ---\n>All good.\n>Two cots left.\n');
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
  expect(store.draft.value.body.startsWith('--- 2026-09-30T15:31:00Z EOC-1 wrote: ---\n>All good.')).toBe(true);
  expect(fetchMock).toHaveBeenCalledWith('/api/mailbox/in/m1/map.png');
  await waitFor(() => expect(store.draft.value.files.map((f) => f.name)).toEqual(['map.png']));
  vi.unstubAllGlobals();
});

test('edit as new copies recipients, subject and body as they were', () => {
  vi.stubGlobal('fetch', vi.fn());
  editAsNew(msg);
  expect(store.draft.value.to).toEqual(['N0CALL', 'N5CALL']);
  expect(store.draft.value.cc).toEqual(['EOC-1', 'N6CALL']);
  expect(store.draft.value.subject).toBe('Shelter status');
  expect(store.draft.value.body).toBe('All good.\nTwo cots left.');
  vi.unstubAllGlobals();
});

test('Send with an empty body and subject posts the defaults, a date, and closes', async () => {
  compose();
  render(<Composer />);
  store.draft.value = { ...store.draft.value, to: ['EOC-1', 'N5CALL'] };
  fireEvent.click(await screen.findByRole('button', { name: 'Send' }));
  await waitFor(() => expect(api.send).toHaveBeenCalled());
  const f = sent();
  expect(f.get('to')).toBe('EOC-1,N5CALL');
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

describe('editing a message in the Outbox', () => {
  const queued: Message = { ...msg, MID: 'q1', Folder: 'out', From: { Addr: 'N0CALL' }, To: [{ Addr: 'EOC-1' }], Cc: null, P2POnly: true };
  afterEach(() => { store.openMessage.value = null; });

  test('opens the message as it is, titled Edit message', async () => {
    editOutbox(queued);
    render(<Composer />);
    const d = store.draft.value;
    expect(d.to).toEqual(['EOC-1']);
    expect(d.subject).toBe('Shelter status');
    expect(d.body).toBe('All good.\nTwo cots left.');
    expect(d.p2pOnly).toBe(true);
    expect(d.replaces).toBe('q1');
    expect(await screen.findByRole('dialog', { name: 'Edit message' })).toBeInTheDocument();
  });

  test('Send posts the new version, then deletes the original and closes it', async () => {
    store.openMessage.value = queued as never;
    editOutbox(queued);
    render(<Composer />);
    store.draft.value = { ...store.draft.value, body: 'Three cots left.' };
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith(['q1']));
    expect(sent().get('body')).toBe('Three cots left.');
    expect(sent().get('p2ponly')).toBe('on');
    const postedFirst = (api.send as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0]!;
    const removedAfter = (api.remove as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0]!;
    expect(postedFirst).toBeLessThan(removedAfter);
    await waitFor(() => expect(store.composerOpen.value).toBe(false));
    expect(store.openMessage.value).toBeNull();
  });

  test('a refused post leaves the original in place and the composer open', async () => {
    (api.send as unknown as { mockRejectedValueOnce: (e: unknown) => void })
      .mockRejectedValueOnce(new api.ApiError(400, 'Validation error: no recipients'));
    editOutbox(queued);
    render(<Composer />);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Validation error: no recipients');
    expect(api.remove).not.toHaveBeenCalled();
    expect(store.composerOpen.value).toBe(true);
  });

  test('Discard leaves the original alone', async () => {
    editOutbox(queued);
    render(<Composer />);
    store.draft.value = { ...store.draft.value, body: 'Changed my mind.' };
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(store.composerOpen.value).toBe(false);
    expect(api.send).not.toHaveBeenCalled();
    expect(api.remove).not.toHaveBeenCalled();
  });

  test('when the post succeeds but the original cannot be deleted, the toast says why in words', async () => {
    (api.remove as unknown as { mockRejectedValueOnce: (e: unknown) => void })
      .mockRejectedValueOnce(new api.ApiError(207, '{"ok":[],"failed":{"q1":"not found"}}', { ok: [], failed: { q1: 'not found' } }));
    editOutbox(queued);
    render(<Composer />);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(
      'The edit is queued, but the original could not be removed: not found', { kind: 'error' }));
    expect(store.composerOpen.value).toBe(false);
  });

  test('a new message and edit as new replace nothing', () => {
    compose();
    expect(store.draft.value.replaces).toBeNull();
    editAsNew(queued);
    expect(store.draft.value.replaces).toBeNull();
  });
});
