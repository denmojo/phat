import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import * as api from '../../lib/api';
import { insecureOrigin } from '../../lib/notify';
import { dismissRecovery } from '../../lib/recovery';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { geoError, mycall, notifyState, recoveryWarning, status, wsUp } from './store';
import './StatusPopover.css';

type Severity = 'danger' | 'warning' | 'info';
type Section = { severity: Severity; title: string; body: ComponentChildren };

const RANK: Record<Severity, number> = { danger: 3, warning: 2, info: 1 };

const SecureOrigin = () => (
  <p>Ensure the <a href="https://github.com/la5nta/pat/wiki/The-web-GUI#powerful-features" target="_blank" rel="noopener">secure origin criteria for Powerful Features</a> are met.</p>
);

// sections lists what's wrong with the page's link to Phat and the
// browser, worst first. The web service line is information only and
// never colors the light.
function sections(fixNow: () => void): Section[] {
  const out: Section[] = [];
  if (!wsUp.value) {
    out.push({ severity: 'danger', title: 'Websocket', body: (
      <><p>A websocket connection to the backend could not be established.</p><p>Make sure Phat is running and available on the network.</p></>
    ) });
  }
  if (recoveryWarning.value) {
    out.push({ severity: 'warning', title: 'Secure your account', body: (
      <>
        <p>You have no recovery email set for your Winlink account.</p>
        <p>Add one now so you can easily reset a forgotten password.</p>
        <div class="sp-actions">
          <Button size="sm" onClick={() => { dismissRecovery(mycall.value); recoveryWarning.value = false; }}>Later</Button>
          <Button size="sm" variant="primary" onClick={fixNow}>Add email</Button>
        </div>
      </>
    ) });
  }
  const n = notifyState.value;
  if (n === 'unsupported' || n === 'denied') {
    const insecure = n === 'denied' && insecureOrigin();
    out.push({ severity: insecure ? 'warning' : 'info', title: 'Desktop notifications', body: (
      n === 'unsupported' ? <p>Not supported by this browser.</p>
        : insecure ? <><p>Desktop notifications are unavailable due to insufficient permissions.</p><SecureOrigin /></>
          : <p>Notification permission denied or dismissed.</p>
    ) });
  }
  if (geoError.value) {
    const insecure = insecureOrigin();
    out.push({ severity: insecure ? 'warning' : 'info', title: 'Geolocation', body: (
      <><p>{geoError.value}</p>{insecure && <SecureOrigin />}</>
    ) });
  }
  return out.sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}

// severity is the light's color: the worst open issue, or ok.
export function severity(): Severity | 'ok' {
  const s = sections(() => {});
  return s.length ? s[0]!.severity : 'ok';
}

export function connectionText(): string {
  const s = status.value;
  if (!wsUp.value) return 'Offline';
  if (!s) return 'Ready';
  if (s.dialing) return 'Dialing…';
  if (s.connected) return `Connected ${s.remote_addr}`;
  if (s.active_listeners.length) return `Listening ${s.active_listeners.join(', ')}`;
  return 'Ready';
}

// StatusPopover is the status pill in the top bar: the light shows the
// worst issue, the text shows the session, and a click lists the issues.
export function StatusPopover() {
  const [open, setOpen] = useState(false);
  const [fixing, setFixing] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const fixNow = useCallback(() => { setOpen(false); setFixing(true); }, []);
  const closeFix = useCallback(() => setFixing(false), []);
  const list = sections(fixNow);
  const sev = list.length ? list[0]!.severity : 'ok';
  const s = status.value;
  const busy = s?.dialing || s?.connected;

  // A missing recovery email opens the panel, as the old client did.
  useEffect(() => { if (recoveryWarning.value) setOpen(true); }, [recoveryWarning.value]);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open]);

  const text = connectionText();
  const clients = s?.http_clients.length ?? 0;
  return (
    <div class="sp" ref={box}>
      <button type="button" class={`status${busy ? ' busy' : ''}`} aria-expanded={open} aria-label={`Status: ${text}`}
        onClick={() => setOpen(!open)}>
        <span class={`light ${sev}`} />
        <span class="label">{text}</span>
      </button>
      {open && (
        <div class="sp-panel" role="dialog" aria-label="Status">
          {list.length === 0 && (
            <section class="sp-section ok"><h3>No issues</h3><p>No problems detected.</p></section>
          )}
          {list.map((x) => (
            <section key={x.title} class={`sp-section ${x.severity}`}><h3>{x.title}</h3>{x.body}</section>
          ))}
          {wsUp.value && (
            <section class="sp-section plain">
              <h3>Web service</h3>
              <p>{`${clients} ${clients === 1 ? 'client' : 'clients'} connected.`}</p>
            </section>
          )}
        </div>
      )}
      <RecoveryEmail open={fixing} onClose={closeFix} />
    </div>
  );
}

function RecoveryEmail({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');
  // Clear on the way out: an effect on open runs a frame late and would
  // wipe what was typed in that frame.
  const close = useCallback(() => { setEmail(''); setState('idle'); setError(''); onClose(); }, [onClose]);
  const submit = async () => {
    setState('sending');
    setError('');
    try {
      await api.putRecoveryEmail(email.trim());
      setState('done');
      recoveryWarning.value = false;
      setTimeout(close, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('idle');
    }
  };
  return (
    <Dialog open={open} title="Recovery email address" onClose={close}
      footer={(
        <>
          <span class="spacer" />
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={state !== 'idle' || !email.trim()} onClick={() => void submit()}>
            {state === 'sending' ? 'Submitting…' : state === 'done' ? 'Submitted' : error ? 'Retry' : 'Submit'}
          </Button>
        </>
      )}>
      <form class="dialog-pad sp-recovery" onSubmit={(e) => { e.preventDefault(); if (state === 'idle' && email.trim()) void submit(); }}>
        <p>Enter your recovery email address. Winlink uses it to recover your password if you forget it.</p>
        <label>
          <input type="email" aria-label="Recovery email" autofocus placeholder="Enter your recovery email" value={email}
            onInput={(e) => setEmail(e.currentTarget.value)} />
        </label>
        {error && <p class="form-error" role="alert">{error}</p>}
        <p class="hint">Submitting sends your email address straight to winlink.org, and their privacy policy applies.
          See <a href="https://winlink.org/terms_conditions" target="_blank" rel="noopener">Winlink's Privacy Policy</a>.</p>
      </form>
    </Dialog>
  );
}
