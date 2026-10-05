import { useCallback, useRef, useState } from 'preact/hooks';
import {
  Archive, ArrowLeft, ChevronDown, ChevronUp, Ellipsis, FilePen, FolderInput, Pencil, Forward, Inbox, Mail, Reply, ReplyAll, Star, Trash2,
} from 'lucide-preact';
import { useHotkeys } from '../../lib/hotkeys';
import { Button } from '../../ui/Button';
import { Chip } from '../../ui/Chip';
import { Dialog } from '../../ui/Dialog';
import { IconButton } from '../../ui/IconButton';
import { Menu } from '../../ui/Menu';
import { MessageAttachments } from './Attachments';
import { compose, editAsNew, editOutbox, forward, reply } from './Composer';
import { LabelMenu } from './LabelMenu';
import { applyBulkTo, closeMsg, folders, labels, neighbors, openMessage, stepMsg } from './store';
import { callColor, folderTitle } from './format';
import './MessagePane.css';

const narrow = () => window.matchMedia?.('(max-width: 640px)').matches ?? false;

const fullDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

// MessagePane shows the open message with reply and forward, and the same
// actions the selection toolbar offers, applied to this one message.
export function MessagePane() {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cancelDelete = useCallback(() => setConfirmDelete(false), []);
  const bar = useRef<HTMLDivElement>(null);
  // step opens the neighbor; when that was the last one on its side, the
  // arrow switches off, so focus moves to the other arrow (or Back) rather
  // than dropping to the page.
  const step = async (dir: -1 | 1) => {
    await stepMsg(dir);
    const n = neighbors.value;
    if (dir < 0 ? n.prev : n.next) return;
    const other = (dir < 0 ? n.next : n.prev) ? (dir < 0 ? 'Next message' : 'Previous message') : 'Back';
    bar.current?.querySelector<HTMLButtonElement>(`button[aria-label="${other}"]`)?.focus();
  };
  const m = openMessage.value;
  // Keys for the open message: j and k step like the down and up arrows
  // (vim's down and up), h goes back (vim's left), and the rest do what
  // their toolbar button does. l and m click the menu buttons so the
  // menus open exactly as they do by mouse. n starts a new message, as it
  // does over the list, which is unmounted while a message is open.
  const click = (label: string) => bar.current?.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)?.click();
  useHotkeys(m ? {
    j: () => void stepMsg(1),
    k: () => void stepMsg(-1),
    h: closeMsg,
    r: () => reply(m, false),
    R: () => reply(m, true),
    f: () => forward(m),
    n: compose,
    a: () => void applyBulkTo([m.MID], 'move', m.Folder === 'archive' ? 'in' : 'archive'),
    t: () => setConfirmDelete(true),
    u: () => { void applyBulkTo([m.MID], 'read', false); closeMsg(); },
    s: () => void applyBulkTo([m.MID], 'star', !m.Starred),
    l: () => click('Label'),
    // On a phone the Move to button is hidden; More actions carries the targets there.
    m: () => click(narrow() ? 'More actions' : 'Move to'),
  } : {}, !!m);
  if (!m) return null;
  const mids = [m.MID];
  const colors = new Map(labels.value.map((l) => [l.name, l.color]));
  const targets = folders.value.filter((f) => f.name !== m.Folder && f.name !== 'out');
  const from = m.From?.Addr ?? '';
  const to = (m.To ?? []).map((a) => a.Addr).join(', ');
  const cc = (m.Cc ?? []).map((a) => a.Addr).join(', ');
  const archived = m.Folder === 'archive';
  const moveTo = () => targets.map((f) => ({ label: folderTitle(f.name), onSelect: () => void applyBulkTo(mids, 'move', f.name) }));
  return (
    <>
      <div class="toolbar" ref={bar}>
        <IconButton icon={ArrowLeft} label="Back" onClick={closeMsg} />
        <IconButton icon={ChevronUp} label="Previous message" title="Previous message (k)" disabled={!neighbors.value.prev} onClick={() => void step(-1)} />
        <IconButton icon={ChevronDown} label="Next message" title="Next message (j)" disabled={!neighbors.value.next} onClick={() => void step(1)} />
        <span class="sep" />
        <IconButton icon={Reply} label="Reply" onClick={() => reply(m, false)} />
        <span class="wide-only">
          <IconButton icon={ReplyAll} label="Reply all" onClick={() => reply(m, true)} />
          <IconButton icon={Forward} label="Forward" onClick={() => forward(m)} />
        </span>
        {/* A message still waiting in the Outbox can be edited in place. */}
        {m.Folder === 'out' && <IconButton icon={Pencil} label="Edit" onClick={() => editOutbox(m)} />}
        <span class="sep" />
        {archived
          ? <IconButton icon={Inbox} label="Move to Inbox" onClick={() => void applyBulkTo(mids, 'move', 'in')} />
          : <IconButton icon={Archive} label="Archive" onClick={() => void applyBulkTo(mids, 'move', 'archive')} />}
        <IconButton icon={Trash2} label="Delete" onClick={() => setConfirmDelete(true)} />
        <span class="sep" />
        <span class="wide-only">
          <IconButton icon={Mail} label="Mark unread" onClick={() => { void applyBulkTo(mids, 'read', false); closeMsg(); }} />
        </span>
        <IconButton icon={Star} label={m.Starred ? 'Unstar' : 'Star'} pressed={m.Starred}
          onClick={() => void applyBulkTo(mids, 'star', !m.Starred)} />
        <LabelMenu target={{ mids, labels: [m.Labels ?? []] }} />
        <span class="wide-only">
          <Menu trigger={<IconButton icon={FolderInput} label="Move to" />} items={moveTo()} />
        </span>
        <Menu align="right" trigger={<IconButton icon={Ellipsis} label="More actions" />} items={[
          ...(narrow() ? [
            { label: 'Reply all', icon: ReplyAll, onSelect: () => reply(m, true) },
            { label: 'Forward', icon: Forward, onSelect: () => forward(m) },
            { label: 'Mark unread', icon: Mail, onSelect: () => { void applyBulkTo(mids, 'read', false); closeMsg(); } },
            ...moveTo().map((x) => ({ ...x, label: `Move to ${x.label}` })),
          ] : []),
          { label: 'Edit as new', icon: FilePen, onSelect: () => editAsNew(m) },
        ]} />
        <span class="spacer" />
        <span class="meta wide-only">{folderTitle(m.Folder)}</span>
      </div>
      {/* Keyed by message, so stepping to another one starts at its top. */}
      <article class="msg" key={`${m.Folder}/${m.MID}`}>
        <h1>
          <span>{m.Subject || '(no subject)'}</span>
          {(m.Labels ?? []).map((l) => <Chip key={l} color={colors.get(l) ?? '#6b7280'}>{l}</Chip>)}
        </h1>
        <div class="hdr">
          <span class="avatar" style={{ '--c': callColor(from) }} aria-hidden="true">{from.slice(0, 2)}</span>
          <div class="who">
            <div class="from">{from}{m.P2POnly && <span class="p2p">P2P only</span>}</div>
            <div class="to">To {to}{cc && `, Cc ${cc}`}</div>
          </div>
          <time class="when" dateTime={m.Date}>{fullDate(m.Date)}</time>
        </div>
        {m.BodyHTML
          // BodyHTML is the server's rendering, sanitized there with bluemonday's UGC policy.
          ? <div class="body" dangerouslySetInnerHTML={{ __html: m.BodyHTML }} />
          : <div class="body">{m.Body}</div>}
        <MessageAttachments m={m} />
      </article>
      <Dialog open={confirmDelete} title="Delete message?" onClose={cancelDelete}
        footer={(
          <>
            <span class="spacer" />
            <Button onClick={cancelDelete}>Cancel</Button>
            <Button variant="danger" autofocus onClick={() => { setConfirmDelete(false); void applyBulkTo(mids, 'delete'); }}>Delete</Button>
          </>
        )}>
        <div class="dialog-pad"><p>“{m.Subject || '(no subject)'}” will be deleted for good. Phat keeps no trash.</p></div>
      </Dialog>
    </>
  );
}
