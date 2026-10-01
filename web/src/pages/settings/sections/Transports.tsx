import type { FormState } from '../configForm';
import type { Edit } from './General';
import { Check, Field, Group, Section, Select } from './fields';

const ARDOP_BW: [string, string][] = [['', 'Default'],
  ...['200', '500', '1000', '2000'].map((n): [string, string] => [`${n}MAX`, `${n} Hz max`]),
  ...['200', '500', '1000', '2000'].map((n): [string, string] => [`${n}FORCED`, `${n} Hz forced`])];
const VARA_BW: [string, string][] = [['', 'Default'], ['500', '500 Hz'], ['2300', '2300 Hz'], ['2750', '2750 Hz']];
const ENGINES: [string, string][] = [['linux', 'Linux'], ['agwpe', 'AGWPE'], ['serial-tnc', 'Serial TNC']];
const TNC_TYPES: [string, string][] = [['', 'Default'], ['kenwood', 'Kenwood']];
const HBAUD: [string, string][] = [['1200', '1200 baud'], ['9600', '9600 baud']];

// Transports holds one collapsible block per modem or link, each with its
// inbound listen switch and, for radios, the rig it tunes.
export function Transports({ s, edit }: { s: FormState; edit: Edit }) {
  const rigs: [string, string][] = [['', 'None'], ...s.rigs.map((r) => r.name.trim()).filter(Boolean).map((n): [string, string] => [n, n])];
  const listen = (t: string) => (
    <Check label="Listen for inbound P2P traffic" checked={s.listen.includes(t)}
      onChange={(on) => edit((d) => { d.listen = on ? [...d.listen.filter((x) => x !== t), t] : d.listen.filter((x) => x !== t); })} />
  );
  const beaconHint = 'Seconds between beacons, at least 10. Leave blank or 0 for none.';
  return (
    <Section id="transports" title="Transports">
      <Group title="ARDOP">
        {listen('ardop')}
        <Field label="TNC address" value={s.ardop.addr} placeholder="localhost:8515" onInput={(v) => edit((d) => { d.ardop.addr = v; })} />
        <Field label="Connect requests" type="number" min={1} value={s.ardop.connectRequests}
          hint="Connect frames to send when dialing. Most stations need several before they answer."
          onInput={(v) => edit((d) => { d.ardop.connectRequests = v; })} />
        <Select label="ARQ bandwidth" value={s.ardop.bandwidth} options={ARDOP_BW} onChange={(v) => edit((d) => { d.ardop.bandwidth = v; })} />
        <Check label="CW ID" checked={s.ardop.cwid} onChange={(v) => edit((d) => { d.ardop.cwid = v; })} />
        <Field label="Beacon interval" type="number" min={0} value={s.ardop.beacon} hint={beaconHint}
          onInput={(v) => edit((d) => { d.ardop.beacon = v; })} />
        <Select label="Rig" value={s.ardop.rig} options={rigs} onChange={(v) => edit((d) => { d.ardop.rig = v; })} />
        <Check label="PTT control" checked={s.ardop.ptt} onChange={(v) => edit((d) => { d.ardop.ptt = v; })} />
      </Group>
      <Group title="PACTOR">
        {listen('pactor')}
        <Field label="TNC path" value={s.pactor.path} placeholder="/dev/ttyUSB0" onInput={(v) => edit((d) => { d.pactor.path = v; })} />
        <Field label="Baud rate" type="number" value={s.pactor.baudrate} placeholder="57600" onInput={(v) => edit((d) => { d.pactor.baudrate = v; })} />
        <Field label="Init script path" value={s.pactor.initScript} placeholder="/path/to/init.sh" hint="Optional script to initialize the TNC."
          onInput={(v) => edit((d) => { d.pactor.initScript = v; })} />
        <Select label="Rig" value={s.pactor.rig} options={rigs} onChange={(v) => edit((d) => { d.pactor.rig = v; })} />
      </Group>
      <Group title="VARA HF">
        {listen('varahf')}
        <Field label="Modem address" value={s.varahf.addr} placeholder="localhost:8300" onInput={(v) => edit((d) => { d.varahf.addr = v; })} />
        <Select label="Bandwidth" value={s.varahf.bandwidth} options={VARA_BW} onChange={(v) => edit((d) => { d.varahf.bandwidth = v; })} />
        <Select label="Rig" value={s.varahf.rig} options={rigs} onChange={(v) => edit((d) => { d.varahf.rig = v; })} />
        <Check label="PTT control" checked={s.varahf.ptt} onChange={(v) => edit((d) => { d.varahf.ptt = v; })} />
      </Group>
      <Group title="VARA FM">
        {listen('varafm')}
        <Field label="Modem address" value={s.varafm.addr} placeholder="localhost:8300" onInput={(v) => edit((d) => { d.varafm.addr = v; })} />
        <Select label="Rig" value={s.varafm.rig} options={rigs} onChange={(v) => edit((d) => { d.varafm.rig = v; })} />
        <Check label="PTT control" checked={s.varafm.ptt} onChange={(v) => edit((d) => { d.varafm.ptt = v; })} />
      </Group>
      <Group title="Telnet">
        {listen('telnet')}
        <Field label="Listen address" value={s.telnet.listenAddr} placeholder=":8774" hint="Network address to listen on for telnet P2P connections."
          onInput={(v) => edit((d) => { d.telnet.listenAddr = v; })} />
        <Field label="Password" type="password" value={s.telnet.password} autocomplete="new-password" hint="Password asked of incoming telnet P2P connections."
          onInput={(v) => edit((d) => { d.telnet.password = v; })} />
      </Group>
      <Group title="AX.25">
        {listen('ax25')}
        <Select label="Engine" value={s.ax25.engine} options={ENGINES} onChange={(v) => edit((d) => { d.ax25.engine = v; })}
          hint="Linux uses kernel AX.25, AGWPE an AGWPE-compatible TNC, Serial TNC a TNC on a serial port." />
        <Select label="Rig" value={s.ax25.rig} options={rigs} onChange={(v) => edit((d) => { d.ax25.rig = v; })} />
        <Field label="Beacon interval" type="number" min={0} value={s.ax25.beaconEvery} hint={`${beaconHint} 3600 is hourly.`}
          onInput={(v) => edit((d) => { d.ax25.beaconEvery = v; })} />
        <Field label="Beacon message" value={s.ax25.beaconMessage} onInput={(v) => edit((d) => { d.ax25.beaconMessage = v; })} />
        <Field label="Beacon destination" value={s.ax25.beaconDest} placeholder="IDENT" hint="Destination callsign for beacon frames."
          onInput={(v) => edit((d) => { d.ax25.beaconDest = v; })} />
        {s.ax25.engine === 'linux' && (
          <div class="st-sub">
            <h3>Linux</h3>
            <Field label="AX.25 port" value={s.ax25Linux.port} placeholder="wl2k" onInput={(v) => edit((d) => { d.ax25Linux.port = v; })} />
          </div>
        )}
        {s.ax25.engine === 'agwpe' && (
          <div class="st-sub">
            <h3>AGWPE</h3>
            <Field label="AGWPE address" value={s.agwpe.addr} placeholder="localhost:8000" onInput={(v) => edit((d) => { d.agwpe.addr = v; })} />
            <Field label="Radio port" type="number" min={0} max={3} value={s.agwpe.radioPort} hint="AGWPE radio port number, 0 to 3."
              onInput={(v) => edit((d) => { d.agwpe.radioPort = v; })} />
          </div>
        )}
        {s.ax25.engine === 'serial-tnc' && (
          <div class="st-sub">
            <h3>Serial TNC</h3>
            <Field label="Device path" value={s.serialTnc.path} placeholder="/dev/ttyUSB0" onInput={(v) => edit((d) => { d.serialTnc.path = v; })} />
            <Field label="Serial baud rate" type="number" value={s.serialTnc.baud} onInput={(v) => edit((d) => { d.serialTnc.baud = v; })} />
            <Select label="TNC type" value={s.serialTnc.type} options={TNC_TYPES} onChange={(v) => edit((d) => { d.serialTnc.type = v; })} />
            <Select label="Packet baud rate" value={s.serialTnc.hbaud} options={HBAUD} onChange={(v) => edit((d) => { d.serialTnc.hbaud = v; })} />
          </div>
        )}
      </Group>
    </Section>
  );
}
