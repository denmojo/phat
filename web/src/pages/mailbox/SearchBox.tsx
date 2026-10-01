import { useEffect, useRef, useState } from 'preact/hooks';
import { Search } from 'lucide-preact';
import { endSearch, setView, view } from './store';

const DEBOUNCE_MS = 250;

// SearchBox searches every folder as the user types, after a short pause.
// Escape, or emptying the box, returns to the folder or label being browsed.
export function SearchBox() {
  const v = view.value;
  const [q, setQ] = useState(v.kind === 'search' ? v.q : '');
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (view.value.kind !== 'search') setQ('');
  }, [view.value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const run = (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const t = text.trim();
    if (t) void setView({ kind: 'search', q: t });
    else if (view.value.kind === 'search') void endSearch();
  };

  return (
    <form role="search" class="search" onSubmit={(e) => { e.preventDefault(); run(q); }}>
      <Search />
      <input ref={input} type="search" aria-label="Search mail" placeholder="Search mail" value={q}
        onInput={(e) => {
          const text = e.currentTarget.value;
          setQ(text);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => run(text), DEBOUNCE_MS);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          e.preventDefault();
          if (timer.current) clearTimeout(timer.current);
          setQ('');
          if (view.value.kind === 'search') void endSearch();
          input.current?.blur();
        }} />
      <span class="kbd" aria-hidden="true">/</span>
    </form>
  );
}
