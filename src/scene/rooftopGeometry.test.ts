import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, getItemFootprint, getLevelCount, getLevelDocument, getRooftopDocument, type Rotation, type ShopDocument, type ShopItem } from '../model';
import { buildBuilding, buildInteriorContext, buildRooftopStructure, getBuildingBounds, getLevelBaseY } from './buildingObjects';
import { disposeGroup } from './objects';
import { getStairOpenings } from './stairGeometry';

function fixture(rotation: Rotation = 0, count = 2): ShopDocument {
  const floor: ShopDocument = { ...createEmptyShop(), width: 10, depth: 10, wallHeight: 3.5, items: [], wallItems: [] };
  const stairs: ShopItem = { id: 'roof-access', kind: 'stairs', x: 2, z: 2, width: 2, depth: 4, rotation, color: '#bd9873', stock: 'none' };
  const floors = Array.from({ length: count }, (_, index) => ({ ...floor, wallHeight: 2.75 + index * 0.5, items: index === count - 1 ? [stairs] : [] }));
  return {
    ...floors[0], upperFloors: floors.slice(1), roof: { style: 'rooftop', color: '#d8caae', garden: false },
    rooftop: { floorColor: '#d8caae', items: [{ id: 'outdoor-plant', kind: 'plant', x: 8, z: 8, rotation: 90, color: '#bfa18a', stock: 'none' }] },
  };
}

function downward(root: THREE.Object3D, x: number, z: number, y = 30) {
  root.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(x, y, z), new THREE.Vector3(0, -1, 0)).intersectObject(root, true);
}

describe('editable rooftop geometry', () => {
  it.each([0, 90, 180, 270] as const)('cuts every deck layer around a rotated %i degree staircase', rotation => {
    const building = fixture(rotation), roof = buildRooftopStructure(building), opening = getStairOpenings(building, getLevelCount(building))[0];
    try {
      expect(opening.exitSide).toBe(({ 0: 'north', 90: 'east', 180: 'south', 270: 'west' } as const)[rotation]);
      for (const name of ['floor-cell-slabs', 'floor-cell-edges', 'floor-cell-tiles']) {
        expect(roof.getObjectByName(name)).toBeDefined();
      }
      for (const fractionX of [0.08, 0.5, 0.92]) for (const fractionZ of [0.08, 0.5, 0.92]) {
        const x = opening.minX + (opening.maxX - opening.minX) * fractionX;
        const z = opening.minZ + (opening.maxZ - opening.minZ) * fractionZ;
        expect(downward(roof, x, z)).toHaveLength(0);
      }
      expect(downward(roof, 3.5, 3.5).length).toBeGreaterThan(0);
      expect(roof.getObjectByName('room-back-wall')).toBeUndefined();
      expect(roof.getObjectByName('rooftop-parapet')).toBeDefined();
      expect(roof.getObjectByName('stairwell-guardrail')).toBeDefined();
      // At guard-rail height the upper exit is open in every rotation.
      const centerX = (opening.minX + opening.maxX) / 2, centerZ = (opening.minZ + opening.maxZ) / 2;
      const exit = {
        north: new THREE.Vector3(centerX, 0.77, opening.minZ - 0.03),
        south: new THREE.Vector3(centerX, 0.77, opening.maxZ + 0.03),
        east: new THREE.Vector3(opening.maxX + 0.03, 0.77, centerZ),
        west: new THREE.Vector3(opening.minX - 0.03, 0.77, centerZ),
      }[opening.exitSide];
      roof.traverse(object => {
        if (object.name === 'stairwell-guardrail') expect(new THREE.Box3().setFromObject(object).containsPoint(exit)).toBe(false);
      });
    } finally { disposeGroup(roof); }
  });

  it.each([1, 2, 3, 4])('aligns the roof deck and real top staircase above %i interior floors', count => {
    const building = fixture(0, count), saved = JSON.stringify(building), group = buildBuilding(building);
    try {
      group.updateMatrixWorld(true);
      const roofY = getLevelBaseY(building, count), roof = group.getObjectByName('rooftop-terrace')!;
      expect(roof.position.y).toBeCloseTo(roofY);
      const slab = new THREE.Box3().setFromObject(roof.getObjectByName('floor-cell-slabs')!);
      const paving = new THREE.Box3().setFromObject(roof.getObjectByName('floor-cell-tiles')!);
      expect(slab.min.y).toBeCloseTo(roofY - 0.24);
      expect(paving.max.y).toBeCloseTo(roofY + 0.0245);
      const stair = group.getObjectByName('item:roof-access')!;
      const treads: THREE.Object3D[] = [];
      stair.traverse(object => { if (object.name === 'stair-tread') treads.push(object); });
      const topTread = new THREE.Box3().setFromObject(treads.at(-1)!);
      expect(topTread.max.y - paving.max.y).toBeGreaterThanOrEqual(0);
      expect(topTread.max.y - paving.max.y).toBeLessThan(0.06);
      const opening = getStairOpenings(building, count)[0];
      const hits = downward(group, (opening.minX + opening.maxX) / 2, (opening.minZ + opening.maxZ) / 2);
      expect(hits[0].object.name).toBe('stair-tread');
      expect(hits[0].point.y).toBeLessThan(roofY - 0.5);
      expect(JSON.stringify(building)).toBe(saved);
    } finally { disposeGroup(group); }
  });

  it('renders authored outdoor objects in the exterior at their saved positions', () => {
    const building = fixture(90), group = buildBuilding(building), doc = getRooftopDocument(building);
    try {
      group.updateMatrixWorld(true);
      const item = doc.items[0], size = getItemFootprint(item), object = group.getObjectByName(`item:${item.id}`)!;
      expect(object.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([
        item.x - doc.width / 2 + size.width / 2, getLevelBaseY(building, 2) + 0.038, item.z - doc.depth / 2 + size.depth / 2,
      ]);
      expect(object.rotation.y).toBeCloseTo(-Math.PI / 2);
      expect(new THREE.Box3().setFromObject(group).max.y).toBeLessThanOrEqual(getBuildingBounds(building).height);
      const structure = buildRooftopStructure(building);
      try { expect(structure.getObjectByName(`item:${item.id}`)).toBeUndefined(); } finally { disposeGroup(structure); }
    } finally { disposeGroup(group); }
  });

  it('shows every lower floor faintly while preserving a clearer stair flight to the roof', () => {
    const building = fixture(0, 4), context = buildInteriorContext(building, 4);
    try {
      expect(context.userData.levels).toEqual([0, 1, 2, 3]);
      expect(context.userData.activeFloorY).toBe(getLevelBaseY(building, 4));
      expect(context.children).toHaveLength(4);
      const stair = context.getObjectByName('item:roof-access')!;
      stair.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          expect(material.opacity).toBeCloseTo(0.65);
          expect(material.depthWrite).toBe(false);
        }
      });
      for (const floor of context.children) expect(floor.userData.contextOpacity).toBe(0.2);
      expect(downward(context, -2, -1)).toHaveLength(0);
    } finally { disposeGroup(context); }
  });

  it('matches the top-floor contour and leaves missing roof cells open', () => {
    const building = fixture(), top = getLevelDocument(building, 1);
    top.items = []; top.floorCells = [{ x: 1, z: 1 }, { x: 2, z: 1 }, { x: 1, z: 2 }];
    building.rooftop!.items = [];
    const roof = buildRooftopStructure(building);
    try {
      expect(downward(roof, -3.5, -3.5).length).toBeGreaterThan(0);
      expect(downward(roof, -2.5, -2.5)).toHaveLength(0);
      expect((roof.getObjectByName('floor-cell-slabs') as THREE.InstancedMesh).count).toBe(3);
      expect(getStairOpenings(building, 3)).toEqual([]);
    } finally { disposeGroup(roof); }
  });
});
