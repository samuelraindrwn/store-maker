import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, getEntrance, getWallHeight, type Rotation, type ShopDocument } from '../model';
import { buildBuilding } from './buildingObjects';
import { buildEntrance, buildRoom, disposeGroup } from './objects';

/** Compare the actual rendered door, including all leaf, frame, mat and canopy parts. */
function appearance(entrance: THREE.Object3D) {
  entrance.updateWorldMatrix(true, true);
  const parts: unknown[] = [];
  entrance.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    parts.push({
      name: object.name,
      transform: object.matrixWorld.toArray(),
      positions: Array.from(object.geometry.attributes.position.array),
      indices: object.geometry.index ? Array.from(object.geometry.index.array) : null,
      materials: materials.map(material => {
        const surface = material as THREE.MeshStandardMaterial;
        return {
          color: surface.color.getHexString(), opacity: surface.opacity,
          transparent: surface.transparent, roughness: surface.roughness,
          metalness: surface.metalness, depthWrite: surface.depthWrite, side: surface.side,
        };
      }),
    });
  });
  return parts;
}

describe('the same saved entrance in interior and exterior', () => {
  it.each<Rotation>([0, 90, 180, 270])('preserves every part of an open %s degree entrance on a narrow custom floor', rotation => {
    const shop: ShopDocument = {
      ...createEmptyShop(),
      floorCells: [{ x: -2, z: 0 }, { x: -2, z: 1 }],
      entrance: { position: 0.3, open: true, rotation },
      exterior: { wallColor: '#345678', trimColor: '#abcdef', awning: true },
    };
    const room = buildRoom(shop), building = buildBuilding(shop);
    try {
      const exteriorEntrance = building.getObjectByName('shop-entrance');
      expect(exteriorEntrance).toBeDefined();
      expect(room.entrance.scale.x).toBeLessThan(1);
      expect(room.doorPivot.rotation.y).toBeCloseTo(-Math.PI / 2);
      expect(appearance(exteriorEntrance!)).toEqual(appearance(room.entrance));
    } finally { disposeGroup(room.group); disposeGroup(building); }
  });

  it('preserves a moved closed door and the original door colors when facade colors change', () => {
    const shop: ShopDocument = { ...createEmptyShop(), entrance: { position: 0.12, open: false } };
    const recolored: ShopDocument = { ...shop, exterior: { wallColor: '#345678', trimColor: '#abcdef', awning: true } };
    const original = buildRoom(shop), room = buildRoom(recolored), building = buildBuilding(recolored);
    try {
      expect(appearance(room.entrance)).toEqual(appearance(original.entrance));
      expect(appearance(building.getObjectByName('shop-entrance')!)).toEqual(appearance(original.entrance));
    } finally { disposeGroup(original.group); disposeGroup(room.group); disposeGroup(building); }
  });

  it.each([true, false])('shows the same entrance canopy in both views when awning is %s', awning => {
    const shop: ShopDocument = { ...createEmptyShop(), exterior: { wallColor: '#345678', trimColor: '#abcdef', awning } };
    const room = buildRoom(shop), building = buildBuilding(shop);
    try {
      const exteriorEntrance = building.getObjectByName('shop-entrance')!;
      expect(Boolean(room.entrance.getObjectByName('entrance-canopy'))).toBe(awning);
      expect(Boolean(exteriorEntrance.getObjectByName('entrance-canopy'))).toBe(awning);
      expect(appearance(exteriorEntrance)).toEqual(appearance(room.entrance));
    } finally { disposeGroup(room.group); disposeGroup(building); }
  });

  it('keeps live room-size and door-position previews aligned with a newly built entrance', () => {
    const shop = createEmptyShop(), room = buildRoom(shop);
    const changed = { ...shop, width: 10, depth: 8, entrance: { ...getEntrance(shop), position: 0.1 } };
    const expected = buildEntrance(changed);
    try {
      room.previewDimensions(changed.width, changed.depth, getWallHeight(changed), changed.entrance.position);
      expect(appearance(room.entrance)).toEqual(appearance(expected.entrance));
    } finally { disposeGroup(room.group); disposeGroup(expected.entrance); }
  });
});
