import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { ChevronDown, Plus, RadioTower, Trash2, TriangleAlert } from 'lucide-preact';
import * as api from '../../lib/api';
import { ApiError } from '../../lib/api';
import { type ConnectParts, build, parse } from '../../lib/connectUrl';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { IconButton } from '../../ui/IconButton';
import { toast } from '../../ui/Toast';
import { RmsList, modeFor } from './RmsList';
import { connectOpen, logOpen, mycall } from './store';
import './ConnectDialog.css';

const TRANSPORTS: [string, string][] = [
  ['ardop', 'ARDOP'], ['ax25', 'AX.25'], ['pactor', 'PACTOR'], ['telnet', 'Telnet'], ['varafm', 'VARA FM'], ['varahf', 'VARA HF'],
];
const ADVANCED: [string, string][] = [['ax25+agwpe', 'AX.25+agwpe'], ['ax25+linux', 'AX.25+linux'], ['ax25+serial-tnc', 'AX.25+serial-tnc']];
const ALIAS_RE = /^[a-zA-Z0-9_.@-]+$/;

// Qsy is the outcome of asking the rig to tune to the entered frequency.
type Qsy = { state: 'idle' | 'busy' | 'ok' | 'unavailable' | 'failed'; freq: string };

const storeKey = () => `pat_connect_url_${mycall.value}`;
function stored(): string {
  try { return localStorage.getItem(storeKey()) ?? ''; } catch { return ''; }
}

const close = () => { connectOpen.value = false; };

// The route is remembered per browser; with connect_via set it starts on Pat.
const ROUTE_KEY = 'phat_connect_route';
function storedRoute(): 'pat' | 'direct' {
  try { return localStorage.getItem(ROUTE_KEY) === 'direct' ? 'direct' : 'pat'; } catch { return 'pat'; }
}

// connect starts a session with the URL as shown, in Phat or through Pat,
// and reports the result.
function connect(url: string, viaPat: boolean) {
  try { localStorage.setItem(storeKey(), url); } catch { /* storage blocked */ }
  close();
  logOpen.value = true;
  api.connect(url, viaPat)
    .then((r) => { if (r.NumReceived === 0) toast('No new messages'); })
    .catch(() => toast('Connect failed. See the session log.', { kind: 'error' }));
}

// ConnectDialog builds a connect URL from its fields (or takes one typed
// in, from an alias or from the RMS list) and starts a session with it.
export function ConnectDialog() {
  if (!connectOpen.value) return null;
  return <ConnectForm />;
}

function ConnectForm() {
  const [parts, setParts] = useState<ConnectParts>(() => parse(stored() || 'ardop:///'));
  // typed is URL text the user (or storage) supplied verbatim; any field edit
  // replaces it with the URL built from the fields.
  const [typed, setTyped] = useState<string | null>(() => stored() || null);
  const [qsy, setQsy] = useState<Qsy>({ state: 'idle', freq: '' });
  const [bandwidths, setBandwidths] = useState<string[]>([]);
  const [triesHint, setTriesHint] = useState('');
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [alias, setAlias] = useState('');
  const [naming, setNaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRms, setShowRms] = useState(false);
  const [rmsMode, setRmsMode] = useState(() => modeFor(parse(stored()).transport) ?? 'ardop');
  const [via, setVia] = useState('');
  const [route, setRoute] = useState(storedRoute);
  const qsySeq = useRef(0);

  // urlFor keeps a frequency unless the rig refused or failed to tune to it.
  const urlFor = (p: ConnectParts, q: Qsy) => {
    const dropFreq = q.freq === p.freq && (q.state === 'unavailable' || q.state === 'failed');
    return build(dropFreq ? { ...p, freq: '' } : p);
  };
  const urlText = typed ?? urlFor(parts, qsy);
  // shown is the URL as last rendered from the fields; leaving the URL field
  // with different text means it was edited by hand.
  const shown = useRef(urlText);
  shown.current = typed === null ? urlText : shown.current;
  // edit is a change the user made in a field, which leaves any alias.
  const edit = (patch: Partial<ConnectParts>) => {
    setAlias('');
    setTyped(null);
    setParts((cur) => ({ ...cur, ...patch }));
  };

  const tune = async (p: ConnectParts) => {
    const n = ++qsySeq.current;
    const f = Number(p.freq);
    if (!p.freq || !f || p.transport === 'telnet') {
      setQsy({ state: 'idle', freq: '' });
      return;
    }
    setQsy({ state: 'busy', freq: p.freq });
    let q: Qsy;
    try {
      await api.qsy(p.transport, f);
      q = { state: 'ok', freq: p.freq };
    } catch (err) {
      q = { state: err instanceof ApiError && err.status === 503 ? 'unavailable' : 'failed', freq: p.freq };
    }
    if (n === qsySeq.current) setQsy(q);
  };

  // load takes a whole URL (typed, from an alias or from the RMS list) and
  // tunes the rig to its frequency, as the old dialog did.
  const load = (url: string, fromAlias = '') => {
    const p = parse(url);
    setAlias(fromAlias);
    setTyped(null);
    setParts(p);
    const m = modeFor(p.transport);
    if (m) setRmsMode(m);
    void tune(p);
  };

  useEffect(() => {
    api.connectAliases().then((a) => setAliases(a ?? {})).catch(() => {});
    api.config().then((c) => {
      const cfg = c as { ardop?: { connect_requests?: number }; connect_via?: string } | null;
      const n = cfg?.ardop?.connect_requests;
      if (n) setTriesHint(String(n));
      setVia(cfg?.connect_via?.trim() ?? '');
    }).catch(() => {});
  }, []);

  // Bandwidths follow the transport; an unknown or empty choice takes the mode's default.
  useEffect(() => {
    let live = true;
    const t = parts.transport;
    api.bandwidths(t).then((r) => {
      if (!live) return;
      const list = r.bandwidths ?? [];
      setBandwidths(list);
      setParts((cur) => {
        if (cur.transport !== t) return cur;
        const bw = list.length === 0 ? '' : list.includes(cur.bw) ? cur.bw : (r.default ?? '');
        return bw === cur.bw ? cur : { ...cur, bw };
      });
      if (list.length > 0) setTyped(null);
    }).catch(() => { if (live) setBandwidths([]); });
    return () => { live = false; };
  }, [parts.transport]);

  // commitFreq tunes once per committed value, so Enter then blur asks once.
  const commitFreq = (freq: string) => {
    if (freq === qsy.freq && qsy.state !== 'idle') return;
    edit({ freq });
    void tune({ ...parts, freq });
  };

  const changeTransport = (t: string) => {
    // A new transport starts from a clean slate, keeping only the target.
    qsySeq.current++;
    setQsy({ state: 'idle', freq: '' });
    edit({ transport: t, addr: '', freq: '', bw: '', connectRequests: '', radioOnly: t.startsWith('ax25') ? false : parts.radioOnly });
    const m = modeFor(t);
    if (m) setRmsMode(m);
  };

  const t = parts.transport;
  const isTelnet = t === 'telnet';
  const closeNaming = useCallback(() => setNaming(false), []);
  const closeDeleting = useCallback(() => setDeleting(false), []);
  const busy = qsy.state === 'busy';
  const viaPat = !!via && route === 'pat';
  const pickRoute = (r: 'pat' | 'direct') => {
    setRoute(r);
    try { localStorage.setItem(ROUTE_KEY, r); } catch { /* storage blocked */ }
  };

  return (
    <Dialog open title="Connect" onClose={close} wide
      footer={(
        <>
          <Button size="sm" onClick={() => setShowRms(!showRms)}>
            <ChevronDown class={showRms ? 'flip' : ''} /><span>{showRms ? 'Hide RMS list' : 'Show RMS list'}</span>
          </Button>
          <span class="spacer" />
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={() => connect(urlText, viaPat)}><RadioTower /><span>Connect</span></Button>
        </>
      )}>
      <form class="connect" onSubmit={(e) => { e.preventDefault(); if (!busy) connect(urlText, viaPat); }}>
        <div class="cf-alias">
          <select aria-label="Alias" value={alias} onChange={(e) => {
            const name = e.currentTarget.value;
            if (name && aliases[name]) load(aliases[name]!, name);
            else setAlias('');
          }}>
            <option value="">(select alias)</option>
            {Object.keys(aliases).sort().map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {alias
            ? <IconButton icon={Trash2} label={`Delete alias ${alias}`} onClick={() => setDeleting(true)} />
            : <IconButton icon={Plus} label="Save as alias" onClick={() => setNaming(true)} />}
        </div>
        <div class="cf-grid">
          <label class="cf-field">
            <span>Transport</span>
            <select value={t} onChange={(e) => changeTransport(e.currentTarget.value)}>
              {TRANSPORTS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              <optgroup label="advanced">{ADVANCED.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</optgroup>
            </select>
          </label>
          <label class="cf-field">
            <span>Target</span>
            <input value={parts.target} placeholder="N0CALL" autocomplete="off" spellcheck={false}
              onInput={(e) => edit({ target: e.currentTarget.value })} />
          </label>
          {isTelnet && (
            <label class="cf-field wide">
              <span>Address</span>
              <input value={parts.addr} placeholder="user:pass@host:port" autocomplete="off" spellcheck={false}
                onInput={(e) => edit({ addr: e.currentTarget.value })} />
            </label>
          )}
          {!isTelnet && (
            <div class="cf-field">
              <label for="cf-freq">Frequency</label>
              <div class={`cf-suffix qsy-${qsy.freq === parts.freq ? qsy.state : 'idle'}`}>
                <input id="cf-freq" inputMode="decimal" value={parts.freq} placeholder="0000.00" autocomplete="off"
                  class={qsy.freq === parts.freq && (qsy.state === 'unavailable' || qsy.state === 'failed') ? 'struck' : ''}
                  onInput={(e) => edit({ freq: e.currentTarget.value })}
                  // Tune when the entry is committed: on leaving the field or on Enter.
                  onBlur={(e) => commitFreq(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitFreq(e.currentTarget.value); }} />
                <span class="unit">kHz</span>
              </div>
            </div>
          )}
          {bandwidths.length > 0 && (
            <label class="cf-field">
              <span>Bandwidth</span>
              <select value={parts.bw} onChange={(e) => edit({ bw: e.currentTarget.value })}>
                <option value="">(default)</option>
                {bandwidths.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
          )}
          {t === 'ardop' && (
            <div class="cf-field" title="Maximum number of ARDOP connect request frames to transmit. Most stations require multiple tries before responding.">
              <label for="cf-tries">Tries</label>
              <div class="cf-suffix">
                <input id="cf-tries" type="number" min="1" value={parts.connectRequests} placeholder={triesHint}
                  onInput={(e) => edit({ connectRequests: e.currentTarget.value })} />
                <span class="unit">frames</span>
              </div>
            </div>
          )}
          {!t.startsWith('ax25') && (
            <label class="cf-check">
              <input type="checkbox" checked={parts.radioOnly} onChange={(e) => edit({ radioOnly: e.currentTarget.checked })} />
              Radio only
            </label>
          )}
        </div>
        {!isTelnet && qsy.freq === parts.freq && qsy.state === 'unavailable' && (
          <p class="cf-note">Rig control is not configured for this transport. Set the radio's frequency by hand.</p>
        )}
        {!isTelnet && qsy.freq === parts.freq && qsy.state === 'failed' && (
          <p class="cf-note warn" title="Could not set the radio frequency. See the session log, or set the frequency by hand.">
            <TriangleAlert />QSY failure
          </p>
        )}
        {via && (
          <fieldset class="cf-route">
            <legend>Connect</legend>
            <label><input type="radio" name="cf-route" checked={route === 'direct'} onChange={() => pickRoute('direct')} />Direct</label>
            <label><input type="radio" name="cf-route" checked={route === 'pat'} onChange={() => pickRoute('pat')} />
              Through Pat at <code>{via}</code></label>
          </fieldset>
        )}
        <label class="cf-url">
          <span class="sr">Connect URL</span>
          <input aria-label="Connect URL" value={urlText} spellcheck={false} autocomplete="off"
            onInput={(e) => setTyped(e.currentTarget.value)}
            onBlur={(e) => { if (e.currentTarget.value !== shown.current) load(e.currentTarget.value); }} />
        </label>
        {/* Enter in any field connects, as in the old dialog. */}
        <button type="submit" hidden tabIndex={-1} aria-hidden="true" />
      </form>
      {showRms && (
        <div class="cf-rms">
          <RmsList mode={rmsMode} onPick={(url) => load(url)} />
        </div>
      )}
      <AliasName open={naming} onClose={closeNaming} taken={aliases} onSave={async (name) => {
        const url = build(parts);
        await api.putAlias(name, url);
        setAliases({ ...aliases, [name]: url });
        setAlias(name);
      }} />
      <Dialog open={deleting} title={`Delete alias ${alias}?`} onClose={closeDeleting}
        footer={(
          <>
            <span class="spacer" />
            <Button onClick={closeDeleting}>Cancel</Button>
            <Button variant="danger" onClick={() => {
              const name = alias;
              setDeleting(false);
              api.deleteAlias(name).then(() => {
                const next = { ...aliases };
                delete next[name];
                setAliases(next);
                setAlias('');
              }).catch((err) => toast(`Could not delete ${name}: ${err instanceof Error ? err.message : String(err)}`, { kind: 'error' }));
            }}>Delete</Button>
          </>
        )}>
        <div class="dialog-pad"><p>The connect URL saved as “{alias}” will be removed from your configuration.</p></div>
      </Dialog>
    </Dialog>
  );
}

function AliasName({ open, onClose, taken, onSave }: {
  open: boolean; onClose: () => void; taken: Record<string, string>; onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  // Clear on the way out, not on the way in: an effect on open runs a
  // frame late and would wipe what was typed in that frame.
  const close = useCallback(() => { setName(''); setError(''); onClose(); }, [onClose]);
  const save = async () => {
    const n = name.trim();
    if (!ALIAS_RE.test(n)) return setError('Alias name must contain only letters, numbers, dashes, underscores, dots, and @ symbols.');
    if (taken[n]) return setError('An alias with this name already exists.');
    try {
      await onSave(n);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  return (
    <Dialog open={open} title="New connection alias" onClose={close}
      footer={(
        <>
          <span class="spacer" />
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()}>Save</Button>
        </>
      )}>
      <form class="dialog-pad cf-alias-name" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p>Save this connection under a name for quick access.</p>
        <label class="cf-field">
          <span>Alias name</span>
          <input value={name} autofocus autocomplete="off" placeholder="Enter alias name..." onInput={(e) => setName(e.currentTarget.value)} />
        </label>
        <p class="hint">Letters, numbers, dashes (-), underscores (_), dots (.) and @.</p>
        {error && <p class="form-error" role="alert">{error}</p>}
      </form>
    </Dialog>
  );
}
