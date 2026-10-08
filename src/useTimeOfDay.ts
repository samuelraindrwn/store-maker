import { useCallback, useEffect, useState } from 'react';

export type TimeMode = 'auto' | 'day' | 'night';

export const TIME_MODE_KEY = 'nemu.store-maker.time-mode';
export const LEGACY_NIGHT_MODE_KEY = 'nemu.store-maker.night-mode';
export const CYCLE_EPOCH_KEY = 'nemu.store-maker.day-night-epoch';
export const GAME_PHASE_MS = 20 * 60_000;
export const GAME_CYCLE_MS = GAME_PHASE_MS * 2;

type StorageReader = Pick<Storage, 'getItem'>;

/** A new cycle starts at 06:00 and completes one game day in forty real minutes. */
export function getGameMinutes(now: number, epoch: number): number {
  const elapsed = Math.max(0, now - epoch) % GAME_CYCLE_MS;
  return (360 + elapsed / GAME_CYCLE_MS * 1440) % 1440;
}

export function isNightAtGameMinutes(gameMinutes: number): boolean {
  return gameMinutes < 360 || gameMinutes >= 1080;
}

export function resolveGameMinutes(mode: TimeMode, now: number, epoch: number): number {
  if (mode === 'day') return 720;
  if (mode === 'night') return 1320;
  return getGameMinutes(now, epoch);
}

export function formatGameClock(gameMinutes: number): string {
  const minute = Math.floor(((gameMinutes % 1440) + 1440) % 1440);
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

/** Refresh the clock each second and land exactly on the next lighting boundary. */
export function nextTimeOfDayRefresh(now: number, epoch: number): number {
  const phaseElapsed = Math.max(0, now - epoch) % GAME_PHASE_MS;
  return Math.max(1, Math.min(1000, Math.ceil(GAME_PHASE_MS - phaseElapsed)));
}

export function readCycleEpoch(now: number, storage?: StorageReader): number {
  try {
    const saved = (storage ?? localStorage).getItem(CYCLE_EPOCH_KEY);
    const epoch = saved !== null && saved.trim() !== '' ? Number(saved) : NaN;
    if (Number.isFinite(epoch) && epoch >= 0 && epoch <= now) return epoch;
  } catch { /* A session-only game clock still works without browser storage. */ }
  return now;
}

export function readTimeMode(storage?: StorageReader): TimeMode {
  try {
    const source = storage ?? localStorage;
    const saved = source.getItem(TIME_MODE_KEY);
    if (saved === 'auto' || saved === 'day' || saved === 'night') return saved;
    // Keep the manual preference of designs opened before automatic lighting.
    const legacy = source.getItem(LEGACY_NIGHT_MODE_KEY);
    if (legacy === 'true') return 'night';
    if (legacy === 'false') return 'day';
  } catch { /* Automatic lighting still works when browser storage is unavailable. */ }
  return 'auto';
}

export function useTimeOfDay() {
  const [mode, updateMode] = useState<TimeMode>(() => readTimeMode());
  const [epoch] = useState(() => readCycleEpoch(Date.now()));
  const [automaticMinutes, setAutomaticMinutes] = useState(() => Math.floor(getGameMinutes(Date.now(), epoch)));
  const gameMinutes = mode === 'auto' ? automaticMinutes : resolveGameMinutes(mode, 0, 0);
  const nightMode = isNightAtGameMinutes(gameMinutes);
  const clockLabel = formatGameClock(gameMinutes);

  const setMode = useCallback((next: TimeMode) => {
    if (next === 'auto') setAutomaticMinutes(Math.floor(getGameMinutes(Date.now(), epoch)));
    updateMode(next);
  }, [epoch]);

  useEffect(() => {
    try { localStorage.setItem(CYCLE_EPOCH_KEY, String(epoch)); }
    catch { /* Keep the same cycle for the remainder of this session. */ }
  }, [epoch]);

  useEffect(() => {
    try {
      localStorage.setItem(TIME_MODE_KEY, mode);
      localStorage.setItem(LEGACY_NIGHT_MODE_KEY, String(nightMode));
    } catch { /* The selected mode remains available for this session. */ }
  }, [mode, nightMode]);

  useEffect(() => {
    if (mode !== 'auto') return;
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      const now = Date.now();
      setAutomaticMinutes(Math.floor(getGameMinutes(now, epoch)));
      if (!document.hidden) timer = window.setTimeout(refresh, nextTimeOfDayRefresh(now, epoch));
    };
    const onVisibilityChange = () => {
      if (document.hidden) window.clearTimeout(timer);
      else refresh();
    };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [mode, epoch]);

  return { mode, nightMode, setMode, gameMinutes, clockLabel };
}
