import { useRef, useState } from 'preact/hooks';
import type { LucideIcon } from 'lucide-preact';
import {
  Archive, EllipsisVertical, Folder, Inbox, MailCheck, MailPlus, MapPin, Pencil, Plus, RadioTower, ScrollText, Send, Settings, Star, Trash2,
} from 'lucide-preact';
import * as api from '../../lib/api';
import type { Label, View } from '../../lib/types';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { IconButton } from '../../ui/IconButton';
import { Menu, type MenuItem } from '../../ui/Menu';
import { toast } from '../../ui/Toast';
import { FolderEditor, deleteFolderMessage } from './FolderEditor';
import { LabelEditor } from './LabelEditor';
import { drawerOpen, logOpen, positionOpen, folders, labels, mycall, refresh, refreshSidebar, setView, view } from './store';
import { folderTitle } from './format';
import { dropTarget, type DropKind } from './dnd';
import { compose } from './Composer';
import './Sidebar.css';

const SYSTEM: [string, LucideIcon][] = [['in', Inbox], ['out', Send], ['sent', MailCheck], ['archive', Archive]];

function same(a: View, b: View): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'folder' && b.kind === 'folder') return a.name === b.name;
  if (a.kind === 'label' && b.kind === 'label') return a.name === b.name;
  return a.kind === 'starred';
}

type EntryProps = {
  to: View; icon?: LucideIcon; dot?: string; name: string; count?: number;
  actions?: { label: string; items: MenuItem[] };
  drop?: [DropKind, string?];
};

// Entry is one sidebar link. Custom folders and labels carry a kebab menu,
// which a right-click on the link also opens.
function Entry({ to, icon: Icon, dot, name, count, actions, drop }: EntryProps) {
  const current = same(view.value, to);
  // A view never accepts its own messages back.
  const target = drop && !current ? dropTarget(drop[0], drop[1]) : undefined;
  const row = useRef<HTMLDivElement>(null);
  return (
    <div ref={row} class={`side-row${current ? ' active' : ''}`}>
      <a href="#" class={`side-item${current ? ' active' : ''}`} aria-current={current ? 'page' : undefined}
        onClick={(e) => { e.preventDefault(); void setView(to); }}
        {...(target ?? {})}
        onContextMenu={actions && ((e) => {
          e.preventDefault();
          row.current?.querySelector<HTMLButtonElement>('.side-kebab button')?.click();
        })}>
        {Icon ? <Icon /> : <span class="dot" style={{ background: dot }} />}
        <span class="name">{name}</span>
        {count ? <span class="count">{count}</span> : null}
      </a>
      {actions && (
        <span class="side-kebab">
          <Menu align="right" trigger={<IconButton icon={EllipsisVertical} label={actions.label} />} items={actions.items} />
        </span>
      )}
    </div>
  );
}

type Editing =
  | { kind: 'new-folder' }
  | { kind: 'rename-folder'; name: string }
  | { kind: 'delete-folder'; name: string }
  | { kind: 'new-label' }
  | { kind: 'edit-label'; label: Label }
  | { kind: 'delete-label'; label: Label }
  | null;

function DeleteFolder({ name, onClose }: { name: string; onClose: () => void }) {
  const [error, setError] = useState('');
  const go = async () => {
    try {
      await api.deleteFolder(name);
      const v = view.value;
      if (v.kind === 'folder' && v.name === name) void setView({ kind: 'folder', name: 'in' });
      await refreshSidebar();
      toast(`Deleted folder ${name}`);
      onClose();
    } catch (err) {
      setError(deleteFolderMessage(err));
    }
  };
  return (
    <Dialog open title={`Delete folder ${name}?`} onClose={onClose}
      footer={<><span style={{ flex: 1 }} /><Button onClick={onClose}>Cancel</Button><Button variant="danger" onClick={() => void go()}>Delete</Button></>}>
      <div class="dialog-pad">
        <p>Only an empty folder can be deleted.</p>
        {error && <p class="form-error" role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}

function DeleteLabel({ label, onClose }: { label: Label; onClose: () => void }) {
  const go = async () => {
    try {
      await api.deleteLabel(label.name);
      const v = view.value;
      if (v.kind === 'label' && v.name === label.name) void setView({ kind: 'folder', name: 'in' });
      await Promise.all([refreshSidebar(), refresh()]);
      toast(`Deleted label ${label.name}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), { kind: 'error' });
    }
    onClose();
  };
  const n = label.count;
  return (
    <Dialog open title={`Delete label ${label.name}?`} onClose={onClose}
      footer={<><span style={{ flex: 1 }} /><Button onClick={onClose}>Cancel</Button><Button variant="danger" onClick={() => void go()}>Delete</Button></>}>
      <div class="dialog-pad">
        <p>{n ? `It comes off ${n} message${n === 1 ? '' : 's'}. The messages stay where they are.` : 'No messages carry it.'}</p>
      </div>
    </Dialog>
  );
}

export function Sidebar() {
  const [editing, setEditing] = useState<Editing>(null);
  const done = () => setEditing(null);
  const byName = new Map(folders.value.map((f) => [f.name, f]));
  const custom = folders.value.filter((f) => !f.system);
  return (
    <aside class={`sidebar${drawerOpen.value ? ' open' : ''}`}>
      <div class="brand">
        <span class="glyph"><RadioTower /></span>
        <span class="appname">Phat</span>
        <span class="call">{mycall.value}</span>
      </div>
      <button type="button" class="compose" onClick={() => { drawerOpen.value = false; compose(); }}>
        <MailPlus /> New message
      </button>
      <nav aria-label="Mailbox" class="side-nav">
        {SYSTEM.map(([name, icon]) => {
          const f = byName.get(name);
          // Inbox counts unread mail; Outbox counts what waits to be sent.
          const count = name === 'out' ? f?.count : name === 'in' ? f?.unread : undefined;
          // The outbox is filled by composing, not by dropping old mail in.
          return <Entry key={name} to={{ kind: 'folder', name }} icon={icon} name={folderTitle(name)} count={count}
            drop={name === 'out' ? undefined : ['folder', name]} />;
        })}
        <Entry to={{ kind: 'starred' }} icon={Star} name="Starred" drop={['starred']} />

        <div class="group">
          <span>Folders</span>
          <button type="button" class="group-add" aria-label="New folder" title="New folder"
            onClick={() => setEditing({ kind: 'new-folder' })}><Plus /></button>
        </div>
        {custom.map((f) => editing?.kind === 'rename-folder' && editing.name === f.name
          ? <FolderEditor key={f.name} rename={f.name} onDone={done} />
          : <Entry key={f.name} to={{ kind: 'folder', name: f.name }} icon={Folder} name={f.name} count={f.unread} drop={['folder', f.name]}
              actions={{ label: `Folder actions for ${f.name}`, items: [
                { label: 'Rename', icon: Pencil, onSelect: () => setEditing({ kind: 'rename-folder', name: f.name }) },
                { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setEditing({ kind: 'delete-folder', name: f.name }) },
              ] }} />)}
        {editing?.kind === 'new-folder' && <FolderEditor onDone={done} />}

        <div class="group">
          <span>Labels</span>
          <button type="button" class="group-add" aria-label="New label" title="New label"
            onClick={() => setEditing({ kind: 'new-label' })}><Plus /></button>
        </div>
        {labels.value.map((l) => (
          <Entry key={l.name} to={{ kind: 'label', name: l.name }} dot={l.color} name={l.name} drop={['label', l.name]}
            actions={{ label: `Label actions for ${l.name}`, items: [
              { label: 'Edit', icon: Pencil, onSelect: () => setEditing({ kind: 'edit-label', label: l }) },
              { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setEditing({ kind: 'delete-label', label: l }) },
            ] }} />
        ))}
      </nav>
      <nav aria-label="Tools" class="side-nav foot">
        <button type="button" class="side-item" onClick={() => { drawerOpen.value = false; positionOpen.value = true; }}>
          <MapPin /><span>Position report</span>
        </button>
        <button type="button" class={`side-item${logOpen.value ? ' active' : ''}`} aria-pressed={logOpen.value}
          onClick={() => { drawerOpen.value = false; logOpen.value = !logOpen.value; }}>
          <ScrollText /><span>Session log</span>
        </button>
        <a href="/ui/config" class="side-item"><Settings /><span>Settings</span></a>
      </nav>

      {editing?.kind === 'delete-folder' && <DeleteFolder name={editing.name} onClose={done} />}
      {editing?.kind === 'new-label' && <LabelEditor open onClose={done} />}
      {editing?.kind === 'edit-label' && <LabelEditor open edit={editing.label} onClose={done} />}
      {editing?.kind === 'delete-label' && <DeleteLabel label={editing.label} onClose={done} />}
    </aside>
  );
}
