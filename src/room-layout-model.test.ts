import { describe, expect, it } from 'vitest';
import {
  canPlace, canPlaceInteriorDoor, canPlacePartition, canPlaceWallItem, createBlankShop, createEmptyShop,
  createInitialShop, createInteriorDoor, createItem, createPartition, createWallItem, getEntrance,
  getEntranceAnchor, getEntranceRotation, getEntranceWall, getInteriorDoorPosition, getInteriorDoorSize,
  getInteriorDoors, getPartitionPosition, getPartitions, getWallRuns, hasFloorCell, MAX_FLOOR_COORD,
  paintFloor, parseShop, placeInteriorDoor, placeItem, placePartition, placeWallItem, removeInteriorDoor,
  removePartition, replaceLevelDocument, resizeShop, setEntrance, updateInteriorDoor, updatePartition,
  wallIsHorizontal, wallItemPosition, type InteriorDoor, type PartitionWall, type ShopDocument, type WallSide,
} from './model';

const wall = (patch: Partial<PartitionWall> = {}): PartitionWall => ({ id: 'partition-a', axis: 'z', line: 3, start: 0, end: 5, color: '#DFE4D7', ...patch });
const door = (patch: Partial<InteriorDoor> = {}): InteriorDoor => ({ id: 'door-a', wallId: 'partition-a', offset: 2.5, width: 1, color: '#AC89B6', open: false, ...patch });
const partitioned = (): ShopDocument => placeInteriorDoor(placePartition(createEmptyShop(), wall()), door());

describe('four facade walls and entrance mounting', () => {
  it.each<WallSide>(['back', 'left', 'front', 'right'])('places and persists a styled window on the %s facade', side => {
    const shop = createEmptyShop(), run = getWallRuns(shop).find(run => run.wall === side)!;
    const item = { ...createWallItem('window'), wall: side, line: run.line, offset: (run.start + run.end) / 2,
      windowStyle: 'arched' as const, color: '#456789', width: 2.8, sizeHeight: 1.6 };
    expect(canPlaceWallItem(shop, item)).toBe(true);
    const placed = placeWallItem(shop, item);
    expect(parseShop(JSON.stringify(placed))).toEqual(placed);
    const pose = wallItemPosition(shop, item), horizontal = wallIsHorizontal(side);
    expect(pose.rotation).toBe({ back: 0, left: Math.PI / 2, front: Math.PI, right: -Math.PI / 2 }[side]);
    const inward = side === 'back' || side === 'left' ? 0.012 : -0.012;
    expect(horizontal ? pose.z : pose.x).toBeCloseTo(run.line - (horizontal ? shop.depth : shop.width) / 2 + inward);
    const resized = resizeShop(placed, 8, 8)!;
    expect(resized.wallItems![0]).toMatchObject({ id: item.id, windowStyle: 'arched', color: '#456789', width: 2.8 });
    expect(canPlaceWallItem(resized, resized.wallItems![0], item.id)).toBe(true);
  });

  it('accepts the outermost front/right boundary line without allowing unsupported windows', () => {
    const shop: ShopDocument = { ...createEmptyShop(), floorCells: [{ x: 15, z: 15 }, { x: 14, z: 15 }, { x: 15, z: 14 }] };
    for (const side of ['front', 'right'] as const) {
      const item = { ...createWallItem('window'), wall: side, line: MAX_FLOOR_COORD + 1, offset: 15, width: 1.2 };
      expect(parseShop(placeWallItem(shop, item))?.wallItems).toHaveLength(1);
      expect(canPlaceWallItem(shop, { ...item, line: MAX_FLOOR_COORD + 2 })).toBe(false);
    }
  });

  it.each<WallSide>(['front', 'right', 'back', 'left'])('anchors the entrance on %s and composes its relative orientation', side => {
    const original = { ...createEmptyShop(), width: 8, depth: 6 };
    const shop = setEntrance(original, { wall: side, position: 0.5 });
    const anchor = getEntranceAnchor(shop), facing = { front: 0, right: 270, back: 180, left: 90 }[side];
    expect(getEntranceWall(shop)).toBe(side);
    expect(getEntranceRotation(shop)).toBe(facing);
    expect(anchor.x).toBeCloseTo({ front: 0, right: 4.09, back: 0, left: -4.09 }[side]);
    expect(anchor.z).toBeCloseTo({ front: 3.09, right: 0, back: -3.09, left: 0 }[side]);
    const rotated = setEntrance(shop, { rotation: 90, open: true });
    expect(getEntranceRotation(rotated)).toBe((facing + 90) % 360);
    expect(getEntranceAnchor(rotated)).toEqual(anchor);
    expect(parseShop(rotated)).toEqual(rotated);
    expect(original.entrance).toBeUndefined();
  });

  it('keeps legacy front-facing entrance data unchanged and resets relative rotation only when changing walls', () => {
    const legacy = { ...createEmptyShop(), entrance: { position: 0.3, open: true, rotation: 270 as const } };
    expect(parseShop(legacy)).toEqual(legacy);
    expect(getEntranceWall(legacy)).toBe('front');
    expect(getEntranceRotation(legacy)).toBe(270);
    const right = setEntrance(legacy, { wall: 'right' });
    expect(getEntrance(right)).toEqual({ position: 0.3, open: true, rotation: 0, wall: 'right' });
    expect(getEntranceRotation(right)).toBe(270);
    expect(setEntrance(right, { wall: 'right' })).toBe(right);
    expect(parseShop({ ...right, entrance: { ...right.entrance, wall: 'ceiling' } })).toBeNull();
  });

  it('follows each actual concave facade instead of placing a doorway across a missing tile', () => {
    const original: ShopDocument = { ...createEmptyShop(), floorCells: [{ x: -2, z: -1 }, { x: -1, z: -1 }, { x: -2, z: 0 }] };
    for (const side of ['front', 'right', 'back', 'left'] as const) {
      const shop = setEntrance(original, { wall: side, position: 0.8 }), anchor = getEntranceAnchor(shop);
      const horizontal = wallIsHorizontal(side), outward = side === 'front' || side === 'right' ? 0.09 : -0.09;
      const line = Math.round((horizontal ? anchor.z + shop.depth / 2 : anchor.x + shop.width / 2) - outward);
      const offset = horizontal ? anchor.x + shop.width / 2 : anchor.z + shop.depth / 2;
      expect(getWallRuns(shop).some(run => run.wall === side && run.line === line && offset >= run.start && offset <= run.end)).toBe(true);
    }
  });
});

describe('independent partition walls and interior doors', () => {
  it('creates useful default placements only on supported empty floor segments', () => {
    const empty = createEmptyShop(), candidate = createPartition(empty)!;
    expect(candidate).not.toBeNull(); expect(canPlacePartition(empty, candidate)).toBe(true);
    expect(createPartition(createBlankShop())).toBeNull();
    const placed = placePartition(empty, candidate), entry = createInteriorDoor(placed, candidate.id)!;
    expect(entry).not.toBeNull(); expect(canPlaceInteriorDoor(placed, entry)).toBe(true);
    expect(createInteriorDoor(placed, 'missing')).toBeNull();
    expect(empty.partitions).toBeUndefined();
    expect(parseShop(placeInteriorDoor(placed, entry))).toEqual(placeInteriorDoor(placed, entry));
  });

  it('requires floor on both sides, rejects collinear overlap, and permits normal corners', () => {
    const empty = createEmptyShop(), first = placePartition(empty, wall());
    expect(canPlacePartition(empty, wall({ line: 0 }))).toBe(false);
    expect(canPlacePartition(empty, wall({ line: 7 }))).toBe(false);
    expect(canPlacePartition(empty, wall({ line: 3.5 }))).toBe(false);
    expect(canPlacePartition(first, wall({ id: 'overlap', start: 2, end: 6 }))).toBe(false);
    expect(canPlacePartition(first, wall({ id: 'corner', axis: 'x', line: 5, start: 3, end: 7 }))).toBe(true);
    const missing = { ...empty, floorCells: [{ x: 2, z: 0 }, { x: 3, z: 0 }, { x: 2, z: 1 }] };
    expect(canPlacePartition(missing, wall({ start: 0, end: 2 }))).toBe(false);
  });

  it('prevents furniture from straddling partitions in either placement order while allowing edge adjacency and rugs', () => {
    const shop = placePartition(createEmptyShop(), wall());
    const crossing = { ...createItem('table'), x: 2, z: 1 };
    expect(canPlace(shop, crossing)).toBe(false);
    expect(canPlace(shop, { ...crossing, x: 3 })).toBe(true);
    expect(canPlace(shop, { ...createItem('rug'), x: 2, z: 1 })).toBe(true);
    expect(canPlacePartition(placeItem(createEmptyShop(), crossing), wall())).toBe(false);
    for (const kind of ['toilet', 'washbasin', 'shower'] as const) {
      expect(canPlace(shop, { ...createItem(kind), x: 3, z: 1 })).toBe(true);
      expect(canPlace(shop, { ...createItem(kind), x: 2, z: 1, width: 2 })).toBe(false);
    }
  });

  it('preserves immutable snapshots and keeps door positions tied to their host wall', () => {
    const original = partitioned();
    const shifted = updatePartition(original, 'partition-a', { line: 4 });
    expect(shifted.partitions![0].line).toBe(4); expect(original.partitions![0].line).toBe(3);
    expect(getPartitionPosition(shifted, shifted.partitions![0])).toEqual({ x: 0.5, z: -0.5, rotation: Math.PI / 2, length: 5 });
    expect(getInteriorDoorPosition(shifted, shifted.interiorDoors![0])).toEqual({ x: 0.5, z: -0.5, rotation: Math.PI / 2 });
    const opened = updateInteriorDoor(shifted, 'door-a', { offset: 3.26, width: 1.26, color: '#abcdef', open: true });
    expect(opened.interiorDoors![0]).toMatchObject({ offset: 3.3, width: 1.3, color: '#abcdef', open: true });
    expect(original.interiorDoors![0].open).toBe(false);
    expect(getInteriorDoorSize(opened, opened.interiorDoors![0])).toEqual({ width: 1.3, height: 2.1, depth: 0.14 });
    expect(updatePartition(opened, 'partition-a', { end: 3 })).toBe(opened);
    expect(updatePartition(opened, 'partition-a', { line: 4 })).toBe(opened);
    expect(updateInteriorDoor(opened, 'door-a', { open: true })).toBe(opened);
    expect(removeInteriorDoor(opened, 'door-a').interiorDoors).toEqual([]);
    expect(removePartition(opened, 'partition-a')).toMatchObject({ partitions: [], interiorDoors: [] });
    expect(parseShop(JSON.stringify(opened))).toEqual(opened);
  });

  it('keeps doors inside their wall, separated from other doors and perpendicular wall junctions', () => {
    const shop = partitioned();
    expect(canPlaceInteriorDoor(shop, door({ id: 'overlap', offset: 2.7 }))).toBe(false);
    expect(canPlaceInteriorDoor(shop, door({ id: 'outside', offset: 0.2 }))).toBe(false);
    expect(canPlaceInteriorDoor(shop, door({ id: 'missing', wallId: 'unknown' }))).toBe(false);
    expect(canPlaceInteriorDoor(shop, door({ id: 'adjacent', offset: 3.5 }))).toBe(true);
    const acrossDoor = wall({ id: 'blocked-junction', axis: 'x', line: 2, start: 1, end: 5 });
    expect(canPlacePartition(shop, acrossDoor)).toBe(false);
    const intersected = placePartition(placePartition(createEmptyShop(), wall()), acrossDoor);
    expect(canPlaceInteriorDoor(intersected, door())).toBe(false);
  });

  it('does not erase supporting floor or shrink away a partition, and still applies other valid stroke cells', () => {
    const shop = partitioned();
    const painted = paintFloor(shop, [{ x: 2, z: 2 }, { x: 6, z: 5 }], 'erase');
    expect(hasFloorCell(painted, 2, 2)).toBe(true);
    expect(hasFloorCell(painted, 6, 5)).toBe(false);
    expect(painted.partitions).toEqual(shop.partitions); expect(painted.interiorDoors).toEqual(shop.interiorDoors);
    const far = placePartition(createEmptyShop(), wall({ line: 5 }));
    expect(resizeShop(far, 4, 6)).toBeNull();
    expect(resizeShop(far, 8, 8)?.partitions).toEqual(far.partitions);
  });

  it('round-trips every floor independently and keeps legacy room fields absent', () => {
    const legacy = { ...createEmptyShop(), items: [{ ...createItem('bathroom'), id: 'legacy-wc' }] };
    expect(parseShop(legacy)).toEqual(legacy);
    expect(parseShop(legacy)).not.toHaveProperty('partitions');
    const building = { ...partitioned(), upperFloors: [createEmptyShop()] };
    const next = replaceLevelDocument(building, 1, partitioned());
    expect(next.partitions).toBe(building.partitions);
    const restored = parseShop(next)!;
    expect(restored).toEqual(next);
    expect(restored.upperFloors![0].partitions![0]).not.toBe(next.upperFloors![0].partitions![0]);
    const detached = getPartitions(next); detached[0].color = '#000000';
    const detachedDoors = getInteriorDoors(next); detachedDoors[0].open = true;
    expect(next.partitions![0].color).not.toBe('#000000'); expect(next.interiorDoors![0].open).toBe(false);
  });

  it('rejects malformed layouts, invalid references and IDs shared with furniture or windows', () => {
    const shop = partitioned();
    for (const patch of [
      { partitions: null }, { partitions: [{ ...wall(), extra: true }] }, { partitions: [wall(), wall()] },
      { partitions: [wall({ line: 7 })] }, { interiorDoors: [door({ wallId: 'missing' })] },
      { interiorDoors: [door({ width: 5 })] }, { interiorDoors: [{ ...door(), extra: true }] },
      { interiorDoors: [door({ id: 'partition-a' })] }, { partitions: Array(81).fill(wall()) },
      { interiorDoors: Array(81).fill(door()) },
    ]) expect(parseShop({ ...shop, ...patch })).toBeNull();
    expect(placeItem(shop, { ...createItem('plant'), id: 'door-a' })).toBe(shop);
    expect(placeWallItem(shop, { ...createWallItem('window'), id: 'partition-a' })).toBe(shop);
    expect(updatePartition(shop, 'partition-a', { id: 'renamed' })).toBe(shop);
    expect(updateInteriorDoor(shop, 'door-a', { wallId: 'missing' })).toBe(shop);
  });

  it('does not invent legacy decoration IDs while parsing an explicitly windowless layout', () => {
    const shop = placePartition(createEmptyShop(), wall({ id: 'builtin-window' }));
    expect(shop.partitions).toHaveLength(1);
    expect(parseShop(shop)).toEqual(shop);
  });

  it('starts with separate WC fixtures, a real privacy wall and door, and clear stairs upstairs', () => {
    const shop = createInitialShop();
    expect(shop).toMatchObject({ width: 10, depth: 9 });
    expect(shop.items.some(item => item.kind === 'bathroom')).toBe(false);
    expect(shop.items.filter(item => ['toilet', 'washbasin', 'shower'].includes(item.kind))).toHaveLength(3);
    expect(shop.partitions).toHaveLength(2); expect(shop.interiorDoors).toHaveLength(1);
    expect(shop.items.find(item => item.kind === 'stairs')).toMatchObject({ x: 0, z: 1, depth: 4 });
    expect(shop.upperFloors![0].items.every(item => item.x >= 3)).toBe(true);
    for (const level of [shop, ...shop.upperFloors!]) for (const item of level.items) expect(canPlace(level, item, item.id)).toBe(true);
    expect(parseShop(shop)).toEqual(shop);
  });
});
