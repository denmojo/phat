import { useEffect, useRef } from 'preact/hooks';

// isTyping reports a key meant for a field: an input, textarea, select or
// content-editable element.
export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);
}

// modalOpen reports a modal dialog on the page; Phat's keys stand down
// while one is open so they can't act behind it.
export function modalOpen(): boolean {
  return document.querySelector('[aria-modal="true"]') !== null;
}

// useHotkeys binds single keys to handlers while enabled. Keys match
// e.key exactly, so 'R' is shifted r. A held Ctrl, Alt or Command leaves
// the key to the browser (Cmd-R still reloads), and typing in a field or
// an open dialog leaves it alone.
export function useHotkeys(keys: Record<string, () => void>, enabled = true): void {
  const current = useRef(keys);
  current.current = keys;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const run = current.current[e.key];
      if (!run || isTyping(e) || modalOpen()) return;
      e.preventDefault();
      run();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}
