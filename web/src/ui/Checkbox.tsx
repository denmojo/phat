import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import './Checkbox.css';

type Props = {
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  onClick: (e: JSX.TargetedMouseEvent<HTMLInputElement>) => void;
};

// Checkbox is a native checkbox drawn to the design; label is its
// accessible name. onClick receives the event so callers can read Shift.
export function Checkbox({ label, checked, indeterminate = false, onClick }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <span class="ui-checkwrap">
      <input ref={ref} type="checkbox" class="ui-check" aria-label={label} checked={checked}
        onClick={(e) => { e.stopPropagation(); onClick(e); }} onChange={() => {}} />
    </span>
  );
}
