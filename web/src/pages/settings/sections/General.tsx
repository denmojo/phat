import { useRef, useState } from 'preact/hooks';
import { Check as CheckIcon, Eye, EyeOff, LoaderCircle, LocateFixed, TriangleAlert, X } from 'lucide-preact';
import * as api from '../../../lib/api';
import { TokenField } from '../../../ui/TokenField';
import { REDACTED, type FormState } from '../configForm';
import { Field, Section } from './fields';

export type Edit = (fn: (d: FormState) => void) => void;
export type Account = 'idle' | 'checking' | 'exists' | 'missing' | 'error' | 'created';

type Props = {
  s: FormState;
  edit: Edit;
  errors: Record<string, string>;
  redacted: boolean;
  account: Account;
  onCheckAccount: () => void;
  onCreateAccount: () => void;
};

const ACCOUNT_ICON: Partial<Record<Account, { icon: typeof CheckIcon; title: string; cls: string }>> = {
  checking: { icon: LoaderCircle, title: 'Checking for a Winlink account', cls: 'spin' },
  exists: { icon: CheckIcon, title: 'Winlink account exists', cls: 'ok' },
  created: { icon: CheckIcon, title: 'Winlink account created', cls: 'ok' },
  missing: { icon: X, title: 'Winlink account does not exist', cls: 'bad' },
  error: { icon: TriangleAlert, title: 'Unable to verify Winlink account status', cls: 'warn' },
};

// General covers who you are on Winlink: callsign, locator, login
// password, extra addresses to fetch for, and the auto-download limit.
export function General({ s, edit, errors, redacted, account, onCheckAccount, onCreateAccount }: Props) {
  const [showPw, setShowPw] = useState(false);
  const mark = ACCOUNT_ICON[account];
  const Icon = mark?.icon;
  return (
    <Section id="general" title="General">
      <Field label="Callsign" required value={s.mycall} error={errors.mycall} hint="Your amateur radio callsign."
        onInput={(v) => edit((d) => { d.mycall = v.toUpperCase(); })} onBlur={onCheckAccount}
        suffix={Icon && <span class={`st-badge ${mark.cls}`} title={mark.title} role="img" aria-label={mark.title}><Icon /></span>} />
      {account === 'missing' && (
        <div class="st-note warn" role="status">
          <span>{`No Winlink account for ${s.mycall}.`}</span>
          <button type="button" class="st-link" onClick={onCreateAccount}>Create one</button>
        </div>
      )}
      {account === 'created' && <div class="st-note ok" role="status">{`Account ${s.mycall} created.`}</div>}
      <Locator s={s} edit={edit} error={errors.locator} />
      <Field label="Secure login password" type={showPw ? 'text' : 'password'} value={s.password} autocomplete="new-password"
        hint="Optional. Phat answers the Winlink login challenge with it, so you aren't asked at every connect."
        onInput={(v) => edit((d) => { d.password = v; })}
        onFocus={() => { if (redacted && s.password === REDACTED) edit((d) => { d.password = ''; }); }}
        onBlur={() => { if (redacted && s.password === '') edit((d) => { d.password = REDACTED; }); }}
        suffix={(
          <button type="button" class="st-addon" aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw}
            onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff /> : <Eye />}</button>
        )} />
      <div class="st-field">
        <TokenField label="Auxiliary addresses" tokens={s.aux} placeholder="Callsign:Password (optional)"
          onChange={(t) => edit((d) => { d.aux = t; })} />
        <p class="st-hint">Callsigns to fetch mail for as well. Use callsign:password when the address has its own password.</p>
      </div>
      <Field label="Auto download size limit" type="number" min={-1} value={s.autoDownload}
        hint="Largest message, in bytes, to download without asking. Use -1 for no limit."
        onInput={(v) => edit((d) => { d.autoDownload = v; })} />
    </Section>
  );
}

// Locator fills the grid square from the GPS device when the server has
// one, else from the browser's location, waiting for 1 km accuracy.
function Locator({ s, edit, error }: { s: FormState; edit: Edit; error?: string }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'info' | 'ok' | 'bad'; text: string } | null>(null);
  const watch = useRef(0);

  const stop = () => {
    if (watch.current && navigator.geolocation) navigator.geolocation.clearWatch(watch.current);
    watch.current = 0;
    setBusy(false);
  };
  const fill = async (lat: number, lon: number, accuracy: number | null, source: string) => {
    try {
      const { locator } = await api.coordsToLocator(lat, lon);
      edit((d) => { d.locator = locator; });
      setNote({ kind: 'ok', text: `Locator updated from ${source}${accuracy ? ` (accuracy: ${Math.round(accuracy)} m)` : ''}.` });
    } catch {
      setNote({ kind: 'bad', text: 'Failed to convert the location to a grid locator.' });
    }
    stop();
  };
  const locate = async () => {
    setBusy(true);
    setNote({ kind: 'info', text: 'Checking for a GPS device…' });
    try {
      const p = await api.gpsPosition() as { Lat: number; Lon: number };
      await fill(p.Lat, p.Lon, null, 'the GPS device');
      return;
    } catch { /* no GPS device: fall back to the browser */ }
    if (!navigator.geolocation) {
      setNote({ kind: 'bad', text: 'This browser has no geolocation.' });
      stop();
      return;
    }
    setNote({ kind: 'info', text: 'Waiting for a position from the browser…' });
    watch.current = navigator.geolocation.watchPosition((pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      if (accuracy > 1000) {
        setNote({ kind: 'info', text: `Waiting for better accuracy (now ${Math.round(accuracy)} m)…` });
        return;
      }
      void fill(latitude, longitude, accuracy, 'geolocation');
    }, (err) => {
      const why = err.code === err.PERMISSION_DENIED ? 'Location access denied. Allow it and try again.'
        : err.code === err.POSITION_UNAVAILABLE ? 'Location information unavailable.'
          : err.code === err.TIMEOUT ? 'Location request timed out.' : err.message;
      setNote({ kind: 'bad', text: why });
      stop();
    }, { enableHighAccuracy: true, maximumAge: 0 });
    setTimeout(() => {
      if (!watch.current) return;
      setNote({ kind: 'bad', text: 'Location request timed out. Try again.' });
      stop();
    }, 60000);
  };

  return (
    <>
      <Field label="Maidenhead locator" required value={s.locator} error={error} hint="Your 4 or 6 character grid square."
        onInput={(v) => edit((d) => { d.locator = v; })}
        suffix={(
          <button type="button" class="st-addon" disabled={busy} aria-label="Locate me" title="Locate me" onClick={() => void locate()}>
            {busy ? <LoaderCircle class="spin" /> : <LocateFixed />}
          </button>
        )} />
      {note && <p class={`st-locate ${note.kind}`} role="status">{note.text}</p>}
    </>
  );
}
