import { renderHook } from '@testing-library/preact';
import { useHotkeys } from '../hotkeys';

afterEach(() => { document.body.innerHTML = ''; });

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}

test('a mapped key calls its handler and takes the default', () => {
  const r = vi.fn();
  renderHook(() => useHotkeys({ r }));
  const e = press('r');
  expect(r).toHaveBeenCalledOnce();
  expect(e.defaultPrevented).toBe(true);
});

test('shifted R and plain r reach different handlers', () => {
  const r = vi.fn();
  const R = vi.fn();
  renderHook(() => useHotkeys({ r, R }));
  press('R', { shiftKey: true });
  expect(R).toHaveBeenCalledOnce();
  expect(r).not.toHaveBeenCalled();
});

test('Ctrl, Alt and Command leave the key to the browser', () => {
  const r = vi.fn();
  renderHook(() => useHotkeys({ r }));
  for (const mod of ['ctrlKey', 'altKey', 'metaKey'] as const) {
    const e = press('r', { [mod]: true });
    expect(e.defaultPrevented).toBe(false);
  }
  expect(r).not.toHaveBeenCalled();
});

test('a key typed into a field is ignored', () => {
  const r = vi.fn();
  renderHook(() => useHotkeys({ r }));
  for (const tag of ['input', 'textarea', 'select']) {
    const el = document.createElement(tag);
    document.body.appendChild(el);
    press('r', {}, el);
  }
  expect(r).not.toHaveBeenCalled();
});

test('keys still work with focus on a checkbox, as after ticking a row', () => {
  const t = vi.fn();
  renderHook(() => useHotkeys({ t }));
  for (const type of ['checkbox', 'radio', 'button']) {
    const el = document.createElement('input');
    el.type = type;
    document.body.appendChild(el);
    press('t', {}, el);
  }
  expect(t).toHaveBeenCalledTimes(3);
});

test('Enter on a focused button or link stays with that control', () => {
  const Enter = vi.fn();
  renderHook(() => useHotkeys({ Enter }));
  const btn = document.createElement('button');
  const link = document.createElement('a');
  link.href = '#x';
  const item = document.createElement('div');
  item.setAttribute('role', 'menuitemcheckbox');
  document.body.append(btn, link, item);
  for (const el of [btn, link, item]) expect(press('Enter', {}, el).defaultPrevented).toBe(false);
  expect(Enter).not.toHaveBeenCalled();
  const box = document.createElement('input');
  box.type = 'checkbox';
  document.body.appendChild(box);
  press('Enter', {}, box);
  expect(Enter).toHaveBeenCalledOnce();
});

test('an open dialog suppresses the keys', () => {
  const r = vi.fn();
  renderHook(() => useHotkeys({ r }));
  const d = document.createElement('div');
  d.setAttribute('aria-modal', 'true');
  document.body.appendChild(d);
  press('r');
  expect(r).not.toHaveBeenCalled();
});

test('disabled, the keys do nothing', () => {
  const r = vi.fn();
  renderHook(() => useHotkeys({ r }, false));
  press('r');
  expect(r).not.toHaveBeenCalled();
});
