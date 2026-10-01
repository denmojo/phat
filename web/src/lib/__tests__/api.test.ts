import * as api from '../api';
import { ApiError } from '../api';

type Call = { url: string; init?: RequestInit };
let calls: Call[];
function stub(status = 200, body: unknown = []) {
  calls = [];
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(text, { status });
  }) as typeof fetch;
}

test('list maps every view kind to its URL', async () => {
  stub();
  await api.list({ kind: 'folder', name: 'Radio Club' });
  await api.list({ kind: 'label', name: 'Radio Club/ARES' });
  await api.list({ kind: 'starred' });
  await api.list({ kind: 'search', q: 'net & fuel' });
  expect(calls.map((c) => c.url)).toEqual([
    '/api/mailbox/Radio%20Club',
    '/api/mailbox/all?label=Radio%20Club%2FARES',
    '/api/starred',
    '/api/search?q=net%20%26%20fuel',
  ]);
});

test('move posts the MIDs and destination as JSON', async () => {
  stub(200, { ok: ['A'], failed: {} });
  const res = await api.move(['A', 'B'], 'Club');
  expect(calls[0]!.url).toBe('/api/messages/move');
  expect(calls[0]!.init?.method).toBe('POST');
  expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ mids: ['A', 'B'], to: 'Club' });
  expect(res.ok).toEqual(['A']);
});

test('a 409 becomes an ApiError carrying status and body', async () => {
  stub(409, 'destination exists\n');
  const err = await api.renameFolder('Club', 'ARES').catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(409);
  expect(err.body).toContain('destination exists');
  expect(calls[0]!.url).toBe('/api/folders/Club');
  expect(calls[0]!.init?.method).toBe('PATCH');
});

test('a bulk 404 still hands back the per-MID result', async () => {
  stub(404, { ok: [], failed: { GHOST: 'not found' } });
  const err = await api.move(['GHOST'], 'Club').catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err.result).toEqual({ ok: [], failed: { GHOST: 'not found' } });
});

test('label PATCH escapes the name in the path', async () => {
  stub(200, 'OK');
  await api.updateLabel('Radio Club/ARES', { color: '#2563eb' });
  expect(calls[0]!.url).toBe('/api/labels/Radio%20Club%2FARES');
  expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ color: '#2563eb' });
});

test('attachmentUrl escapes each part', () => {
  expect(api.attachmentUrl('in', 'ABC', 'photo 1.jpg')).toBe('/api/mailbox/in/ABC/photo%201.jpg');
  expect(api.attachmentUrl('in', 'ABC', 'form.xml', true)).toBe('/api/mailbox/in/ABC/form.xml?rendertohtml=true');
});

test('message fills in the folder it was read from', async () => {
  stub(200, { MID: 'A', Subject: 'x' });
  const m = await api.message('Radio Club', 'A');
  expect(calls[0]!.url).toBe('/api/mailbox/Radio%20Club/A');
  expect(m.Folder).toBe('Radio Club');
});
