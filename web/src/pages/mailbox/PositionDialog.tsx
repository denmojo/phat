import { useEffect, useRef, useState } from 'preact/hooks';
import { MapPin } from 'lucide-preact';
import * as api from '../../lib/api';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { toast } from '../../ui/Toast';
import { geoError, positionOpen } from './store';
import './PositionDialog.css';

const close = () => { positionOpen.value = false; };

// PositionDialog posts a position report. It takes the position from a GPS
// device on the server when there is one, and otherwise from the browser.
export function PositionDialog() {
  if (!positionOpen.value) return null;
  return <PositionForm />;
}

function PositionForm() {
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [comment, setComment] = useState('');
  const [when, setWhen] = useState<Date | null>(null);
  const [note, setNote] = useState('Checking if a GPS device is available…');
  const [posting, setPosting] = useState(false);
  const watch = useRef<number | null>(null);

  const stopWatch = () => {
    if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
  };

  useEffect(() => {
    let live = true;
    const fill = (la: number, lo: number, d: Date, source: string) => {
      setLat(String(la));
      setLon(String(lo));
      setWhen(d);
      setNote(`${source} position from ${d.toLocaleString()}`);
    };
    api.gpsPosition().then((g) => {
      if (!live) return;
      const gp = g as { Lat: number; Lon: number; Time: string };
      fill(gp.Lat, gp.Lon, new Date(gp.Time), 'GPS');
    }).catch(() => {
      if (!live) return;
      if (!navigator.geolocation) {
        setNote('No GPS device, and this browser has no geolocation.');
        return;
      }
      setNote('Waiting for a position from the browser…');
      watch.current = navigator.geolocation.watchPosition(
        (pos) => {
          // Safari reports a stale timestamp, so it gets the current time.
          const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
          if (live) fill(pos.coords.latitude, pos.coords.longitude, safari ? new Date() : new Date(pos.timestamp), 'Browser');
        },
        (err) => {
          if (!live) return;
          geoError.value = err.message || 'Geolocation error.';
          setNote('Geolocation unavailable.');
        },
        { enableHighAccuracy: true, maximumAge: 0 },
      );
    });
    return () => { live = false; stopWatch(); };
  }, []);

  const cancel = () => { stopWatch(); close(); };
  const post = async () => {
    setPosting(true);
    try {
      const r = await api.posReport({ lat: parseFloat(lat), lon: parseFloat(lon), comment, date: when ?? new Date() });
      stopWatch();
      close();
      toast(r || 'Position report posted');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), { kind: 'error' });
    } finally {
      setPosting(false);
    }
  };

  const ready = lat !== '' && lon !== '' && !Number.isNaN(parseFloat(lat)) && !Number.isNaN(parseFloat(lon));
  return (
    <Dialog open title="Position report" onClose={cancel}
      footer={(
        <>
          <span class="spacer" />
          <Button onClick={cancel}>Cancel</Button>
          <Button variant="primary" disabled={!ready || posting} onClick={() => void post()}><MapPin /><span>Post report</span></Button>
        </>
      )}>
      <form class="position" onSubmit={(e) => { e.preventDefault(); if (ready) void post(); }}>
        <p class="pos-note" role="status">{note}</p>
        <div class="pos-grid">
          <label><span>Latitude</span><input inputMode="decimal" value={lat} onInput={(e) => setLat(e.currentTarget.value)} /></label>
          <label><span>Longitude</span><input inputMode="decimal" value={lon} onInput={(e) => setLon(e.currentTarget.value)} /></label>
        </div>
        <label><span>Comment</span><input value={comment} onInput={(e) => setComment(e.currentTarget.value)} /></label>
      </form>
    </Dialog>
  );
}
