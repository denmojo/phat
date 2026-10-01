import { useId } from 'preact/hooks';
import './TextField.css';

type Props = {
  label: string;
  value: string;
  onInput: (value: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  autofocus?: boolean;
};

export function TextField({ label, value, onInput, type = 'text', placeholder, error, autofocus }: Props) {
  const id = useId();
  return (
    <div class={`ui-field${error ? ' invalid' : ''}`}>
      <label for={id}>{label}</label>
      <input id={id} type={type} value={value} placeholder={placeholder} autofocus={autofocus}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined}
        onInput={(e) => onInput(e.currentTarget.value)} />
      {error && <span id={`${id}-err`} class="ui-field-error">{error}</span>}
    </div>
  );
}
