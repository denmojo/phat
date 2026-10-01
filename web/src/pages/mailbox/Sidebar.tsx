import type { LucideIcon } from 'lucide-preact';
import { Archive, Folder, Inbox, MailCheck, MailPlus, Plus, RadioTower, Send, Settings, Star } from 'lucide-preact';
import type { View } from '../../lib/types';
import { composerOpen, drawerOpen, folders, labels, mycall, setView, view } from './store';
import { folderTitle } from './format';
import './Sidebar.css';

const SYSTEM: [string, LucideIcon][] = [['in', Inbox], ['out', Send], ['sent', MailCheck], ['archive', Archive]];

function same(a: View, b: View): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'folder' && b.kind === 'folder') return a.name === b.name;
  if (a.kind === 'label' && b.kind === 'label') return a.name === b.name;
  return a.kind === 'starred';
}

function Entry({ to, icon: Icon, dot, name, count }: { to: View; icon?: LucideIcon; dot?: string; name: string; count?: number }) {
  const current = same(view.value, to);
  return (
    <a href="#" class={`side-item${current ? ' active' : ''}`} aria-current={current ? 'page' : undefined}
      onClick={(e) => { e.preventDefault(); void setView(to); }}>
      {Icon ? <Icon /> : <span class="dot" style={{ background: dot }} />}
      <span class="name">{name}</span>
      {count ? <span class="count">{count}</span> : null}
    </a>
  );
}

export function Sidebar() {
  const byName = new Map(folders.value.map((f) => [f.name, f]));
  const custom = folders.value.filter((f) => !f.system);
  return (
    <aside class={`sidebar${drawerOpen.value ? ' open' : ''}`}>
      <div class="brand">
        <span class="glyph"><RadioTower /></span>
        <span class="appname">Phat</span>
        <span class="call">{mycall.value}</span>
      </div>
      <button type="button" class="compose" onClick={() => { composerOpen.value = true; }}>
        <MailPlus /> New message
      </button>
      <nav aria-label="Mailbox" class="side-nav">
        {SYSTEM.map(([name, icon]) => {
          const f = byName.get(name);
          // Inbox counts unread mail; Outbox counts what waits to be sent.
          const count = name === 'out' ? f?.count : name === 'in' ? f?.unread : undefined;
          return <Entry key={name} to={{ kind: 'folder', name }} icon={icon} name={folderTitle(name)} count={count} />;
        })}
        <Entry to={{ kind: 'starred' }} icon={Star} name="Starred" />

        <div class="group">
          <span>Folders</span>
          <button type="button" class="group-add" aria-label="New folder" title="New folder"><Plus /></button>
        </div>
        {custom.map((f) => <Entry key={f.name} to={{ kind: 'folder', name: f.name }} icon={Folder} name={f.name} count={f.unread} />)}

        <div class="group">
          <span>Labels</span>
          <button type="button" class="group-add" aria-label="New label" title="New label"><Plus /></button>
        </div>
        {labels.value.map((l) => <Entry key={l.name} to={{ kind: 'label', name: l.name }} dot={l.color} name={l.name} />)}
      </nav>
      <nav aria-label="Settings" class="side-nav foot">
        <a href="/ui/config" class="side-item"><Settings /><span>Settings</span></a>
      </nav>
    </aside>
  );
}
