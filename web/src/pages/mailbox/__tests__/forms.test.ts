vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  pollForm: vi.fn(),
}));
import * as api from '../../../lib/api';
import * as store from '../store';
import { replyFormFor, startFormPolling, stopFormPolling } from '../../../lib/forms';
import type { Message } from '../../../lib/types';

const poll = api.pollForm as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  store.composerOpen.value = true;
  store.draft.value = { ...store.emptyDraft(), subject: 'Re: ICS-213' };
  document.cookie = 'forminstance=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
});
afterEach(() => {
  stopFormPolling();
  vi.useRealTimers();
});

test('polling sets the forminstance cookie, retries each second, then fills the composer', async () => {
  poll.mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce({
    msg_to: 'EOC-1;N5CALL', msg_cc: '', msg_subject: '', msg_body: 'Form body',
  });
  startFormPolling();
  expect(document.cookie).toMatch(/forminstance=\d+/);
  await vi.advanceTimersByTimeAsync(0);
  expect(poll).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(poll).toHaveBeenCalledTimes(2);
  expect(store.draft.value.to).toEqual(['EOC-1', 'N5CALL']);
  expect(store.draft.value.body).toBe('Form body');
  // An empty subject from the form keeps the reply's Re: subject.
  expect(store.draft.value.subject).toBe('Re: ICS-213');
});

test('stopping clears the cookie and the retry', async () => {
  poll.mockRejectedValue(new Error('404'));
  startFormPolling();
  await vi.advanceTimersByTimeAsync(0);
  stopFormPolling();
  expect(document.cookie).not.toMatch(/forminstance=\d+/);
  await vi.advanceTimersByTimeAsync(3000);
  expect(poll).toHaveBeenCalledTimes(1);
});

const formMsg = (name: string): Message => ({
  MID: 'm1', Folder: 'in', From: { Addr: 'EOC-1' }, To: [], Cc: null, Subject: 's', Date: '', Size: 1,
  Unread: false, P2POnly: false, Starred: false, Labels: [], Body: '', BodyHTML: '', Files: [{ Name: name, Size: 1 }],
});

test('a form with a reply template opens the reply form and starts polling', async () => {
  vi.useRealTimers();
  const xml = '<RMS_Express_Form><form_parameters><reply_template>ICS213_Reply.txt</reply_template></form_parameters></RMS_Express_Form>';
  vi.stubGlobal('fetch', vi.fn(async () => new Response(xml)));
  const open = vi.fn();
  vi.stubGlobal('open', open);
  poll.mockRejectedValue(new Error('404'));
  await replyFormFor(formMsg('RMS_Express_Form_ICS213_Initial_Viewer.xml'));
  expect(fetch).toHaveBeenCalledWith('/api/mailbox/in/m1/RMS_Express_Form_ICS213_Initial_Viewer.xml?rendertohtml=false');
  expect(open).toHaveBeenCalledWith('/api/mailbox/in/m1/RMS_Express_Form_ICS213_Initial_Viewer.xml?rendertohtml=true&in-reply-to=in%2Fm1');
  expect(document.cookie).toMatch(/forminstance=\d+/);
  vi.unstubAllGlobals();
});

test('a form without a reply template opens nothing', async () => {
  vi.useRealTimers();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<RMS_Express_Form><form_parameters/></RMS_Express_Form>')));
  const open = vi.fn();
  vi.stubGlobal('open', open);
  await replyFormFor(formMsg('RMS_Express_Form_ICS213_Initial_Viewer.xml'));
  expect(open).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test('a message without form attachments fetches nothing', async () => {
  vi.useRealTimers();
  vi.stubGlobal('fetch', vi.fn());
  await replyFormFor(formMsg('photo.jpg'));
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
