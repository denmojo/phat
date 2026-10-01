import { mount, parseTemplate } from '../template';

const FIXTURE = [
  'Def: Name=<Ask Your name,UP>',
  'To: <Var Recipient>',
  'Subj: Check-in from <Var Name>',
  'Msg:',
  'Station: <Var Name>',
  'Status: <Select Status:Green=G,Yellow=Y,Red=R>',
  'Remarks: <Ask Remarks,MU>',
  'Tom & Jerry <3',
].join('\n');

const tick = () => new Promise((r) => setTimeout(r, 0));
const typeInto = (el: Element, v: string) => {
  (el as HTMLInputElement).value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => (init?.method === 'POST'
    ? new Response('"ok"', { status: 200 })
    : new Response(FIXTURE, { status: 200 })));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

test('parseTemplate finds the variables, prompts and selects', () => {
  const s = parseTemplate(FIXTURE);
  expect(s.getNode('Name')?.type).toBe('var');
  expect(s.getPrompt('Name')).toBe('<Ask Your name,UP>');
  expect(s.getNode('Recipient')?.type).toBe('var');
  expect(s.getNode('Status')?.options).toEqual([{ label: 'Green', value: 'G' }, { label: 'Yellow', value: 'Y' }, { label: 'Red', value: 'R' }]);
  expect(s.getNode('Remarks')?.type).toBe('ask');
});

test('renders a control per prompt, gates Submit on every prompt, and posts the answers', async () => {
  const close = vi.spyOn(window, 'close').mockImplementation(() => {});
  const app = document.getElementById('app')!;
  const state = await mount(app, '?template=Phat%20Test%2FCheck-in.txt&in-reply-to=ABC');
  expect(fetchMock).toHaveBeenCalledWith('/api/template?template=Phat+Test%2FCheck-in.txt&in-reply-to=ABC');
  expect(app.querySelector('h1')!.textContent).toBe('Phat Test/Check-in.txt');

  const recipient = app.querySelector('input[data-var="Recipient"]')!;
  const names = app.querySelectorAll('input[data-var="Name"]');
  const status = app.querySelector('select[data-node="Status"]') as HTMLSelectElement;
  const remarks = app.querySelector('textarea[data-node="Remarks"]')!;
  expect(names).toHaveLength(2);
  expect(remarks.getAttribute('placeholder')).toBe('Remarks');
  expect(Array.from(status.options).map((o) => o.textContent)).toEqual(['Choose Status', 'Green', 'Yellow', 'Red']);
  // Template text is shown as text, never parsed as markup.
  expect(app.textContent).toContain('Tom & Jerry <3');

  const submit = app.querySelector('button[type="submit"]') as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  typeInto(recipient, 'EOC-1');
  typeInto(names[0]!, 'ada');
  expect((names[1] as HTMLInputElement).value).toBe('ADA');
  status.value = 'Y';
  status.dispatchEvent(new Event('change', { bubbles: true }));
  expect(submit.disabled).toBe(true);
  typeInto(remarks, 'All good');
  expect(submit.disabled).toBe(false);

  expect(state.collectFormData()).toEqual({ responses: {
    '<Var Recipient>': 'EOC-1',
    '<Ask Your name,UP>': 'ADA',
    '<Select Status:Green=G,Yellow=Y,Red=R>': 'Y',
    '<Ask Remarks,MU>': 'All good',
  } });

  submit.click();
  await tick();
  await tick();
  expect(fetchMock).toHaveBeenLastCalledWith('/api/form?template=Phat+Test%2FCheck-in.txt&in-reply-to=ABC', expect.objectContaining({
    method: 'POST', body: JSON.stringify(state.collectFormData()),
  }));
  expect(close).toHaveBeenCalled();
});

test('a failed submit says why and keeps the window open', async () => {
  const close = vi.spyOn(window, 'close').mockImplementation(() => {});
  fetchMock.mockImplementation(async (_u: string, init?: RequestInit) => (init?.method === 'POST'
    ? new Response('mailbox full', { status: 500 })
    : new Response('To: X\nMsg:\nNo prompts here', { status: 200 })));
  const app = document.getElementById('app')!;
  await mount(app, '?template=x.txt');
  const submit = app.querySelector('button[type="submit"]') as HTMLButtonElement;
  expect(submit.disabled).toBe(false);
  submit.click();
  await tick();
  await tick();
  expect(app.querySelector('[role="alert"]')!.textContent).toBe('Failed to submit the form: mailbox full');
  expect(close).not.toHaveBeenCalled();
});

test('no template named says so', async () => {
  const app = document.getElementById('app')!;
  await mount(app, '');
  expect(app.querySelector('[role="alert"]')!.textContent).toBe('No template specified.');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('Cancel closes the window', async () => {
  const close = vi.spyOn(window, 'close').mockImplementation(() => {});
  const app = document.getElementById('app')!;
  await mount(app, '?template=x.txt');
  (Array.from(app.querySelectorAll('button')).find((b) => b.textContent === 'Cancel') as HTMLButtonElement).click();
  expect(close).toHaveBeenCalled();
});
