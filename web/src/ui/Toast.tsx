import { signal } from '@preact/signals';
import './Toast.css';

type Kind = 'info' | 'error';
type Item = { id: number; message: string; kind: Kind };

const items = signal<Item[]>([]);
let next = 1;

// toast shows a short message at the bottom of the window. Errors stay
// twice as long by default and are announced as alerts.
export function toast(message: string, opts: { kind?: Kind; ms?: number } = {}): void {
  const kind = opts.kind ?? 'info';
  const id = next++;
  items.value = [...items.value, { id, message, kind }];
  setTimeout(() => {
    items.value = items.value.filter((t) => t.id !== id);
  }, opts.ms ?? (kind === 'error' ? 8000 : 4000));
}

export function Toasts() {
  return (
    <div class="ui-toasts">
      {items.value.map((t) => (
        <div key={t.id} class={`ui-toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
