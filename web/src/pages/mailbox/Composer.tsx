import { useCallback, useEffect, useId, useRef, useState } from 'preact/hooks';
import { FileText, Paperclip, Send } from 'lucide-preact';
import * as api from '../../lib/api';
import { replyFormFor, stopFormPolling } from '../../lib/forms';
import type { Message } from '../../lib/types';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { TokenField } from '../../ui/TokenField';
import { toast } from '../../ui/Toast';
import { DraftAttachments } from './Attachments';
import { FormCatalog } from './FormCatalog';
import { type Draft, composerOpen, draft, emptyDraft, mycall, refresh, refreshSidebar } from './store';
import './Composer.css';

const addrs = (list: { Addr: string }[] | null | undefined) => (list ?? []).map((a) => a.Addr);

function quote(m: Message): string {
  return `--- ${m.Date} ${m.From.Addr} wrote: ---\n${m.Body.split('\n').map((l) => `>${l}\n`).join('')}`;
}

// replyCc is everyone the message went to except me and the sender, once each.
function replyCc(m: Message): string[] {
  const seen = new Set([mycall.value, m.From.Addr]);
  const out: string[] = [];
  for (const a of [...addrs(m.To), ...addrs(m.Cc)]) {
    if (seen.has(a)) continue;
    seen.add(a);
    out.push(a);
  }
  return out;
}

function open(d: Draft) {
  draft.value = d;
  composerOpen.value = true;
}

// reattach fetches the message's files and adds them to the draft, the
// way forward and edit-as-new carry attachments along.
function reattach(m: Message) {
  for (const f of m.Files ?? []) {
    void fetch(api.attachmentUrl(m.Folder, m.MID, f.Name))
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`${f.Name}: HTTP ${res.status}`))))
      .then((blob) => {
        draft.value = { ...draft.value, files: [...draft.value.files, new File([blob], f.Name, { type: blob.type })] };
      })
      .catch((err) => toast(`Could not attach ${f.Name}: ${err instanceof Error ? err.message : String(err)}`, { kind: 'error' }));
  }
}

export function compose() {
  open(emptyDraft());
}

export function reply(m: Message, all: boolean) {
  open({
    ...emptyDraft(),
    to: [m.From.Addr],
    cc: all ? replyCc(m) : [],
    subject: /^re:/i.test(m.Subject) ? m.Subject : `Re: ${m.Subject}`,
    body: `\n\n${quote(m)}`,
    inReplyTo: `${m.Folder}/${m.MID}`,
  });
  // A form-based message opens its reply form, which fills the composer.
  void replyFormFor(m);
}

export function forward(m: Message) {
  open({ ...emptyDraft(), subject: `Fw: ${m.Subject}`, body: quote(m) });
  reattach(m);
}

export function editAsNew(m: Message) {
  open({ ...emptyDraft(), to: addrs(m.To), cc: addrs(m.Cc), subject: m.Subject, body: m.Body });
  reattach(m);
}

// closeComposer discards the draft. It is one stable function so the
// dialog's focus handling doesn't rerun on every keystroke.
export function closeComposer() {
  stopFormPolling();
  composerOpen.value = false;
  draft.value = emptyDraft();
}

const set = (patch: Partial<Draft>) => { draft.value = { ...draft.value, ...patch }; };

export function Composer() {
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [catalog, setCatalog] = useState(false);
  const body = useRef<HTMLTextAreaElement>(null);
  const closeCatalog = useCallback(() => setCatalog(false), []);
  const subjectId = useId();
  const isOpen = composerOpen.value;
  const d = draft.value;

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    // A reply starts typing above the quote.
    if (draft.value.inReplyTo) body.current?.setSelectionRange(0, 0);
  }, [isOpen]);

  const send = async () => {
    // Read the draft now: leaving an address field commits its pending text.
    const cur = draft.value;
    const form = new FormData();
    form.append('to', cur.to.join(','));
    form.append('cc', cur.cc.join(','));
    form.append('subject', cur.subject || '<No subject>');
    form.append('body', cur.body || '<No message body>');
    for (const f of cur.files) form.append('files', f, f.name);
    form.append('date', new Date().toJSON());
    if (cur.inReplyTo) form.append('in_reply_to', cur.inReplyTo);
    if (cur.p2pOnly) form.append('p2ponly', 'on');
    setSending(true);
    setError('');
    try {
      const result = await api.send(form);
      closeComposer();
      toast(result || 'Message posted');
      await Promise.all([refresh(), refreshSidebar()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const pick = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    if (picked.length) set({ files: [...draft.value.files, ...picked] });
    // Clearing the input lets the same file be picked again after removal.
    input.value = '';
  };

  const title = d.inReplyTo ? 'Reply' : 'New message';
  return (
    <>
      <Dialog open={isOpen} title={title} onClose={closeComposer} wide closeOnBackdrop={false}
        footer={(
          <>
            <label class="ui-btn ui-btn-default ui-btn-md attach">
              <Paperclip /><span>Attach</span>
              <input type="file" multiple onChange={pick} />
            </label>
            <Button onClick={() => setCatalog(true)}><FileText /><span>Forms</span></Button>
            <label class="p2p">
              <input type="checkbox" checked={d.p2pOnly} onChange={(e) => set({ p2pOnly: e.currentTarget.checked })} />
              P2P only
            </label>
            <span class="spacer" />
            <Button onClick={closeComposer}>Cancel</Button>
            <Button variant="primary" disabled={sending} onClick={() => void send()}><Send /><span>Send</span></Button>
          </>
        )}>
        <div class="composer">
          {error && <div class="err" role="alert">{error}</div>}
          <TokenField label="To" tokens={d.to} onChange={(to) => set({ to })} autofocus={!d.inReplyTo} />
          <TokenField label="Cc" tokens={d.cc} onChange={(cc) => set({ cc })} />
          <div class="ui-tokenfield">
            <label for={subjectId}>Subject</label>
            <input id={subjectId} value={d.subject} onInput={(e) => set({ subject: e.currentTarget.value })} />
          </div>
          <textarea ref={body} class="body" aria-label="Message" value={d.body} autofocus={!!d.inReplyTo}
            onInput={(e) => set({ body: e.currentTarget.value })} />
          <DraftAttachments files={d.files} onRemove={(i) => set({ files: draft.value.files.filter((_, j) => j !== i) })} />
        </div>
      </Dialog>
      <FormCatalog open={isOpen && catalog} onClose={closeCatalog} />
    </>
  );
}

