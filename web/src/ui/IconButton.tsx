import type { JSX } from 'preact';
import type { LucideIcon } from 'lucide-preact';
import './IconButton.css';

type Props = {
  icon: LucideIcon;
  label: string;
  title?: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick?: (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => void;
};

// IconButton is a round, borderless button carrying one Lucide icon. The
// label is its accessible name; title defaults to the label for a tooltip.
export function IconButton({ icon: Icon, label, title, pressed, disabled, onClick }: Props) {
  return (
    <button type="button" class={`ui-iconbtn${pressed ? ' on' : ''}`} aria-label={label} title={title ?? label}
      aria-pressed={pressed === undefined ? undefined : pressed} disabled={disabled} onClick={onClick}>
      <Icon />
    </button>
  );
}
