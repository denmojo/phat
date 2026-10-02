import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import './Tooltip.css';

type Props = { id: string; content: ComponentChildren; children: ComponentChildren };

// Tooltip shows rich content beside its trigger on hover and keyboard
// focus. A title attribute renders plain text only, so this is a
// styled element of the page's own; it describes the trigger for
// screen readers through aria-describedby. Hover and focus are tracked
// apart, so the mouse leaving doesn't hide it while the trigger still
// has focus, and Escape anywhere dismisses it until the next hover or
// focus.
export function Tooltip({ id, content, children }: Props) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = (hovered || focused) && !dismissed;

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setDismissed(true); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open]);

  return (
    <span class="ui-tooltip">
      <span class="ui-tooltip-trigger" tabIndex={0} aria-describedby={id}
        onMouseEnter={() => { setHovered(true); setDismissed(false); }} onMouseLeave={() => setHovered(false)}
        onFocus={() => { setFocused(true); setDismissed(false); }} onBlur={() => setFocused(false)}>
        {children}
      </span>
      <span role="tooltip" id={id} class="ui-tooltip-body" hidden={!open}>{content}</span>
    </span>
  );
}
