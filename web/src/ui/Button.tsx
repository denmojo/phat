import type { ComponentChildren, JSX } from 'preact';
import './Button.css';

type Props = {
  variant?: 'primary' | 'default' | 'danger';
  size?: 'sm' | 'md';
  type?: 'button' | 'submit';
  disabled?: boolean;
  title?: string;
  onClick?: (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => void;
  children: ComponentChildren;
};

export function Button({ variant = 'default', size = 'md', type = 'button', disabled, title, onClick, children }: Props) {
  return (
    <button type={type} class={`ui-btn ui-btn-${variant} ui-btn-${size}`} disabled={disabled} title={title} onClick={onClick}>
      {children}
    </button>
  );
}
