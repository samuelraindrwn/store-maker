import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, type ShopItem } from '../model';
import { buildItem, buildRoom, disposeGroup, standingSignGroundY } from './objects';

describe('movable standing sign geometry', () => {
  it.each(['chalkboard', 'poster-stand', 'direction-sign'] as const)('%s has pickable geometry, grounded feet and a one-cell footprint in every rotation', kind => {
    const item: ShopItem = { id: `test-${kind}`, kind, x: 0, z: 6, rotation: 0, color: '#A68BB5', stock: 'none' };
    const object = buildItem(item);
    try {
      expect(object.userData.itemId).toBe(item.id);
      for (const rotation of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        object.rotation.y = rotation;
        object.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(object);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-0.5);
        expect(bounds.max.x).toBeLessThanOrEqual(0.5);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-0.5);
        expect(bounds.max.z).toBeLessThanOrEqual(0.5);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.005);
        expect(bounds.min.y).toBeLessThan(0.04);
        expect(bounds.max.y).toBeGreaterThan(0.75);
      }
      object.rotation.y = 0;
      object.updateMatrixWorld(true);
      const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
      const ray = new THREE.Raycaster(new THREE.Vector3(center.x, center.y, 3), new THREE.Vector3(0, 0, -1));
      expect(ray.intersectObject(object, true).length).toBeGreaterThan(0);
    } finally { disposeGroup(object); }
  });

  it('does not respawn a fixed sidewalk board when room geometry rebuilds', () => {
    const room = buildRoom(createEmptyShop());
    try {
      expect(room.group.getObjectByName('sidewalk-chalkboard')).toBeUndefined();
      room.previewDimensions(8, 7, 3.2);
      expect(room.group.getObjectByName('sidewalk-chalkboard')).toBeUndefined();
    } finally { disposeGroup(room.group); }
  });

  it('grounds exterior signs on the plinth, sidewalk, bare ground or entrance landing that actually supports them', () => {
    const shop = createEmptyShop();
    const room = buildRoom(shop);
    const x = -shop.width / 2 + 0.5;
    const front = shop.depth / 2;
    try {
      expect(standingSignGroundY(room.floor, undefined, x, front + 0.5, false)).toBeCloseTo(-0.09, 5);
      expect(standingSignGroundY(room.floor, undefined, x, front + 0.5, true)).toBeCloseTo(-0.08, 5);
      expect(standingSignGroundY(room.floor, undefined, x, front + 1.5, false)).toBeCloseTo(-0.401, 5);
      expect(standingSignGroundY(room.floor, undefined, x, front + 1.5, true)).toBeCloseTo(-0.08, 5);
      const mat = room.entrance.getObjectByName('entrance-mat')!;
      room.group.updateMatrixWorld(true);
      const center = mat.getWorldPosition(new THREE.Vector3());
      expect(standingSignGroundY(room.floor, room.entrance, center.x, center.z, false)).toBeCloseTo(0.01, 5);
      expect(standingSignGroundY(room.floor, room.entrance, center.x, center.z, true)).toBeCloseTo(0.01, 5);
      // A moved doorway must immediately use its new support location.
      room.previewDimensions(shop.width, shop.depth, 2.75, 0);
      mat.updateWorldMatrix(true, false);
      mat.getWorldPosition(center);
      expect(standingSignGroundY(room.floor, room.entrance, center.x, center.z, false)).toBeCloseTo(0.01, 5);
    } finally { disposeGroup(room.group); }
    const custom = buildRoom({ ...shop, floorCells: [{ x: 0, z: 0 }] });
    try {
      expect(standingSignGroundY(custom.floor, undefined, x, 1.5 - shop.depth / 2, false)).toBeCloseTo(-0.401, 5);
    } finally { disposeGroup(custom.group); }
  });
});
