import { describe, expect, it } from 'vitest';
import {
  WALL_CATALOG, canPlaceWallItem, createEmptyShop, createInitialShop, createItem, createWallItem,
  findWallPlacement, getWallItems, getWallRuns, hasFloorCell, paintFloor, parseShop,
  placeItem, placeWallItem, removeWallItem, resizeShop, setWallHeight, updateWallItem, wallItemPosition,
  type ShopDocument, type WallItem, type WallItemKind,
} from './model';

const accessory = (kind: WallItemKind, patch: Partial<WallItem> = {}): WallItem => ({ ...createWallItem(kind), ...patch });
const strip = (): ShopDocument => ({ ...createEmptyShop(), floorCells: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }] });
const square = (): ShopDocument => ({ ...createEmptyShop(), floorCells: Array.from({ length: 9 }, (_, i) => ({ x: i % 3, z: Math.floor(i / 3) })) });
const legacy = (): ShopDocument => { const doc = createEmptyShop(); delete doc.wallItems; return doc; };
const expectValidAttachments = (doc: ShopDocument) => {
  for (const item of getWallItems(doc)) expect(canPlaceWallItem(doc, item, item.id)).toBe(true);
};

describe('wall catalog and geometry coordinates', () => {
  it('provides five distinct accessories with valid defaults and unique IDs', () => {
    expect(WALL_CATALOG.map(item => [item.kind, item.width, item.height])).toEqual([
      ['window', 2.2, 1.4], ['wall-lamp', 0.45, 0.7], ['wall-shelf', 1.5, 0.85], ['painting', 0.9, 1.1], ['wall-sign', 1.6, 0.55],
    ]);
    const items = WALL_CATALOG.flatMap(entry => [createWallItem(entry.kind), createWallItem(entry.kind)]);
    expect(new Set(items.map(item => item.id)).size).toBe(items.length);
    for (const item of items) expect(canPlaceWallItem(createEmptyShop(), item)).toBe(true);
  });

  it('merges all four boundary sides, including courtyard edges and negative cells', () => {
    expect(getWallRuns(createEmptyShop())).toEqual([
      { wall: 'back', line: 0, start: 0, end: 7 }, { wall: 'left', line: 0, start: 0, end: 6 },
      { wall: 'front', line: 6, start: 0, end: 7 }, { wall: 'right', line: 7, start: 0, end: 6 },
    ]);
    const hole = { ...square(), floorCells: square().floorCells!.filter(cell => !(cell.x === 1 && cell.z === 1)) };
    expect(getWallRuns(hole)).toEqual([
      { wall: 'back', line: 0, start: 0, end: 3 }, { wall: 'back', line: 2, start: 1, end: 2 },
      { wall: 'left', line: 0, start: 0, end: 3 }, { wall: 'left', line: 2, start: 1, end: 2 },
      { wall: 'front', line: 1, start: 1, end: 2 }, { wall: 'front', line: 3, start: 0, end: 3 },
      { wall: 'right', line: 1, start: 1, end: 2 }, { wall: 'right', line: 3, start: 0, end: 3 },
    ]);
    expect(getWallRuns({ ...createEmptyShop(), floorCells: [{ x: -2, z: -1 }, { x: -1, z: -1 }, { x: -2, z: 0 }] })).toEqual([
      { wall: 'back', line: -1, start: -2, end: 0 }, { wall: 'left', line: -2, start: -1, end: 1 },
      { wall: 'front', line: 0, start: -1, end: 0 }, { wall: 'front', line: 1, start: -2, end: -1 },
      { wall: 'right', line: -1, start: 0, end: 1 }, { wall: 'right', line: 0, start: -1, end: 0 },
    ]);
  });

  it('maps grid coordinates to inward-facing wall planes without shifting the room anchor', () => {
    const doc = createEmptyShop();
    const back = accessory('painting', { line: -1, offset: 2.3, height: 1.7 });
    expect(wallItemPosition(doc, back)).toEqual({ x: 2.3 - doc.width / 2, y: 1.7, z: -1 - doc.depth / 2 + 0.012, rotation: 0 });
    expect(wallItemPosition(doc, { ...back, wall: 'left' })).toEqual({ x: -1 - doc.width / 2 + 0.012, y: 1.7, z: 2.3 - doc.depth / 2, rotation: Math.PI / 2 });
  });
});

describe('wall placement and immutable edits', () => {
  it('requires continuous wall support, headroom, and valid values', () => {
    const doc = createEmptyShop();
    for (const patch of [{ offset: 0.5 }, { height: 0.5 }, { height: 2.5 }, { line: 2 }, { line: 0.1 }, { offset: NaN }]) {
      expect(canPlaceWallItem(doc, accessory('window', patch))).toBe(false);
    }
    const gaps = { ...doc, floorCells: [{ x: 0, z: 0 }, { x: 2, z: 0 }] };
    expect(canPlaceWallItem(gaps, accessory('window', { offset: 1.5 }))).toBe(false);
  });

  it('rejects same-face overlap while allowing separate heights, adjacent edges, and the other face', () => {
    const first = accessory('painting', { offset: 1, height: 1 });
    const doc = placeWallItem(createEmptyShop(), first);
    expect(canPlaceWallItem(doc, accessory('painting', { offset: 1.8, height: 1 }))).toBe(false);
    expect(canPlaceWallItem(doc, accessory('painting', { offset: 1.9, height: 1 }))).toBe(true);
    expect(canPlaceWallItem(doc, accessory('painting', { offset: 1, height: 2.1 }))).toBe(true);
    expect(canPlaceWallItem(doc, { ...first, id: 'other-wall', wall: 'left' })).toBe(true);
    expect(canPlaceWallItem(doc, first)).toBe(false);
    expect(canPlaceWallItem(doc, first, first.id)).toBe(true);
  });

  it('keeps live fractional positions and snaps only accepted commits', () => {
    const input = accessory('wall-lamp', { offset: 1.234, height: 1.256 });
    expect(canPlaceWallItem(createEmptyShop(), input)).toBe(true);
    const doc = placeWallItem(createEmptyShop(), input);
    expect(doc.wallItems![0]).toMatchObject({ offset: 1.2, height: 1.3 });
    expect(input).toMatchObject({ offset: 1.234, height: 1.256 });
    expect(updateWallItem(doc, input.id, { offset: 2.26, height: 1.84 }).wallItems![0]).toMatchObject({ offset: 2.3, height: 1.8 });
    expect(placeWallItem(doc, { ...input, id: 'bad', height: '1.5' } as unknown as WallItem)).toBe(doc);
  });

  it('updates text, color and lighting without mutating old state or changing identity', () => {
    const original = accessory('wall-lamp');
    const empty = createEmptyShop();
    const doc = placeWallItem(empty, original);
    const updated = updateWallItem(doc, original.id, { color: '#ABCDEF', text: 'Sudut hangat', lit: false });
    expect(empty.wallItems).toEqual([]);
    expect(doc.wallItems![0]).toEqual(original);
    expect(updated.wallItems![0]).toMatchObject({ id: original.id, color: '#ABCDEF', text: 'Sudut hangat', lit: false });
    expect(updated.wallItems![0]).not.toBe(doc.wallItems![0]);
    for (const patch of [{ id: 'replacement' }, { color: 'red' }, { text: 'x'.repeat(81) }, { text: 'bad\ntext' }, { height: '1.5' }, { extra: true }]) {
      expect(updateWallItem(doc, original.id, patch as Partial<WallItem>)).toBe(doc);
    }
    expect(removeWallItem(doc, 'missing')).toBe(doc);
    expect(removeWallItem(doc, original.id).wallItems).toEqual([]);
  });

  it('finds placement for copies while ignoring only the ID of the item being moved', () => {
    const original = accessory('window', { offset: 2, height: 1.5 });
    const doc = placeWallItem(createEmptyShop(), original);
    expect(findWallPlacement(doc, original)).toEqual(original);
    const copy = { ...original, id: 'window-copy' };
    const placed = findWallPlacement(doc, copy)!;
    expect(placed.id).toBe(copy.id);
    expect(canPlaceWallItem(doc, placed)).toBe(true);
    expect([placed.wall, placed.line, placed.offset, placed.height]).not.toEqual([original.wall, original.line, original.offset, original.height]);
  });

  it('tries the preferred face/run first and falls back when it cannot fit', () => {
    const item = accessory('window', { offset: 3 });
    expect(findWallPlacement(createEmptyShop(), item, { wall: 'left', line: 0 })?.wall).toBe('left');
    const placed = findWallPlacement(strip(), item, { wall: 'left', line: 0 })!;
    expect(placed.wall).toBe('front');
    expect(canPlaceWallItem(strip(), placed)).toBe(true);
    expect(findWallPlacement({ ...createEmptyShop(), floorCells: [{ x: 0, z: 0 }] }, item)).toBeNull();
  });

  it('keeps IDs unique across furniture and wall accessories', () => {
    const lamp = accessory('wall-lamp', { id: 'shared-id' });
    const furniture = { ...createItem('plant'), id: 'shared-id' };
    expect(placeWallItem(placeItem(createEmptyShop(), furniture), lamp).wallItems).toEqual([]);
    const doc = placeWallItem(createEmptyShop(), lamp);
    expect(placeItem(doc, furniture)).toBe(doc);
  });
});

describe('legacy decorations and safe persistence', () => {
  it('resolves stable detached legacy defaults without changing saved names or documents', () => {
    const doc = { ...legacy(), name: 'Nama toko yang sudah ada' };
    const first = getWallItems(doc);
    expect(first.map(item => item.id)).toEqual(['builtin-window', 'builtin-wall-sign']);
    expect(first.find(item => item.kind === 'wall-sign')!.text).toBe(doc.name);
    expect(getWallItems(doc)).toEqual(first);
    first[0].color = '#000000';
    expect(getWallItems(doc)[0].color).not.toBe('#000000');
    expect(doc.wallItems).toBeUndefined();
    expect(parseShop(doc)).toEqual(doc);
    expect(createEmptyShop().wallItems).toEqual([]);
    expect(createInitialShop().wallItems).toHaveLength(4);
  });

  it('synthesizes only legacy decorations that fit and persists an intentional removal', () => {
    const tiny = { ...legacy(), floorCells: [{ x: 0, z: 0 }] };
    expect(getWallItems(tiny)).toEqual([]);
    const doc = legacy();
    const removed = removeWallItem(doc, 'builtin-window');
    expect(removed.wallItems?.map(item => item.id)).toEqual(['builtin-wall-sign']);
    expect(getWallItems(parseShop(JSON.stringify(removed))!).map(item => item.id)).toEqual(['builtin-wall-sign']);
  });

  it('strictly validates wall arrays and returns detached imported accessories', () => {
    const first = accessory('wall-lamp');
    const doc = placeWallItem(createEmptyShop(), first);
    const imported = parseShop(JSON.stringify(doc))!;
    expect(imported).toEqual(doc);
    expect(imported.wallItems![0]).not.toBe(doc.wallItems![0]);
    for (const wallItems of [null, {}, new Array(61).fill(first), [first, { ...first, offset: 4 }], [{ ...first, line: 3 }], [{ ...first, unknown: true }]]) {
      expect(parseShop({ ...doc, wallItems })).toBeNull();
    }
    for (const patch of [{ kind: 'unknown' }, { wall: 'right' }, { line: 0.5 }, { offset: Infinity }, { height: NaN }, { text: 42 }, { lit: 'yes' }, { text: 'a\u0000b' }]) {
      expect(parseShop({ ...doc, wallItems: [{ ...first, ...patch }] })).toBeNull();
    }
    expect(parseShop({ ...doc, wallItems: [first, { ...first, id: 'overlap' }] })).toBeNull();
    expect(parseShop({ ...doc, items: [{ ...createItem('plant'), id: first.id }] })).toBeNull();
  });
});

describe('accessory preservation during room changes', () => {
  it('rehomes affected accessories while keeping valid ones exactly in place', () => {
    const window = accessory('window', { offset: 1.5, height: 1.5 });
    const fixed = accessory('wall-lamp', { wall: 'left', offset: 2.5, height: 2.4 });
    const doc = placeWallItem(placeWallItem(square(), window), fixed);
    const changed = paintFloor(doc, [{ x: 1, z: -1 }], 'add');
    expect(changed).not.toBe(doc);
    expect(changed.wallItems!.find(item => item.id === fixed.id)).toEqual(fixed);
    expect(changed.wallItems!.find(item => item.id === window.id)?.wall).toBe('left');
    expect(new Set(changed.wallItems!.map(item => item.id))).toEqual(new Set(doc.wallItems!.map(item => item.id)));
    expectValidAttachments(changed);
    expect(doc.wallItems).toEqual([window, fixed]);
  });

  it('rejects only impossible floor cells and continues the rest of a stroke without deleting accessories', () => {
    const window = accessory('window', { offset: 1.5 });
    const front = accessory('window', { wall: 'front', line: 1, offset: 1.5 });
    const doc = placeWallItem(placeWallItem(strip(), window), front);
    const changed = paintFloor(doc, [{ x: 1, z: -1 }, { x: 3, z: 0 }], 'add');
    expect(hasFloorCell(changed, 1, -1)).toBe(false);
    expect(hasFloorCell(changed, 3, 0)).toBe(true);
    expect(changed.wallItems).toEqual([window, front]);
    expect(paintFloor(doc, [{ x: 1, z: 0 }], 'erase')).toBe(doc);
    expectValidAttachments(changed);
  });

  it('lowers affected accessories with the wall and preserves valid lower decorations', () => {
    const high = accessory('wall-sign', { offset: 2, height: 4 });
    const low = accessory('painting', { offset: 2, height: 1 });
    const doc = placeWallItem(placeWallItem({ ...createEmptyShop(), wallHeight: 4.5 }, high), low);
    const changed = setWallHeight(doc, 2.3);
    expect(changed.wallHeight).toBe(2.3);
    expect(changed.wallItems!.find(item => item.id === low.id)).toEqual(low);
    expect(changed.wallItems!.find(item => item.id === high.id)!.height).toBeLessThan(high.height);
    expectValidAttachments(changed);
  });

  it('rejects a lower wall if every existing accessory cannot be preserved', () => {
    let doc: ShopDocument = { ...createEmptyShop(), wallHeight: 4.5, floorCells: [{ x: 0, z: 0 }] };
    for (const wall of ['back', 'left', 'front', 'right'] as const) for (const height of [0.6, 1.7, 2.8, 3.9]) {
      doc = placeWallItem(doc, accessory('painting', { wall, line: wall === 'front' || wall === 'right' ? 1 : 0, offset: 0.5, height }));
    }
    expect(doc.wallItems).toHaveLength(16);
    expect(setWallHeight(doc, 2.3)).toBe(doc);
  });

  it('reconciles rectangle resizing and materializes legacy defaults on the first room edit', () => {
    const sign = accessory('wall-sign', { offset: 6, height: 2 });
    const doc = placeWallItem(createEmptyShop(), sign);
    const resized = resizeShop(doc, 4, 6)!;
    expect(resized.wallItems![0].id).toBe(sign.id);
    expect(resized.wallItems![0].offset).toBeLessThan(sign.offset);
    expectValidAttachments(resized);
    const old = legacy();
    const edited = paintFloor(old, [{ x: 7, z: 0 }], 'add');
    expect(edited.wallItems?.map(item => item.id)).toEqual(getWallItems(old).map(item => item.id));
    expect(old.wallItems).toBeUndefined();
    expect(paintFloor(createEmptyShop(), [{ x: 7, z: 0 }], 'add').wallItems).toEqual([]);
  });
});
