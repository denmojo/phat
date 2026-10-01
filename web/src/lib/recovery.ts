// Winlink password-recovery email check, with the old client's storage
// keys: a confirmed email isn't rechecked for 30 days, and "Later" hides the
// warning for 84 hours, per callsign.
import * as api from './api';

const VERIFIED_MS = 30 * 24 * 60 * 60 * 1000;
const DISMISS_MS = 84 * 60 * 60 * 1000;

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

// checkRecovery returns warn when the account has no recovery email, ok when
// it has one, and skip when the check isn't due or couldn't run.
export async function checkRecovery(call: string): Promise<'warn' | 'ok' | 'skip'> {
  const last = parseInt(get(`passwordRecoveryLastCheck_${call}`) ?? '0', 10);
  if (last && Date.now() - last < VERIFIED_MS) return 'skip';
  const until = parseInt(get(`passwordRecoveryDismissed_${call}`) ?? '0', 10);
  if (until && Date.now() < until) return 'skip';
  try {
    const r = await api.recoveryEmail();
    if (r.recovery_email?.trim()) {
      put(`passwordRecoveryLastCheck_${call}`, String(Date.now()));
      return 'ok';
    }
    return 'warn';
  } catch {
    // Expected offline.
    return 'skip';
  }
}

export function dismissRecovery(call: string): void {
  put(`passwordRecoveryDismissed_${call}`, String(Date.now() + DISMISS_MS));
}
