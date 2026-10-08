import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Clock3, Moon, Sun } from 'lucide-react';
import './TimeOfDayControl.css';

type TimeMode = 'auto' | 'day' | 'night';

interface TimeOfDayControlProps {
  mode: TimeMode;
  nightMode: boolean;
  clockLabel: string;
  onModeChange: (mode: TimeMode) => void;
}

const OPTIONS = [
  { mode: 'auto', label: 'Waktu otomatis', icon: Clock3 },
  { mode: 'day', label: 'Selalu siang', icon: Sun },
  { mode: 'night', label: 'Selalu malam', icon: Moon },
] as const;

export default function TimeOfDayControl({ mode, nightMode, clockLabel, onModeChange }: TimeOfDayControlProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const currentLabel = nightMode ? 'malam' : 'siang';
  const oppositeLabel = nightMode ? 'siang' : 'malam';

  useEffect(() => {
    if (!open) return;
    popover.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);

  const chooseMode = (next: TimeMode) => {
    onModeChange(next);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };

  return <div ref={root} className="time-of-day-control" onBlur={event => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button className={`icon-button night-mode-toggle ${nightMode ? 'active' : ''}`} aria-label="Mode malam" aria-pressed={nightMode} onClick={() => { onModeChange(nightMode ? 'day' : 'night'); setOpen(false); }} title={`${mode === 'auto' ? 'Waktu otomatis' : 'Mode manual'} · sekarang ${currentLabel} · klik untuk ${oppositeLabel}`}>
      {nightMode ? <Moon size={17} /> : <Sun size={17} />}
      {mode === 'auto' && <span className="time-auto-indicator" aria-hidden="true">A</span>}
    </button>
    <button ref={trigger} className={`icon-button time-mode-trigger ${open ? 'active' : ''}`} aria-label="Atur siang dan malam" aria-description={`Jam toko ${clockLabel}`} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? popoverId : undefined} title={`Jam toko ${clockLabel} · atur siang dan malam`} onClick={() => setOpen(value => !value)}><time className="time-game-clock" data-testid="game-clock" dateTime={clockLabel}>{clockLabel}</time><ChevronDown size={11} /></button>
    {open && <div ref={popover} id={popoverId} className="time-mode-popover" role="dialog" aria-label="Waktu toko">
      <div className="time-mode-heading"><Clock3 size={15} /><strong>Siang & malam</strong><span>Sekarang {currentLabel}</span></div>
      <p>Siang 20 menit, lalu malam 20 menit. Jam toko berputar otomatis.</p>
      <div className="time-mode-options" role="group" aria-label="Pilihan waktu toko">
        {OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => <button key={optionMode} aria-label={label} aria-pressed={mode === optionMode} onClick={() => chooseMode(optionMode)}><Icon size={16} /><span>{label}</span>{mode === optionMode && <Check size={14} />}</button>)}
      </div>
    </div>}
  </div>;
}
