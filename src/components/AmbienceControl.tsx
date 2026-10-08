import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Music2, Pause, Volume2, VolumeX } from 'lucide-react';
import { CozyAmbience, type AmbienceTrack } from '../audio/CozyAmbience';
import './AmbienceControl.css';

const VOLUME_KEY = 'store-maker.ambience-volume';
const TRACK_KEY = 'store-maker.ambience-track';

function savedTrack(): AmbienceTrack {
  try { if (localStorage.getItem(TRACK_KEY) === 'calm') return 'calm'; } catch { /* Session-only music. */ }
  return 'cheerful';
}

function savedVolume() {
  try {
    const saved = localStorage.getItem(VOLUME_KEY);
    const value = saved === null ? NaN : Number(saved);
    if (Number.isFinite(value) && value >= 0 && value <= 1) return value;
  } catch { /* Music still works without browser storage. */ }
  return 0.35;
}

export default function AmbienceControl() {
  const [enabled, setEnabled] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(savedVolume);
  const [track, setTrack] = useState(savedTrack);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const engine = useRef<CozyAmbience | null>(null);
  const wanted = useRef(true);
  const currentVolume = useRef(volume);
  const currentTrack = useRef(track);
  const request = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const settings = useRef<HTMLButtonElement>(null);
  const slider = useRef<HTMLInputElement>(null);
  const playbackLabel = playing ? 'Jeda musik cozy' : enabled ? 'Matikan musik cozy' : 'Putar musik cozy';

  useEffect(() => {
    currentVolume.current = volume;
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* Session-only volume. */ }
  }, [volume]);

  useEffect(() => {
    currentTrack.current = track;
    try { localStorage.setItem(TRACK_KEY, track); } catch { /* Session-only music. */ }
  }, [track]);

  const start = useCallback(async (manual = false) => {
    if (!wanted.current || document.hidden) return;
    const token = ++request.current;
    setError('');
    try {
      const player = engine.current ??= new CozyAmbience();
      player.setVolume(currentVolume.current);
      player.setTrack(currentTrack.current);
      await player.play();
      if (token === request.current && wanted.current) setPlaying(true);
    } catch {
      if (token !== request.current) return;
      setPlaying(false);
      // Blocked autoplay stays armed for the first real interaction.
      if (manual) {
        wanted.current = false;
        setEnabled(false);
        setError('Musik belum bisa diputar. Coba tekan putar lagi.');
        setOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    // Defer one tick so StrictMode's setup/cleanup does not open two contexts.
    const autoplay = window.setTimeout(() => { void start(); }, 0);
    return () => {
      window.clearTimeout(autoplay);
      request.current++;
      engine.current?.dispose();
      engine.current = null;
    };
  }, [start]);

  useEffect(() => {
    if (!enabled || playing) return;
    const unlock = (event: Event) => {
      if (!event.isTrusted || (event.target instanceof Node && root.current?.contains(event.target))) return;
      if (event instanceof KeyboardEvent && (event.repeat || event.ctrlKey || event.metaKey || event.altKey || ['Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key))) return;
      void start();
    };
    // Capture also works when the editor handles the click itself. Music
    // controls are excluded so manually switching it off always takes priority.
    document.addEventListener('click', unlock, true);
    document.addEventListener('pointerup', unlock, true);
    document.addEventListener('keydown', unlock, true);
    return () => {
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('pointerup', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
  }, [enabled, playing, start]);

  useEffect(() => {
    const visibility = () => {
      if (document.hidden) {
        request.current++;
        engine.current?.pause();
        setPlaying(false);
      } else if (wanted.current) void start();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [start]);

  useEffect(() => {
    if (!open) return;
    slider.current?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  const toggle = () => {
    request.current++;
    setError('');
    if (wanted.current) {
      wanted.current = false;
      setEnabled(false);
      setPlaying(false);
      engine.current?.pause();
      return;
    }
    wanted.current = true;
    setEnabled(true);
    void start(true);
  };

  return <div className={`ambience-control ${playing ? 'is-playing' : ''}`} ref={root} onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); settings.current?.focus();
    }
  }}>
    <div className="ambience-pill">
      <button className="ambience-play" type="button" aria-label={playbackLabel} aria-pressed={enabled} title={playbackLabel} onClick={toggle}>
        {playing ? <Pause size={15} /> : <Music2 size={15} />}<span>Cozy</span>
        {playing && <span className="ambience-bars" aria-hidden="true"><i /><i /><i /></span>}
      </button>
      <button ref={settings} className="ambience-settings" type="button" aria-label="Atur musik dan volume" aria-expanded={open} aria-controls="ambience-settings" onClick={() => setOpen(value => !value)} title="Atur musik dan volume"><ChevronDown size={14} /></button>
    </div>
    {open && <div className="ambience-popover" id="ambience-settings" role="dialog" aria-label="Pengaturan musik">
      <div className="ambience-title"><Music2 size={17} /><strong>Suasana toko</strong><span>{playing ? 'Mengalun' : enabled ? 'Siap diputar' : 'Dijeda'}</span></div>
      <p>{track === 'cheerful' ? 'Melodi ceria, petikan ringan. Serasa membangun toko di cozy game.' : 'Piano hangat, gerimis pelan. Teman santai bikin toko kecilmu.'}</p>
      <label className="ambience-track-label" htmlFor="ambience-track">Pilihan musik</label>
      <select className="ambience-track" id="ambience-track" value={track} onChange={event => {
        const next = event.currentTarget.value as AmbienceTrack;
        currentTrack.current = next; setTrack(next); engine.current?.setTrack(next);
        if (wanted.current && !playing) void start(true);
      }}>
        <option value="cheerful">Ceria · Cozy game</option>
        <option value="calm">Santai · Piano & gerimis</option>
      </select>
      <label className="ambience-volume-label" htmlFor="ambience-volume"><span>Volume</span><output>{Math.round(volume * 100)}%</output></label>
      <div className="ambience-volume-row">{volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}<input ref={slider} id="ambience-volume" aria-label="Volume musik" aria-valuetext={`${Math.round(volume * 100)} persen`} type="range" min={0} max={100} step={1} value={Math.round(volume * 100)} onChange={event => {
        const next = Number(event.currentTarget.value) / 100;
        currentVolume.current = next; setVolume(next); engine.current?.setVolume(next);
      }} /></div>
      {error && <p className="ambience-error" role="status">{error}</p>}
    </div>}
  </div>;
}
