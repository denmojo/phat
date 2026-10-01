import { applyAppearance } from '../theme';
test('light and dark set data-theme directly', () => {
  applyAppearance('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
  applyAppearance('light');
  expect(document.documentElement.dataset.theme).toBe('light');
});
test('system follows prefers-color-scheme', () => {
  const listeners: ((e: { matches: boolean }) => void)[] = [];
  window.matchMedia = ((q: string) => ({
    matches: true, media: q,
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn),
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  applyAppearance('system');
  expect(document.documentElement.dataset.theme).toBe('dark');
  listeners.forEach((fn) => fn({ matches: false }));
  expect(document.documentElement.dataset.theme).toBe('light');
});
