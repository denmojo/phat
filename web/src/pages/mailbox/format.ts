// Display helpers for the mailbox page.

const SYSTEM_NAMES: Record<string, string> = { in: 'Inbox', out: 'Outbox', sent: 'Sent', archive: 'Archive' };

// narrow reports a phone-width screen, where toolbars fold some buttons
// into their More actions menu.
export const narrow = () => window.matchMedia?.('(max-width: 640px)').matches ?? false;

export function folderTitle(name: string): string {
  return SYSTEM_NAMES[name] ?? name;
}

// formatDate shows the time for today's mail, month and day for this
// year's, and adds the year for anything older.
export function formatDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const CALL_COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#4f46e5', '#b45309'];

export function callColor(s: string): string {
  return CALL_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % CALL_COLORS.length]!;
}
