import { useEffect, useRef, useState } from 'preact/hooks';
import { Search } from 'lucide-preact';
import { setView, view } from './store';

// SearchBox searches every folder. Task 5 adds debouncing and Escape.
export function SearchBox() {
  const v = view.value;
  const [q, setQ] = useState(v.kind === 'search' ? v.q : '');
  const input = useRef<HTMLInputElement>(null);
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
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <form role="search" class="search" onSubmit={(e) => {
      e.preventDefault();
      if (q.trim()) void setView({ kind: 'search', q: q.trim() });
    }}>
      <Search />
      <input ref={input} type="search" aria-label="Search mail" placeholder="Search mail" value={q}
        onInput={(e) => setQ(e.currentTarget.value)} />
      <span class="kbd" aria-hidden="true">/</span>
    </form>
  );
}
