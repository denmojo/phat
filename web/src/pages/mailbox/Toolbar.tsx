import { Archive, ArrowDownWideNarrow, Ellipsis, FolderInput, Mail, MailOpen, Menu as MenuIcon, RadioTower, RotateCw, Star, StarOff, Trash2, Unplug, X } from 'lucide-preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import * as api from '../../lib/api';
import { Checkbox } from '../../ui/Checkbox';
import { toast } from '../../ui/Toast';
import { StatusPopover } from './StatusPopover';
import { IconButton } from '../../ui/IconButton';
import { Menu } from '../../ui/Menu';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { SearchBox } from './SearchBox';
import { LabelMenu } from './LabelMenu';
import {
  applyBulk, clearSelection, connectOpen, drawerOpen, folders, refresh, rows, selectAll, selected, setSort, sort, status, view,
  type SortKey,
} from './store';
import { folderTitle } from './format';
import './Toolbar.css';

// Topbar sits above the message panel: the drawer button on narrow
// screens, search, the status pill, and Connect, which becomes Abort or
// Disconnect during a session and Force disconnect on a second press.
export function Topbar() {
  const s = status.value;
  const [stopping, setStopping] = useState(false);
  const live = !!(s?.dialing || s?.connected);
  useEffect(() => { if (!live) setStopping(false); }, [live]);
  const stop = (dirty: boolean) => {
    setStopping(true);
    api.disconnect(dirty).catch((err) => toast(err instanceof Error ? err.message : String(err), { kind: 'error' }));
  };
  let button;
  if (!live) {
    button = <Button variant="primary" label="Connect" onClick={() => { connectOpen.value = true; }}><RadioTower /><span class="label">Connect</span></Button>;
  } else if (stopping) {
    button = <Button variant="danger" label="Force disconnect" onClick={() => stop(true)}><Unplug /><span class="label">Force disconnect</span></Button>;
  } else {
    const name = s?.dialing ? 'Abort' : 'Disconnect';
    button = <Button label={name} onClick={() => stop(false)}><Unplug /><span class="label">{name}</span></Button>;
  }
  return (
    <div class="topbar">
      <span class="menu-btn"><IconButton icon={MenuIcon} label="Folders" onClick={() => { drawerOpen.value = true; }} /></span>
      <SearchBox />
      <div class="conn">
        <StatusPopover />
        {button}
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
  // Delete is for good: Phat keeps no trash, so it asks first.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cancelDelete = useCallback(() => setConfirmDelete(false), []);

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
      <span class="sel">{n}<span class="wide-only"> selected</span></span>
      {here !== 'archive' && <IconButton icon={Archive} label="Archive" onClick={() => void applyBulk('move', 'archive')} />}
      <IconButton icon={Trash2} label="Delete" onClick={() => setConfirmDelete(true)} />
      <span class="sep wide-only" />
      <IconButton icon={MailOpen} label="Mark read" onClick={() => void applyBulk('read', true)} />
      <span class="wide-only"><IconButton icon={Mail} label="Mark unread" onClick={() => void applyBulk('read', false)} /></span>
      <IconButton icon={Star} label="Star" onClick={() => void applyBulk('star', true)} />
      <span class="wide-only"><IconButton icon={StarOff} label="Unstar" onClick={() => void applyBulk('star', false)} /></span>
      <LabelMenu />
      <Menu trigger={<IconButton icon={FolderInput} label="Move to" />}
        items={moveTargets.map((f) => ({ label: folderTitle(f.name), onSelect: () => void applyBulk('move', f.name) }))} />
      <span class="narrow-only">
        <Menu align="right" trigger={<IconButton icon={Ellipsis} label="More actions" />} items={[
          { label: 'Mark unread', icon: Mail, onSelect: () => void applyBulk('read', false) },
          { label: 'Unstar', icon: StarOff, onSelect: () => void applyBulk('star', false) },
        ]} />
      </span>
      <span class="spacer" />
      <IconButton icon={X} label="Clear selection" onClick={clearSelection} />
      <Dialog open={confirmDelete} title={`Delete ${n === 1 ? '1 message' : `${n} messages`}?`} onClose={cancelDelete}
        footer={(
          <>
            <span class="spacer" />
            <Button onClick={cancelDelete}>Cancel</Button>
            <Button variant="danger" onClick={() => { setConfirmDelete(false); void applyBulk('delete'); }}>Delete</Button>
          </>
        )}>
        <div class="dialog-pad"><p>{`The selected ${n === 1 ? 'message' : 'messages'} will be deleted for good. Phat keeps no trash.`}</p></div>
      </Dialog>
    </div>
  );
}
