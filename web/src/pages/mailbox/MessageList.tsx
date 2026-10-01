import { Check, Paperclip, Star } from 'lucide-preact';
import { Checkbox } from '../../ui/Checkbox';
import { Chip } from '../../ui/Chip';
import * as api from '../../lib/api';
import type { Row } from '../../lib/types';
import { toast } from '../../ui/Toast';
import {
  correspondent, labels, openMsg, refresh, refreshSidebar, selectRange, selected, sortedRows, toggleSelect, view,
} from './store';
import { callColor, folderTitle, formatDate } from './format';
import { dragging, endDrag, startDrag } from './dnd';
import './MessageList.css';

// anchor is the last row checked without Shift, the start of a range.
let anchor: string | null = null;

const LONG_PRESS_MS = 500;
const MOVE_SLOP_PX = 10;
const narrow = () => window.matchMedia?.('(max-width: 640px)').matches ?? false;

// Long press is how a phone selects, since its rows hide the checkboxes:
// holding a row selects it, and while anything is selected a tap toggles
// rows instead of opening them. A press that moves is a scroll.
let press: { mid: string; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null;
let swallowClick = false;

function pressStart(mid: string, e: PointerEvent) {
  pressEnd();
  press = {
    mid, x: e.clientX, y: e.clientY,
    timer: setTimeout(() => {
      press = null;
      swallowClick = true;
      if (!selected.value.has(mid)) toggleSelect(mid);
      anchor = mid;
      navigator.vibrate?.(15);
    }, LONG_PRESS_MS),
  };
}

function pressMove(e: PointerEvent) {
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_SLOP_PX) pressEnd();
}

function pressEnd() {
  if (press) clearTimeout(press.timer);
  press = null;
}

function rowClick(r: Row) {
  if (swallowClick) {
    swallowClick = false;
    return;
  }
  if (selected.value.size > 0 && narrow()) {
    toggleSelect(r.MID);
    return;
  }
  void openMsg(r.Folder, r.MID);
}

async function toggleStar(r: Row) {
  try {
    await api.star([r.MID], !r.Starred);
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), { kind: 'error' });
  }
  await Promise.all([refresh(), refreshSidebar()]);
}

function MessageRow({ r, showFolder, colors }: { r: Row; showFolder: boolean; colors: Map<string, string> }) {
  const who = correspondent(r);
  const isSel = selected.value.has(r.MID);
  return (
    <div role="row" class={`mrow${r.Unread ? ' unread' : ''}${isSel ? ' selected' : ''}${dragging.value.has(r.MID) ? ' dragging' : ''}`}
      aria-selected={isSel}
      // Phones use long press to select, so rows only drag on wider screens.
      draggable={!narrow()} onDragStart={(e) => { pressEnd(); startDrag(e, r.MID); }} onDragEnd={endDrag}
      onClick={() => rowClick(r)}
      onPointerDown={(e) => pressStart(r.MID, e)} onPointerMove={pressMove} onPointerUp={pressEnd} onPointerCancel={pressEnd}
      onContextMenu={(e) => { if (narrow()) e.preventDefault(); }}>
      <span role="cell" class="c-check">
        <Checkbox label={`Select ${r.Subject || 'message'}`} checked={isSel} onClick={(e) => {
          if (e.shiftKey && anchor) selectRange(anchor, r.MID);
          else {
            toggleSelect(r.MID);
            anchor = r.MID;
          }
        }} />
      </span>
      <span role="cell" class="c-star">
        <button type="button" class={`star${r.Starred ? ' on' : ''}`} aria-label={r.Starred ? 'Unstar' : 'Star'} aria-pressed={r.Starred}
          onClick={(e) => { e.stopPropagation(); void toggleStar(r); }}>
          <Star />
        </button>
      </span>
      <span role="cell" class={`avatar${isSel ? ' checked' : ''}`} style={{ '--c': callColor(who) }} aria-hidden="true">
        {isSel ? <Check /> : who.slice(0, 2)}
      </span>
      <span role="cell" class="who" title={who}>{who}</span>
      <span role="cell" class="subjline">
        <span class="subj">{r.Subject || '(no subject)'}</span>
        {r.P2POnly && <span class="p2p">P2P</span>}
        {r.Labels.map((l) => <Chip key={l} color={colors.get(l) ?? '#6b7280'}>{l}</Chip>)}
        {showFolder && <Chip>{folderTitle(r.Folder)}</Chip>}
      </span>
      <span role="cell" class="att">
        {r.Attachments > 0 && <span aria-label={`${r.Attachments} attachment${r.Attachments === 1 ? '' : 's'}`}><Paperclip /></span>}
      </span>
      <span role="cell" class="date">{formatDate(r.Date)}</span>
    </div>
  );
}

export function MessageList() {
  const list = sortedRows.value;
  const showFolder = view.value.kind !== 'folder';
  const colors = new Map(labels.value.map((l) => [l.name, l.color]));
  if (list.length === 0) {
    return <div class="mlist empty"><p>No messages</p></div>;
  }
  return (
    <div class="mlist" role="table" aria-label="Messages">
      <div role="rowgroup">
        {list.map((r) => <MessageRow key={r.MID} r={r} showFolder={showFolder} colors={colors} />)}
      </div>
    </div>
  );
}
