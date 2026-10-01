export type Appearance = 'system' | 'light' | 'dark';

let mq: MediaQueryList | null = null;
let handler: ((e: { matches: boolean }) => void) | null = null;

// applyAppearance sets data-theme on <html>. For 'system' it follows the
// OS color scheme and keeps following it until called again.
export function applyAppearance(value: Appearance): void {
  if (mq && handler) mq.removeEventListener('change', handler);
  mq = null;
  handler = null;
  if (value !== 'system') {
    document.documentElement.dataset.theme = value;
    return;
  }
  mq = window.matchMedia('(prefers-color-scheme: dark)');
  const set = (e: { matches: boolean }) => {
    document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
  };
  set(mq);
  handler = set;
  mq.addEventListener('change', set);
}
