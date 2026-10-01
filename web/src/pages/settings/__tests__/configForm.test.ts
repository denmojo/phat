import { fromConfig, toConfig } from '../configForm';
import type { Config } from '../../../lib/types';

// Every section the page shows, plus fields it never shows.
const full = (): Config => ({
  mycall: 'N0CALL',
  secure_login_password: '[REDACTED]',
  auxiliary_addresses: ['N0CALL-1', 'EMCOMM:secret'],
  locator: 'FN31',
  auto_download_size_limit: 50000,
  service_codes: ['PUBLIC'],
  http_addr: '127.0.0.1:8080',
  ui: { appearance: 'dark' },
  motd: ['hello'],
  connect_aliases: { telnet: 'telnet://{mycall}:CMSTelnet@cms.winlink.org:8772/wl2k', eoc: 'ardop:///EOC-1?freq=7102.2' },
  listen: ['telnet', 'ardop'],
  hamlib_rigs: { ic7300: { network: 'tcp', address: 'localhost:4532', VFO: 'A' }, ft891: { address: '/dev/ttyUSB1', VFO: '' } },
  ax25: { engine: 'serial-tnc', rig: 'ic7300', port: 'old', beacon: { every: 3600, message: 'Pat here', destination: 'IDENT' } },
  ax25_linux: { port: 'wl2k' },
  agwpe: { addr: 'localhost:8000', radio_port: 0 },
  'serial-tnc': { path: '/dev/ttyUSB0', serial_baud: 9600, hbaud: 1200, type: 'kenwood' },
  ardop: { addr: 'localhost:8515', arq_bandwidth: { Forced: true, Max: 500 }, connect_requests: 10, rig: 'ic7300', ptt_ctrl: true, beacon_interval: 600, cwid_enabled: true },
  pactor: { path: '/dev/ttyUSB0', baudrate: 57600, rig: 'ft891', custom_init_script: '/etc/pactor.sh' },
  telnet: { listen_addr: ':8774', password: 'p2p' },
  varahf: { addr: 'localhost:8300', bandwidth: 2300, rig: 'ic7300', ptt_ctrl: true },
  varafm: { addr: 'localhost:8400', rig: '', ptt_ctrl: false },
  gpsd: { enable_http: true, allow_forms: true, use_server_time: true, update_locator: true, addr: 'localhost:2947' },
  prediction: { engine: 'voacap' },
  schedule: { '@every 1h': 'connect telnet' },
  version_reporting_disabled: true,
});

// A fresh install: empty collections come back as null.
const bare = (): Config => ({
  mycall: 'N0CALL', secure_login_password: '', auxiliary_addresses: null, locator: 'FN31', auto_download_size_limit: -1,
  service_codes: ['PUBLIC'], http_addr: '127.0.0.1:8090', ui: { appearance: '' }, motd: null,
  connect_aliases: { telnet: 'telnet://{mycall}:CMSTelnet@cms.winlink.org:8772/wl2k' }, listen: ['telnet'], hamlib_rigs: null,
  ax25: { engine: 'agwpe', rig: '', beacon: { every: 0, message: '', destination: '' } }, ax25_linux: { port: 'wl2k' },
  agwpe: { addr: 'localhost:8000', radio_port: 0 }, 'serial-tnc': { path: '', serial_baud: 9600, hbaud: 1200, type: '' },
  ardop: { addr: '', arq_bandwidth: { Forced: false, Max: 0 }, connect_requests: 10, rig: '', ptt_ctrl: false, beacon_interval: 0, cwid_enabled: false },
  pactor: { path: '/dev/ttyUSB0', baudrate: 57600, rig: '', custom_init_script: '' }, telnet: { listen_addr: '127.0.0.1:8774', password: '' },
  varahf: { addr: 'localhost:8300', rig: '', ptt_ctrl: false }, varafm: { addr: 'localhost:8300', rig: '', ptt_ctrl: false },
  gpsd: { enable_http: false, allow_forms: false, use_server_time: false, update_locator: false, addr: 'localhost:2947' },
  schedule: null, version_reporting_disabled: true,
});

test('a config survives a round trip through the form unchanged', () => {
  expect(toConfig(full(), fromConfig(full()))).toEqual(full());
  expect(toConfig(bare(), fromConfig(bare()))).toEqual(bare());
});

test('an untouched redacted password stays redacted, so the server keeps the stored one', () => {
  const s = fromConfig(full());
  expect(s.password).toBe('[REDACTED]');
  expect(toConfig(full(), { ...s, password: '' }).secure_login_password).toBe('[REDACTED]');
  expect(toConfig(full(), { ...s, password: 'newpass' }).secure_login_password).toBe('newpass');
});

test('edits map back to their config fields', () => {
  const s = fromConfig(bare());
  s.autoDownload = '';
  s.ardop.bandwidth = '2000MAX';
  s.ardop.beacon = '';
  s.varahf.bandwidth = '500';
  s.aliases.push({ name: 'eoc', url: 'ardop:///EOC-1' }, { name: '', url: 'dropped' });
  s.rigs.push({ name: 'ic7300', network: 'tcp', address: 'localhost:4532', vfo: 'B' }, { name: 'noaddr', network: 'tcp', address: '', vfo: '' });
  s.schedule.push({ expr: '@every 30m', cmd: 'connect telnet' });
  s.listen = ['telnet', 'varahf'];
  s.aux = ['N0CALL-1'];
  s.appearance = 'light';
  const c = toConfig(bare(), s) as any;
  expect(c.auto_download_size_limit).toBe(-1);
  expect(c.ardop.arq_bandwidth).toEqual({ Forced: false, Max: 2000 });
  expect(c.ardop.beacon_interval).toBe(0);
  expect(c.varahf.bandwidth).toBe(500);
  expect(c.connect_aliases).toEqual({ telnet: 'telnet://{mycall}:CMSTelnet@cms.winlink.org:8772/wl2k', eoc: 'ardop:///EOC-1' });
  expect(c.hamlib_rigs).toEqual({ ic7300: { network: 'tcp', address: 'localhost:4532', VFO: 'B' } });
  expect(c.schedule).toEqual({ '@every 30m': 'connect telnet' });
  expect(c.listen).toEqual(['telnet', 'varahf']);
  expect(c.auxiliary_addresses).toEqual(['N0CALL-1']);
  expect(c.ui).toEqual({ appearance: 'light' });
});

test('beacon intervals under 10 seconds are raised to 10', () => {
  const s = fromConfig(bare());
  s.ardop.beacon = '5';
  s.ax25.beaconEvery = '3';
  const c = toConfig(bare(), s) as any;
  expect(c.ardop.beacon_interval).toBe(10);
  expect(c.ax25.beacon.every).toBe(10);
});

test('the GPSd HTTP proxy setting is never written from the page', () => {
  const s = fromConfig(full());
  expect('enableHttp' in s.gpsd).toBe(false);
  expect((toConfig(full(), s) as any).gpsd.enable_http).toBe(true);
});
