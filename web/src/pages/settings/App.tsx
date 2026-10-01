import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { ArrowLeft, LoaderCircle, Save } from 'lucide-preact';
import * as api from '../../lib/api';
import type { Config } from '../../lib/types';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { REDACTED, fromConfig, toConfig, type FormState } from './configForm';
import { Aliases } from './sections/Aliases';
import { CreateAccount } from './sections/CreateAccount';
import { type Account, General } from './sections/General';
import { Gpsd } from './sections/Gpsd';
import { Interface } from './sections/Interface';
import { RigControl } from './sections/RigControl';
import { Schedule } from './sections/Schedule';
import { Transports } from './sections/Transports';
import './settings.css';

const NAV: [string, string][] = [
  ['general', 'General'], ['aliases', 'Connect aliases'], ['transports', 'Transports'], ['rigs', 'Rig control'],
  ['gpsd', 'GPSd'], ['schedule', 'Schedule'], ['interface', 'Interface'],
];

function validate(s: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!s.mycall.trim()) e.mycall = 'Enter your callsign.';
  if (!s.locator.trim()) e.locator = 'Enter your grid locator.';
  return e;
}

// App is the settings page: it loads config.json into the form, saves the
// whole form back over what was loaded, and offers a restart afterwards.
export function App() {
  const [original, setOriginal] = useState<Config | null>(null);
  const [s, setS] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [restart, setRestart] = useState(false);
  const [account, setAccount] = useState<Account>('idle');
  const [creating, setCreating] = useState(false);
  const checkSeq = useRef(0);

  const checkAccount = useCallback(async (call: string) => {
    const n = ++checkSeq.current;
    if (call.trim().length < 3) { setAccount('idle'); return; }
    setAccount('checking');
    try {
      const r = await api.registration(call.trim()) as { exists?: boolean };
      if (n === checkSeq.current) setAccount(r?.exists ? 'exists' : 'missing');
    } catch {
      if (n === checkSeq.current) setAccount('error');
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const c = await api.config();
      setOriginal(c);
      const form = fromConfig(c);
      setS(form);
      setLoadError('');
      void checkAccount(form.mycall);
    } catch (err) {
      setLoadError(`Failed to load the configuration: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [checkAccount]);

  useEffect(() => {
    void load();
    if (new URLSearchParams(location.search).get('action') === 'create-account') setCreating(true);
    // A page restored from the back-forward cache shows stale values.
    const show = (e: PageTransitionEvent) => { if (e.persisted) void load(); };
    window.addEventListener('pageshow', show);
    return () => window.removeEventListener('pageshow', show);
  }, [load]);

  const edit = useCallback((fn: (d: FormState) => void) => {
    setS((prev) => {
      if (!prev) return prev;
      const d = JSON.parse(JSON.stringify(prev)) as FormState;
      fn(d);
      return d;
    });
  }, []);

  useEffect(() => { if (tried && s) setErrors(validate(s)); }, [s, tried]);

  const closeRestart = useCallback(() => setRestart(false), []);
  const closeCreate = useCallback(() => setCreating(false), []);

  if (!s || !original) {
    return (
      <div class="st-page">
        <Header />
        <main class="st-main">{loadError ? <p class="st-error" role="alert">{loadError}</p> : <p class="st-empty">Loading…</p>}</main>
      </div>
    );
  }

  const save = async () => {
    setTried(true);
    const e = validate(s);
    setErrors(e);
    if (Object.keys(e).length) {
      setMessage({ ok: false, text: 'Fix the marked fields first.' });
      document.getElementById('general')?.scrollIntoView({ block: 'start' });
      return;
    }
    const next = toConfig(original, s);
    setSaving(true);
    setMessage(null);
    try {
      await api.saveConfig(next);
      setOriginal(next);
      setMessage({ ok: true, text: 'Settings saved.' });
      setRestart(true);
    } catch (err) {
      setMessage({ ok: false, text: `Save failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSaving(false);
    }
  };

  const enableHttp = !!(original as { gpsd?: { enable_http?: boolean } }).gpsd?.enable_http;
  return (
    <div class="st-page">
      <Header />
      <div class="st-layout">
        <nav class="st-nav" aria-label="Settings sections">
          {NAV.map(([id, t]) => <a key={id} href={`#${id}`}>{t}</a>)}
        </nav>
        <form class="st-main" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <General s={s} edit={edit} errors={errors} redacted={(original as { secure_login_password?: string }).secure_login_password === REDACTED}
            account={account} onCheckAccount={() => void checkAccount(s.mycall)} onCreateAccount={() => setCreating(true)} />
          <Aliases s={s} edit={edit} />
          <Transports s={s} edit={edit} />
          <RigControl s={s} edit={edit} />
          <Gpsd s={s} edit={edit} enableHttp={enableHttp} />
          <Schedule s={s} edit={edit} />
          <Interface appearance={s.appearance} onChange={(a) => edit((d) => { d.appearance = a; })} />
          <div class="st-savebar">
            {message && <span class={message.ok ? 'st-ok' : 'st-error'} role="status">{message.text}</span>}
            <span class="spacer" />
            <Button type="submit" variant="primary" disabled={saving}>{saving ? <LoaderCircle class="spin" /> : <Save />}<span>Save</span></Button>
          </div>
        </form>
      </div>
      <RestartDialog open={restart} onClose={closeRestart} />
      <CreateAccount open={creating} callsign={s.mycall} onClose={closeCreate}
        onCreated={(pw) => { edit((d) => { d.password = pw; }); setAccount('created'); }} />
    </div>
  );
}

function Header() {
  return (
    <header class="st-header">
      <a class="st-back" href="/ui"><ArrowLeft /><span>Back to mailbox</span></a>
      <h1>Settings</h1>
    </header>
  );
}

// RestartDialog asks the server to reload its configuration, then polls
// status every 100 ms, up to 30 times, until it answers again.
function RestartDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  const [text, setText] = useState('');
  const close = useCallback(() => { setState('idle'); setText(''); onClose(); }, [onClose]);

  const restart = async () => {
    setState('busy');
    setText('');
    try {
      await api.reload();
    } catch (err) {
      setState('failed');
      setText(`Restart failed: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
    for (let i = 0; i < 30; i++) {
      try {
        await api.status();
        setState('done');
        setText('Restart successful.');
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    setState('failed');
    setText('Restart timed out. Check the application log.');
  };

  return (
    <Dialog open={open} title="Restart required" onClose={close}
      footer={(
        <>
          <span class="spacer" />
          <Button onClick={close}>{state === 'done' ? 'Close' : 'Later'}</Button>
          <Button variant="primary" disabled={state === 'busy' || state === 'done'} onClick={() => void restart()}>
            {state === 'busy' ? 'Restarting…' : state === 'done' ? 'Restarted' : 'Restart now'}
          </Button>
        </>
      )}>
      <div class="dialog-pad">
        <p>Your settings are saved. Some changes take effect only after Phat restarts.</p>
        {text && <p class={state === 'done' ? 'st-ok' : 'st-error'} role="status">{text}</p>}
      </div>
    </Dialog>
  );
}
