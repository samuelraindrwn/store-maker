import { describe, expect, it } from 'vitest';
import {
  CYCLE_EPOCH_KEY, formatGameClock, GAME_CYCLE_MS, GAME_PHASE_MS, getGameMinutes,
  isNightAtGameMinutes, LEGACY_NIGHT_MODE_KEY, nextTimeOfDayRefresh, readCycleEpoch,
  readTimeMode, resolveGameMinutes, TIME_MODE_KEY,
} from './useTimeOfDay';

const epoch = Date.UTC(2026, 9, 8, 12);
const storage = (values: Record<string, string> = {}) => ({
  getItem: (key: string) => values[key] ?? null,
});

describe('automatic game day and night', () => {
  it('starts at 06:00, independently of the device hour and time zone', () => {
    for (const start of [0, epoch, epoch + 37_123]) {
      expect(getGameMinutes(start, start)).toBe(360);
      expect(formatGameClock(getGameMinutes(start, start))).toBe('06:00');
      expect(isNightAtGameMinutes(getGameMinutes(start, start))).toBe(false);
    }
  });

  it('gives each day and each night twenty real minutes', () => {
    expect(GAME_PHASE_MS).toBe(20 * 60_000);
    expect(GAME_CYCLE_MS).toBe(40 * 60_000);
    expect(formatGameClock(getGameMinutes(epoch + 10 * 60_000, epoch))).toBe('12:00');
    expect(formatGameClock(getGameMinutes(epoch + 20 * 60_000, epoch))).toBe('18:00');
    expect(formatGameClock(getGameMinutes(epoch + 30 * 60_000, epoch))).toBe('00:00');
    expect(formatGameClock(getGameMinutes(epoch + 40 * 60_000, epoch))).toBe('06:00');
  });

  it.each([
    [0, false],
    [GAME_PHASE_MS - 1, false],
    [GAME_PHASE_MS, true],
    [GAME_CYCLE_MS - 1, true],
    [GAME_CYCLE_MS, false],
    [GAME_CYCLE_MS + GAME_PHASE_MS, true],
  ] as const)('switches light at elapsed %i ms to night=%s', (elapsed, night) => {
    expect(isNightAtGameMinutes(getGameMinutes(epoch + elapsed, epoch))).toBe(night);
  });

  it('catches up after reloads, background tabs and many elapsed cycles', () => {
    const now = epoch + GAME_CYCLE_MS * 10_000 + GAME_PHASE_MS + 5 * 60_000;
    const restoredEpoch = readCycleEpoch(now, storage({ [CYCLE_EPOCH_KEY]: String(epoch) }));
    expect(formatGameClock(getGameMinutes(now, restoredEpoch))).toBe('21:00');
    expect(isNightAtGameMinutes(getGameMinutes(now, restoredEpoch))).toBe(true);
  });

  it('uses noon and 22:00 for manual lighting without resetting the automatic cycle', () => {
    const now = epoch + 25 * 60_000;
    expect(resolveGameMinutes('day', now, epoch)).toBe(720);
    expect(isNightAtGameMinutes(resolveGameMinutes('day', now, epoch))).toBe(false);
    expect(resolveGameMinutes('night', now, epoch)).toBe(1320);
    expect(isNightAtGameMinutes(resolveGameMinutes('night', now, epoch))).toBe(true);
    expect(resolveGameMinutes('auto', now, epoch)).toBe(1260);
  });

  it('refreshes within a second and exactly at the twenty-minute boundary', () => {
    expect(nextTimeOfDayRefresh(epoch, epoch)).toBe(1000);
    expect(nextTimeOfDayRefresh(epoch + GAME_PHASE_MS - 725, epoch)).toBe(725);
    expect(nextTimeOfDayRefresh(epoch + GAME_PHASE_MS - 1, epoch)).toBe(1);
    expect(nextTimeOfDayRefresh(epoch + GAME_PHASE_MS, epoch)).toBe(1000);
    expect(nextTimeOfDayRefresh(epoch + GAME_CYCLE_MS - 725, epoch)).toBe(725);
  });

  it('does not run backwards when the device clock moves before the stored epoch', () => {
    expect(getGameMinutes(epoch - 5000, epoch)).toBe(360);
    expect(nextTimeOfDayRefresh(epoch - 5000, epoch)).toBe(1000);
  });

  it('formats game minutes with padded digits and wraps midnight without rounding early', () => {
    expect(formatGameClock(0)).toBe('00:00');
    expect(formatGameClock(365.99)).toBe('06:05');
    expect(formatGameClock(1439.99)).toBe('23:59');
    expect(formatGameClock(1440)).toBe('00:00');
  });
});

describe('saved game cycle', () => {
  it('starts a fresh cycle only if no usable epoch is stored', () => {
    expect(readCycleEpoch(epoch, storage())).toBe(epoch);
    for (const invalid of ['', ' ', 'not-a-date', 'Infinity', '-1', String(epoch + 1)]) {
      expect(readCycleEpoch(epoch, storage({ [CYCLE_EPOCH_KEY]: invalid }))).toBe(epoch);
    }
  });

  it('preserves existing epochs, including the start of Unix time', () => {
    expect(readCycleEpoch(epoch, storage({ [CYCLE_EPOCH_KEY]: String(epoch - 5000) }))).toBe(epoch - 5000);
    expect(readCycleEpoch(epoch, storage({ [CYCLE_EPOCH_KEY]: '0' }))).toBe(0);
  });

  it('falls back to a session cycle when storage is blocked', () => {
    expect(readCycleEpoch(epoch, { getItem() { throw new Error('Storage blocked'); } })).toBe(epoch);
  });
});

describe('saved lighting preference', () => {
  it('defaults new visitors to automatic lighting', () => {
    expect(readTimeMode(storage())).toBe('auto');
  });

  it.each(['auto', 'day', 'night'] as const)('restores the saved %s mode ahead of the legacy boolean', mode => {
    expect(readTimeMode(storage({ [TIME_MODE_KEY]: mode, [LEGACY_NIGHT_MODE_KEY]: 'true' }))).toBe(mode);
    expect(readTimeMode(storage({ [TIME_MODE_KEY]: mode, [LEGACY_NIGHT_MODE_KEY]: 'false' }))).toBe(mode);
  });

  it('migrates earlier manual day and night choices', () => {
    expect(readTimeMode(storage({ [LEGACY_NIGHT_MODE_KEY]: 'true' }))).toBe('night');
    expect(readTimeMode(storage({ [LEGACY_NIGHT_MODE_KEY]: 'false' }))).toBe('day');
  });

  it('recovers invalid saved data without interpreting arbitrary text as night', () => {
    expect(readTimeMode(storage({ [TIME_MODE_KEY]: 'invalid', [LEGACY_NIGHT_MODE_KEY]: 'invalid' }))).toBe('auto');
    expect(readTimeMode(storage({ [TIME_MODE_KEY]: 'invalid', [LEGACY_NIGHT_MODE_KEY]: 'true' }))).toBe('night');
  });

  it('works when browser storage is blocked', () => {
    expect(readTimeMode({ getItem() { throw new Error('Storage blocked'); } })).toBe('auto');
  });
});
