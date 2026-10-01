import { Archive, ArrowDownWideNarrow, FolderInput, Mail, MailOpen, Menu as MenuIcon, RadioTower, RotateCw, Star, StarOff, Trash2, X } from 'lucide-preact';
import { Checkbox } from '../../ui/Checkbox';
import { IconButton } from '../../ui/IconButton';
import { Menu } from '../../ui/Menu';
import { Button } from '../../ui/Button';
import { SearchBox } from './SearchBox';
import {
  applyBulk, clearSelection, drawerOpen, folders, refresh, rows, selectAll, selected, setSort, sort, status, view, wsUp,
  type SortKey,
} from './store';
import { folderTitle } from './format';
import './Toolbar.css';

// Topbar sits above the message panel: the drawer button on narrow
// screens, search, and the connection status with Connect at the right.
export function Topbar() {
  const s = status.value;
  const text = !wsUp.value ? 'Offline' : s?.connected ? `Connected ${s.remote_addr}` : s?.dialing ? 'Dialing' : 'Disconnected';
  const light = !wsUp.value ? 'off' : s?.connected ? 'on' : s?.dialing ? 'busy' : 'idle';
  return (
    <div class="topbar">
      <span class="menu-btn"><IconButton icon={MenuIcon} label="Folders" onClick={() => { drawerOpen.value = true; }} /></span>
      <SearchBox />
      <div class="conn">
        <span class="status" role="status"><span class={`light ${light}`} /><span class="label">{text}</span></span>
        <Button variant="primary"><RadioTower /><span class="label">Connect</span></Button>
      </div>
    </div>
  );
}

function viewTitle(): string {
  const v = view.value;
  switch (v.kind) {
    case 'folder': return folderTitle(v.name);
    case 'label': return v.name;
    case 'starred': return 'Starred';
    case 'search': return `Results for "${v.q}"`;
  }
}

const SORTS: [SortKey, string][] = [['date', 'Date'], ['from', 'Correspondent'], ['subject', 'Subject']];

export function Toolbar() {
  const n = selected.value.size;
  const total = rows.value.length;
  const all = total > 0 && n === total;
  const v = view.value;
  const here = v.kind === 'folder' ? v.name : null;
  const toggleAll = () => (all || n > 0 ? clearSelection() : selectAll());

  if (n === 0) {
    return (
      <div class="toolbar">
        <Checkbox label="Select all" checked={false} onClick={toggleAll} />
        <span class="title">{viewTitle()}</span>
        <IconButton icon={RotateCw} label="Refresh" onClick={() => void refresh()} />
        <span class="spacer" />
        <span class="meta">{total === 1 ? '1 message' : `${total} messages`}{v.kind === 'search' ? ', all folders' : ''}</span>
        {v.kind !== 'search' && (
          <Menu align="right" trigger={<IconButton icon={ArrowDownWideNarrow} label="Sort" />}
            items={SORTS.map(([key, label]) => {
              const on = sort.value.key === key;
              return {
                label: `${label}${on ? (sort.value.asc ? ' ↑' : ' ↓') : ''}`,
                onSelect: () => setSort({ key, asc: on ? !sort.value.asc : key !== 'date' }),
              };
            })} />
        )}
      </div>
    );
  }

  const moveTargets = folders.value.filter((f) => f.name !== here && f.name !== 'out');
  return (
    <div class="toolbar">
      <Checkbox label="Select all" checked={all} indeterminate={!all} onClick={toggleAll} />
      <span class="sel">{n} selected</span>
      {here !== 'archive' && <IconButton icon={Archive} label="Archive" onClick={() => void applyBulk('move', 'archive')} />}
      <IconButton icon={Trash2} label="Delete" onClick={() => void applyBulk('delete')} />
      <span class="sep" />
      <IconButton icon={MailOpen} label="Mark read" onClick={() => void applyBulk('read', true)} />
      <IconButton icon={Mail} label="Mark unread" onClick={() => void applyBulk('read', false)} />
      <IconButton icon={Star} label="Star" onClick={() => void applyBulk('star', true)} />
      <IconButton icon={StarOff} label="Unstar" onClick={() => void applyBulk('star', false)} />
      <Menu trigger={<IconButton icon={FolderInput} label="Move to" />}
        items={moveTargets.map((f) => ({ label: folderTitle(f.name), onSelect: () => void applyBulk('move', f.name) }))} />
      <span class="spacer" />
      <IconButton icon={X} label="Clear selection" onClick={clearSelection} />
    </div>
  );
}
