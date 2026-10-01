import type { FormState } from '../configForm';
import type { Edit } from './General';
import { Check, Field, Section } from './fields';

// Gpsd points Phat at a GPS daemon. The HTTP proxy switch is shown but
// fixed: the server refuses to change it from the web.
export function Gpsd({ s, edit, enableHttp }: { s: FormState; edit: Edit; enableHttp: boolean }) {
  return (
    <Section id="gpsd" title="GPSd">
      <Field label="Server address" value={s.gpsd.addr} placeholder="localhost:2947"
        onInput={(v) => edit((d) => { d.gpsd.addr = v; })} />
      <Check label="Update locator" checked={s.gpsd.updateLocator} onChange={(v) => edit((d) => { d.gpsd.updateLocator = v; })}
        hint="Polls GPSd every hour and updates the locator in memory. Until the first fix, the locator above is used." />
      <Check label="Allow forms GPS access" checked={s.gpsd.allowForms} onChange={(v) => edit((d) => { d.gpsd.allowForms = v; })}
        hint="Caution: puts your GPS position into forms without asking each time." />
      <Check label="Use server time" checked={s.gpsd.useServerTime} onChange={(v) => edit((d) => { d.gpsd.useServerTime = v; })}
        hint="Use this computer's clock instead of the GPS device's timestamp." />
      <div class="st-check disabled">
        <input id="gpsd-http" type="checkbox" checked={enableHttp} disabled aria-describedby="gpsd-http-hint" />
        <div>
          <label for="gpsd-http">Enable GPSd HTTP proxy</label>
          <p id="gpsd-http-hint" class="st-hint">Can only be changed by editing the configuration file, for security.</p>
        </div>
      </div>
    </Section>
  );
}
