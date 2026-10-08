import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, createItem, getItemFootprint, type ShopItem } from '../model';
import { buildRoom, disposeGroup, standingSignGroundY } from './objects';
import { getItemSupport } from './itemSupport';

const board = (patch: Partial<ShopItem> = {}): ShopItem => ({ ...createItem('chalkboard'), x: 0, z: 6, ...patch });

describe('outdoor item support', () => {
  it('leaves normal floor objects and resized signs placed on floor at their original base height', () => {
    const shop = createEmptyShop();
    const room = buildRoom(shop);
    try {
      for (const showCity of [true, false]) {
        expect(getItemSupport(shop, createItem('table'), room.floor, room.entrance, showCity)).toEqual({ baseY: 0.038 });
        expect(getItemSupport(shop, board({ z: 0, width: 3, depth: 2 }), room.floor, room.entrance, showCity)).toEqual({ baseY: 0.038 });
      }
    } finally { disposeGroup(room.group); }
  });

  it('preserves exact one-cell support behavior on both exterior rows and at the entrance', () => {
    const shop = createEmptyShop();
    const room = buildRoom(shop);
    try {
      for (const showCity of [true, false]) for (const x of [0, 4]) for (const z of [6, 7]) {
        const item = board({ x, z, width: 1, depth: 1 });
        const expected = standingSignGroundY(room.floor, room.entrance, x - shop.width / 2 + 0.5, z - shop.depth / 2 + 0.5, showCity) + 0.002;
        expect(getItemSupport(shop, item, room.floor, room.entrance, showCity)).toEqual({ baseY: expected });
      }
    } finally { disposeGroup(room.group); }
  });

  it('supports both rows beneath a two-by-two sign when the city is hidden', () => {
    const shop = createEmptyShop();
    const room = buildRoom(shop);
    const item = board({ width: 2, depth: 2 });
    try {
      const result = getItemSupport(shop, item, room.floor, undefined, false);
      const foundation = result.foundation!;
      const lipSurface = standingSignGroundY(room.floor, undefined, -2.5, 3.03, false);
      expect(foundation).toBeDefined();
      expect(lipSurface).toBeGreaterThan(standingSignGroundY(room.floor, undefined, -2.5, 3.5, false));
      expect(result.baseY).toBeCloseTo(lipSurface + 0.002, 5);
      expect(foundation.top).toBeCloseTo(lipSurface, 5);
      expect(foundation.bottom).toBeLessThanOrEqual(-0.401);
      expect(foundation).toMatchObject({ x: -2.5, z: 4, width: 1.94, depth: 1.94 });
      // The platform reaches the lowest terrain and supports all scaled feet at one height.
      for (const x of [-3, -2]) for (const z of [3.5, 4.5]) {
        const surface = standingSignGroundY(room.floor, undefined, x, z, false);
        expect(foundation.bottom).toBeLessThanOrEqual(surface + 0.000001);
        expect(foundation.top).toBeGreaterThanOrEqual(surface - 0.000001);
        expect(x).toBeGreaterThan(foundation.x - foundation.width / 2);
        expect(x).toBeLessThan(foundation.x + foundation.width / 2);
        expect(z).toBeGreaterThan(foundation.z - foundation.depth / 2);
        expect(z).toBeLessThan(foundation.z + foundation.depth / 2);
      }
      expect(result.baseY - foundation.top).toBeCloseTo(0.002);
    } finally { disposeGroup(room.group); }
  });

  it('needs no added platform when the whole enlarged footprint already has a flat sidewalk', () => {
    const shop = createEmptyShop();
    const room = buildRoom(shop);
    try {
      const result = getItemSupport(shop, board({ width: 2, depth: 1, z: 7 }), room.floor, undefined, true);
      expect(result.baseY).toBeCloseTo(-0.078);
      expect(result.foundation).toBeUndefined();
    } finally { disposeGroup(room.group); }
  });

  it('finds the raised real entrance landing even when the first cell lies beside it', () => {
    const shop = createEmptyShop();
    const room = buildRoom(shop);
    const item = board({ x: 2, width: 4, depth: 2 });
    try {
      const anchorSurface = standingSignGroundY(room.floor, room.entrance, -1, 3.5, true);
      const mat = room.entrance.getObjectByName('entrance-mat')!;
      room.group.updateMatrixWorld(true);
      const center = mat.getWorldPosition(new THREE.Vector3());
      const matSurface = standingSignGroundY(room.floor, room.entrance, center.x, center.z, true);
      expect(matSurface).toBeGreaterThan(anchorSurface);
      for (const showCity of [true, false]) {
        const result = getItemSupport(shop, item, room.floor, room.entrance, showCity);
        expect(result.baseY).toBeCloseTo(matSurface + 0.002, 5);
        expect(result.foundation!.top).toBeCloseTo(matSurface, 5);
        expect(result.foundation!.bottom).toBeLessThanOrEqual(showCity ? -0.08 : -0.401);
      }
    } finally { disposeGroup(room.group); }
  });

  it('uses the rotated footprint and current shop anchor for platform placement', () => {
    const shop = { ...createEmptyShop(), width: 8, depth: 7 };
    const room = buildRoom(shop);
    const item = board({ z: 7, width: 2, depth: 3, rotation: 90 });
    try {
      expect(getItemFootprint(item)).toEqual({ width: 3, depth: 2 });
      const result = getItemSupport(shop, item, room.floor, undefined, false);
      expect(result.foundation).toMatchObject({ x: -2.5, z: 4.5, width: 2.94, depth: 1.94 });
      expect(result.baseY).toBeCloseTo(result.foundation!.top + 0.002);
    } finally { disposeGroup(room.group); }
  });

  it('detects a narrow transformed support between cell centers instead of assuming its bounding-box height', () => {
    const shop = createEmptyShop();
    const floor = new THREE.Group();
    const entrance = new THREE.Group();
    const mat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), new THREE.MeshBasicMaterial());
    mat.name = 'entrance-mat';
    entrance.add(mat);
    entrance.position.set(-3.27, 0.15, 3.77);
    entrance.rotation.y = Math.PI / 4;
    try {
      const result = getItemSupport(shop, board({ width: 2, depth: 2 }), floor, entrance, false);
      expect(result.foundation).toBeDefined();
      expect(result.foundation!.top).toBeCloseTo(0.2);
      expect(result.foundation!.bottom).toBe(-0.401);
      expect(result.baseY).toBeCloseTo(0.202);
      // Merely overlapping an AABB is insufficient: support entirely outside the
      // inset footprint must not lift the item or generate an unnecessary platform.
      entrance.position.x = -4;
      const outside = getItemSupport(shop, board({ width: 2, depth: 2 }), floor, entrance, false);
      expect(outside).toEqual({ baseY: -0.399 });
    } finally { disposeGroup(floor); disposeGroup(entrance); }
  });
});
