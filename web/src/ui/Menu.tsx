import type { ComponentChildren } from 'preact';
import type { LucideIcon } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import './Menu.css';

export type MenuItem = {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
};

type Props = {
  trigger: ComponentChildren;
  items: MenuItem[];
  align?: 'left' | 'right';
};

// Menu wraps a trigger (normally an IconButton) and opens a list of
// actions under it. Click or keyboard on the trigger opens it; Escape, an
// outside press or choosing an item closes it.
export function Menu({ trigger, items, align = 'left' }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onKey = (e: KeyboardEvent) => {
    const els = Array.from(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const at = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      wrap.current?.querySelector<HTMLElement>('button')?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(at + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(at - 1 + els.length) % els.length]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <span ref={wrap} class="ui-menu-wrap" onClick={(e) => {
      if (!list.current?.contains(e.target as Node)) setOpen((o) => !o);
    }}>
      {trigger}
      {open && (
        <div ref={list} class={`ui-menu ${align}`} role="menu" onKeyDown={onKey}>
          {items.map(({ label, icon: Icon, onSelect, danger }) => (
            <button type="button" role="menuitem" key={label} class={`ui-menu-item${danger ? ' danger' : ''}`}
              onClick={() => { setOpen(false); onSelect(); }}>
              {Icon && <Icon size={16} />}
              {label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
