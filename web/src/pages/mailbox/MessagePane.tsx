import { Archive, ArrowLeft, FolderInput, Mail, Paperclip, Star, Trash2 } from 'lucide-preact';
import * as api from '../../lib/api';
import { Chip } from '../../ui/Chip';
import { IconButton } from '../../ui/IconButton';
import { Menu } from '../../ui/Menu';
import { LabelMenu } from './LabelMenu';
import { applyBulkTo, closeMsg, folders, labels, openMessage } from './store';
import { callColor, folderTitle, formatDate } from './format';
import './MessagePane.css';

// MessagePane shows the open message with the same actions the selection
// toolbar offers, applied to this one message. Web Task 7 adds reply,
// forward, Winlink form rendering and image previews.
export function MessagePane() {
  const m = openMessage.value;
  if (!m) return null;
  const mids = [m.MID];
  const colors = new Map(labels.value.map((l) => [l.name, l.color]));
  const targets = folders.value.filter((f) => f.name !== m.Folder && f.name !== 'out');
  const from = m.From?.Addr ?? '';
  const to = (m.To ?? []).map((a) => a.Addr).join(', ');
  const cc = (m.Cc ?? []).map((a) => a.Addr).join(', ');
  return (
    <>
      <div class="toolbar">
        <IconButton icon={ArrowLeft} label="Back" onClick={closeMsg} />
        <span class="sep" />
        {m.Folder !== 'archive' && <IconButton icon={Archive} label="Archive" onClick={() => void applyBulkTo(mids, 'move', 'archive')} />}
        <IconButton icon={Trash2} label="Delete" onClick={() => void applyBulkTo(mids, 'delete')} />
        <span class="sep" />
        <IconButton icon={Mail} label="Mark unread" onClick={() => { void applyBulkTo(mids, 'read', false); closeMsg(); }} />
        <IconButton icon={Star} label={m.Starred ? 'Unstar' : 'Star'} pressed={m.Starred}
          onClick={() => void applyBulkTo(mids, 'star', !m.Starred)} />
        <LabelMenu target={{ mids, labels: [m.Labels ?? []] }} />
        <Menu trigger={<IconButton icon={FolderInput} label="Move to" />}
          items={targets.map((f) => ({ label: folderTitle(f.name), onSelect: () => void applyBulkTo(mids, 'move', f.name) }))} />
        <span class="spacer" />
        <span class="meta">{folderTitle(m.Folder)}</span>
      </div>
      <article class="msg">
        <h1>
          <span>{m.Subject || '(no subject)'}</span>
          {(m.Labels ?? []).map((l) => <Chip key={l} color={colors.get(l) ?? '#6b7280'}>{l}</Chip>)}
        </h1>
        <div class="hdr">
          <span class="avatar" style={{ '--c': callColor(from) }} aria-hidden="true">{from.slice(0, 2)}</span>
          <div>
            <div class="from">{from}</div>
            <div class="to">To {to}{cc && `, Cc ${cc}`}</div>
          </div>
          <span class="when">{formatDate(m.Date)}</span>
        </div>
        <div class="body">{m.Body}</div>
        {m.Files && m.Files.length > 0 && (
          <div class="atts">
            {m.Files.map((f) => (
              <a key={f.Name} class="attcard" href={api.attachmentUrl(m.Folder, m.MID, f.Name)} target="_blank" rel="noopener">
                <Paperclip /><span>{f.Name}</span>
              </a>
            ))}
          </div>
        )}
      </article>
    </>
  );
}
