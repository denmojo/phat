import { useEffect, useRef } from 'preact/hooks';
import { Eraser, X } from 'lucide-preact';
import { IconButton } from '../../ui/IconButton';
import { logLines, logOpen } from './store';
import './SessionLog.css';

// SessionLog shows the server's log as it streams over the websocket, the
// way the old client's console did, following the newest line.
export function SessionLog() {
  const pre = useRef<HTMLPreElement>(null);
  const lines = logLines.value;
  useEffect(() => {
    const el = pre.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, logOpen.value]);
  if (!logOpen.value) return null;
  return (
    <section class="sessionlog" aria-label="Session log">
      <div class="sl-head">
        <h2>Session log</h2>
        <IconButton icon={Eraser} label="Clear log" onClick={() => { logLines.value = []; }} />
        <IconButton icon={X} label="Close log" onClick={() => { logOpen.value = false; }} />
      </div>
      <pre ref={pre} class="sl-body" role="log" aria-live="polite">
        {lines.length ? lines.join('\n') : <span class="sl-empty">Nothing logged yet. Session output appears here.</span>}
      </pre>
    </section>
  );
}
