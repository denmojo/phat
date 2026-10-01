import { useState } from 'preact/hooks';
import { Check } from 'lucide-preact';
import * as api from '../../lib/api';
import { ApiError } from '../../lib/api';
import type { Label } from '../../lib/types';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { TextField } from '../../ui/TextField';
import { refresh, refreshSidebar, setView, view } from './store';
import './Editors.css';

export const LABEL_COLORS = ['#2563eb', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#6b7280'];

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
  const [color, setColor] = useState(edit?.color ?? LABEL_COLORS[0]!);
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
        <fieldset class="swatches" role="radiogroup" aria-label="Color">
          <legend>Color</legend>
          {LABEL_COLORS.map((c) => (
            <button key={c} type="button" role="radio" class="swatch" style={{ '--c': c }} aria-checked={color === c}
              aria-label={c} onClick={() => setColor(c)}>
              {color === c && <Check />}
            </button>
          ))}
        </fieldset>
      </form>
    </Dialog>
  );
}
