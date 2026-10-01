// New-release check, with the old client's storage keys: once per browser
// session, skipped for 72 hours after "Remind me later", and never again
// for a version the user chose to ignore.
import * as api from './api';

export type Release = { version: string; release_url: string };

const SNOOZE_MS = 72 * 60 * 60 * 1000;

export async function checkNewVersion(): Promise<Release | null> {
  try {
    if (sessionStorage.getItem('pat_version_checked') === 'true') return null;
    const last = parseInt(localStorage.getItem('pat_version_check_time') ?? '0', 10);
    if (Date.now() - last < SNOOZE_MS) return null;
  } catch {
    return null;
  }
  let r: Release | undefined;
  try {
    r = (await api.newReleaseCheck()) as Release | undefined;
  } catch {
    return null;
  }
  try {
    sessionStorage.setItem('pat_version_checked', 'true');
    if (!r?.version || r.version === localStorage.getItem('pat_ignored_version')) return null;
  } catch {
    return null;
  }
  return r;
}

export function ignoreVersion(version: string): void {
  try { localStorage.setItem('pat_ignored_version', version); } catch { /* storage blocked */ }
}

export function remindLater(): void {
  try { localStorage.setItem('pat_version_check_time', String(Date.now())); } catch { /* storage blocked */ }
}
