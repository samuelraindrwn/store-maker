import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, WALL_CATALOG, wallItemPosition, type ShopDocument, type WallItem } from '../model';
import { buildRoom, buildWallItem, disposeGroup } from './objects';

const windowItem = (id: string, wall: 'back' | 'left', line: number, offset: number): WallItem => ({
  id, kind: 'window', wall, line, offset, height: 1.5, color: '#f5ead6', text: '', lit: false,
});

function structuralHit(room: ReturnType<typeof buildRoom>, doc: ShopDocument, item: WallItem, along = 0, up = 0) {
  const position = wallItemPosition(doc, item);
  const center = new THREE.Vector3(position.x, position.y + up, position.z);
  const normal = item.wall === 'back' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  if (item.wall === 'back') center.x += along; else center.z += along;
  return new THREE.Raycaster(center.addScaledVector(normal, 0.25), normal.clone().negate(), 0, 0.5)
    .intersectObjects([room.backWall, room.leftWall], true);
}

describe('movable wall accessories and structural openings', () => {
  it('cuts both windows on the back wall and a window on a stepped west contour', () => {
    const items = [windowItem('back-a', 'back', 0, 1.4), windowItem('back-b', 'back', 0, 5), windowItem('left-inset', 'left', 2, 4.5)];
    const doc: ShopDocument = { ...createEmptyShop(), wallItems: items,
      floorCells: Array.from({ length: 6 }, (_, z) => Array.from({ length: z < 3 ? 7 : 5 }, (_, x) => ({ x: x + (z < 3 ? 0 : 2), z }))).flat(),
    };
    const room = buildRoom(doc);
    try {
      room.group.updateMatrixWorld(true);
      for (const item of items) {
        for (const along of [-0.75, 0, 0.75]) for (const up of [-0.45, 0, 0.45]) {
          expect(structuralHit(room, doc, item, along, up), `${item.id} opening`).toHaveLength(0);
        }
        expect(structuralHit(room, doc, item, 0, 0.85).length).toBeGreaterThan(0);
      }
      // No hidden fixed window frame or sign remains inside the structural shell.
      expect(room.backWall.children.every(object => object instanceof THREE.Mesh)).toBe(true);
      expect(room.leftWall.children.some(object => object.name === 'wall-window-glass')).toBe(false);
    } finally { disposeGroup(room.group); }
  });

  it('closes the previous opening after a window is moved or deleted', () => {
    const original = windowItem('movable', 'back', 0, 1.5);
    const base: ShopDocument = { ...createEmptyShop(), wallItems: [] };
    for (const items of [[{ ...original, offset: 5 }], []]) {
      const doc = { ...base, wallItems: items };
      const room = buildRoom(doc);
      try {
        room.group.updateMatrixWorld(true);
        expect(structuralHit(room, doc, original).length).toBeGreaterThan(0);
        if (items.length) expect(structuralHit(room, doc, items[0])).toHaveLength(0);
      } finally { disposeGroup(room.group); }
    }
  });

  it('moves a live opening and cancels it while retaining floor and entrance resources', () => {
    const original = windowItem('movable', 'back', 0, 1.5);
    const doc: ShopDocument = { ...createEmptyShop(), wallItems: [original] };
    const room = buildRoom(doc);
    const floorMesh = room.floor.children[0] as THREE.Mesh;
    const floorGeometry = floorMesh.geometry;
    const doorGeometry = room.doorHit.geometry;
    const backWall = room.backWall;
    const previousWall = room.backWall.children[0] as THREE.Mesh;
    let disposed = false;
    previousWall.geometry.addEventListener('dispose', () => { disposed = true; });
    try {
      const moved = { ...original, offset: 5 };
      room.previewWallItems([moved]); room.group.updateMatrixWorld(true);
      expect(disposed).toBe(true);
      expect(room.backWall).toBe(backWall);
      expect(room.backWall.parent).toBe(room.walls);
      expect(room.floor.children[0]).toBe(floorMesh);
      expect(floorMesh.geometry).toBe(floorGeometry);
      expect(room.doorHit.geometry).toBe(doorGeometry);
      expect(structuralHit(room, doc, original).length).toBeGreaterThan(0);
      expect(structuralHit(room, doc, moved)).toHaveLength(0);
      room.previewWallItems([original]); room.group.updateMatrixWorld(true);
      expect(structuralHit(room, doc, original)).toHaveLength(0);
      expect(structuralHit(room, doc, moved).length).toBeGreaterThan(0);
    } finally { disposeGroup(room.group); }
  });

  it('keeps a window opening at its absolute mounting height while previewing wall height', () => {
    const item = windowItem('window', 'back', 0, 3);
    const doc: ShopDocument = { ...createEmptyShop(), wallItems: [item] };
    const room = buildRoom(doc);
    const originalGeometry = (room.backWall.children[0] as THREE.Mesh).geometry;
    try {
      for (const height of [4.5, 2.3, 2.75]) {
        room.previewDimensions(doc.width, doc.depth, height); room.group.updateMatrixWorld(true);
        expect((room.backWall.children[0] as THREE.Mesh).geometry).toBe(originalGeometry);
        expect(structuralHit(room, doc, item, 0, 0.45)).toHaveLength(0);
        expect(structuralHit(room, doc, item, 0, -0.45)).toHaveLength(0);
        expect(structuralHit(room, doc, item, 0, -0.8).length).toBeGreaterThan(0);
        const top = new THREE.Box3().setFromObject(room.backWall).max.y;
        expect(top).toBeCloseTo(height + 0.09);
      }
    } finally { disposeGroup(room.group); }
  });

  it.each(WALL_CATALOG)('$kind has bounded mounting geometry and an independent selection id', entry => {
    const item: WallItem = { ...windowItem('accessory', 'back', 0, 3), kind: entry.kind, color: entry.color, text: 'Sudut Cerita', lit: true };
    const group = buildWallItem(item);
    try {
      group.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(group);
      expect(bounds.min.x).toBeGreaterThanOrEqual(-entry.width / 2 - 0.001);
      expect(bounds.max.x).toBeLessThanOrEqual(entry.width / 2 + 0.001);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-entry.height / 2 - 0.001);
      expect(bounds.max.y).toBeLessThanOrEqual(entry.height / 2 + 0.001);
      expect(bounds.min.z).toBeGreaterThanOrEqual(entry.kind === 'window' ? -0.201 : -0.05);
      expect(bounds.max.z).toBeGreaterThan(0.05);
      group.traverse(object => {
        expect(object.userData.wallItemId).toBe(item.id);
        expect(object.userData.itemId).toBeUndefined();
        expect(object).not.toBeInstanceOf(THREE.Light);
      });
    } finally { disposeGroup(group); }
  });

  it('turns the warm lamp off and disposes its glow texture with its geometry', () => {
    const item: WallItem = { ...windowItem('lamp', 'back', 0, 3), kind: 'wall-lamp', lit: true };
    const group = buildWallItem(item);
    const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      resources.add(object.geometry);
      for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
        resources.add(mat);
        if ('map' in mat && mat.map instanceof THREE.Texture) resources.add(mat.map);
      }
    });
    expect([...resources].some(resource => resource instanceof THREE.DataTexture)).toBe(true);
    const disposed = new Set<unknown>();
    resources.forEach(resource => resource.addEventListener('dispose', () => disposed.add(resource)));
    disposeGroup(group);
    expect(disposed.size).toBe(resources.size);
    expect(group.children).toHaveLength(0);
    const unlit = buildWallItem({ ...item, lit: false });
    try { expect(unlit.getObjectByName('wall-lamp-light-pool')).toBeUndefined(); }
    finally { disposeGroup(unlit); }
  });
});
