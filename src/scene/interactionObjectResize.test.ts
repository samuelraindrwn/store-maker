import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, getItemFootprint, getItemSize, getWallItemSize, updateWallItem, type Rotation, type ShopItem, type WallItem } from '../model';
import { disposeGroup } from './objects';
import { ObjectResizeTools, resizeFloorEdge, resizeFloorToTile, resizeWallEdge, resizeWallToTile, type ResizeEdge } from './interactionObjectResize';

const rotations: Rotation[] = [0, 90, 180, 270];
const floorItem = (rotation: Rotation = 0): ShopItem => ({ id: 'table', kind: 'table', x: 2, z: 3, rotation, color: '#AABBCC', stock: 'books', width: 3, depth: 2 });
const wallItem = (patch: Partial<WallItem> = {}): WallItem => ({ id: 'art', kind: 'painting', wall: 'back', line: 0, offset: 1.5, height: 1.6, width: 1.6, sizeHeight: 0.8, color: '#AABBCC', text: '', lit: false, ...patch });
const camera = () => {
  const value = new THREE.PerspectiveCamera();
  value.position.set(8, 10, 12);
  value.lookAt(0, 1, 0);
  value.updateMatrixWorld(true);
  return value;
};

describe.each(rotations)('floor resizing at %s degrees', rotation => {
  it.each<ResizeEdge>(['min-x', 'max-x', 'min-z', 'max-z'])('moves %s while retaining the opposite edge and the other axis', edge => {
    const source = Object.freeze(floorItem(rotation));
    const before = getItemFootprint(source);
    const alongX = edge.endsWith('x');
    const near = edge.startsWith('min');
    const coordinate = near ? -1 : 9;
    const result = resizeFloorEdge(source, edge, coordinate);
    const after = getItemFootprint(result);
    const oldStart = alongX ? source.x : source.z;
    const oldLength = alongX ? before.width : before.depth;
    const newStart = alongX ? result.x : result.z;
    const newLength = alongX ? after.width : after.depth;

    expect(near ? newStart : newStart + newLength).toBe(coordinate);
    expect(near ? newStart + newLength : newStart).toBe(near ? oldStart + oldLength : oldStart);
    expect(alongX ? result.z : result.x).toBe(alongX ? source.z : source.x);
    expect(alongX ? after.depth : after.width).toBe(alongX ? before.depth : before.width);
    expect(result).toMatchObject({ id: source.id, kind: source.kind, rotation, color: source.color, stock: source.stock });
    expect(source).toEqual(floorItem(rotation));
    // Stored axes stay local: changing world X affects local depth after a quarter turn.
    const local = getItemSize(result);
    if (rotation === 90 || rotation === 270) expect(local).toEqual({ width: after.depth, depth: after.width });
    else expect(local).toEqual(after);
  });

  it('resizes both world axes to a corner tile, including for rotated furniture', () => {
    const result = resizeFloorToTile(floorItem(rotation), { x: 7, z: 8 });
    expect(result).toMatchObject({ x: 2, z: 3, rotation });
    expect(getItemFootprint(result)).toEqual({ width: 6, depth: 6 });
  });
});

describe('floor tile anchors and limits', () => {
  const source = { ...floorItem(), x: -2, z: -1, width: 5, depth: 4 };

  it('extends through negative cells while retaining the old far corner', () => {
    const result = resizeFloorToTile(source, { x: -4, z: -3 });
    expect(result).toMatchObject({ x: -4, z: -3 });
    expect(getItemFootprint(result)).toEqual({ width: 7, depth: 6 });
    expect(result.x + getItemFootprint(result).width).toBe(3);
    expect(result.z + getItemFootprint(result).depth).toBe(3);
  });

  it('shrinks to an interior tile without moving its near corner', () => {
    const result = resizeFloorToTile(source, { x: 0, z: 0 });
    expect(result).toMatchObject({ x: -2, z: -1 });
    expect(getItemFootprint(result)).toEqual({ width: 3, depth: 2 });
  });

  it('clamps crossed handles to one cell and distant edges to 24 without losing the fixed edge', () => {
    const collapsed = resizeFloorEdge(source, 'min-x', 20);
    expect(collapsed.x).toBe(2);
    expect(getItemFootprint(collapsed).width).toBe(1);
    const expanded = resizeFloorEdge(source, 'min-x', -100);
    expect(expanded.x).toBe(-21);
    expect(getItemFootprint(expanded).width).toBe(24);
    expect(expanded.x + getItemFootprint(expanded).width).toBe(3);
    const positive = resizeFloorEdge(source, 'max-z', 100);
    expect(positive.z).toBe(-1);
    expect(getItemFootprint(positive).depth).toBe(24);
  });
});

describe('wall dimensions and mounting position', () => {
  it.each([
    ['min-x', 0.3, 1.3],
    ['max-x', 2.7, 1.7],
  ] as const)('changes width through %s without changing height or the opposite boundary', (edge, coordinate, expectedOffset) => {
    const source = Object.freeze(wallItem());
    const result = resizeWallEdge(source, edge, coordinate);
    expect(getWallItemSize(result)).toMatchObject({ width: 2, height: 0.8 });
    expect(result.offset).toBeCloseTo(expectedOffset);
    expect(result.height).toBe(source.height);
    const fixed = edge === 'min-x' ? result.offset + 1 : result.offset - 1;
    expect(fixed).toBeCloseTo(edge === 'min-x' ? 2.3 : 0.7);
    expect(result).toMatchObject({ wall: source.wall, line: source.line, id: source.id, color: source.color });
  });

  it.each([
    ['min-y', 0.8, 1.4],
    ['max-y', 2.4, 1.8],
  ] as const)('changes physical height through %s and adjusts mounting center to preserve the opposite edge', (edge, coordinate, expectedCenter) => {
    const source = Object.freeze(wallItem());
    const result = resizeWallEdge(source, edge, coordinate);
    expect(getWallItemSize(result)).toMatchObject({ width: 1.6, height: 1.2 });
    expect(result.height).toBeCloseTo(expectedCenter);
    expect(result.offset).toBe(source.offset);
    expect(edge === 'min-y' ? result.height + 0.6 : result.height - 0.6).toBeCloseTo(edge === 'min-y' ? 2 : 1.2);
  });

  it('uses half-meter target tiles for two-axis growth and shrink', () => {
    const source = wallItem({ width: 2, sizeHeight: 1, offset: 2, height: 1.5 });
    const negative = resizeWallToTile(source, 0.2, 0.2);
    expect(getWallItemSize(negative)).toMatchObject({ width: 3, height: 2 });
    expect(negative).toMatchObject({ offset: 1.5, height: 1 });
    const positive = resizeWallToTile(source, 3.75, 2.75);
    expect(getWallItemSize(positive)).toMatchObject({ width: 3, height: 2 });
    expect(positive).toMatchObject({ offset: 2.5, height: 2 });
    const shrunk = resizeWallToTile(source, 1.75, 1.75);
    expect(getWallItemSize(shrunk)).toMatchObject({ width: 1, height: 1 });
    expect(shrunk).toMatchObject({ offset: 1.5, height: 1.5 });
  });

  it('keeps a default lamp at .45m wide when only its vertical dimension is resized and saved', () => {
    const source: WallItem = { id: 'lamp', kind: 'wall-lamp', wall: 'back', line: 0, offset: 1.5, height: 1.5, color: '#BC9870', text: '', lit: true };
    const doc = { ...createEmptyShop(), wallItems: [source] };
    const candidate = resizeWallEdge(source, 'max-y', 2.05);
    expect(getWallItemSize(candidate).width).toBe(0.45);
    const result = updateWallItem(doc, source.id, candidate);
    expect(result).not.toBe(doc);
    expect(getWallItemSize(result.wallItems![0]).width).toBe(0.45);
    expect(result.wallItems![0].offset).toBe(1.5);
    expect(result.wallItems![0].lit).toBe(true);
  });
});

describe('resize geometry and target coordinates', () => {
  it('keeps sidewalk tile meshes and hit-target metadata at the same support heights after a city toggle', () => {
    const tools = new ObjectResizeTools();
    const shop = createEmptyShop();
    const item: ShopItem = { ...floorItem(), kind: 'chalkboard', stock: 'none', x: 0, z: 6, width: 1, depth: 1 };
    const matrices = tools.group.children.find(object => object instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const assertTarget = (x: number, z: number, expectedY: number) => {
      const index = tools.targets.findIndex(target => target.x === x && target.z === z);
      expect(index).toBeGreaterThanOrEqual(0);
      const point = tools.targets[index].point;
      expect(point.y).toBeCloseTo(expectedY);
      matrices.getMatrixAt(index, matrix);
      const meshCenter = new THREE.Vector3().setFromMatrixPosition(matrix);
      expect(meshCenter.x).toBeCloseTo(point.x);
      expect(meshCenter.y).toBeCloseTo(point.y);
      expect(meshCenter.z).toBeCloseTo(point.z);
    };
    try {
      tools.floor(shop, item, camera(), 1, true, -0.008, item, {
        key: 'city-visible', height: (_x, z) => z < 6 ? 0.052 : -0.072,
      });
      assertTarget(0, 5, 0.052);
      assertTarget(0, 6, -0.072);
      assertTarget(0, 7, -0.072);
      tools.floor(shop, item, camera(), 1, true, -0.018, item, {
        key: 'city-hidden', height: (_x, z) => z < 6 ? 0.052 : z === 6 ? -0.082 : -0.393,
      });
      assertTarget(0, 5, 0.052);
      assertTarget(0, 6, -0.082);
      assertTarget(0, 7, -0.393);
    } finally { disposeGroup(tools.group); }
  });

  it('previews a floor corner without moving the selected object handles under the pointer', () => {
    const tools = new ObjectResizeTools();
    const source = floorItem();
    const preview = resizeFloorToTile(source, { x: 6, z: 5 });
    try {
      tools.floor(createEmptyShop(), preview, camera(), 1, true, 0.084, source);
      const grip = tools.handles.find(handle => handle.edge === 'max-x')!.object;
      expect(grip.position.x).toBe(1.5);
      expect(grip.position.z).toBe(1);
      const outline = tools.group.children.find(object => object instanceof THREE.LineLoop) as THREE.LineLoop;
      const points = outline.geometry.getAttribute('position');
      expect(points.getX(1)).toBe(3.5);
      expect(points.getZ(2)).toBe(3);
    } finally { disposeGroup(tools.group); }
  });

  it('previews a left-wall resize with stable original handles and a separate larger outline', () => {
    const tools = new ObjectResizeTools();
    const source = wallItem({ wall: 'left', offset: 2.5 });
    const preview = resizeWallEdge(source, 'max-x', 4);
    try {
      // 2.5 + (2.3 - 1.6) / 2 is a mathematical half-tenth, despite IEEE drift.
      expect(preview.offset).toBe(2.9);
      tools.wall(createEmptyShop(), preview, camera(), 1, true, source);
      const grip = tools.handles.find(handle => handle.edge === 'max-x')!.object;
      expect(grip.position.z).toBeCloseTo(0.3);
      expect(grip.position.y).toBe(1.6);
      const outline = tools.group.children.find(object => object instanceof THREE.LineLoop) as THREE.LineLoop;
      expect(outline.geometry.getAttribute('position').getZ(1)).toBeCloseTo(1.05);
    } finally { disposeGroup(tools.group); }
  });

  it.each(['back', 'left'] as const)('%s wall handle positions follow increasing wall offsets and have the correct height', wall => {
    const tools = new ObjectResizeTools();
    const shop = createEmptyShop();
    const item = wallItem({ wall, line: 0, offset: 2.5, height: 1.6 });
    const view = camera();
    try {
      tools.wall(shop, item, view, 1.2, true);
      const grip = (edge: ResizeEdge) => tools.handles.find(handle => handle.edge === edge)!.object;
      const low = grip('min-x').position, high = grip('max-x').position;
      if (wall === 'left') {
        expect(low.x).toBeCloseTo(-shop.width / 2 + 0.162);
        expect(high.x).toBeCloseTo(low.x);
        expect(low.z).toBeCloseTo(1.7 - shop.depth / 2);
        expect(high.z).toBeCloseTo(3.3 - shop.depth / 2);
        expect(high.z).toBeGreaterThan(low.z);
      } else {
        expect(low.z).toBeCloseTo(-shop.depth / 2 + 0.162);
        expect(high.z).toBeCloseTo(low.z);
        expect(low.x).toBeCloseTo(1.7 - shop.width / 2);
        expect(high.x).toBeCloseTo(3.3 - shop.width / 2);
        expect(high.x).toBeGreaterThan(low.x);
      }
      expect(grip('min-y').position.y).toBeCloseTo(1.2);
      expect(grip('max-y').position.y).toBeCloseTo(2);
      expect(grip('min-z').visible).toBe(false);
      expect(grip('max-z').visible).toBe(false);
      expect(grip('max-x').quaternion.angleTo(view.quaternion)).toBeCloseTo(0);
      const first = tools.targets[0];
      expect(first).toMatchObject({ x: 0.25, height: 0.25 });
      expect(first.point.y).toBe(0.25);
      if (wall === 'left') expect(first.point.z).toBeCloseTo(0.25 - shop.depth / 2);
      else expect(first.point.x).toBeCloseTo(0.25 - shop.width / 2);

      // The target grid is reusable, but handles must refresh after each resize.
      tools.wall(shop, { ...item, width: 2.4, sizeHeight: 1.2 }, view, 1.2, true);
      expect(grip('max-y').position.y).toBeCloseTo(2.2);
      expect(wall === 'left' ? grip('max-x').position.z : grip('max-x').position.x).toBeCloseTo(3.7 - (wall === 'left' ? shop.depth : shop.width) / 2);
    } finally { disposeGroup(tools.group); }
  });

  it('keeps custom negative target cells stable and draws rotated floor handles at the actual footprint edges', () => {
    const tools = new ObjectResizeTools();
    const floorCells = [{ x: -3, z: -2 }, { x: -2, z: -2 }, { x: -2, z: -1 }];
    const shop = { ...createEmptyShop(), floorCells };
    const item = { ...floorItem(90), x: -3, z: -2 };
    try {
      tools.floor(shop, item, camera(), 1, true, 0.084);
      expect(tools.targets.map(({ x, z }) => ({ x, z }))).toEqual(floorCells);
      expect(tools.targets[0].point.toArray()).toEqual([-6, 0.052, -4.5]);
      const grip = (edge: ResizeEdge) => tools.handles.find(handle => handle.edge === edge)!.object;
      expect(grip('min-x').position.toArray()).toEqual([-6.5, 0.084, -3.5]);
      expect(grip('max-x').position.toArray()).toEqual([-4.5, 0.084, -3.5]);
      expect(grip('min-z').position.toArray()).toEqual([-5.5, 0.084, -5]);
      expect(grip('max-z').position.toArray()).toEqual([-5.5, 0.084, -2]);
      expect(grip('min-y').visible).toBe(false);
      expect(grip('max-y').visible).toBe(false);
      const matrices = tools.group.children.find(object => object instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
      expect(matrices.count).toBe(3);
      tools.floor(shop, { ...item, kind: 'chalkboard' }, camera(), 1, true, -0.078);
      expect(tools.targets.some(target => target.z === 0)).toBe(true);
      expect(tools.targets.some(target => target.z === 1)).toBe(true);
      expect(floorCells).toHaveLength(3);
    } finally { disposeGroup(tools.group); }
  });
});
