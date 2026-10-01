import { Plus, Trash2 } from 'lucide-preact';
import { Button } from '../../../ui/Button';
import { IconButton } from '../../../ui/IconButton';
import type { FormState } from '../configForm';
import type { Edit } from './General';
import { Section } from './fields';

// Aliases names connect URLs for the connect dialog. A row needs both a
// name and a URL to be saved.
export function Aliases({ s, edit }: { s: FormState; edit: Edit }) {
  return (
    <Section id="aliases" title="Connect aliases"
      action={<Button size="sm" onClick={() => edit((d) => { d.aliases.push({ name: '', url: '' }); })}><Plus /><span>Add alias</span></Button>}>
      <p class="st-hint">Names for connect URLs, offered in the connect dialog. {'{mycall}'} in a URL stands for your callsign.</p>
      {s.aliases.length === 0 && <p class="st-empty">No aliases.</p>}
      <div class="st-rows">
        {s.aliases.map((a, i) => (
          <div class="st-row st-row-alias" key={i}>
            <input aria-label={`Alias ${i + 1} name`} placeholder="Alias name" value={a.name} spellcheck={false}
              onInput={(e) => { const v = e.currentTarget.value; edit((d) => { d.aliases[i]!.name = v; }); }} />
            <input aria-label={`Alias ${i + 1} URL`} placeholder="Connect URL" class="mono" value={a.url} spellcheck={false}
              onInput={(e) => { const v = e.currentTarget.value; edit((d) => { d.aliases[i]!.url = v; }); }} />
            <IconButton icon={Trash2} label={`Remove alias ${a.name || i + 1}`} onClick={() => edit((d) => { d.aliases.splice(i, 1); })} />
          </div>
        ))}
      </div>
    </Section>
  );
}
