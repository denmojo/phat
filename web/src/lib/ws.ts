// Websocket client for /ws. It answers the server's Ping itself and
// reconnects after 1 s, doubling to 30 s, back to 1 s once a connection opens.
import type { Notification, Progress, Prompt, Status } from './types';

export type Handlers = {
  onOpen: () => void;
  onClose: () => void;
  onStatus: (s: Status) => void;
  onProgress: (p: Progress) => void;
  onNotification: (n: Notification) => void;
  onPrompt: (p: Prompt) => void;
  onPromptAbort: () => void;
  onUpdateMailbox: () => void;
  onMyCall: (call: string) => void;
  onLogLine: (line: string) => void;
};

export function connectWs(h: Handlers) {
  let ws: WebSocket | null = null;
  let delay = 1000;
  let closed = false;
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  const open = () => {
    ws = new WebSocket(url);
    ws.onopen = () => { delay = 1000; h.onOpen(); };
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.MyCall) h.onMyCall(m.MyCall);
      if (m.Notification) h.onNotification(m.Notification);
      if (m.UpdateMailbox) h.onUpdateMailbox();
      if (m.Status) h.onStatus(m.Status);
      if (m.Progress) h.onProgress(m.Progress);
      if (m.Prompt) h.onPrompt(m.Prompt);
      if (m.PromptAbort) h.onPromptAbort();
      if (m.LogLine) h.onLogLine(m.LogLine);
      if (m.Ping) ws?.send(JSON.stringify({ Pong: true }));
    };
    ws.onclose = () => {
      h.onClose();
      if (closed) return;
      setTimeout(open, delay);
      delay = Math.min(delay * 2, 30000);
    };
  };
  open();
  return {
    send: (o: unknown) => ws?.send(JSON.stringify(o)),
    close: () => { closed = true; ws?.close(); },
  };
}
