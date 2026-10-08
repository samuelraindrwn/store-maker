import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, PARTITION_WALL_MOUNT_OFFSET, wallIsHorizontal, wallItemPosition, type ShopDocument, type WallItem, type WallSide } from '../model';
import { intersectWall, intersectWallPlane, wallInwardNormal } from './interactionWalls';

const sides: WallSide[] = ['back', 'left', 'front', 'right'];
const shop: ShopDocument = { ...createEmptyShop(), width: 8, depth: 6 };
const source = (wall: WallSide): WallItem => ({ id: 'selected-window', kind: 'window', wall, line: wall === 'front' ? shop.depth : wall === 'right' ? shop.width : 0,
  offset: 2.5, height: 1.5, color: '#aabbcc', text: '', lit: false });
const mountPoint = (item: WallItem) => new THREE.Vector3(wallIsHorizontal(item.wall) ? item.offset - shop.width / 2 : item.line - shop.width / 2,
  item.height, wallIsHorizontal(item.wall) ? item.line - shop.depth / 2 : item.offset - shop.depth / 2);

describe('wall picking follows the four inward-facing sides', () => {
  it.each(sides)('picks the %s wall from inside without mirroring its signed plane', wall => {
    const item = source(wall), point = mountPoint(item), normal = wallInwardNormal(wall);
    const ray = new THREE.Ray(point.clone().addScaledVector(normal, 1), normal.clone().negate());
    const hit = intersectWall(ray, shop)!;
    expect(hit).toMatchObject({ wall, line: item.line, offset: item.offset, height: item.height });
    expect(hit.point.distanceTo(point)).toBeLessThan(0.000001);
    expect(hit.distance).toBeCloseTo(1);
  });

  it.each([['front', 'back'], ['right', 'left']] as const)('ignores the hidden near %s surface when placing on the visible %s wall', (near, far) => {
    const item = source(near), point = mountPoint(item), normal = wallInwardNormal(near);
    const ray = new THREE.Ray(point.clone().addScaledVector(normal, -4), normal);
    const ordinary = intersectWall(ray, shop)!;
    expect(ordinary.wall).toBe(far);
    expect(ordinary.line).toBe(0);
    expect(ordinary.offset).toBeCloseTo(item.offset);
    // Selecting a front/right item explicitly makes that same surface editable
    // from outside without changing ordinary catalog placement behavior.
    const explicit = intersectWall(ray, shop, item)!;
    expect(explicit.wall).toBe(near);
    expect(explicit.point.distanceTo(point)).toBeLessThan(0.000001);
    expect(explicit.distance).toBeLessThan(ordinary.distance);
  });

  it.each(sides)('allows a selected %s item to be dragged from its outside face', wall => {
    const item = source(wall), point = mountPoint(item), normal = wallInwardNormal(wall);
    const ray = new THREE.Ray(point.clone().addScaledVector(normal, -0.6), normal);
    const hit = intersectWall(ray, shop, item)!;
    expect(hit).toMatchObject({ wall, line: item.line, offset: item.offset, height: item.height });
    expect(hit.distance).toBeCloseTo(0.6);
  });

  it.each(sides)('retains out-of-bounds %s drag coordinates for the rejected-drop preview', wall => {
    const item = source(wall), point = mountPoint(item); point.y = 5;
    const normal = wallInwardNormal(wall), ray = new THREE.Ray(point.clone().addScaledVector(normal, 2), normal.clone().negate());
    expect(intersectWall(ray, shop)).toBeNull();
    expect(intersectWall(ray, shop, item)).toMatchObject({ wall, line: item.line, offset: item.offset, height: 5 });
  });

  it('uses a saved inset right-side run on a concave contour', () => {
    const floorCells = Array.from({ length: 6 }, (_, z) => Array.from({ length: z < 3 ? 8 : 4 }, (_, x) => ({ x, z }))).flat();
    const item: WallItem = { ...source('right'), line: 4, offset: 4.5 };
    const ray = new THREE.Ray(new THREE.Vector3(3, 1.5, 1.5), new THREE.Vector3(-1, 0, 0));
    const hit = intersectWall(ray, { ...shop, floorCells }, item)!;
    expect(hit).toMatchObject({ wall: 'right', line: 4, offset: 4.5 });
    expect(hit.point.toArray()).toEqual([0, 1.5, 1.5]);
  });

  it.each(sides)('supplies a stable unbounded %s plane for selected-object resizing', wall => {
    const item = source(wall), normal = wallInwardNormal(wall), target = { ...item, offset: -1.25, height: 4 };
    const point = mountPoint(target), ray = new THREE.Ray(point.clone().addScaledVector(normal, -3), normal);
    expect(intersectWallPlane(ray, shop, item)).toMatchObject({ wall, line: item.line, offset: -1.25, height: 4 });
    expect(intersectWallPlane(new THREE.Ray(point, new THREE.Vector3(0, 1, 0)), shop, item)).toBeNull();
  });
});

describe('authored partition mounting faces', () => {
  const fixture = (wall: WallSide): ShopDocument => ({ ...shop,
    partitions: [{ id: 'divider', axis: wallIsHorizontal(wall) ? 'x' : 'z', line: wallIsHorizontal(wall) ? 3 : 4, start: 1, end: wallIsHorizontal(wall) ? 7 : 5, color: '#eeeeee' }],
  });
  const painting = (wall: WallSide): WallItem => ({ ...source(wall), id: 'partition-art', kind: 'painting', partitionId: 'divider', line: wallIsHorizontal(wall) ? 3 : 4 });

  it.each(sides)('picks the %s partition face at the same surface as its rendered decor', wall => {
    const doc = fixture(wall), item = painting(wall), position = wallItemPosition(doc, item), normal = wallInwardNormal(wall);
    const point = new THREE.Vector3(position.x, position.y, position.z);
    const ray = new THREE.Ray(point.clone().addScaledVector(normal, 0.75), normal.clone().negate());
    const hit = intersectWall(ray, doc, undefined, false, item)!;
    expect(hit).toMatchObject({ wall, line: item.line, partitionId: 'divider', offset: item.offset, height: item.height });
    expect(hit.distance).toBeCloseTo(0.75);
    expect(hit.point.distanceTo(point)).toBeLessThan(0.000001);
    const centerPlane = wallIsHorizontal(wall) ? item.line - doc.depth / 2 : item.line - doc.width / 2;
    expect(Math.abs((wallIsHorizontal(wall) ? hit.point.z : hit.point.x) - centerPlane)).toBeCloseTo(PARTITION_WALL_MOUNT_OFFSET);
  });

  it('moves a dragged decoration from a partition onto the outer wall without retaining the old mounting identity', () => {
    const doc = fixture('back'), item = painting('back');
    const ray = new THREE.Ray(new THREE.Vector3(0.5 - doc.width / 2, 1.5, 2), new THREE.Vector3(0, 0, -1));
    const hit = intersectWall(ray, doc, item)!;
    expect(hit).toMatchObject({ wall: 'back', line: 0, offset: 0.5 });
    expect(hit).not.toHaveProperty('partitionId');
  });

  it('keeps the selected partition face for an out-of-bounds rejected drop', () => {
    const doc = fixture('front'), item = painting('front');
    const ray = new THREE.Ray(new THREE.Vector3(-1.5, 5, -1), new THREE.Vector3(0, 0, 1));
    expect(intersectWall(ray, doc, undefined, false, item)).toBeNull();
    expect(intersectWall(ray, doc, item)).toMatchObject({ wall: 'front', line: 3, partitionId: 'divider', height: 5 });
  });

  it('does not send a window through a partition to the distant boundary', () => {
    const doc = fixture('back'), ray = new THREE.Ray(new THREE.Vector3(-1.5, 1.5, 1), new THREE.Vector3(0, 0, -1));
    expect(intersectWall(ray, doc, undefined, false, source('back'))).toBeNull();
    expect(intersectWall(ray, doc, undefined, false, painting('back'))).toMatchObject({ partitionId: 'divider' });
  });

  it('never offers partition faces to an exterior placement', () => {
    const doc = fixture('back'), ray = new THREE.Ray(new THREE.Vector3(-1.5, 1.5, 8), new THREE.Vector3(0, 0, -1));
    const item: WallItem = { ...painting('back'), mount: 'exterior' };
    delete item.partitionId;
    const hit = intersectWall(ray, doc, undefined, true, item)!;
    expect(hit).toMatchObject({ wall: 'front', line: 6 });
    expect(hit).not.toHaveProperty('partitionId');
  });
});
