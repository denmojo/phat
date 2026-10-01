import { Plus, Trash2 } from 'lucide-preact';
import { Button } from '../../../ui/Button';
import { IconButton } from '../../../ui/IconButton';
import type { FormState } from '../configForm';
import type { Edit } from './General';
import { Section } from './fields';

// RigControl lists Hamlib rigs by name; the transports pick from these
// names. A rig needs a name and an address to be saved.
export function RigControl({ s, edit }: { s: FormState; edit: Edit }) {
  return (
    <Section id="rigs" title="Rig control"
      action={<Button size="sm" onClick={() => edit((d) => { d.rigs.push({ name: '', network: 'tcp', address: '', vfo: '' }); })}><Plus /><span>Add rig</span></Button>}>
      <p class="st-hint">Hamlib rigs Phat can tune. TCP talks to rigctld (recommended); Serial opens the rig's port directly.</p>
      {s.rigs.length === 0 && <p class="st-empty">No rigs.</p>}
      <div class="st-rows">
        {s.rigs.map((r, i) => (
          <fieldset class="st-rig" key={i}>
            <legend class="sr-only">{`Rig ${r.name || i + 1}`}</legend>
            <label class="st-mini">
              <span>Name</span>
              <input placeholder="My IC-7300" value={r.name} spellcheck={false}
                onInput={(e) => { const v = e.currentTarget.value; edit((d) => { d.rigs[i]!.name = v; }); }} />
            </label>
            <label class="st-mini">
              <span>Connection</span>
              <select value={r.network} onChange={(e) => { const v = e.currentTarget.value; edit((d) => { d.rigs[i]!.network = v; }); }}>
                <option value="tcp">TCP</option>
                <option value="serial">Serial</option>
                {r.network !== 'tcp' && r.network !== 'serial' && <option value={r.network}>{r.network || '(unset)'}</option>}
              </select>
            </label>
            <label class="st-mini st-grow">
              <span>Address</span>
              <input class="mono" placeholder={r.network === 'serial' ? '/dev/ttyUSB0' : 'localhost:4532'} value={r.address} spellcheck={false}
                onInput={(e) => { const v = e.currentTarget.value; edit((d) => { d.rigs[i]!.address = v; }); }} />
            </label>
            <label class="st-mini">
              <span>VFO</span>
              <select value={r.vfo} onChange={(e) => { const v = e.currentTarget.value; edit((d) => { d.rigs[i]!.vfo = v; }); }}>
                <option value="">Default</option>
                <option value="A">VFO A</option>
                <option value="B">VFO B</option>
              </select>
            </label>
            <IconButton icon={Trash2} label={`Remove rig ${r.name || i + 1}`} onClick={() => edit((d) => { d.rigs.splice(i, 1); })} />
          </fieldset>
        ))}
      </div>
    </Section>
  );
}
