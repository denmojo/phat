vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  move: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  setLabels: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  star: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  setRead: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  message: vi.fn(async () => null),
  remove: vi.fn(async (mids: string[]) => ({ ok: mids, failed: {} })),
  list: vi.fn(async () => []),
  folders: vi.fn(async () => []),
  labels: vi.fn(async () => []),
}));
import { render, screen, fireEvent, waitFor, within } from '@testing-library/preact';
import * as api from '../../../lib/api';
import * as store from '../store';
import { MessagePane } from '../MessagePane';

const msg = {
  MID: 'm1', Folder: 'in', From: { Addr: 'EOC-1' }, To: [{ Addr: 'N0CALL' }], Cc: null, Subject: 'Shelter status',
  Date: '2026-09-30T15:31:00Z', Size: 1, Unread: false, P2POnly: false, Starred: false, Labels: ['net'],
  Body: 'All good.', BodyHTML: '', Files: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  store.view.value = { kind: 'folder', name: 'in' };
  store.labels.value = [{ name: 'net', color: '#2563eb', count: 1 }, { name: 'urgent', color: '#dc2626', count: 0 }];
  store.folders.value = [{ name: 'in', system: true, count: 1, unread: 0 }, { name: 'Club', system: false, count: 0, unread: 0 }];
  store.openMessage.value = msg as never;
  store.selected.value = new Set(['other']);
});

test('shows subject, sender and label chips', () => {
  render(<MessagePane />);
  expect(screen.getByRole('heading', { name: /Shelter status/ })).toBeInTheDocument();
  expect(screen.getByText('EOC-1')).toBeInTheDocument();
  expect(screen.getByText('net')).toBeInTheDocument();
});

test('Archive moves this message, not the selection, and closes it', async () => {
  render(<MessagePane />);
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
  await waitFor(() => expect(api.move).toHaveBeenCalledWith(['m1'], 'archive'));
  await waitFor(() => expect(store.openMessage.value).toBeNull());
});

test('the label menu acts on this message', async () => {
  render(<MessagePane />);
  fireEvent.click(screen.getByRole('button', { name: 'Label' }));
  const net = screen.getByRole('menuitemcheckbox', { name: 'net' });
  expect(net).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'urgent' }));
  await waitFor(() => expect(api.setLabels).toHaveBeenCalledWith(['m1'], ['urgent'], []));
});

test('Back closes the message', () => {
  render(<MessagePane />);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(store.openMessage.value).toBeNull();
});

test('the body renders the server-sanitized HTML, with P2P only and Cc in the headers', () => {
  store.openMessage.value = { ...msg, P2POnly: true, Cc: [{ Addr: 'N5CALL' }], BodyHTML: '<p>All <blockquote>quoted</blockquote></p>' } as never;
  render(<MessagePane />);
  expect(document.querySelector('.msg .body blockquote')).toHaveTextContent('quoted');
  expect(screen.getByText('P2P only')).toBeInTheDocument();
  expect(screen.getByText(/Cc N5CALL/)).toBeInTheDocument();
});

test('opening an unread message marks it read', async () => {
  (api.message as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...msg, Unread: true });
  store.rows.value = [{ MID: 'm1', Unread: true } as never];
  await store.openMsg('in', 'm1');
  expect(api.setRead).toHaveBeenCalledWith(['m1'], true);
});

test('a form attachment is a button that opens the rendered form; images preview inline', () => {
  store.openMessage.value = { ...msg, Files: [
    { Name: 'RMS_Express_Form_ICS213_Initial_Viewer.xml', Size: 900 },
    { Name: 'map.jpg', Size: 2048 },
    { Name: 'log.txt', Size: 10 },
  ] } as never;
  render(<MessagePane />);
  const form = screen.getByRole('button', { name: /ICS213 Initial Viewer/ });
  expect(form.getAttribute('href')).toMatch(/rendertohtml=true$/);
  expect(document.querySelector('img[alt="map.jpg"]')?.getAttribute('src')).toBe('/api/mailbox/in/m1/map.jpg');
  expect(screen.getByRole('link', { name: /log\.txt/ }).getAttribute('href')).toBe('/api/mailbox/in/m1/log.txt');
});

test('Reply opens the composer addressed to the sender', () => {
  render(<MessagePane />);
  fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
  expect(store.composerOpen.value).toBe(true);
  expect(store.draft.value.to).toEqual(['EOC-1']);
  store.composerOpen.value = false;
});

test('Delete asks first, and only Delete in the dialog deletes', async () => {
  render(<MessagePane />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  const dialog = screen.getByRole('dialog');
  expect(api.remove).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(api.remove).toHaveBeenCalledWith(['m1']));
});

test('in the archive, Archive becomes Move to Inbox', async () => {
  store.openMessage.value = { ...msg, Folder: 'archive' } as never;
  render(<MessagePane />);
  expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Move to Inbox' }));
  await waitFor(() => expect(api.move).toHaveBeenCalledWith(['m1'], 'in'));
});

test('the arrows step through the list and switch off at its end', async () => {
  store.rows.value = [{ MID: 'm0', Folder: 'in', Unread: false }, { MID: 'm1', Folder: 'in', Unread: false }] as never;
  vi.mocked(api.message).mockResolvedValueOnce({ ...msg, MID: 'm0' } as never);
  render(<MessagePane />);
  expect(screen.getByRole('button', { name: 'Next message' })).toBeDisabled();
  const prev = screen.getByRole('button', { name: 'Previous message' });
  expect(prev).toBeEnabled();
  fireEvent.click(prev);
  await waitFor(() => expect(api.message).toHaveBeenCalledWith('in', 'm0'));
  await waitFor(() => expect(store.openMessage.value).toMatchObject({ MID: 'm0' }));
  store.rows.value = [];
});

test('an arrow that switches off at the end hands focus to the other arrow', async () => {
  store.rows.value = [{ MID: 'm0', Folder: 'in', Unread: false }, { MID: 'm1', Folder: 'in', Unread: false }] as never;
  vi.mocked(api.message).mockResolvedValueOnce({ ...msg, MID: 'm0' } as never);
  render(<MessagePane />);
  const prev = screen.getByRole('button', { name: 'Previous message' });
  prev.focus();
  fireEvent.click(prev);
  await waitFor(() => expect(prev).toBeDisabled());
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next message' }));
  store.rows.value = [];
});

test('stepping to another message starts it scrolled to the top', async () => {
  store.rows.value = [{ MID: 'm0', Folder: 'in', Unread: false }, { MID: 'm1', Folder: 'in', Unread: false }] as never;
  vi.mocked(api.message).mockResolvedValueOnce({ ...msg, MID: 'm0' } as never);
  const { container } = render(<MessagePane />);
  const before = container.querySelector('article.msg') as HTMLElement;
  before.scrollTop = 120;
  fireEvent.click(screen.getByRole('button', { name: 'Previous message' }));
  await waitFor(() => expect(store.openMessage.value).toMatchObject({ MID: 'm0' }));
  const after = container.querySelector('article.msg') as HTMLElement;
  expect(after).not.toBe(before);
  expect(after.scrollTop).toBe(0);
  store.rows.value = [];
});

describe('j and k', () => {
  const three = [
    { MID: 'm0', Folder: 'in', Unread: false },
    { MID: 'm1', Folder: 'in', Unread: false },
    { MID: 'm2', Folder: 'in', Unread: false },
  ] as never;
  afterEach(() => { store.rows.value = []; document.body.innerHTML = ''; });

  test('j opens the next message and k the previous one', async () => {
    store.rows.value = three;
    vi.mocked(api.message).mockResolvedValueOnce({ ...msg, MID: 'm2' } as never);
    render(<MessagePane />);
    fireEvent.keyDown(document.body, { key: 'j' });
    await waitFor(() => expect(store.openMessage.value).toMatchObject({ MID: 'm2' }));
    expect(api.message).toHaveBeenCalledWith('in', 'm2');
    vi.mocked(api.message).mockResolvedValueOnce({ ...msg, MID: 'm1' } as never);
    fireEvent.keyDown(document.body, { key: 'k' });
    await waitFor(() => expect(store.openMessage.value).toMatchObject({ MID: 'm1' }));
  });

  test('typing in a field, a held modifier, or an open dialog leaves them alone', () => {
    store.rows.value = three;
    render(<MessagePane />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'j' });
    fireEvent.keyDown(document.body, { key: 'j', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);
    fireEvent.keyDown(document.body, { key: 'j' });
    expect(api.message).not.toHaveBeenCalled();
  });
});

test('the arrows\' tooltips name their keys', () => {
  render(<MessagePane />);
  expect(screen.getByRole('button', { name: 'Next message' })).toHaveAttribute('title', 'Next message (j)');
  expect(screen.getByRole('button', { name: 'Previous message' })).toHaveAttribute('title', 'Previous message (k)');
});

describe('message-view keys', () => {
  const key = (k: string) => fireEvent.keyDown(document.body, { key: k });
  afterEach(() => { store.composerOpen.value = false; });

  test('n starts a new message with the message still open', () => {
    render(<MessagePane />);
    key('n');
    expect(store.composerOpen.value).toBe(true);
    expect(store.draft.value.to).toEqual([]);
    expect(store.draft.value.subject).toBe('');
    expect(store.openMessage.value?.MID).toBe('m1');
  });

  test('r replies, R replies to all, f forwards', () => {
    store.openMessage.value = { ...msg, Cc: [{ Addr: 'W1AW' }] } as never;
    render(<MessagePane />);
    key('r');
    expect(store.composerOpen.value).toBe(true);
    expect(store.draft.value.to).toEqual(['EOC-1']);
    expect(store.draft.value.cc).toEqual([]);
    store.composerOpen.value = false;
    key('R');
    expect(store.draft.value.cc).toContain('W1AW');
    store.composerOpen.value = false;
    key('f');
    expect(store.draft.value.to).toEqual([]);
    expect(store.draft.value.subject).toMatch(/^Fw: /);
  });

  test('a archives, and in the archive moves back to the Inbox', async () => {
    const { unmount } = render(<MessagePane />);
    key('a');
    await waitFor(() => expect(api.move).toHaveBeenCalledWith(['m1'], 'archive'));
    unmount();
    store.openMessage.value = { ...msg, Folder: 'archive' } as never;
    render(<MessagePane />);
    key('a');
    await waitFor(() => expect(api.move).toHaveBeenCalledWith(['m1'], 'in'));
  });

  test('t asks to delete with Delete focused, so Enter confirms', async () => {
    render(<MessagePane />);
    key('t');
    const dialog = screen.getByRole('dialog');
    const del = within(dialog).getByRole('button', { name: 'Delete' });
    expect(document.activeElement).toBe(del);
    expect(api.remove).not.toHaveBeenCalled();
    fireEvent.click(del);
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith(['m1']));
  });

  test('u marks it unread and returns to the list it came from', async () => {
    store.view.value = { kind: 'label', name: 'net' };
    render(<MessagePane />);
    key('u');
    await waitFor(() => expect(api.setRead).toHaveBeenCalledWith(['m1'], false));
    expect(store.openMessage.value).toBeNull();
    expect(store.view.value).toEqual({ kind: 'label', name: 'net' });
  });

  test('s stars it', async () => {
    render(<MessagePane />);
    key('s');
    await waitFor(() => expect(api.star).toHaveBeenCalledWith(['m1'], true));
  });

  test('l opens the label menu and m the move menu', () => {
    render(<MessagePane />);
    key('l');
    expect(screen.getByRole('menuitemcheckbox', { name: 'net' })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    key('m');
    expect(screen.getByRole('menuitem', { name: 'Club' })).toBeInTheDocument();
  });

  test('keys stand down while a menu is open', async () => {
    render(<MessagePane />);
    key('l');
    key('t');
    key('a');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.move).not.toHaveBeenCalled();
  });

  test('at phone width m opens the menu that holds the move targets', () => {
    const wide = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as never;
    try {
      render(<MessagePane />);
      key('m');
      expect(screen.getByRole('menuitem', { name: 'Move to Club' })).toBeInTheDocument();
    } finally {
      window.matchMedia = wide;
    }
  });

  test('h goes back to the list', () => {
    render(<MessagePane />);
    key('h');
    expect(store.openMessage.value).toBeNull();
  });
});
