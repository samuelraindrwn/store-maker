import { describe, expect, it } from 'vitest';
import { canPlaceWallItem, createInitialShop, createWallItem, type WallItem } from '../model';
import { snapWallDragCandidate } from './interactionWalls';

const shop = createInitialShop();
const art = (patch: Partial<WallItem> = {}): WallItem => ({ ...createWallItem('painting'), id: 'dragged-art',
  partitionId: 'wc-front-wall', wall: 'back', line: 3, offset: 7.5, height: 1.5, ...patch });
const snap = (item: WallItem) => snapWallDragCandidate(shop, item, item.id);

describe('direct partition drag assists only nearby clear space on the same face', () => {
  it('keeps an already valid raw position and its normal commit rounding', () => {
    const candidate = art({ offset: 7.54163, height: 1.521 });
    expect(canPlaceWallItem(shop, candidate)).toBe(true);
    expect(snap(candidate)).toBe(candidate);
  });

  it('fits the real off-center grab beside the default bathroom doorway', () => {
    const candidate = art({ offset: 7.74163, height: 1.521 });
    expect(canPlaceWallItem(shop, candidate)).toBe(false);
    const fitted = snap(candidate);
    expect(fitted).toEqual({ ...candidate, offset: 7.5, height: 1.5 });
    expect(canPlaceWallItem(shop, fitted)).toBe(true);
  });

  it('corrects a position whose tenth-grid commit would collide with the door', () => {
    const candidate = art({ offset: 7.55 });
    expect(canPlaceWallItem(shop, candidate)).toBe(true);
    expect(snap(candidate)).toEqual({ ...candidate, offset: 7.5 });
  });

  it('accepts the exact assistance radius and rejects a farther correction', () => {
    expect(snap(art({ offset: 7.75 }))).toMatchObject({ offset: 7.5 });
    const tooFar = art({ offset: 7.7501 });
    expect(snap(tooFar)).toBe(tooFar);
  });

  it('does not shrink or relocate a full painting above the door or wall top', () => {
    for (const candidate of [art({ offset: 8.5, height: 2.5 }), art({ offset: 9.5, height: 2.8 })]) {
      expect(canPlaceWallItem(shop, candidate)).toBe(false);
      expect(snap(candidate)).toBe(candidate);
    }
    const resized = art({ offset: 8.5, height: 2.5, width: 0.6, sizeHeight: 0.4 });
    expect(canPlaceWallItem(shop, resized)).toBe(true);
    expect(snap(resized)).toBe(resized);
  });

  it('preserves the opposite partition face when finding a nearby position', () => {
    const candidate = art({ wall: 'front', offset: 9.74163, height: 1.521 });
    const fitted = snap(candidate);
    expect(fitted).toEqual({ ...candidate, offset: 9.5, height: 1.5 });
    expect(canPlaceWallItem(shop, fitted)).toBe(true);
  });

  it('does not change perimeter, exterior, or unsupported partition-window behavior', () => {
    const boundary = art({ line: 0, offset: -0.1 }); delete boundary.partitionId;
    const exterior = { ...boundary, mount: 'exterior' as const };
    const window = art({ kind: 'window', offset: 7.74163 });
    for (const candidate of [boundary, exterior, window]) expect(snap(candidate)).toBe(candidate);
  });

  it.each([Infinity, -Infinity, NaN, 1e30])('rejects unsafe drag coordinate %s without searching', coordinate => {
    const offset = art({ offset: coordinate }), height = art({ height: coordinate });
    expect(snap(offset)).toBe(offset);
    expect(snap(height)).toBe(height);
  });
});
