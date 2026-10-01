import { build, parse } from '../connectUrl';

test.each([
  'ardop:///LA3F?freq=5350&bw=500',
  'telnet://N0CALL:pw@server.winlink.org:8772/wl2k',
  'ax25+linux:///LD5GU/LA1B-10',
  'varahf:///LA1B?freq=7050&radio_only=true',
  'ardop:///LA3F?freq=3590&connect_requests=10&host=10.0.0.5',
])('%s round-trips', (url) => {
  expect(build(parse(url))).toBe(url);
});

test('parse splits a telnet address with credentials from its target', () => {
  const p = parse('telnet://N0CALL:pw@server.winlink.org:8772/wl2k');
  expect(p.transport).toBe('telnet');
  expect(p.addr).toBe('N0CALL:pw@server.winlink.org:8772');
  expect(p.target).toBe('wl2k');
});

test('parse reads the known parameters and keeps the rest', () => {
  const p = parse('ardop:///LA3F?freq=3590&bw=500&radio_only=true&connect_requests=10&host=10.0.0.5');
  expect(p).toMatchObject({ transport: 'ardop', addr: '', target: 'LA3F', freq: '3590', bw: '500', radioOnly: true, connectRequests: '10' });
  expect(p.extra.get('host')).toBe('10.0.0.5');
});

test('digipeaters stay in the target path', () => {
  expect(parse('ax25+linux:///LD5GU/LA1B-10').target).toBe('LD5GU/LA1B-10');
});

test('build drops empty parameters and radio_only when off', () => {
  expect(build({ transport: 'varafm', addr: '', target: 'EOC-1', freq: '', bw: '', radioOnly: false, connectRequests: '', extra: new URLSearchParams() }))
    .toBe('varafm:///EOC-1');
});

test('a malformed string parses to an empty telnet URL rather than throwing', () => {
  expect(parse('not a url').transport).toBe('telnet');
});
