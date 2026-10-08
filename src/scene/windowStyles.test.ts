import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, getWallItemSize, wallItemPosition, type ShopDocument, type WallItem, type WindowStyle } from '../model';
import { applyWallItemSize, buildRoom, buildWallItem, disposeGroup } from './objects';

const styles: WindowStyle[] = ['classic', 'picture', 'grid', 'sliding', 'arched'];
const windowItem = (windowStyle: WindowStyle, width = 2.2, sizeHeight = 1.4): WallItem => ({
  id: 'window', kind: 'window', windowStyle, wall: 'back', line: 0, offset: 3, height: 1.5,
  color: '#F5EAD6', text: '', lit: false, width, sizeHeight,
});

function named(root: THREE.Object3D, name: string) {
  const objects: THREE.Object3D[] = [];
  root.traverse(object => { if (object.name === name) objects.push(object); });
  return objects;
}

function wallHit(room: ReturnType<typeof buildRoom>, doc: ShopDocument, item: WallItem, along: number, up: number) {
  const p = wallItemPosition(doc, item);
  const normal = item.wall === 'back' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const origin = new THREE.Vector3(p.x, p.y + up, p.z);
  if (item.wall === 'back') origin.x += along; else origin.z += along;
  return new THREE.Raycaster(origin.addScaledVector(normal, 0.3), normal.clone().negate(), 0, 0.6)
    .intersectObjects([room.backWall, room.leftWall], true);
}

describe('five procedural window styles', () => {
  for (const [width, height] of [[0.3, 0.3], [2.2, 1.4], [24, 4.5]]) {
    it.each(styles)(`%s stays within its ${width}x${height} mounting envelope`, style => {
      const item = windowItem(style, width, height);
      const group = buildWallItem(item);
      try {
        group.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(group);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-width / 2 - 0.001);
        expect(bounds.max.x).toBeLessThanOrEqual(width / 2 + 0.001);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-height / 2 - 0.001);
        expect(bounds.max.y).toBeLessThanOrEqual(height / 2 + 0.001);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-0.05);
        expect(bounds.max.z).toBeLessThanOrEqual(getWallItemSize(item).depth + 0.001);
        group.traverse(object => { expect(object.userData.wallItemId).toBe(item.id); });
      } finally { disposeGroup(group); }
    });
  }

  it('uses real different pane/frame layouts rather than style tags alone', () => {
    const [classic, picture, grid, sliding, arched] = styles.map(style => buildWallItem(windowItem(style)));
    try {
      expect(named(classic, 'window-classic-crossbar')).toHaveLength(1);
      expect(named(classic, 'window-classic-mullion').length).toBeGreaterThan(0);
      expect(named(picture, 'window-classic-crossbar')).toHaveLength(0);
      expect(named(picture, 'window-classic-mullion')).toHaveLength(0);
      expect(named(picture, 'wall-window-glass')).toHaveLength(1);
      expect(named(grid, 'window-grid-vertical').length).toBeGreaterThan(1);
      expect(named(grid, 'window-grid-horizontal').length).toBeGreaterThan(1);
      expect(named(sliding, 'wall-window-glass')).toHaveLength(2);
      expect(named(sliding, 'window-sliding-rail')).toHaveLength(2);
      expect(named(sliding, 'window-sliding-handle')).toHaveLength(2);
      sliding.updateMatrixWorld(true);
      const panels = named(sliding, 'wall-window-glass').map(object => object.getWorldPosition(new THREE.Vector3()));
      expect(Math.abs(panels[0].z - panels[1].z)).toBeGreaterThan(0.02);
      expect(named(arched, 'window-arched-frame')).toHaveLength(1);
      const glass = named(arched, 'wall-window-glass')[0] as THREE.Mesh;
      arched.updateMatrixWorld(true);
      const ray = (x: number, y: number) => new THREE.Raycaster(new THREE.Vector3(x, y, 0.5), new THREE.Vector3(0, 0, -1)).intersectObject(glass);
      expect(ray(0, 0.55).length).toBeGreaterThan(0);
      expect(ray(0.85, 0.55)).toHaveLength(0);
      expect(ray(-0.85, 0.55)).toHaveLength(0);
    } finally { [classic, picture, grid, sliding, arched].forEach(disposeGroup); }
  });

  it.each(styles)('%s previews dimensions without reallocating its authored geometry', style => {
    const item = windowItem(style);
    const group = buildWallItem(item);
    const meshes: THREE.Mesh[] = []; group.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
    const geometries = meshes.map(mesh => mesh.geometry);
    const original = new THREE.Box3().setFromObject(group);
    try {
      applyWallItemSize(group, { ...item, width: 4.4, sizeHeight: 2.8 }); group.updateMatrixWorld(true);
      const enlarged = new THREE.Box3().setFromObject(group);
      expect(enlarged.max.x).toBeCloseTo(original.max.x * 2);
      expect(enlarged.max.y).toBeCloseTo(original.max.y * 2);
      expect(meshes.map(mesh => mesh.geometry)).toEqual(geometries);
      applyWallItemSize(group, item); group.updateMatrixWorld(true);
      expect(new THREE.Box3().setFromObject(group).equals(original)).toBe(true);
    } finally { disposeGroup(group); }
  });
});

describe('arched structural apertures', () => {
  it.each(['back', 'left'] as const)('has solid upper corners and open crown on the %s wall at every wall height', wall => {
    const item = { ...windowItem('arched'), wall };
    const doc: ShopDocument = { ...createEmptyShop(), wallItems: [item] };
    const room = buildRoom(doc);
    try {
      for (const height of [2.75, 4.5, 2.3, 2.75]) {
        room.previewDimensions(doc.width, doc.depth, height); room.group.updateMatrixWorld(true);
        expect(wallHit(room, doc, item, 0, 0.55)).toHaveLength(0);
        expect(wallHit(room, doc, item, 0.85, 0.55).length).toBeGreaterThan(0);
        expect(wallHit(room, doc, item, -0.85, 0.55).length).toBeGreaterThan(0);
        expect(wallHit(room, doc, item, 0.85, 0.05)).toHaveLength(0);
      }
    } finally { disposeGroup(room.group); }
  });

  it('cuts an arched window on an inset west contour without affecting another rectangular window', () => {
    const arch = { ...windowItem('arched'), wall: 'left' as const, line: 2, offset: 4.5 };
    const classic = { ...windowItem('classic'), id: 'classic', offset: 4 };
    const doc: ShopDocument = { ...createEmptyShop(), wallItems: [arch, classic],
      floorCells: Array.from({ length: 6 }, (_, z) => Array.from({ length: z < 3 ? 7 : 5 }, (_, x) => ({ x: x + (z < 3 ? 0 : 2), z }))).flat(),
    };
    const room = buildRoom(doc);
    try {
      room.group.updateMatrixWorld(true);
      expect(wallHit(room, doc, arch, 0, 0.55)).toHaveLength(0);
      expect(wallHit(room, doc, arch, 0.85, 0.55).length).toBeGreaterThan(0);
      expect(wallHit(room, doc, classic, 0.85, 0.55)).toHaveLength(0);
    } finally { disposeGroup(room.group); }
  });

  it('adds each arch infill once when disconnected runs share the same boundary line', () => {
    const item = { ...windowItem('arched', 1.2, 1.4), offset: 5.5 };
    const doc: ShopDocument = { ...createEmptyShop(), wallItems: [item],
      floorCells: Array.from({ length: 3 }, (_, z) => [0, 1, 4, 5, 6].map(x => ({ x, z }))).flat(),
    };
    const room = buildRoom(doc);
    try {
      expect(named(room.backWall, 'structural-window-spandrel')).toHaveLength(2);
      room.group.updateMatrixWorld(true);
      expect(wallHit(room, doc, item, 0, 0.55)).toHaveLength(0);
      expect(wallHit(room, doc, item, 0.45, 0.55).length).toBeGreaterThan(0);
    } finally { disposeGroup(room.group); }
  });

  it('switches, resizes, moves and cancels the live arch while retaining floor/door and disposing old infills', () => {
    const item = windowItem('arched');
    const doc: ShopDocument = { ...createEmptyShop(), wallHeight: 4.5, wallItems: [item] };
    const room = buildRoom(doc);
    const floor = room.floor.children[0], door = room.doorHit.geometry;
    const infill = named(room.backWall, 'structural-window-spandrel')[0] as THREE.Mesh;
    let disposed = false; infill.geometry.addEventListener('dispose', () => { disposed = true; });
    try {
      room.previewWallItems([{ ...item, windowStyle: 'picture' }]); room.group.updateMatrixWorld(true);
      expect(disposed).toBe(true);
      expect(wallHit(room, doc, item, 0.85, 0.55)).toHaveLength(0);
      const resized = { ...item, width: 4, sizeHeight: 2.2, offset: 3.5, height: 2 };
      room.previewWallItems([resized]); room.group.updateMatrixWorld(true);
      expect(wallHit(room, doc, resized, 0, 0.95)).toHaveLength(0);
      expect(wallHit(room, doc, resized, 1.7, 0.95).length).toBeGreaterThan(0);
      const moved = { ...item, wall: 'left' as const, offset: 3.5 };
      room.previewWallItems([moved]); room.group.updateMatrixWorld(true);
      expect(wallHit(room, doc, item, 0, 0).length).toBeGreaterThan(0);
      expect(wallHit(room, doc, moved, 0, 0.55)).toHaveLength(0);
      room.previewWallItems([item]); room.group.updateMatrixWorld(true);
      expect(wallHit(room, doc, item, 0, 0.55)).toHaveLength(0);
      expect(wallHit(room, doc, item, 0.85, 0.55).length).toBeGreaterThan(0);
      expect(wallHit(room, doc, moved, 0, 0).length).toBeGreaterThan(0);
      expect(room.floor.children[0]).toBe(floor); expect(room.doorHit.geometry).toBe(door);
    } finally { disposeGroup(room.group); }
  });
});
