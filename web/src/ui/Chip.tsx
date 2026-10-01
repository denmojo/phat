import type { ComponentChildren } from 'preact';
import { X } from 'lucide-preact';
import './Chip.css';

type Props = {
  color?: string;
  onRemove?: () => void;
  removeLabel?: string;
  children: ComponentChildren;
};

// Chip is a small rounded tag, tinted by color (a label's color) or neutral.
export function Chip({ color, onRemove, removeLabel, children }: Props) {
  const style = color ? { '--c': color } : undefined;
  return (
    <span class={`ui-chip${color ? '' : ' neutral'}`} style={style}>
      {children}
      {onRemove && (
        <button type="button" class="ui-chip-x" aria-label={removeLabel ?? 'Remove'} onClick={onRemove}>
          <X size={14} />
        </button>
      )}
    </span>
  );
}
