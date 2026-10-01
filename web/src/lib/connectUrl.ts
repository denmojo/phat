// Connect URLs name a transport, an address (telnet only), a target path
// with any digipeaters, and query parameters. This replaces urijs: the
// dialog's fields read and write the known parameters, and every other
// parameter (from an alias or a hand edit) is carried through untouched.
// The target is the path, as wl2k-go's transport.ParseURL reads it, so an
// ARDOP URL is ardop:///LA3F, not ardop://LA3F.

export type ConnectParts = {
  transport: string;
  // addr is the URL's authority; for telnet it may be user:pass@host:port.
  addr: string;
  // target is the path without its leading slash, digipeaters included.
  target: string;
  freq: string;
  bw: string;
  radioOnly: boolean;
  connectRequests: string;
  extra: URLSearchParams;
};

const KNOWN = ['freq', 'bw', 'radio_only', 'connect_requests'];
const RE = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)(\/[^?#]*)?(?:\?([^#]*))?/i;

export function parse(url: string): ConnectParts {
  const m = url.trim().match(RE);
  if (!m) {
    return { transport: 'telnet', addr: '', target: '', freq: '', bw: '', radioOnly: false, connectRequests: '', extra: new URLSearchParams() };
  }
  const q = new URLSearchParams(m[4] ?? '');
  const extra = new URLSearchParams();
  for (const [k, v] of q) if (!KNOWN.includes(k)) extra.append(k, v);
  return {
    transport: m[1]!.toLowerCase(),
    addr: m[2] ?? '',
    target: (m[3] ?? '').replace(/^\//, ''),
    freq: q.get('freq') ?? '',
    bw: q.get('bw') ?? '',
    radioOnly: q.get('radio_only') === 'true',
    connectRequests: q.get('connect_requests') ?? '',
    extra,
  };
}

export function build(p: ConnectParts): string {
  const q = new URLSearchParams();
  if (p.freq) q.set('freq', p.freq);
  if (p.bw) q.set('bw', p.bw);
  if (p.radioOnly) q.set('radio_only', 'true');
  if (p.connectRequests) q.set('connect_requests', p.connectRequests);
  for (const [k, v] of p.extra) q.append(k, v);
  const query = q.toString();
  return `${p.transport}://${p.addr}/${p.target}${query ? `?${query}` : ''}`;
}
