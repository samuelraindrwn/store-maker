import { describe, expect, it } from 'vitest';
import {
  PARTITION_WALL_MOUNT_OFFSET, canPlaceInteriorDoor, canPlacePartition, canPlaceWallItem, createEmptyShop,
  createItem, createWallItem, findWallPlacement, getWallMountRuns, getWallRuns, paintFloor, parseShop,
  placeInteriorDoor, placePartition, placeWallItem, removePartition, resizeShop, setWallHeight,
  updateInteriorDoor, updatePartition, updateWallItem, wallItemPosition,
  type InteriorDoor, type PartitionWall, type ShopDocument, type WallItem, type WallSide,
} from './model';

const partition = (patch: Partial<PartitionWall> = {}): PartitionWall => ({ id: 'divider', axis: 'x', line: 4, start: 1, end: 7, color: '#DFE4D7', ...patch });
const fixture = (patch: Partial<PartitionWall> = {}): ShopDocument => placePartition({ ...createEmptyShop(), width: 8, depth: 8, wallHeight: 3 }, partition(patch));
const art = (patch: Partial<WallItem> = {}): WallItem => ({ ...createWallItem('painting'), id: 'painting-a', partitionId: 'divider', wall: 'back', line: 4, offset: 2, height: 1.5, ...patch });
const door = (patch: Partial<InteriorDoor> = {}): InteriorDoor => ({ id: 'door-a', wallId: 'divider', offset: 4, width: 1, color: '#AC89B6', open: false, ...patch });
const faces = [
  ['x', 'back', 1, 0], ['x', 'front', -1, Math.PI],
  ['z', 'left', 1, Math.PI / 2], ['z', 'right', -1, -Math.PI / 2],
] as const;

describe('decor on both authored partition faces', () => {
  it('keeps structural perimeter runs unchanged and exposes only eligible partition mounts', () => {
    const shop = fixture(), outer = getWallRuns(shop);
    expect(outer).toEqual(getWallRuns({ ...shop, partitions: [] }));
    expect(getWallMountRuns(shop)).toEqual([...outer,
      { partitionId: 'divider', wall: 'back', line: 4, start: 1, end: 7 },
      { partitionId: 'divider', wall: 'front', line: 4, start: 1, end: 7 },
    ]);
    expect(getWallMountRuns(shop, { kind: 'window' })).toEqual(outer);
    expect(getWallMountRuns(shop, { kind: 'wall-sign', mount: 'exterior' })).toEqual(outer);
  });

  it.each(faces)('mounts decor outside the %s/%s wall face, facing its room', (axis, wall, direction, rotation) => {
    const shop = fixture({ axis });
    for (const kind of ['painting', 'wall-lamp', 'wall-shelf', 'wall-sign', 'wall-clock'] as const) {
      const item = { ...createWallItem(kind), partitionId: 'divider', wall, line: 4, offset: 3, height: 1.5 };
      expect(canPlaceWallItem(shop, item)).toBe(true);
      const placed = placeWallItem(shop, item), pose = wallItemPosition(placed, item);
      expect(pose.rotation).toBe(rotation);
      expect(axis === 'x' ? pose.z : pose.x).toBeCloseTo(direction * PARTITION_WALL_MOUNT_OFFSET);
      expect(axis === 'x' ? pose.x : pose.z).toBe(-1);
      expect(pose.y).toBe(1.5);
      expect(parseShop(JSON.stringify(placed))).toEqual(placed);
    }
  });

  it('blocks overlaps on one face while allowing matching decorations on the opposite face', () => {
    const front = art({ id: 'front', wall: 'front' }), back = art();
    const first = placeWallItem(fixture(), back), both = placeWallItem(first, front);
    expect(both.wallItems).toHaveLength(2);
    expect(canPlaceWallItem(both, art({ id: 'overlap', offset: 2.1 }))).toBe(false);
    expect(canPlaceWallItem(both, art({ id: 'touching', offset: 2.9 }))).toBe(true);
    expect(canPlaceWallItem(both, back, back.id)).toBe(true);
    expect(parseShop(both)).toEqual(both);
  });

  it('requires a real matching host, correct axis, continuous span and valid mount', () => {
    const shop = fixture();
    for (const patch of [
      { partitionId: 'missing' }, { wall: 'left' as WallSide }, { line: 3 }, { offset: 1.2 }, { offset: 7 },
      { height: 0.3 }, { height: 2.7 }, { mount: 'exterior' as const }, { kind: 'window' as const },
    ]) expect(canPlaceWallItem(shop, art(patch))).toBe(false);
    const unbound = art(); delete unbound.partitionId;
    expect(canPlaceWallItem(shop, unbound)).toBe(false);
  });
});

describe('partition door apertures and attachment lifecycle', () => {
  it.each(['back', 'front'] as const)('keeps the %s doorway clear for open and closed door leaves', wall => {
    for (const open of [false, true]) {
      const shop = placeInteriorDoor(fixture(), door({ open }));
      expect(canPlaceWallItem(shop, art({ wall, offset: 4 }))).toBe(false);
      expect(canPlaceWallItem(shop, art({ wall, offset: 3.05 }))).toBe(true);
      expect(canPlaceWallItem(shop, art({ wall, offset: 4, height: 2.6, width: 0.7, sizeHeight: 0.4 }))).toBe(true);
      const proposed = findWallPlacement(shop, art({ wall, offset: 4 }), { partitionId: 'divider', wall, line: 4 });
      expect(proposed?.partitionId).toBe('divider');
      expect(proposed && canPlaceWallItem(shop, proposed)).toBe(true);
    }
  });

  it('checks existing decor on either face before adding, moving or widening a door', () => {
    for (const wall of ['back', 'front'] as const) {
      const decorated = placeWallItem(fixture(), art({ wall, offset: 4 }));
      expect(canPlaceInteriorDoor(decorated, door())).toBe(false);
      expect(placeInteriorDoor(decorated, door())).toBe(decorated);
      const shop = placeInteriorDoor(decorated, door({ offset: 2.5 }));
      expect(shop.interiorDoors).toHaveLength(1);
      expect(updateInteriorDoor(shop, 'door-a', { offset: 3.2 })).toBe(shop);
      expect(updateInteriorDoor(shop, 'door-a', { width: 2.2 })).toBe(shop);
      expect(updateInteriorDoor(shop, 'door-a', { open: true }).interiorDoors![0].open).toBe(true);
    }
  });

  it('moves and rotates each attached face with its wall without mutating saved snapshots', () => {
    const original = placeWallItem(placeWallItem(fixture(), art()), art({ id: 'reverse', wall: 'front' }));
    const shifted = updatePartition(original, 'divider', { line: 5, start: 2, end: 8 });
    expect(shifted.wallItems).toEqual(original.wallItems!.map(item => ({ ...item, line: 5, offset: 3 })));
    expect(original.wallItems![0]).toMatchObject({ line: 4, offset: 2, wall: 'back' });
    const rotated = updatePartition(shifted, 'divider', { axis: 'z' });
    expect(rotated.wallItems!.map(item => item.wall)).toEqual(['left', 'right']);
    expect(rotated.wallItems!.every(item => canPlaceWallItem(rotated, item, item.id))).toBe(true);
    expect(parseShop(rotated)).toEqual(rotated);
    expect(updatePartition(rotated, 'divider', { axis: 'z' })).toBe(rotated);
    expect(updatePartition(rotated, 'divider', { end: 3 })).toBe(rotated);
    expect(canPlacePartition(rotated, { ...rotated.partitions![0], end: 3 }, 'divider')).toBe(false);
  });

  it('rejects carrying a decoration across an existing door opening', () => {
    const shop = placeInteriorDoor(placeWallItem(fixture(), art({ offset: 2.5 })), door());
    expect(updatePartition(shop, 'divider', { start: 2, end: 8 })).toBe(shop);
  });

  it('removes the wall, its door and both faces of decor together, retaining unrelated art', () => {
    const first = placeWallItem(placeWallItem(fixture(), art()), art({ id: 'reverse', wall: 'front' }));
    const second = placePartition(first, partition({ id: 'other-divider', line: 6 }));
    const outer = { ...createWallItem('painting'), id: 'outer-art', offset: 6, height: 1.5 };
    const shop = placeWallItem(placeWallItem(placeInteriorDoor(second, door()), art({ id: 'other-art', partitionId: 'other-divider', line: 6 })), outer);
    const removed = removePartition(shop, 'divider');
    expect(removed.wallItems!.map(item => item.id)).toEqual(['other-art', 'outer-art']);
    expect(removed.interiorDoors).toEqual([]);
    expect(removed.partitions!.map(wall => wall.id)).toEqual(['other-divider']);
    expect(shop.wallItems).toHaveLength(4);
    expect(parseShop(removed)).toEqual(removed);
  });

  it('keeps art on its host during floor and height reconciliation, rejecting an impossible height', () => {
    const shop = placeWallItem(fixture(), art({ height: 2.4 }));
    const lowered = setWallHeight(shop, 2.3);
    expect(lowered).not.toBe(shop);
    expect(lowered.wallItems![0].partitionId).toBe('divider');
    expect(lowered.wallItems![0].height).toBeLessThan(2.4);
    expect(canPlaceWallItem(lowered, lowered.wallItems![0], 'painting-a')).toBe(true);
    expect(resizeShop(lowered, 9, 9)?.wallItems).toEqual(lowered.wallItems);
    const painted = paintFloor(lowered, [{ x: 7, z: 7 }], 'erase');
    expect(painted.wallItems).toEqual(lowered.wallItems);
    const tall = placeWallItem(fixture(), art({ height: 1.5, sizeHeight: 2.8 }));
    expect(setWallHeight(tall, 2.3)).toBe(tall);
  });
});

describe('partition mount edits and import validation', () => {
  it('can move decor between partition faces and the perimeter, explicitly clearing the host', () => {
    const original = placeWallItem(fixture(), art());
    const opposite = updateWallItem(original, 'painting-a', { wall: 'front' });
    expect(opposite.wallItems![0]).toMatchObject({ wall: 'front', partitionId: 'divider' });
    const candidate = findWallPlacement(opposite, opposite.wallItems![0], { partitionId: undefined, wall: 'back', line: 0 });
    expect(candidate?.partitionId).toBeUndefined();
    const boundary = updateWallItem(opposite, 'painting-a', { ...candidate!, partitionId: undefined });
    expect(boundary.wallItems![0]).not.toHaveProperty('partitionId');
    expect(canPlaceWallItem(boundary, boundary.wallItems![0], 'painting-a')).toBe(true);
    expect(updateWallItem(boundary, 'painting-a', { partitionId: undefined })).toBe(boundary);
    const back = updateWallItem(boundary, 'painting-a', { partitionId: 'divider', wall: 'back', line: 4, offset: 2 });
    expect(back.wallItems![0]).toEqual(original.wallItems![0]);
  });

  it('persists detached partition references independently on every floor, preserving legacy documents', () => {
    const lower = placeWallItem(fixture(), art()), upper = placeWallItem(fixture({ axis: 'z' }), art({ wall: 'right' }));
    const building = { ...lower, upperFloors: [upper] };
    const parsed = parseShop(JSON.stringify(building))!;
    expect(parsed).toEqual(building);
    parsed.upperFloors![0].wallItems![0].color = '#000000';
    expect(upper.wallItems![0].color).not.toBe('#000000');
    expect(lower.wallItems![0].wall).toBe('back');
    const legacy = createEmptyShop();
    expect(parseShop(legacy)).toEqual(legacy);
    expect(parseShop(legacy)).not.toHaveProperty('partitions');
  });

  it.each([undefined, null, '', 'invalid id', 1, [], {}, 'x'.repeat(65)])('rejects malformed raw partitionId %j', partitionId => {
    expect(parseShop({ ...fixture(), wallItems: [{ ...art(), partitionId }] })).toBeNull();
  });

  it('rejects missing hosts, unsupported decor and IDs shared with walls, doors or furniture', () => {
    const shop = fixture();
    for (const item of [art({ partitionId: 'missing' }), art({ id: 'divider' }), art({ kind: 'window' }), art({ mount: 'exterior' })]) {
      expect(parseShop({ ...shop, wallItems: [item] })).toBeNull();
      expect(placeWallItem(shop, item)).toBe(shop);
    }
    expect(parseShop({ ...placeInteriorDoor(shop, door()), wallItems: [art({ id: 'door-a' })] })).toBeNull();
    const furnished = { ...shop, items: [{ ...createItem('plant'), id: 'plant-a', x: 0, z: 0 }] };
    expect(placeWallItem(furnished, art({ id: 'plant-a' }))).toBe(furnished);
    expect(parseShop({ ...placeInteriorDoor(shop, door()), wallItems: [art({ offset: 4 })] })).toBeNull();
    expect(parseShop({ ...shop, wallItems: [art(), art()] })).toBeNull();
  });
});
