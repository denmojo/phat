import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useId, useRef } from 'preact/hooks';
import { X } from 'lucide-preact';
import { IconButton } from './IconButton';
import './Dialog.css';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ComponentChildren;
  wide?: boolean;
  // closeOnBackdrop false keeps a click outside from closing the dialog,
  // for dialogs holding work a stray click would lose.
  closeOnBackdrop?: boolean;
  children: ComponentChildren;
};

// open dialogs, newest last; only the top one answers Escape and Tab, so a
// dialog opened over another closes alone.
const stack: object[] = [];

const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Dialog renders a modal into document.body. Escape, the close button and
// a click on the backdrop close it; Tab stays inside while it is open, and
// focus returns to where it was when it closes.
export function Dialog({ open, title, onClose, footer, wide, closeOnBackdrop = true, children }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const me = {};
    stack.push(me);
    const before = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>('[autofocus]') ?? box.current?.querySelector<HTMLElement>(focusable);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== me) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !box.current) return;
      const els = Array.from(box.current.querySelectorAll<HTMLElement>(focusable));
      if (els.length === 0) return;
      const head = els[0]!;
      const tail = els[els.length - 1]!;
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(me), 1);
      before?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div class="ui-scrim" onClick={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}>
      <div ref={box} class={`ui-dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div class="ui-dialog-head">
          <h2 id={titleId}>{title}</h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div class="ui-dialog-body">{children}</div>
        {footer && <div class="ui-dialog-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
