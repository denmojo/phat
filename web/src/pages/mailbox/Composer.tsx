import { useCallback, useEffect, useId, useRef, useState } from 'preact/hooks';
import { FileText, Paperclip, Save, Send } from 'lucide-preact';
import * as api from '../../lib/api';
import { replyFormFor, stopFormPolling } from '../../lib/forms';
import type { Message } from '../../lib/types';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { TokenField } from '../../ui/TokenField';
import { toast } from '../../ui/Toast';
import { DraftAttachments } from './Attachments';
import { FormCatalog } from './FormCatalog';
import { type Draft, closeMsg, composerOpen, draft, emptyDraft, mycall, openMessage, refresh, refreshSidebar } from './store';
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

// opened is the draft as the composer first showed it, so closing an
// untouched reply doesn't ask about the quote it started with.
let opened: Draft = emptyDraft();

function open(d: Draft) {
  opened = d;
  draft.value = d;
  composerOpen.value = true;
}

function edited(d: Draft): boolean {
  return d.subject !== opened.subject || d.body !== opened.body || d.p2pOnly !== opened.p2pOnly
    || d.to.join() !== opened.to.join() || d.cc.join() !== opened.cc.join()
    || d.files.length !== opened.files.length;
}

// reattach fetches the message's files and adds them to the draft, the
// way forward and edit-as-new carry attachments along.
function reattach(m: Message) {
  for (const f of m.Files ?? []) {
    void fetch(api.attachmentUrl(m.Folder, m.MID, f.Name))
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`${f.Name}: HTTP ${res.status}`))))
      .then((blob) => {
        const file = new File([blob], f.Name, { type: blob.type });
        // A carried-along file counts as part of the opened draft.
        opened = { ...opened, files: [...opened.files, file] };
        draft.value = { ...draft.value, files: [...draft.value.files, file] };
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

// editOutbox opens a message still waiting in the Outbox for editing.
// Send posts the edited version and then deletes this one, so the Outbox
// holds it once; a refused post or a discard leaves the original as it was.
export function editOutbox(m: Message) {
  open({ ...emptyDraft(), to: addrs(m.To), cc: addrs(m.Cc), subject: m.Subject, body: m.Body, p2pOnly: m.P2POnly, replaces: m.MID });
  reattach(m);
}

// editDraft opens a saved draft. Send queues it and Save draft writes a new
// version; either one deletes this copy afterwards, so a draft is never
// both queued and kept, and a refused write leaves it as it was.
export function editDraft(m: Message) {
  open({ ...emptyDraft(), to: addrs(m.To), cc: addrs(m.Cc), subject: m.Subject, body: m.Body, p2pOnly: m.P2POnly, replaces: m.MID, fromDrafts: true });
  reattach(m);
}

// closeComposer discards the draft without asking: Send calls it after a
// post, and Discard after the user has confirmed.
export function closeComposer() {
  stopFormPolling();
  composerOpen.value = false;
  draft.value = emptyDraft();
}

// removeOriginal deletes the Outbox message or draft an edit replaced and
// closes it if it is open. A delete that fails (a connect sent it
// meanwhile) is reported, since the new version is already written beside
// it; lead says what was written and what names the copy left behind.
async function removeOriginal(mid: string, lead: string, what: string) {
  const report = (why: string) => toast(`${lead}, but the ${what} could not be removed: ${why}`, { kind: 'error' });
  try {
    const res = await api.remove([mid]);
    const why = res?.failed?.[mid];
    if (why) report(why);
  } catch (err) {
    report(err instanceof api.ApiError ? err.result?.failed?.[mid] ?? err.message : err instanceof Error ? err.message : String(err));
  }
  if (openMessage.value?.MID === mid) closeMsg();
}

// formFor turns the draft into the form the server reads. A message being
// sent gets placeholders for an empty subject and body, as Pat does; a
// draft being saved keeps exactly what was typed.
function formFor(cur: Draft, sending: boolean): FormData {
  const form = new FormData();
  form.append('to', cur.to.join(','));
  form.append('cc', cur.cc.join(','));
  form.append('subject', sending ? cur.subject || '<No subject>' : cur.subject);
  form.append('body', sending ? cur.body || '<No message body>' : cur.body);
  for (const f of cur.files) form.append('files', f, f.name);
  form.append('date', new Date().toJSON());
  if (cur.inReplyTo) form.append('in_reply_to', cur.inReplyTo);
  if (cur.p2pOnly) form.append('p2ponly', 'on');
  return form;
}

const set = (patch: Partial<Draft>) => { draft.value = { ...draft.value, ...patch }; };

export function Composer() {
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [catalog, setCatalog] = useState(false);
  const body = useRef<HTMLTextAreaElement>(null);
  const closeCatalog = useCallback(() => setCatalog(false), []);
  const subjectId = useId();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const isOpen = composerOpen.value;
  const d = draft.value;
  // Escape, the X and Cancel ask first when anything was typed.
  const tryClose = useCallback(() => {
    if (edited(draft.value)) setConfirmDiscard(true);
    else closeComposer();
  }, []);
  const keepEditing = useCallback(() => setConfirmDiscard(false), []);
  const discard = () => { setConfirmDiscard(false); closeComposer(); };
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    // A reply starts typing above the quote.
    if (draft.value.inReplyTo) body.current?.setSelectionRange(0, 0);
  }, [isOpen]);

  const send = async () => {
    // Read the draft now: leaving an address field commits its pending text.
    const cur = draft.value;
    setSending(true);
    setError('');
    try {
      const result = await api.send(formFor(cur, true));
      // The new version is in the Outbox now; only then does the original go.
      if (cur.replaces) {
        await (cur.fromDrafts ? removeOriginal(cur.replaces, 'The message is queued', 'draft') : removeOriginal(cur.replaces, 'The edit is queued', 'original'));
      }
      closeComposer();
      toast(result || 'Message posted');
      await Promise.all([refresh(), refreshSidebar()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  // saveDraft writes the composer's contents to Drafts and closes it. An
  // edit of a saved draft or a queued message replaces that one, once the
  // new draft is safely written.
  const saveDraft = async () => {
    const cur = draft.value;
    setConfirmDiscard(false);
    setSaving(true);
    setError('');
    try {
      await api.saveDraft(formFor(cur, false));
      if (cur.replaces) await removeOriginal(cur.replaces, 'The draft is saved', cur.fromDrafts ? 'old draft' : 'queued message');
      closeComposer();
      toast('Draft saved');
      await Promise.all([refresh(), refreshSidebar()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const pick = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    if (picked.length) set({ files: [...draft.value.files, ...picked] });
    // Clearing the input lets the same file be picked again after removal.
    input.value = '';
  };

  const title = d.fromDrafts ? 'Draft' : d.replaces ? 'Edit message' : d.inReplyTo ? 'Reply' : 'New message';
  return (
    <>
      <Dialog open={isOpen} title={title} onClose={tryClose} wide closeOnBackdrop={false}
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
            <Button onClick={tryClose}>Cancel</Button>
            <Button disabled={saving || sending} onClick={() => void saveDraft()}><Save /><span>Save draft</span></Button>
            <Button variant="primary" disabled={sending || saving} onClick={() => void send()}><Send /><span>Send</span></Button>
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
      <Dialog open={isOpen && confirmDiscard} title="Discard this message?" onClose={keepEditing}
        footer={(
          <>
            <Button onClick={keepEditing}>Keep editing</Button>
            <Button disabled={saving} onClick={() => void saveDraft()}>Save draft</Button>
            <Button variant="danger" onClick={discard}>Discard</Button>
          </>
        )}>
        <div class="dialog-pad"><p>What you've written will be lost unless you save it as a draft.</p></div>
      </Dialog>
    </>
  );
}

