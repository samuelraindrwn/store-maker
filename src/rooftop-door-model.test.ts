import { describe, expect, it } from 'vitest';
import {
  createEmptyShop, createItem, getRoof, getRooftopDoorIds, getRooftopDoorOpen, parseShop, setRoof, setRooftopDoorOpen,
  type RoofDesign, type ShopDocument,
} from './model';

function fixture(): ShopDocument {
  return {
    ...createEmptyShop(), width: 10, depth: 10,
    items: [
      { ...createItem('stairs'), id: 'west-stairs', x: 2, z: 2 },
      { ...createItem('stairs'), id: 'east-stairs', x: 6, z: 2 },
      { ...createItem('plant'), id: 'plant', x: 8, z: 8 },
    ],
    roof: { style: 'rooftop', color: '#C69A74', garden: false, stairAccess: 'enclosed' },
  };
}

describe('independent rooftop access doors', () => {
  it('defaults legacy doors to closed without changing the saved design', () => {
    const legacy = fixture(), saved = JSON.stringify(legacy);
    expect(getRooftopDoorOpen(legacy, 'west-stairs')).toBe(false);
    expect(getRooftopDoorOpen(legacy, 'east-stairs')).toBe(false);
    expect(getRoof(legacy).stairDoors).toBeUndefined();
    expect(setRooftopDoorOpen(legacy, 'west-stairs', false)).toBe(legacy);
    expect(JSON.stringify(legacy)).toBe(saved);
    expect(parseShop(legacy)).toEqual(legacy);
  });

  it('opens and closes one door, preserving other doors, stairs and the downstairs entrance', () => {
    const original = fixture();
    const westOpen = setRooftopDoorOpen(original, 'west-stairs', true);
    expect(westOpen).not.toBe(original);
    expect(getRooftopDoorOpen(westOpen, 'west-stairs')).toBe(true);
    expect(getRooftopDoorOpen(westOpen, 'east-stairs')).toBe(false);
    expect(westOpen.items).toBe(original.items);
    expect(westOpen.entrance).toBe(original.entrance);
    expect(setRooftopDoorOpen(westOpen, 'west-stairs', true)).toBe(westOpen);
    const bothOpen = setRooftopDoorOpen(westOpen, 'east-stairs', true);
    const westClosed = setRooftopDoorOpen(bothOpen, 'west-stairs', false);
    expect(getRooftopDoorOpen(westClosed, 'west-stairs')).toBe(false);
    expect(getRooftopDoorOpen(westClosed, 'east-stairs')).toBe(true);
    expect(westOpen.roof!.stairDoors).toEqual({ 'west-stairs': true });
    expect(parseShop(JSON.stringify(westClosed))).toEqual(westClosed);
  });

  it('changes only door state when a legacy rooftop has no saved furniture', () => {
    const legacy = fixture();
    expect(legacy.rooftop).toBeUndefined();
    const opened = setRooftopDoorOpen(legacy, 'west-stairs', true);
    expect(opened.rooftop).toBeUndefined();
    expect(opened).toEqual({ ...legacy, roof: { ...legacy.roof, stairDoors: { 'west-stairs': true } } });
    const closed = setRooftopDoorOpen(opened, 'west-stairs', false);
    expect(closed.rooftop).toBeUndefined();
    expect(closed).toEqual({ ...legacy, roof: { ...legacy.roof, stairDoors: {} } });
  });

  it('accepts only existing top-floor stair houses for interactive changes', () => {
    const doc = fixture();
    for (const id of ['missing', 'plant']) expect(setRooftopDoorOpen(doc, id, true)).toBe(doc);
    expect(setRooftopDoorOpen(doc, 'west-stairs', 'true' as unknown as boolean)).toBe(doc);
    const tiled = { ...doc, roof: { ...doc.roof!, style: 'tiles' as const } };
    const openStairwell = { ...doc, roof: { ...doc.roof!, stairAccess: 'open' as const } };
    expect(setRooftopDoorOpen(tiled, 'west-stairs', true)).toBe(tiled);
    expect(setRooftopDoorOpen(openStairwell, 'west-stairs', true)).toBe(openStairwell);
    const upstairs = { ...doc, upperFloors: [{ ...createEmptyShop(), items: [{ ...createItem('stairs'), id: 'upper-stairs', x: 1, z: 1 }] }] };
    expect(setRooftopDoorOpen(upstairs, 'west-stairs', true)).toBe(upstairs);
    expect(getRooftopDoorOpen(setRooftopDoorOpen(upstairs, 'upper-stairs', true), 'upper-stairs')).toBe(true);
  });

  it('lists only enclosed rooftop doors whose stair openings intersect the deck', () => {
    const doc = fixture();
    expect(getRooftopDoorIds(doc)).toEqual(['west-stairs', 'east-stairs']);
    expect(getRooftopDoorIds({ ...doc, roof: { ...doc.roof!, stairAccess: 'open' } })).toEqual([]);
    expect(getRooftopDoorIds({ ...doc, roof: { ...doc.roof!, style: 'tiles' } })).toEqual([]);
    const emptyDeck = { ...doc, floorCells: [] };
    expect(getRooftopDoorIds(emptyDeck)).toEqual([]);
    expect(setRooftopDoorOpen(emptyDeck, 'west-stairs', true)).toBe(emptyDeck);
    const offDeck = { ...doc, floorCells: [{ x: 8, z: 8 }] };
    expect(getRooftopDoorIds(offDeck)).toEqual([]);
    expect(setRooftopDoorOpen(offDeck, 'west-stairs', true)).toBe(offDeck);
  });

  it('detaches imported and supplied door records from their source objects', () => {
    const source = fixture(), states = { 'west-stairs': true, 'east-stairs': false };
    const configured = setRoof(source, { stairDoors: states });
    expect(configured.roof!.stairDoors).toEqual(states);
    expect(setRoof(configured, { stairDoors: { 'east-stairs': false, 'west-stairs': true } })).toBe(configured);
    states['west-stairs'] = false;
    expect(getRooftopDoorOpen(configured, 'west-stairs')).toBe(true);
    const parsed = parseShop(configured)!;
    expect(parsed).toEqual(configured);
    parsed.roof!.stairDoors!['west-stairs'] = false;
    expect(getRooftopDoorOpen(configured, 'west-stairs')).toBe(true);
  });

  it('retains dormant states through roof changes and prunes removed stairs on the next door edit', () => {
    const opened = setRooftopDoorOpen(fixture(), 'west-stairs', true);
    const openAccess = setRoof(opened, { stairAccess: 'open' });
    expect(setRoof(openAccess, { stairAccess: 'enclosed' }).roof!.stairDoors).toEqual(opened.roof!.stairDoors);
    const removed = { ...opened, items: opened.items.filter(item => item.id !== 'west-stairs') };
    expect(parseShop(removed)).toEqual(removed);
    expect(setRooftopDoorOpen(removed, 'west-stairs', false)).toBe(removed);
    expect(setRooftopDoorOpen(removed, 'east-stairs', true).roof!.stairDoors).toEqual({ 'east-stairs': true });
  });

  it.each([null, [], true, 'open', { 'west-stairs': 'true' }, { 'west-stairs': 1 }, { 'invalid id': true }, { '': false },
    { ['a'.repeat(65)]: true }, Object.fromEntries(Array.from({ length: 201 }, (_, index) => [`stair-${index}`, false])),
    { [Symbol('door')]: true }, JSON.parse('{"__proto__":true}'),
  ])('rejects malformed door state %j', states => {
    const doc = fixture();
    expect(parseShop({ ...doc, roof: { ...doc.roof, stairDoors: states } })).toBeNull();
    expect(setRoof(doc, { stairDoors: states } as unknown as Partial<RoofDesign>)).toBe(doc);
  });
});
