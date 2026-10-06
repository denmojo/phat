import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import * as api from '../../lib/api';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';

// patOffer holds the first-run question while it is unanswered. The server
// asks only once, right after Phat copied a Pat install's files.
export const patOffer = signal<api.PatChoice | null>(null);

export async function askAboutPat(): Promise<void> {
  try {
    const c = await api.patChoice();
    if (c.ask) patOffer.value = c;
  } catch { /* an older server or no answer: nothing to ask */ }
}

// waitForServer polls until Phat answers again after a restart.
async function waitForServer(): Promise<void> {
  await new Promise((r) => setTimeout(r, 1000));
  for (let i = 0; i < 30; i++) {
    try {
      await api.status();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

export function PatDialog() {
  const c = patOffer.value;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!c) return null;

  const answer = async (use: boolean) => {
    setBusy(true);
    setError('');
    try {
      await api.answerPatChoice(use);
      if (use) {
        // Phat opens the mailbox at startup, so Pat's takes a restart.
        await api.reload();
        await waitForServer();
        location.reload();
        return;
      }
      patOffer.value = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open title="Connect through your Pat?" onClose={() => void answer(false)}
      footer={(
        <>
          <Button disabled={busy} onClick={() => void answer(false)}>Use Phat on its own</Button>
          <span class="spacer" />
          <Button variant="primary" disabled={busy} onClick={() => void answer(true)}>Connect through Pat</Button>
        </>
      )}>
      <div class="dialog-pad">
        <p>Phat found Pat on this computer.</p>
        <p>{`Connect through Pat, and Phat shows Pat's mailbox and forms and hands its connections to Pat at ${c.pat_url}, which Winlink accepts by name. Pat itself isn't changed. Phat restarts to switch over.`}</p>
        <p>Use Phat on its own, and Phat keeps the copy of Pat's mail it just made, separate from Pat from now on.</p>
        {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      </div>
    </Dialog>
  );
}
