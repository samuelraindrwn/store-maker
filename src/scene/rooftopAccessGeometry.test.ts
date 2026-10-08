import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, createItem, getItemFootprint, getWallHeight, type Rotation, type ShopDocument } from '../model';
import { buildBuilding, buildRooftopStructure, getBuildingBounds, getStairRise } from './buildingObjects';
import { applyItemSize, buildItem, disposeGroup } from './objects';
import { buildStairwellRims, getStairOpenings } from './stairGeometry';

function fixture(rotation: Rotation = 0): ShopDocument {
  return { ...createEmptyShop(), width: 10, depth: 10, items: [{ ...createItem('stairs'), id: 'access', x: 3, z: 3, rotation }],
    roof: { style: 'rooftop', stairAccess: 'enclosed', color: '#BC7A5A', garden: false }, rooftop: { items: [], floorColor: '#DECEBA' } };
}

describe('roof stair houses and joined landings', () => {
  it.each([0, 90, 180, 270] as const)('encloses rotation %i with an open exit and a solid roof', rotation => {
    const building = fixture(rotation), structure = buildRooftopStructure(building);
    try {
      structure.updateMatrixWorld(true);
      const house = structure.getObjectByName('stair-access-enclosure:access')!;
      expect(house).toBeDefined();
      expect(house.getObjectByName('stair-access-roof')).toBeDefined();
      expect(house.getObjectByName('stair-access-open-door')).toBeDefined();
      expect(structure.getObjectByName('stairwell-guardrail')).toBeUndefined();
      const hole = getStairOpenings(building, 1)[0];
      const depth = rotation % 180 === 0 ? hole.maxZ - hole.minZ : hole.maxX - hole.minX;
      const entry = house.localToWorld(new THREE.Vector3(0, 1, -depth / 2 - 0.22));
      const direction = new THREE.Vector3(0, 0, 1).transformDirection(house.matrixWorld);
      expect(new THREE.Raycaster(entry, direction, 0, 0.5).intersectObject(house, true)).toHaveLength(0);
      const roofHits = new THREE.Raycaster(house.localToWorld(new THREE.Vector3(0, 4, 0)), new THREE.Vector3(0, -1, 0)).intersectObject(house, true);
      expect(roofHits[0].object.name).toBe('stair-access-roof-cap');
      expect(new THREE.Box3().setFromObject(structure).max.y).toBeLessThanOrEqual(2.401);
      expect(getBuildingBounds(building).height).toBeGreaterThanOrEqual(getWallHeight(building) + 0.24 + 2.4);
    } finally { disposeGroup(structure); }
  });

  it.each([0, 90, 180, 270] as const)('clears the crossing rail but preserves side guards beside an aligned upper flight at rotation %i', rotation => {
    const building = fixture(rotation), lower = building.items[0];
    building.upperFloors = [{ ...createEmptyShop(), width: 10, depth: 10, items: [{ ...lower, id: 'next-flight' }] }];
    const rims = buildStairwellRims(building, 1);
    try {
      expect(rims.getObjectByName('stairwell-rim')).toBeDefined();
      expect(rims.getObjectByName('stairwell-guardrail')).toBeDefined();
      expect(rims.getObjectByName('stairwell-guard-post')).toBeDefined();
      rims.traverse(object => {
        if (object.name !== 'stairwell-guardrail') return;
        const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
        expect(rotation % 180 === 0 ? size.z > size.x : size.x > size.z).toBe(true);
      });
    } finally { disposeGroup(rims); }
  });

  it('trims only the intersecting guard sections for a partly overlapping upper flight', () => {
    const building = fixture(), upperStairs = { ...building.items[0], id: 'upper', x: 4 };
    building.upperFloors = [{ ...createEmptyShop(), width: 10, depth: 10, items: [upperStairs] }];
    const rims = buildStairwellRims(building, 1), size = getItemFootprint(upperStairs);
    try {
      rims.updateMatrixWorld(true);
      expect(rims.getObjectByName('stairwell-guardrail')).toBeDefined();
      rims.traverse(object => {
        if (!['stairwell-guardrail', 'stairwell-guard-post'].includes(object.name)) return;
        const box = new THREE.Box3().setFromObject(object);
        expect(box.min.x < upperStairs.x - 5 + size.width && box.max.x > upperStairs.x - 5
          && box.min.z < upperStairs.z - 5 + size.depth && box.max.z > upperStairs.z - 5).toBe(false);
      });
    } finally { disposeGroup(rims); }
  });

  it('keeps an old unmarked top-floor stair below the tile roof without deleting it', () => {
    const building = fixture(); building.roof!.style = 'tiles';
    const scene = buildBuilding(building);
    try {
      scene.updateMatrixWorld(true);
      const stairs = scene.getObjectByName('item:access')!;
      expect(stairs).toBeDefined();
      expect(new THREE.Box3().setFromObject(stairs).max.y).toBeLessThan(getWallHeight(building));
      expect(stairs.userData.stairRise).toBe(getStairRise(building, 0));
      expect(building.items).toHaveLength(1);
    } finally { disposeGroup(scene); }
  });
});

describe('outdoor shade geometry', () => {
  it.each(['canopy', 'patio-umbrella'] as const)('%s resizes in both axes without changing its height', kind => {
    const item = { ...createItem(kind), width: 4, depth: 6 };
    const group = buildItem(item);
    try {
      const initial = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
      expect(group.userData.outdoorCover).toBe(true);
      expect(initial.x).toBeLessThanOrEqual(4.001);
      expect(initial.z).toBeLessThanOrEqual(6.001);
      expect(initial.y).toBeLessThan(2.8);
      applyItemSize(group, { ...item, width: 2, depth: 3 });
      const resized = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
      expect(resized.x).toBeCloseTo(initial.x / 2);
      expect(resized.z).toBeCloseTo(initial.z / 2);
      expect(resized.y).toBeCloseTo(initial.y);
    } finally { disposeGroup(group); }
  });
});
