import { connectWs } from '../ws';

class FakeWs {
  static all: FakeWs[] = [];
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  constructor(public url: string) { FakeWs.all.push(this); }
  send(s: string) { this.sent.push(s); }
  close() { this.onclose?.(); }
  emit(o: unknown) { this.onmessage?.({ data: JSON.stringify(o) }); }
}

function handlers() {
  return {
    onOpen: vi.fn(), onClose: vi.fn(), onStatus: vi.fn(), onProgress: vi.fn(), onNotification: vi.fn(),
    onPrompt: vi.fn(), onPromptAbort: vi.fn(), onUpdateMailbox: vi.fn(), onMyCall: vi.fn(), onLogLine: vi.fn(),
  };
}

beforeEach(() => {
  FakeWs.all = [];
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWs;
});

test('answers Ping with Pong and routes messages', () => {
  const h = handlers();
  connectWs(h);
  const ws = FakeWs.all[0]!;
  ws.onopen?.();
  expect(h.onOpen).toHaveBeenCalled();
  ws.emit({ Ping: true });
  expect(ws.sent).toEqual([JSON.stringify({ Pong: true })]);
  const prompt = { id: '1', kind: 'password', message: 'Password' };
  ws.emit({ Prompt: prompt });
  expect(h.onPrompt).toHaveBeenCalledWith(prompt);
  ws.emit({ UpdateMailbox: true, MyCall: 'N0CALL' });
  expect(h.onUpdateMailbox).toHaveBeenCalled();
  expect(h.onMyCall).toHaveBeenCalledWith('N0CALL');
});

test('reconnects with a delay that doubles and resets on open', () => {
  vi.useFakeTimers();
  const h = handlers();
  connectWs(h);
  const drop = (expectDelay: number) => {
    const before = FakeWs.all.length;
    FakeWs.all[before - 1]!.onclose?.();
    vi.advanceTimersByTime(expectDelay - 1);
    expect(FakeWs.all.length).toBe(before);
    vi.advanceTimersByTime(1);
    expect(FakeWs.all.length).toBe(before + 1);
  };
  drop(1000);
  drop(2000);
  drop(4000);
  FakeWs.all[FakeWs.all.length - 1]!.onopen?.();
  drop(1000);
  vi.useRealTimers();
});

test('close stops reconnecting', () => {
  vi.useFakeTimers();
  const c = connectWs(handlers());
  c.close();
  vi.advanceTimersByTime(60000);
  expect(FakeWs.all.length).toBe(1);
  vi.useRealTimers();
});

test('routes server log lines', () => {
  const h = handlers();
  connectWs(h);
  FakeWs.all[0]!.emit({ LogLine: 'Connecting to W6EOC (telnet)...' });
  expect(h.onLogLine).toHaveBeenCalledWith('Connecting to W6EOC (telnet)...');
});
