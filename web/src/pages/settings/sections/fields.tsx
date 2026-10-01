import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';

// Preact's useId repeats across portal roots, so a field in a dialog could
// share an id with one on the page; a page-wide counter cannot.
let next = 0;
function useId(): string {
  const id = useRef('');
  if (!id.current) id.current = `st-${++next}`;
  return id.current;
}

// Shared building blocks for the settings sections: a titled card, and
// labeled text, number, select and checkbox fields with an optional hint.

export function Section({ id, title, children, action }: { id: string; title: string; children: ComponentChildren; action?: ComponentChildren }) {
  return (
    <section class="st-section" id={id} aria-labelledby={`${id}-h`}>
      <header class="st-section-head"><h2 id={`${id}-h`}>{title}</h2>{action}</header>
      <div class="st-section-body">{children}</div>
    </section>
  );
}

// Group is a collapsible block inside a section, used for each transport.
export function Group({ title, open, children }: { title: string; open?: boolean; children: ComponentChildren }) {
  return (
    <details class="st-group" open={open}>
      <summary>{title}</summary>
      <div class="st-group-body">{children}</div>
    </details>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onInput: (v: string) => void;
  hint?: ComponentChildren;
  type?: 'text' | 'number' | 'password';
  placeholder?: string;
  required?: boolean;
  error?: string;
  min?: number;
  max?: number;
  onBlur?: () => void;
  onFocus?: () => void;
  suffix?: ComponentChildren;
  autocomplete?: string;
};

export function Field({ label, value, onInput, hint, type = 'text', placeholder, required, error, min, max, onBlur, onFocus, suffix, autocomplete = 'off' }: FieldProps) {
  const id = useId();
  return (
    <div class={`st-field${error ? ' invalid' : ''}`}>
      <label for={id}>{label}{required && <span class="st-req" aria-hidden="true"> *</span>}</label>
      <div class="st-control">
        <input id={id} type={type} value={value} placeholder={placeholder} required={required} min={min} max={max}
          autocomplete={autocomplete} spellcheck={false} aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? `${id}-hint` : undefined}
          onInput={(e) => onInput(e.currentTarget.value)} onBlur={onBlur} onFocus={onFocus} />
        {suffix}
      </div>
      {(hint || error) && <p id={`${id}-hint`} class={error ? 'st-error' : 'st-hint'}>{error || hint}</p>}
    </div>
  );
}

export function Select({ label, value, onChange, options, hint }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][]; hint?: ComponentChildren;
}) {
  const id = useId();
  const known = options.some(([v]) => v === value);
  return (
    <div class="st-field">
      <label for={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.currentTarget.value)} aria-describedby={hint ? `${id}-hint` : undefined}>
        {!known && <option value={value}>{value}</option>}
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      {hint && <p id={`${id}-hint`} class="st-hint">{hint}</p>}
    </div>
  );
}

export function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: ComponentChildren }) {
  const id = useId();
  return (
    <div class="st-check">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)}
        aria-describedby={hint ? `${id}-hint` : undefined} />
      <div>
        <label for={id}>{label}</label>
        {hint && <p id={`${id}-hint`} class="st-hint">{hint}</p>}
      </div>
    </div>
  );
}
