import type { ComponentChildren } from 'preact';
import { X } from 'lucide-preact';
import './Chip.css';

type Props = {
  color?: string;
  // token draws an address chip in an editable field.
  token?: boolean;
  onRemove?: (e: MouseEvent) => void;
  removeLabel?: string;
  children: ComponentChildren;
};

// Chip is a small rounded tag, tinted by color (a label's color) or grey.
export function Chip({ color, token, onRemove, removeLabel, children }: Props) {
  const style = color ? { '--c': color } : undefined;
  return (
    <span class={`ui-chip${token ? ' token' : ''}`} style={style}>
      {children}
      {onRemove && (
        <button type="button" class="ui-chip-x" aria-label={removeLabel ?? 'Remove'} onClick={onRemove}>
          <X size={14} />
        </button>
      )}
    </span>
  );
}
