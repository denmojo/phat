import { useState } from 'preact/hooks';
import { Check } from 'lucide-preact';
import * as api from '../../lib/api';
import { ApiError } from '../../lib/api';
import type { Label } from '../../lib/types';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { TextField } from '../../ui/TextField';
import { labels, refresh, refreshSidebar, setView, view } from './store';
import './Editors.css';

// Twenty hue families, each in a bright and a deep shade, so a mailbox with
// dozens of labels can still tell them apart. The bright row comes first,
// so new labels take bright colors before deep ones.
const FAMILIES: [string, string, string][] = [
  ['Red', '#dc2626', '#991b1b'], ['Orange', '#ea580c', '#9a3412'], ['Amber', '#d97706', '#92400e'],
  ['Yellow', '#ca8a04', '#854d0e'], ['Lime', '#65a30d', '#3f6212'], ['Green', '#16a34a', '#166534'],
  ['Emerald', '#059669', '#065f46'], ['Teal', '#0d9488', '#115e59'], ['Cyan', '#0891b2', '#155e75'],
  ['Sky', '#0284c7', '#075985'], ['Blue', '#2563eb', '#1e40af'], ['Indigo', '#4f46e5', '#3730a3'],
  ['Violet', '#7c3aed', '#5b21b6'], ['Purple', '#9333ea', '#6b21a8'], ['Fuchsia', '#c026d3', '#86198f'],
  ['Pink', '#db2777', '#9d174d'], ['Rose', '#e11d48', '#9f1239'], ['Slate', '#475569', '#1e293b'],
  ['Gray', '#6b7280', '#374151'], ['Stone', '#78716c', '#44403c'],
];
export const LABEL_COLORS: { name: string; hex: string }[] = [
  ...FAMILIES.map(([name, bright]) => ({ name, hex: bright })),
  ...FAMILIES.map(([name, , deep]) => ({ name: `Dark ${name.toLowerCase()}`, hex: deep })),
];

function unusedColor(): string {
  const used = new Set(labels.value.map((l) => l.color.toLowerCase()));
  return (LABEL_COLORS.find((c) => !used.has(c.hex)) ?? LABEL_COLORS[0]!).hex;
}

type Props = { open: boolean; edit?: Label; onClose: (created?: string) => void };

function labelMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return 'A label with that name exists';
    if (err.status === 400) return 'Give the label a name';
  }
  return err instanceof Error ? err.message : String(err);
}

// LabelEditor creates a label, or renames and recolors one, in a dialog.
export function LabelEditor({ open, edit, onClose }: Props) {
  const [name, setName] = useState(edit?.name ?? '');
  const [color, setColor] = useState(() => edit?.color ?? unusedColor());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = name.trim();
    if (!n) return setError('Give the label a name');
    setBusy(true);
    try {
      if (edit) {
        const patch: { name?: string; color?: string } = {};
        if (n !== edit.name) patch.name = n;
        if (color !== edit.color) patch.color = color;
        if (patch.name || patch.color) await api.updateLabel(edit.name, patch);
        const v = view.value;
        if (patch.name && v.kind === 'label' && v.name === edit.name) void setView({ kind: 'label', name: n });
      } else {
        await api.createLabel(n, color);
      }
      await Promise.all([refreshSidebar(), refresh()]);
      onClose(edit ? undefined : n);
    } catch (err) {
      setError(labelMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} title={edit ? 'Edit label' : 'New label'} onClose={() => onClose()}
      footer={<><span style={{ flex: 1 }} /><Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>{edit ? 'Save' : 'Create'}</Button></>}>
      <form class="dialog-pad" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <TextField label="Name" value={name} autofocus onInput={(v) => { setName(v); setError(''); }} error={error || undefined} />
        <fieldset class="swatches">
          <legend>Color</legend>
          <div class="swatch-grid" role="radiogroup" aria-label="Color">
            {LABEL_COLORS.map((c) => (
              <button key={c.hex} type="button" role="radio" class="swatch" style={{ '--c': c.hex }} aria-checked={color === c.hex}
                aria-label={c.name} title={c.name} onClick={() => setColor(c.hex)}>
                {color === c.hex && <Check />}
              </button>
            ))}
          </div>
          <label class="custom-color">
            <input type="color" aria-label="Custom color" value={color} onInput={(e) => setColor(e.currentTarget.value)} />
            <span>{LABEL_COLORS.some((c) => c.hex === color) ? 'Custom color' : `Custom: ${color}`}</span>
          </label>
        </fieldset>
      </form>
    </Dialog>
  );
}
