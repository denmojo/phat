// Desktop notifications. Chrome on Android only allows them from a service
// worker and throws a TypeError on construction, which is how support is
// detected without asking for a pointless permission.
export type NotifyState = 'granted' | 'denied' | 'unsupported';

export function supported(): boolean {
  if (!('Notification' in window) || !Notification.requestPermission) return false;
  if (Notification.permission === 'granted') return true;
  try {
    new Notification('');
  } catch (e) {
    if (e instanceof TypeError) return false;
  }
  return true;
}

export async function requestPermission(): Promise<NotifyState> {
  if (!supported()) return 'unsupported';
  try {
    return (await Notification.requestPermission()) === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export function show(title: string, body = ''): Notification | null {
  if (!supported() || Notification.permission !== 'granted') return null;
  return new Notification(title, { body, icon: '/dist/static/phat_logo.png' });
}

// insecureOrigin guesses whether the browser withholds powerful features
// (notifications, geolocation) because the page isn't a secure context.
export function insecureOrigin(): boolean {
  if ('isSecureContext' in window) return !window.isSecureContext;
  if (location.protocol === 'https:' || location.protocol === 'file:') return false;
  return !(location.hostname === 'localhost' || location.hostname.startsWith('127.'));
}
