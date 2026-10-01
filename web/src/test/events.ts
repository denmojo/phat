// @testing-library/preact sends fireEvent.change as an input event, and
// preact/compat turns a text field's onChange into onInput. These helpers
// fire what a browser fires, inside act so the re-render is flushed.
import { act } from 'preact/test-utils';

// change picks a value in a select (or a file or checkbox input).
export function change(el: Element, value: string): void {
  act(() => {
    (el as HTMLSelectElement).value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

// commit types a value into a text field and leaves it, the way a person
// finishes an entry that acts on blur.
export function commit(el: Element, value: string): void {
  const input = el as HTMLInputElement;
  act(() => {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => input.blur());
}
