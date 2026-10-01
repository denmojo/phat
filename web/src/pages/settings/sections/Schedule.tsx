import { Plus, Trash2 } from 'lucide-preact';
import { Button } from '../../../ui/Button';
import { IconButton } from '../../../ui/IconButton';
import type { FormState } from '../configForm';
import type { Edit } from './General';
import { Section } from './fields';

// Schedule runs Phat commands on a cron expression, such as a connect
// every hour. A row needs both parts to be saved.
export function Schedule({ s, edit }: { s: FormState; edit: Edit }) {
  return (
    <Section id="schedule" title="Schedule"
      action={<Button size="sm" onClick={() => edit((d) => { d.schedule.push({ expr: '', cmd: '' }); })}><Plus /><span>Add job</span></Button>}>
      <p class="st-hint">Cron expressions (or @every 1h) and the command to run, for example connect telnet.</p>
      {s.schedule.length === 0 && <p class="st-empty">No scheduled jobs.</p>}
      <div class="st-rows">
        {s.schedule.map((r, i) => (
          <div class="st-row st-row-sched" key={i}>
            <input aria-label={`Job ${i + 1} schedule`} placeholder="* * * * *" class="mono" value={r.expr} spellcheck={false}
              onInput={(e) => { const v = e.currentTarget.value; edit((d) => { d.schedule[i]!.expr = v; }); }} />
            <input aria-label={`Job ${i + 1} command`} placeholder="command" class="mono" value={r.cmd} spellcheck={false}
              onInput={(e) => { const v = e.currentTarget.value; edit((d) => { d.schedule[i]!.cmd = v; }); }} />
            <IconButton icon={Trash2} label={`Remove job ${i + 1}`} onClick={() => edit((d) => { d.schedule.splice(i, 1); })} />
          </div>
        ))}
      </div>
    </Section>
  );
}
