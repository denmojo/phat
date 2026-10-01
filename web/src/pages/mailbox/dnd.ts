// HTML5 drag and drop of messages onto sidebar folders, labels and Starred.
import { signal } from '@preact/signals';
import { applyBulkTo, selected } from './store';

export const MIDS_TYPE = 'application/x-phat-mids';

// dragging holds the MIDs in flight so their rows can dim.
export const dragging = signal<Set<string>>(new Set());

// startDrag carries the whole selection when the grabbed row is part of it,
// otherwise just that row, and shows a small "N messages" label under the
// pointer.
export function startDrag(e: DragEvent, mid: string): void {
  const mids = selected.value.has(mid) ? [...selected.value] : [mid];
  const dt = e.dataTransfer;
  if (!dt) return;
  dt.setData(MIDS_TYPE, JSON.stringify(mids));
  // Folders move messages; labels and Starred mark them in place (copy).
  dt.effectAllowed = 'copyMove';
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.textContent = mids.length === 1 ? '1 message' : `${mids.length} messages`;
  document.body.appendChild(ghost);
  dt.setDragImage(ghost, 12, 12);
  setTimeout(() => ghost.remove(), 0);
  dragging.value = new Set(mids);
}

export function endDrag(): void {
  dragging.value = new Set();
}

function carriesMessages(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes(MIDS_TYPE);
}

// Nested elements fire enter and leave as the pointer crosses them; a
// per-target count keeps the highlight steady.
const depth = new WeakMap<EventTarget, number>();

function setHover(el: EventTarget | null, d: number) {
  if (!(el instanceof HTMLElement)) return;
  depth.set(el, d);
  el.classList.toggle('drop-hover', d > 0);
}

export type DropKind = 'folder' | 'label' | 'starred';

export function dropTarget(kind: DropKind, name?: string) {
  return {
    onDragEnter(e: DragEvent) {
      if (!carriesMessages(e)) return;
      e.preventDefault();
      setHover(e.currentTarget, (depth.get(e.currentTarget!) ?? 0) + 1);
    },
    onDragOver(e: DragEvent) {
      if (!carriesMessages(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = kind === 'folder' ? 'move' : 'copy';
    },
    onDragLeave(e: DragEvent) {
      if (!carriesMessages(e)) return;
      setHover(e.currentTarget, Math.max(0, (depth.get(e.currentTarget!) ?? 1) - 1));
    },
    async onDrop(e: DragEvent) {
      e.preventDefault();
      setHover(e.currentTarget, 0);
      endDrag();
      let mids: unknown;
      try {
        mids = JSON.parse(e.dataTransfer?.getData(MIDS_TYPE) ?? '');
      } catch {
        return;
      }
      if (!Array.isArray(mids) || mids.length === 0 || !mids.every((m) => typeof m === 'string')) return;
      if (kind === 'folder' && name) await applyBulkTo(mids, 'move', name);
      else if (kind === 'label' && name) await applyBulkTo(mids, 'labels', [name], []);
      else if (kind === 'starred') await applyBulkTo(mids, 'star', true);
    },
  };
}
