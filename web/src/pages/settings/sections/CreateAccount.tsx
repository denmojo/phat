import { useCallback, useState } from 'preact/hooks';
import * as api from '../../../lib/api';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/Dialog';
import { Field } from './fields';

const STEPS = ['Callsign', 'Password', 'Recovery email', 'Confirm'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = { open: boolean; callsign: string; onClose: () => void; onCreated: (password: string) => void };

// CreateAccount registers a new Winlink account in four steps, as the old
// page did, and hands the chosen password back to the form.
export function CreateAccount({ open, callsign, onClose, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Clear on the way out so the next opening starts at step one.
  const close = useCallback(() => {
    setStep(0); setPw(''); setPw2(''); setEmail(''); setConsent(false); setBusy(false); setError('');
    onClose();
  }, [onClose]);

  const lengthOk = pw.length >= 6 && pw.length <= 12;
  const emailOk = email === '' || EMAIL.test(email);
  const canNext = step === 0 ? !!callsign : step === 1 ? lengthOk && pw === pw2 : emailOk;

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      await api.register({ callsign, password: pw, password_recovery_email: email });
      onCreated(pw);
      close();
    } catch (err) {
      setError(`Failed to create the account: ${err instanceof Error ? err.message : String(err)}`);
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} title="Create Winlink account" onClose={close} closeOnBackdrop={false}
      footer={(
        <>
          {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
          <span class="spacer" />
          {step < 3
            ? <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next</Button>
            : <Button variant="primary" disabled={!consent || busy} onClick={() => void create()}>{busy ? 'Creating…' : 'Create account'}</Button>}
        </>
      )}>
      <div class="dialog-pad st-account">
        <ol class="st-steps">
          {STEPS.map((t, i) => (
            <li key={t} class={i === step ? 'active' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
              <span>{i + 1}</span>{t}
            </li>
          ))}
        </ol>
        {step === 0 && (
          <>
            <p>Confirm the callsign for your new Winlink account.</p>
            <div class="st-field">
              <label for="ca-call">Callsign</label>
              <input id="ca-call" value={callsign} disabled />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <p>Choose a password of 6 to 12 characters.</p>
            <Field label="Password" type="password" value={pw} autocomplete="new-password" onInput={setPw}
              error={pw && !lengthOk ? 'Use 6 to 12 characters.' : undefined} />
            <Field label="Verify password" type="password" value={pw2} autocomplete="new-password" onInput={setPw2}
              error={pw2 && pw2 !== pw ? 'The passwords differ.' : undefined} />
          </>
        )}
        {step === 2 && (
          <>
            <p>A recovery email lets you reset a forgotten password. It's optional, and recommended.</p>
            <Field label="Recovery email" value={email} onInput={setEmail} autocomplete="email"
              error={!emailOk ? 'That doesn\'t look like an email address.' : undefined} />
          </>
        )}
        {step === 3 && (
          <>
            <p>Your callsign, password and recovery email go straight to the Winlink system to create the account.</p>
            <p>Your callsign and password are also stored in Phat's configuration file on this computer, so you can log in from here.</p>
            <p>Winlink handles your data under its <a href="https://winlink.org/terms_conditions" target="_blank" rel="noopener">terms, conditions and privacy policy</a>.</p>
            <label class="st-consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.currentTarget.checked)} />
              <span>I agree to create my Winlink account and store my credentials locally.</span>
            </label>
          </>
        )}
        {error && <p class="form-error" role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}
