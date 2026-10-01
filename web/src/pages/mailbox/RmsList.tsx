import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { RefreshCw } from 'lucide-preact';
import * as api from '../../lib/api';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import './RmsList.css';

export type Rms = {
  callsign: string;
  distance: number;
  modes: string;
  dial: { desc: string };
  url: string;
  prediction: { link_quality: number; output_values?: Record<string, string> | null; output_raw?: string | null } | null;
};

const PAGE = 100;
const MODES: [string, string][] = [['', '(any mode)'], ['ardop', 'ARDOP'], ['packet', 'Packet'], ['pactor', 'Pactor'], ['varafm', 'VARA FM'], ['varahf', 'VARA HF']];
// Bands as freq.go names them.
const BANDS = ['160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m', '4m', '2m', '1.25m', '70cm'];

// modeFor maps a connect transport to the RMS list's mode filter; telnet
// leaves the filter where it was.
export function modeFor(transport: string): string | null {
  if (['ardop', 'pactor', 'varafm', 'varahf'].includes(transport)) return transport;
  if (transport.startsWith('ax25')) return 'packet';
  return null;
}

// RmsList lists Winlink gateways for a mode and band, nearest first, with
// predicted link quality when the server has propagation predictions.
export function RmsList({ mode: initialMode, onPick }: { mode: string; onPick: (url: string) => void }) {
  const [mode, setMode] = useState(initialMode);
  const [band, setBand] = useState('');
  const [filter, setFilter] = useState('');
  const [data, setData] = useState<Rms[]>([]);
  const [shown, setShown] = useState(PAGE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [raw, setRaw] = useState<Rms | null>(null);
  const seq = useRef(0);
  const closeRaw = useCallback(() => setRaw(null), []);

  useEffect(() => setMode(initialMode), [initialMode]);

  const load = async (force: boolean) => {
    const n = ++seq.current;
    setLoading(true);
    setError('');
    try {
      const rows = (await api.rmslist({ mode, band }, force)) as Rms[];
      if (n !== seq.current) return;
      setData(rows ?? []);
      setShown(PAGE);
    } catch (err) {
      if (n === seq.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  };
  useEffect(() => { void load(false); }, [mode, band]);

  const f = filter.trim().toLowerCase();
  const rows = f ? data.filter((r) => r.callsign.toLowerCase().startsWith(f)) : data;
  const quality = rows.some((r) => r.prediction != null);
  return (
    <div class="rmslist">
      <div class="rms-filters">
        <select aria-label="Mode" value={mode} onChange={(e) => setMode(e.currentTarget.value)}>
          {MODES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <select aria-label="Band" value={band} onChange={(e) => setBand(e.currentTarget.value)}>
          <option value="">(any band)</option>
          {BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <input type="search" aria-label="Callsign" placeholder="(any target)" value={filter}
          onInput={(e) => { setFilter(e.currentTarget.value); setShown(PAGE); }} />
        <Button size="sm" disabled={loading} onClick={() => void load(true)}>
          <RefreshCw class={loading ? 'spin' : ''} /><span>Update cache</span>
        </Button>
      </div>
      {error && <p class="rms-error" role="alert">{error}</p>}
      <div class="rms-table">
        <table>
          <thead>
            <tr>
              <th>Target</th><th>Distance</th><th>Mode</th><th class="num">Dial freq</th>
              {quality && <th class="num" title="Predicted link quality">Quality</th>}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((r) => {
              const p = r.prediction;
              const values = p?.output_values ? Object.entries(p.output_values).map(([k, v]) => `${k}: ${v}`).join('\n') : undefined;
              return (
                <tr key={r.url} class={picked === r.url ? 'active' : ''} onClick={() => { setPicked(r.url); onPick(r.url); }}>
                  <td class="call">{r.callsign}</td>
                  <td>{`${r.distance.toFixed(0)} km`}</td>
                  <td>{r.modes}</td>
                  <td class="num">{r.dial.desc}</td>
                  {quality && (
                    <td class="num">
                      {p == null ? 'N/A' : (
                        <button type="button" class="lq" title={values}
                          onClick={(e) => { e.stopPropagation(); if (p.output_raw) setRaw(r); }}>{`${p.link_quality}%`}</button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && data.length === 0 && <p class="rms-empty">Loading…</p>}
        {!loading && !error && rows.length === 0 && <p class="rms-empty">No gateways match.</p>}
      </div>
      {rows.length > 0 && (
        <div class="rms-more">
          <span>{`Showing ${Math.min(shown, rows.length)} of ${rows.length}`}</span>
          {shown < rows.length && <Button size="sm" onClick={() => setShown(shown + PAGE)}>Load more</Button>}
        </div>
      )}
      <Dialog open={raw !== null} title={`Propagation prediction: ${raw?.callsign ?? ''}`} onClose={closeRaw} wide>
        <pre class="rms-raw">{raw?.prediction?.output_raw}</pre>
      </Dialog>
    </div>
  );
}
