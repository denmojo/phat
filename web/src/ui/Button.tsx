import type { ComponentChildren, JSX } from 'preact';
import './Button.css';

type Props = {
  variant?: 'primary' | 'default' | 'danger';
  size?: 'sm' | 'md';
  type?: 'button' | 'submit';
  disabled?: boolean;
  title?: string;
  // label names the button when its visible text may be hidden.
  label?: string;
  // autofocus takes focus when the button appears, as a dialog's default
  // action does, so Enter presses it.
  autofocus?: boolean;
  onClick?: (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => void;
  children: ComponentChildren;
};

export function Button({ variant = 'default', size = 'md', type = 'button', disabled, title, label, autofocus, onClick, children }: Props) {
  return (
    <button type={type} class={`ui-btn ui-btn-${variant} ui-btn-${size}`} disabled={disabled} autofocus={autofocus} title={title} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}
