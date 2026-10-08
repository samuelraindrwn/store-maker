import { describe, expect, it } from 'vitest';
import {
  canPlace, canPlaceRooftop, createEmptyShop, createInitialShop, createItem, getLevelDocument, getRoof,
  getRooftopDocument, parseShop, placeItem, setLevelCount, setRoof, updateItem,
} from './model';

describe('rooftop access choices and lifecycle', () => {
  it('defaults legacy stairs to open and persists an enclosed roof entrance', () => {
    const legacy = createInitialShop();
    expect(getRoof(legacy).stairAccess).toBe('open');
    const enclosed = setRoof(legacy, { style: 'rooftop', stairAccess: 'enclosed' });
    expect(getRoof(enclosed).stairAccess).toBe('enclosed');
    expect(parseShop(JSON.stringify(enclosed))).toEqual(enclosed);
    expect(setRoof(enclosed, { stairAccess: 'enclosed' })).toBe(enclosed);
    expect(parseShop({ ...enclosed, roof: { ...enclosed.roof, stairAccess: 'invalid' } })).toBeNull();
  });

  it('removes only auto-added top access on tiled roofs and retains outdoor furniture for later', () => {
    const outdoor = setRoof(createInitialShop(), { style: 'rooftop' });
    expect(getLevelDocument(outdoor, 1).items.find(item => item.kind === 'stairs')!.roofAccess).toBe(true);
    const tiled = setRoof(outdoor, { style: 'tiles' });
    expect(tiled.items).toEqual(outdoor.items);
    expect(tiled.items.some(item => item.kind === 'stairs')).toBe(true);
    expect(getLevelDocument(tiled, 1).items.some(item => item.kind === 'stairs')).toBe(false);
    expect(tiled.rooftop).toBe(outdoor.rooftop);
    expect(getLevelDocument(setRoof(tiled, { style: 'rooftop' }), 1).items.some(item => item.roofAccess)).toBe(true);
    expect(parseShop(tiled)).toEqual(tiled);
  });

  it('preserves manual stairs and generated flights that now connect interior levels', () => {
    const manual = { ...createItem('stairs'), x: 2, z: 2 };
    const doc = setRoof({ ...createEmptyShop(), items: [manual] }, { style: 'rooftop' });
    const tiled = setRoof(doc, { style: 'tiles' });
    expect(tiled.items).toEqual([manual]);
    const expanded = setLevelCount(setRoof(createInitialShop(), { style: 'rooftop' }), 4);
    const fourTiled = setRoof(expanded, { style: 'tiles' });
    for (let level = 0; level < 3; level++) expect(getLevelDocument(fourTiled, level).items.some(item => item.kind === 'stairs')).toBe(true);
    expect(getLevelDocument(fourTiled, 3).items.some(item => item.roofAccess)).toBe(false);
  });

  it('accepts the access marker only on stairs', () => {
    expect(parseShop({ ...createEmptyShop(), items: [{ ...createItem('plant'), roofAccess: true }] })).toBeNull();
    expect(parseShop({ ...createEmptyShop(), items: [{ ...createItem('stairs'), roofAccess: 'true' }] })).toBeNull();
  });
});

describe('resizable outdoor covers', () => {
  it.each(['canopy', 'patio-umbrella'] as const)('%s shelters furniture but rejects another cover and the stair approach', kind => {
    const table = { ...createItem('dining-table'), x: 4, z: 4 };
    const cover = { ...createItem(kind), x: 3, z: 3, width: 4, depth: 4 };
    const room = { ...createEmptyShop(), width: 10, depth: 10, items: [table] };
    expect(canPlace(room, cover)).toBe(true);
    const covered = placeItem(room, cover);
    expect(canPlace({ ...room, items: [cover] }, table)).toBe(true);
    expect(canPlace(covered, { ...createItem('canopy'), x: 4, z: 4 })).toBe(false);
    const resized = updateItem(covered, cover.id, { width: 5, depth: 3, rotation: 90 });
    expect(parseShop(resized)).toEqual(resized);
    expect(resized.items.find(item => item.id === cover.id)).toMatchObject({ width: 5, depth: 3, rotation: 90 });
    const building = setRoof(createInitialShop(), { style: 'rooftop' });
    const stairs = getLevelDocument(building, 1).items.find(item => item.kind === 'stairs')!;
    expect(canPlaceRooftop(building, { ...cover, x: stairs.x, z: stairs.z })).toBe(false);
    const roof = getRooftopDocument(building);
    expect(canPlace(roof, { ...cover, x: 5, z: 4 })).toBe(true);
  });
});
