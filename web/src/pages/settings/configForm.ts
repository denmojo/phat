// configForm maps the server's config.json to the settings form and back,
// field for field as the old page did. toConfig starts from the config it
// was loaded from, so fields the page does not show survive a save.
import type { Config } from '../../lib/types';
import type { Appearance } from '../../ui/theme';

export const REDACTED = '[REDACTED]';

export type AliasRow = { name: string; url: string };
export type RigRow = { name: string; network: string; address: string; vfo: string };
export type ScheduleRow = { expr: string; cmd: string };

export type FormState = {
  mycall: string;
  locator: string;
  password: string;
  aux: string[];
  autoDownload: string;
  connectVia: string;
  listen: string[];
  aliases: AliasRow[];
  rigs: RigRow[];
  ardop: { addr: string; connectRequests: string; bandwidth: string; cwid: boolean; beacon: string; rig: string; ptt: boolean };
  pactor: { path: string; baudrate: string; initScript: string; rig: string };
  varahf: { addr: string; bandwidth: string; rig: string; ptt: boolean };
  varafm: { addr: string; rig: string; ptt: boolean };
  telnet: { listenAddr: string; password: string };
  ax25: { engine: string; rig: string; beaconEvery: string; beaconMessage: string; beaconDest: string };
  ax25Linux: { port: string };
  agwpe: { addr: string; radioPort: string };
  serialTnc: { path: string; baud: string; type: string; hbaud: string };
  gpsd: { addr: string; updateLocator: boolean; allowForms: boolean; useServerTime: boolean };
  schedule: ScheduleRow[];
  appearance: Appearance;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

// Zero shows as an empty field, the way the old page left unset numbers.
const opt = (n: unknown) => (typeof n === 'number' && n !== 0 ? String(n) : '');
const str = (n: unknown) => (typeof n === 'number' ? String(n) : '');
const num = (s: string) => parseInt(s.trim(), 10) || 0;
// Beacons fire no more often than every 10 seconds; 0 turns them off.
const beacon = (s: string) => { const n = num(s); return n > 0 && n < 10 ? 10 : n; };

export function fromConfig(config: Config): FormState {
  const c = config as Raw;
  const bw = c.ardop?.arq_bandwidth;
  const appearance = c.ui?.appearance;
  return {
    mycall: c.mycall ?? '',
    locator: c.locator ?? '',
    password: c.secure_login_password ?? '',
    aux: (c.auxiliary_addresses ?? []).filter((a: string) => a && a.trim()),
    autoDownload: str(c.auto_download_size_limit ?? -1),
    connectVia: c.connect_via ?? '',
    listen: [...(c.listen ?? [])],
    aliases: Object.entries(c.connect_aliases ?? {}).map(([name, url]) => ({ name, url: url as string })),
    rigs: Object.entries(c.hamlib_rigs ?? {}).map(([name, r]: [string, any]) => ({ name, network: r.network ?? '', address: r.address ?? '', vfo: r.VFO ?? '' })),
    ardop: {
      addr: c.ardop?.addr ?? '',
      connectRequests: opt(c.ardop?.connect_requests),
      bandwidth: bw?.Max ? `${bw.Max}${bw.Forced ? 'FORCED' : 'MAX'}` : '',
      cwid: !!c.ardop?.cwid_enabled,
      beacon: opt(c.ardop?.beacon_interval),
      rig: c.ardop?.rig ?? '',
      ptt: !!c.ardop?.ptt_ctrl,
    },
    pactor: { path: c.pactor?.path ?? '', baudrate: opt(c.pactor?.baudrate), initScript: c.pactor?.custom_init_script ?? '', rig: c.pactor?.rig ?? '' },
    varahf: { addr: c.varahf?.addr ?? '', bandwidth: opt(c.varahf?.bandwidth), rig: c.varahf?.rig ?? '', ptt: !!c.varahf?.ptt_ctrl },
    varafm: { addr: c.varafm?.addr ?? '', rig: c.varafm?.rig ?? '', ptt: !!c.varafm?.ptt_ctrl },
    telnet: { listenAddr: c.telnet?.listen_addr ?? '', password: c.telnet?.password ?? '' },
    ax25: {
      engine: c.ax25?.engine ?? '',
      rig: c.ax25?.rig ?? '',
      beaconEvery: opt(c.ax25?.beacon?.every),
      beaconMessage: c.ax25?.beacon?.message ?? '',
      beaconDest: c.ax25?.beacon?.destination ?? '',
    },
    ax25Linux: { port: c.ax25_linux?.port ?? '' },
    agwpe: { addr: c.agwpe?.addr ?? '', radioPort: str(c.agwpe?.radio_port) },
    serialTnc: { path: c['serial-tnc']?.path ?? '', baud: str(c['serial-tnc']?.serial_baud), type: c['serial-tnc']?.type ?? '', hbaud: str(c['serial-tnc']?.hbaud) },
    gpsd: { addr: c.gpsd?.addr ?? '', updateLocator: !!c.gpsd?.update_locator, allowForms: !!c.gpsd?.allow_forms, useServerTime: !!c.gpsd?.use_server_time },
    schedule: Object.entries(c.schedule ?? {}).map(([expr, cmd]) => ({ expr, cmd: cmd as string })),
    appearance: appearance === 'light' || appearance === 'dark' ? appearance : 'system',
  };
}

// An empty collection goes back as it came (null on a fresh install) so an
// untouched save writes the file it read.
function collection<T>(original: unknown, value: T, empty: boolean): T | unknown {
  return empty && (original === null || original === undefined) ? original : value;
}

export function toConfig(original: Config, s: FormState): Config {
  const o = original as Raw;
  const pairs = <R,>(rows: R[], key: (r: R) => string, keep: (r: R) => boolean, value: (r: R) => unknown) =>
    Object.fromEntries(rows.filter(keep).map((r) => [key(r), value(r)]));

  const aliases = pairs(s.aliases, (r) => r.name.trim(), (r) => !!r.name.trim() && !!r.url.trim(), (r) => r.url.trim());
  const rigs = pairs(s.rigs, (r) => r.name.trim(), (r) => !!r.name.trim() && !!r.address.trim(), (r) => ({
    ...(r.network ? { network: r.network } : {}),
    address: r.address.trim(),
    VFO: r.vfo,
  }));
  const schedule = pairs(s.schedule, (r) => r.expr.trim(), (r) => !!r.expr.trim() && !!r.cmd.trim(), (r) => r.cmd.trim());
  const aux = s.aux.map((a) => a.trim()).filter(Boolean);
  const bw = /^(\d+)(MAX|FORCED)$/.exec(s.ardop.bandwidth);

  const varahf: Raw = { ...o.varahf, addr: s.varahf.addr, rig: s.varahf.rig, ptt_ctrl: s.varahf.ptt };
  if (s.varahf.bandwidth) varahf.bandwidth = num(s.varahf.bandwidth);
  else delete varahf.bandwidth;

  const keepAppearance = s.appearance === 'system' && !o.ui?.appearance;

  const out: Raw = {
    ...o,
    mycall: s.mycall.trim(),
    locator: s.locator.trim(),
    secure_login_password: s.password || o.secure_login_password,
    auxiliary_addresses: collection(o.auxiliary_addresses, aux, aux.length === 0),
    auto_download_size_limit: s.autoDownload.trim() === '' ? -1 : parseInt(s.autoDownload, 10),
    ui: { ...o.ui, appearance: keepAppearance ? o.ui?.appearance : s.appearance },
    connect_aliases: collection(o.connect_aliases, aliases, Object.keys(aliases).length === 0),
    listen: s.listen,
    hamlib_rigs: collection(o.hamlib_rigs, rigs, Object.keys(rigs).length === 0),
    ardop: {
      ...o.ardop,
      addr: s.ardop.addr,
      connect_requests: num(s.ardop.connectRequests),
      arq_bandwidth: bw ? { Forced: bw[2] === 'FORCED', Max: Number(bw[1]) } : { Forced: false, Max: 0 },
      cwid_enabled: s.ardop.cwid,
      beacon_interval: beacon(s.ardop.beacon),
      rig: s.ardop.rig,
      ptt_ctrl: s.ardop.ptt,
    },
    pactor: { ...o.pactor, path: s.pactor.path, baudrate: num(s.pactor.baudrate), custom_init_script: s.pactor.initScript, rig: s.pactor.rig },
    varahf,
    varafm: { ...o.varafm, addr: s.varafm.addr, rig: s.varafm.rig, ptt_ctrl: s.varafm.ptt },
    telnet: { ...o.telnet, listen_addr: s.telnet.listenAddr, password: s.telnet.password },
    ax25: {
      ...o.ax25,
      engine: s.ax25.engine,
      rig: s.ax25.rig,
      beacon: { ...o.ax25?.beacon, every: beacon(s.ax25.beaconEvery), message: s.ax25.beaconMessage, destination: s.ax25.beaconDest },
    },
    ax25_linux: { ...o.ax25_linux, port: s.ax25Linux.port },
    agwpe: { ...o.agwpe, addr: s.agwpe.addr, radio_port: num(s.agwpe.radioPort) },
    'serial-tnc': { ...o['serial-tnc'], path: s.serialTnc.path, serial_baud: num(s.serialTnc.baud), type: s.serialTnc.type, hbaud: num(s.serialTnc.hbaud) },
    // enable_http stays as the file has it: the server refuses a change.
    gpsd: { ...o.gpsd, addr: s.gpsd.addr, update_locator: s.gpsd.updateLocator, allow_forms: s.gpsd.allowForms, use_server_time: s.gpsd.useServerTime },
    schedule: collection(o.schedule, schedule, Object.keys(schedule).length === 0),
  };
  const via = s.connectVia.trim();
  if (via) out.connect_via = via;
  else delete out.connect_via;
  return out;
}
