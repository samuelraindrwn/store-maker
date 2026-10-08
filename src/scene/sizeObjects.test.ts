import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CATALOG, WALL_CATALOG, createEmptyShop, getWallItemSize, wallItemPosition, type ShopDocument, type ShopItem, type WallItem } from '../model';
import { applyItemSize, applyWallItemSize, buildItem, buildRoom, buildWallItem, disposeGroup } from './objects';

const floorItem = (kind: ShopItem['kind'], width: number, depth: number): ShopItem => ({
  id: `sized-${kind}`, kind, x: 0, z: 0, rotation: 0, color: '#BC8F69',
  stock: kind === 'rack' ? 'fashion' : kind === 'shelf' ? 'books' : kind === 'table' ? 'ceramics' : 'none', width, depth,
});

const wallItem = (kind: WallItem['kind'], width: number, sizeHeight: number): WallItem => ({
  id: `sized-${kind}`, kind, wall: 'back', line: 0, offset: 3.5, height: 2.25,
  color: '#BC8F69', text: 'Sudut Cerita', lit: true, width, sizeHeight,
});

function meshes(group: THREE.Object3D) {
  const result: THREE.Mesh[] = [];
  group.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); });
  return result;
}

describe('resized furniture geometry', () => {
  for (const size of [{ width: 1, depth: 1 }, { width: 4, depth: 3 }, { width: 24, depth: 24 }]) {
    it.each(CATALOG)(`$kind stays inside its ${size.width}x${size.depth} footprint before and after rotation`, entry => {
      const item = floorItem(entry.kind, size.width, size.depth);
      const group = buildItem(item);
      try {
        for (const rotation of [0, Math.PI / 2]) {
          group.rotation.y = rotation; group.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(group);
          const width = rotation ? size.depth : size.width, depth = rotation ? size.width : size.depth;
          expect(bounds.min.x).toBeGreaterThanOrEqual(-width / 2 - 0.001);
          expect(bounds.max.x).toBeLessThanOrEqual(width / 2 + 0.001);
          expect(bounds.min.z).toBeGreaterThanOrEqual(-depth / 2 - 0.001);
          expect(bounds.max.z).toBeLessThanOrEqual(depth / 2 + 0.001);
          expect(bounds.max.y).toBeGreaterThan(0);
          expect(Number.isFinite(bounds.min.y)).toBe(true);
        }
      } finally { disposeGroup(group); }
    });
  }

  it('keeps table legs at their authored thickness and repeats shelf stock as width grows', () => {
    const small = buildItem(floorItem('table', 2, 2));
    const large = buildItem(floorItem('table', 6, 4));
    const shelf = buildItem(floorItem('shelf', 2, 1));
    const wideShelf = buildItem(floorItem('shelf', 6, 1));
    try {
      const legSize = (group: THREE.Group) => new THREE.Box3().setFromObject(group.children[0]).getSize(new THREE.Vector3());
      expect(legSize(large).x).toBeCloseTo(legSize(small).x);
      expect(legSize(large).z).toBeCloseTo(legSize(small).z);
      expect(large.children.length).toBeGreaterThan(small.children.length);
      expect(wideShelf.children.length).toBeGreaterThan(shelf.children.length);
    } finally { [small, large, shelf, wideShelf].forEach(disposeGroup); }
  });

  it('previews absolute sizes without reallocating resources or changing placement, then restores exactly', () => {
    const item = floorItem('table', 4, 2);
    const group = buildItem(item);
    group.position.set(2, 0.038, -1); group.rotation.y = Math.PI / 2;
    group.updateMatrixWorld(true);
    const before = new THREE.Box3().setFromObject(group);
    const resources = meshes(group).map(mesh => ({ mesh, geometry: mesh.geometry, material: mesh.material }));
    const basis = group.userData.itemSizeBasis;
    try {
      for (let index = 0; index < 10; index++) applyItemSize(group, { ...item, width: 2, depth: 6 });
      expect(group.scale.toArray()).toEqual([0.5, 1, 3]);
      expect(group.position.toArray()).toEqual([2, 0.038, -1]);
      expect(group.rotation.y).toBe(Math.PI / 2);
      expect(group.userData.itemSizeBasis).toBe(basis);
      for (const resource of resources) {
        expect(resource.mesh.geometry).toBe(resource.geometry);
        expect(resource.mesh.material).toBe(resource.material);
      }
      applyItemSize(group, item); group.updateMatrixWorld(true);
      expect(new THREE.Box3().setFromObject(group).equals(before)).toBe(true);
    } finally { disposeGroup(group); }
  });

  it('does not scale selection frames or other unannotated scene objects', () => {
    const frame = new THREE.Object3D(); frame.scale.set(0.4, 0.5, 0.6);
    applyItemSize(frame, floorItem('table', 6, 3));
    applyWallItemSize(frame, wallItem('window', 4, 2));
    expect(frame.scale.toArray()).toEqual([0.4, 0.5, 0.6]);
  });
});

function hitWall(room: ReturnType<typeof buildRoom>, doc: ShopDocument, item: WallItem, along: number, up = 0) {
  const p = wallItemPosition(doc, item);
  const normal = item.wall === 'back' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const origin = new THREE.Vector3(p.x, p.y + up, p.z);
  if (item.wall === 'back') origin.x += along; else origin.z += along;
  return new THREE.Raycaster(origin.addScaledVector(normal, 0.25), normal.clone().negate(), 0, 0.5)
    .intersectObjects([room.backWall, room.leftWall], true);
}

describe('resized wall accessories and real window openings', () => {
  for (const size of [{ width: 0.3, height: 0.3 }, { width: 3.2, height: 2.4 }]) {
    it.each(WALL_CATALOG)(`$kind respects its ${size.width}x${size.height} mounting envelope`, entry => {
      const item = wallItem(entry.kind, size.width, size.height);
      const group = buildWallItem(item);
      try {
        group.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(group);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-size.width / 2 - 0.001);
        expect(bounds.max.x).toBeLessThanOrEqual(size.width / 2 + 0.001);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-size.height / 2 - 0.001);
        expect(bounds.max.y).toBeLessThanOrEqual(size.height / 2 + 0.001);
        expect(bounds.max.z).toBeLessThanOrEqual(getWallItemSize(item).depth + 0.001);
        expect(bounds.min.z).toBeGreaterThanOrEqual(entry.kind === 'window' ? -0.201 : -0.05);
      } finally { disposeGroup(group); }
    });
  }

  it.each(['back', 'left'] as const)('resizes a real %s-wall opening live and restores it without replacing floor or door', wall => {
    const item = { ...wallItem('window', 2.2, 1.4), wall, offset: 3 };
    const doc: ShopDocument = { ...createEmptyShop(), wallHeight: 4.5, wallItems: [item] };
    const room = buildRoom(doc);
    const floor = room.floor.children[0], doorGeometry = room.doorHit.geometry;
    try {
      room.group.updateMatrixWorld(true);
      expect(hitWall(room, doc, item, 1.6).length).toBeGreaterThan(0);
      expect(hitWall(room, doc, item, 0, 0.85).length).toBeGreaterThan(0);
      const resized = { ...item, width: 4, sizeHeight: 2.2 };
      room.previewWallItems([resized]); room.group.updateMatrixWorld(true);
      expect(hitWall(room, doc, resized, 1.6)).toHaveLength(0);
      expect(hitWall(room, doc, resized, 0, 0.85)).toHaveLength(0);
      expect(hitWall(room, doc, resized, 2.05).length).toBeGreaterThan(0);
      expect(hitWall(room, doc, resized, 0, 1.15).length).toBeGreaterThan(0);
      expect(room.floor.children[0]).toBe(floor);
      expect(room.doorHit.geometry).toBe(doorGeometry);
      room.previewWallItems([item]); room.group.updateMatrixWorld(true);
      expect(hitWall(room, doc, item, 1.6).length).toBeGreaterThan(0);
      expect(hitWall(room, doc, item, 0, 0.85).length).toBeGreaterThan(0);
    } finally { disposeGroup(room.group); }
  });

  it('previews wall size against its authored basis without changing mounting transform or resources', () => {
    const item = wallItem('window', 4, 2.2);
    const group = buildWallItem(item);
    group.position.set(1, 2.25, 0.012); group.rotation.y = Math.PI / 2;
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    const resources = meshes(group).map(mesh => mesh.geometry);
    try {
      for (let index = 0; index < 10; index++) applyWallItemSize(group, { ...item, width: 2, sizeHeight: 1.1 });
      expect(group.scale.toArray()).toEqual([0.5, 0.5, 1]);
      expect(group.position.toArray()).toEqual([1, 2.25, 0.012]);
      expect(group.rotation.y).toBe(Math.PI / 2);
      expect(meshes(group).map(mesh => mesh.geometry)).toEqual(resources);
      applyWallItemSize(group, item); group.updateMatrixWorld(true);
      expect(new THREE.Box3().setFromObject(group).equals(bounds)).toBe(true);
    } finally { disposeGroup(group); }
  });
});
