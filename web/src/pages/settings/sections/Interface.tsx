import { applyAppearance, type Appearance } from '../../../ui/theme';
import { Section } from './fields';

const CHOICES: [Appearance, string][] = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];

// Interface holds the appearance setting. A choice applies at once so the
// page shows it before saving; Save writes it with everything else.
export function Interface({ appearance, onChange }: { appearance: Appearance; onChange: (a: Appearance) => void }) {
  return (
    <Section id="interface" title="Interface">
      <fieldset class="st-radios">
        <legend>Appearance</legend>
        {CHOICES.map(([v, label]) => (
          <label key={v} class="st-radio">
            <input type="radio" name="appearance" value={v} checked={appearance === v}
              onChange={() => { applyAppearance(v); onChange(v); }} />
            <span>{label}</span>
          </label>
        ))}
        <p class="st-hint">System follows your device's light or dark setting.</p>
      </fieldset>
    </Section>
  );
}
