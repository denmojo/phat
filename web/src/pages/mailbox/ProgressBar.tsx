import { progress } from './store';
import './ProgressBar.css';

// ProgressBar shows the message being sent or received during a session.
export function ProgressBar() {
  const p = progress.value;
  if (!p) return null;
  const pct = p.bytes_total > 0 ? Math.min(100, Math.ceil((p.bytes_transferred * 100) / p.bytes_total)) : 0;
  const text = `${p.receiving ? 'Receiving' : 'Sending'} ${p.mid} (${p.bytes_total} bytes)${p.subject ? ` - ${p.subject}` : ''}`;
  return (
    <div class={`progress${p.done ? ' done' : ''}`}>
      <div class="pg-text"><span class="what">{text}</span><span class="pct">{`${pct}%`}</span></div>
      <div class="pg-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={text}>
        <div class="pg-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
