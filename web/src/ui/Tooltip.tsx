import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import './Tooltip.css';

type Props = { id: string; content: ComponentChildren; children: ComponentChildren };

// Tooltip shows rich content beside its trigger on hover and keyboard
// focus. A title attribute renders plain text only, so this is a
// styled element of the page's own; it describes the trigger for
// screen readers through aria-describedby.
export function Tooltip({ id, content, children }: Props) {
  const [open, setOpen] = useState(false);
  const show = () => setOpen(true);
  const hide = () => setOpen(false);
  return (
    <span class="ui-tooltip">
      <span class="ui-tooltip-trigger" tabIndex={0} aria-describedby={id}
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
        onKeyDown={(e) => { if (e.key === 'Escape') hide(); }}>
        {children}
      </span>
      <span role="tooltip" id={id} class="ui-tooltip-body" hidden={!open}>{content}</span>
    </span>
  );
}
