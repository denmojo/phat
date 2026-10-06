import { useEffect, useState } from 'preact/hooks';
import { ChevronRight, FileText, RefreshCw } from 'lucide-preact';
import * as api from '../../lib/api';
import { startFormPolling } from '../../lib/forms';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { draft } from './store';
import './FormCatalog.css';

type Form = { name: string; template_path: string };
type Folder = { name: string; path?: string; version?: string; form_count: number; forms: Form[] | null; folders: Folder[] | null };

// matching keeps the forms whose template path holds the filter, and the
// folders that still hold any.
function matching(f: Folder, q: string): Folder | null {
  const forms = (f.forms ?? []).filter((x) => x.template_path.toLowerCase().includes(q));
  const folders = (f.folders ?? []).filter((x) => x.form_count > 0).map((x) => matching(x, q)).filter((x): x is Folder => x !== null);
  if (forms.length === 0 && folders.length === 0) return null;
  return { ...f, forms, folders };
}

function count(f: Folder): number {
  return (f.forms ?? []).length + (f.folders ?? []).reduce((n, x) => n + count(x), 0);
}

function Tree({ f, expand, choose }: { f: Folder; expand: boolean; choose: (x: Form) => void }) {
  return (
    <>
      {(f.folders ?? []).map((sub) => <Branch key={sub.name} f={sub} expand={expand} choose={choose} />)}
      {(f.forms ?? []).map((x) => (
        <button key={x.template_path} type="button" class="fc-form" onClick={() => choose(x)}>
          <FileText /><span>{x.name}</span>
        </button>
      ))}
    </>
  );
}

function Branch({ f, expand, choose }: { f: Folder; expand: boolean; choose: (x: Form) => void }) {
  const [open, setOpen] = useState(false);
  const shown = open || expand;
  return (
    <div class="fc-folder">
      <button type="button" class={`fc-toggle${shown ? ' open' : ''}`} aria-expanded={shown} onClick={() => setOpen(!shown)}>
        <ChevronRight /><span>{f.name}</span><span class="n">{count(f)}</span>
      </button>
      {shown && <div class="fc-kids"><Tree f={f} expand={expand} choose={choose} /></div>}
    </div>
  );
}

// FormCatalog lists the Winlink form templates. Choosing one opens it in a
// new tab and starts the poll that fills the composer when it is posted.
export function FormCatalog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [root, setRoot] = useState<Folder | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [updating, setUpdating] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);

  const load = async () => {
    try {
      setRoot((await api.formCatalog()) as Folder);
      setFailed(false);
    } catch {
      setRoot(null);
      setFailed(true);
    }
  };
  useEffect(() => {
    if (open) void load();
  }, [open]);

  const choose = (x: Form) => {
    const ref = draft.value.inReplyTo;
    startFormPolling();
    window.open(`/api/forms?template=${encodeURIComponent(x.template_path)}${ref ? `&in-reply-to=${encodeURIComponent(ref)}` : ''}`);
    onClose();
  };

  const update = async () => {
    setUpdating(true);
    setNote(null);
    try {
      const r = (await api.formsUpdate()) as { action: string; newestVersion: string; owner?: string };
      if (r.owner === 'pat') {
        // Phat uses Pat's forms folder, so Pat ran the update.
        setNote({
          text: r.action === 'update'
            ? `Pat updated its forms to ${r.newestVersion}. These forms belong to Pat.`
            : `Pat already has the latest forms (${r.newestVersion}). These forms belong to Pat.`,
        });
        if (r.action === 'update') await load();
      } else if (r.action === 'update') {
        setNote({ text: `Updated forms to ${r.newestVersion}` });
        await load();
      } else {
        setNote({ text: 'You already have the latest forms version' });
      }
    } catch (err) {
      setNote({ text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setUpdating(false);
    }
  };

  const filter = q.trim().toLowerCase();
  const shown = root ? matching(root, filter) : null;
  const total = shown ? count(shown) : 0;
  const empty = !root || count(root) === 0;
  return (
    <Dialog open={open} title="Winlink forms" onClose={onClose}
      footer={(
        <>
          <span class="fc-ver">{root?.version ? `Templates ${root.version}` : ''}</span>
          <span class="spacer" />
          <Button disabled={updating} onClick={() => void update()}>
            <RefreshCw class={updating ? 'spin' : ''} /><span>Update forms</span>
          </Button>
        </>
      )}>
      <div class="formcatalog">
        <input type="search" class="fc-filter" aria-label="Filter forms" placeholder="Filter forms" value={q} autofocus
          onInput={(e) => setQ(e.currentTarget.value)} />
        {note && <p class={`fc-note${note.error ? ' error' : ''}`} role={note.error ? 'alert' : 'status'}>{note.text}</p>}
        {empty && (
          <p class="fc-empty">{failed ? 'Could not read the form catalog.' : 'Form templates are not downloaded yet. Use Update forms to fetch them.'}</p>
        )}
        {!empty && !shown && <p class="fc-empty">No forms match.</p>}
        {/* A short list opens every folder, the way the old catalog did under 20 results. */}
        {shown && <div class="fc-tree"><Tree f={shown} expand={filter !== '' && total < 20} choose={choose} /></div>}
      </div>
    </Dialog>
  );
}
