import { useId, useState } from 'preact/hooks';
import { Chip } from './Chip';
import './TokenField.css';

type Props = {
  label: string;
  tokens: string[];
  onChange: (tokens: string[]) => void;
  delimiters?: string[];
  placeholder?: string;
};

// TokenField edits a list of addresses as chips. Typing a delimiter,
// pressing Enter or leaving the field turns the pending text into tokens;
// Backspace in an empty field removes the last one.
export function TokenField({ label, tokens, onChange, delimiters = [',', ';', ' '], placeholder }: Props) {
  const id = useId();
  const [pending, setPending] = useState('');

  const split = (s: string) => {
    let parts = [s];
    for (const d of delimiters) parts = parts.flatMap((p) => p.split(d));
    return parts;
  };
  const commit = (text: string) => {
    const add = split(text).map((t) => t.trim()).filter((t) => t !== '');
    if (add.length) onChange([...tokens, ...add]);
    setPending('');
  };

  const onInput = (value: string) => {
    const parts = split(value);
    const rest = parts.pop() ?? '';
    const add = parts.map((t) => t.trim()).filter((t) => t !== '');
    if (add.length) onChange([...tokens, ...add]);
    setPending(rest);
  };

  return (
    <div class="ui-tokenfield">
      <label for={id}>{label}</label>
      {tokens.map((t, i) => (
        <Chip key={`${t}-${i}`} removeLabel={`Remove ${t}`} onRemove={() => onChange(tokens.filter((_, j) => j !== i))}>
          {t}
        </Chip>
      ))}
      <input id={id} value={pending} placeholder={tokens.length ? undefined : placeholder} autocomplete="off" spellcheck={false}
        onInput={(e) => onInput(e.currentTarget.value)}
        onBlur={() => commit(pending)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(pending);
          } else if (e.key === 'Backspace' && pending === '' && tokens.length) {
            onChange(tokens.slice(0, -1));
          }
        }} />
    </div>
  );
}
