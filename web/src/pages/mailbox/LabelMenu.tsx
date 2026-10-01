import { useEffect, useRef, useState } from 'preact/hooks';
import { Plus, Tag } from 'lucide-preact';
import { IconButton } from '../../ui/IconButton';
import { LabelEditor } from './LabelEditor';
import { applyBulkTo, labels, rows, selected } from './store';
import '../../ui/Menu.css';
import './LabelMenu.css';

type State = 'true' | 'false' | 'mixed';

type Target = { mids: string[]; labels: string[][] };

// LabelMenu toggles labels on the selected rows, or on target when given
// (the open message). A label all of them carry shows checked and comes
// off; one some or none carry goes on all.
export function LabelMenu({ target }: { target?: Target }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const chosen = rows.value.filter((r) => selected.value.has(r.MID));
  const mids = target?.mids ?? chosen.map((r) => r.MID);
  const sets = target?.labels ?? chosen.map((r) => r.Labels);
  const state = (name: string): State => {
    const n = sets.filter((ls) => ls.includes(name)).length;
    return n === 0 ? 'false' : n === sets.length ? 'true' : 'mixed';
  };

  const onKey = (e: KeyboardEvent) => {
    const els = Array.from(wrap.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    const at = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); els[(at + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(at - 1 + els.length) % els.length]?.focus(); }
  };

  return (
    <span ref={wrap} class="ui-menu-wrap">
      <IconButton icon={Tag} label="Label" onClick={() => setOpen(!open)} />
      {open && (
        <div class="ui-menu left label-menu" role="menu" aria-label="Labels" onKeyDown={onKey}>
          {labels.value.map((l) => {
            const s = state(l.name);
            return (
              <button key={l.name} type="button" role="menuitemcheckbox" aria-checked={s} class="ui-menu-item"
                onClick={() => void (s === 'true' ? applyBulkTo(mids, 'labels', [], [l.name]) : applyBulkTo(mids, 'labels', [l.name], []))}>
                <span class={`lm-box ${s}`} aria-hidden="true" />
                <span class="dot" style={{ background: l.color }} />
                {l.name}
              </button>
            );
          })}
          {labels.value.length > 0 && <div class="lm-sep" role="separator" />}
          <button type="button" role="menuitem" class="ui-menu-item" onClick={() => { setOpen(false); setCreating(true); }}>
            <Plus size={16} /> New label
          </button>
        </div>
      )}
      {creating && (
        <LabelEditor open onClose={(created) => {
          setCreating(false);
          if (created) void applyBulkTo(mids, 'labels', [created], []);
        }} />
      )}
    </span>
  );
}
