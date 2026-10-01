import { useState } from 'preact/hooks';
import { Folder } from 'lucide-preact';
import * as api from '../../lib/api';
import { ApiError } from '../../lib/api';
import { refreshSidebar, setView, view } from './store';
import './Editors.css';

type Props = { rename?: string; onDone: () => void };

function folderMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return 'A folder with that name exists';
    if (err.status === 400) return 'Letters, digits, space, - and _ only, 32 max';
    if (err.status === 403) return 'Inbox, Outbox, Sent and Archive cannot be renamed';
  }
  return err instanceof Error ? err.message : String(err);
}

// FolderEditor is the inline field under the Folders group. Enter saves,
// Escape cancels; a refusal from the server shows under the field and the
// field stays open so the name can be fixed.
export function FolderEditor({ rename, onDone }: Props) {
  const [name, setName] = useState(rename ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = name.trim();
    if (!n || n === rename) return onDone();
    setBusy(true);
    try {
      if (rename) {
        await api.renameFolder(rename, n);
        const v = view.value;
        if (v.kind === 'folder' && v.name === rename) void setView({ kind: 'folder', name: n });
      } else {
        await api.createFolder(n);
      }
      await refreshSidebar();
      onDone();
    } catch (err) {
      setError(folderMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="inline-editor">
      <div class="inline-row">
        <Folder />
        <input autofocus value={name} disabled={busy} maxLength={32} placeholder="Folder name"
          aria-label={rename ? `Rename folder ${rename}` : 'New folder name'} aria-invalid={error ? true : undefined}
          onInput={(e) => { setName(e.currentTarget.value); setError(''); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); void save(); }
            if (e.key === 'Escape') { e.preventDefault(); onDone(); }
          }}
          onBlur={() => { if (!name.trim() && !busy) onDone(); }} />
      </div>
      {error && <p class="inline-error" role="alert">{error}</p>}
    </div>
  );
}

// deleteFolderMessage explains why the server refused a folder delete.
export function deleteFolderMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 409) return 'This folder still holds messages. Move or delete them first.';
  return folderMessage(err);
}
