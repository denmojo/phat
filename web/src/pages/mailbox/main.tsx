// Temporary component gallery for review on the preview server. Web Task 4
// replaces this file with the mailbox shell.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { Archive, MoreHorizontal, Star, Tag, Trash2 } from 'lucide-preact';
import '../../ui/base.css';
import { applyAppearance, type Appearance } from '../../ui/theme';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Chip } from '../../ui/Chip';
import { Dialog } from '../../ui/Dialog';
import { Menu } from '../../ui/Menu';
import { TextField } from '../../ui/TextField';
import { TokenField } from '../../ui/TokenField';
import { Toasts, toast } from '../../ui/Toast';

applyAppearance((document.documentElement.dataset.appearance as Appearance) || 'system');

const LABELS: [string, string][] = [['net-control', '#2563eb'], ['urgent', '#dc2626'], ['logistics', '#16a34a'], ['follow up', '#d97706'], ['personal', '#7c3aed']];

function Gallery() {
  const [theme, setTheme] = useState<Appearance>('system');
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(['W6EOC', 'KJ6ABC']);
  const [name, setName] = useState('');
  const [starred, setStarred] = useState(true);
  const pick = (a: Appearance) => { setTheme(a); applyAppearance(a); };
  const section = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-5)' };
  return (
    <main class="stack" style={{ gap: 'var(--space-5)', maxWidth: 860, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <div class="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 'var(--text-xl)' }}>Phat components</h1>
        <div class="row">
          {(['system', 'light', 'dark'] as Appearance[]).map((a) => (
            <Button key={a} size="sm" variant={theme === a ? 'primary' : 'default'} onClick={() => pick(a)}>{a}</Button>
          ))}
        </div>
      </div>
      <p class="muted">Base components for review (web Task 2). The mailbox screen replaces this page in Task 4.</p>

      <section class="stack" style={section}>
        <h2 style={{ fontSize: 'var(--text-lg)' }}>Buttons</h2>
        <div class="row" style={{ flexWrap: 'wrap' }}>
          <Button variant="primary">Send</Button>
          <Button>Cancel</Button>
          <Button variant="danger">Delete folder</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
        </div>
        <div class="row">
          <IconButton icon={Archive} label="Archive" />
          <IconButton icon={Trash2} label="Delete" />
          <IconButton icon={Tag} label="Label" />
          <IconButton icon={Star} label="Star" pressed={starred} onClick={() => setStarred(!starred)} />
          <Menu trigger={<IconButton icon={MoreHorizontal} label="More" />} items={[
            { label: 'Mark as unread', onSelect: () => toast('Marked as unread') },
            { label: 'Move to folder', onSelect: () => toast('Moved to Club') },
            { label: 'Delete', icon: Trash2, danger: true, onSelect: () => toast('Deleted 1 message') },
          ]} />
        </div>
      </section>

      <section class="stack" style={section}>
        <h2 style={{ fontSize: 'var(--text-lg)' }}>Label chips</h2>
        <div class="row" style={{ flexWrap: 'wrap' }}>
          {LABELS.map(([n, c]) => <Chip key={n} color={c}>{n}</Chip>)}
        </div>
      </section>

      <section class="stack" style={section}>
        <h2 style={{ fontSize: 'var(--text-lg)' }}>Fields</h2>
        <TextField label="Folder name" value={name} onInput={setName} placeholder="Radio Club"
          error={name.includes('/') ? 'Folder names cannot contain a slash' : undefined} />
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <TokenField label="To" tokens={to} onChange={setTo} placeholder="Callsigns or addresses" />
        </div>
      </section>

      <section class="stack" style={section}>
        <h2 style={{ fontSize: 'var(--text-lg)' }}>Dialog and toasts</h2>
        <div class="row">
          <Button variant="primary" onClick={() => setOpen(true)}>Open a dialog</Button>
          <Button onClick={() => toast('Moved 2 messages to Radio Club')}>Info toast</Button>
          <Button onClick={() => toast('1 message could not be moved: it is already in Radio Club', { kind: 'error' })}>Error toast</Button>
        </div>
      </section>

      <Dialog open={open} title="New folder" onClose={() => setOpen(false)}
        footer={<><span style={{ flex: 1 }} /><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => { setOpen(false); toast('Created folder'); }}>Create</Button></>}>
        <div style={{ padding: 'var(--space-4)' }}>
          <TextField label="Name" value={name} onInput={setName} autofocus />
        </div>
      </Dialog>
      <Toasts />
    </main>
  );
}

render(<Gallery />, document.getElementById('app')!);
