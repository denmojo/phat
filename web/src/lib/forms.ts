// Winlink forms open in their own tab and post back to the server; the
// composer polls for the result and fills itself in. The forminstance
// cookie ties the posted form to this composer, and the server attaches
// the form's files on send by the same cookie.
import * as api from './api';
import type { Message } from './types';
import { composerOpen, draft } from '../pages/mailbox/store';

let timer: ReturnType<typeof setTimeout> | null = null;
let polling = false;

const split = (s: string) => s.split(/[ ;,]/).filter(Boolean);

// formName returns the form's name for an RMS Express form attachment,
// or null for any other file.
export function formName(file: string): string | null {
  const m = file.match(/^RMS_Express_Form_([\w .]+?)(?:-\d+)?\.xml$/i);
  return m ? m[1]! : null;
}

export function startFormPolling(): void {
  stopFormPolling();
  document.cookie = `forminstance=${Math.floor(Math.random() * 1e9)};path=/;max-age=86400`;
  polling = true;
  void poll();
}

export function stopFormPolling(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  polling = false;
  document.cookie = 'forminstance=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

async function poll(): Promise<void> {
  if (!polling || !composerOpen.value) return;
  let data: Record<string, unknown>;
  try {
    data = await api.pollForm();
  } catch {
    // Nothing posted yet.
    if (polling && composerOpen.value) timer = setTimeout(() => void poll(), 1000);
    return;
  }
  if (!polling || !composerOpen.value) return;
  const str = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : '');
  const d = { ...draft.value, body: str('msg_body') };
  if (str('msg_to')) d.to = split(str('msg_to'));
  if (str('msg_cc')) d.cc = split(str('msg_cc'));
  // A form-based reply keeps the composer's Re: subject when the form sends none.
  if (str('msg_subject')) d.subject = str('msg_subject');
  draft.value = d;
}

// replyFormFor opens the reply form when the message carries a form whose
// definition names a reply template. Only the first form attachment counts.
export async function replyFormFor(msg: Message): Promise<void> {
  const file = (msg.Files ?? []).find((f) => formName(f.Name));
  if (!file) return;
  const url = api.attachmentUrl(msg.Folder, msg.MID, file.Name);
  let xml: string;
  try {
    const res = await fetch(`${url}?rendertohtml=false`);
    if (!res.ok) return;
    xml = await res.text();
  } catch {
    return;
  }
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const tmpl = doc.evaluate('/RMS_Express_Form/form_parameters/reply_template', doc, null, XPathResult.STRING_TYPE, null);
  if (!tmpl.stringValue) return;
  startFormPolling();
  window.open(`${api.attachmentUrl(msg.Folder, msg.MID, file.Name, true)}&in-reply-to=${encodeURIComponent(`${msg.Folder}/${msg.MID}`)}`);
}
