import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, getFloorCells, getItemFootprint, getWallHeight, type Rotation, type ShopDocument, type ShopItem } from '../model';
import { buildItem, buildRoom, disposeGroup } from './objects';
import { buildStairwellRims, getStairOpenings, subtractFloorOpenings } from './stairGeometry';

const SLAB = 0.24;
function fixture(rotation: Rotation, resized = false): ShopDocument {
  const stair: ShopItem = { id: 'stairs-down', kind: 'stairs', x: 2, z: 2, color: '#b69972', rotation, stock: 'none', ...(resized ? { width: 3, depth: 4 } : {}) };
  const lower: ShopDocument = { ...createEmptyShop(), width: 10, depth: 10, items: [stair], wallItems: [] };
  return { ...lower, upperFloors: [{ ...lower, width: 12, depth: 12, items: [] }] };
}
function downward(root: THREE.Object3D, x: number, z: number, y = 20) {
  root.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(x, y, z), new THREE.Vector3(0, -1, 0)).intersectObject(root, true);
}

describe('real stairwells between floors', () => {
  it.each([0, 90, 180, 270] as const)('opens every floor layer over the flight rotated %i degrees', rotation => {
    const building = fixture(rotation), saved = JSON.stringify(building), opening = getStairOpenings(building, 1)[0];
    const room = buildRoom(building.upperFloors![0], { slabDepth: SLAB, floorOpenings: [opening] });
    const rims = buildStairwellRims(building, 1);
    try {
      room.floor.add(rims);
      // No brown hatch, tile, backing slab, outline, or trim can seal the void.
      for (const fractionX of [0.08, 0.5, 0.92]) for (const fractionZ of [0.08, 0.5, 0.92]) {
        const x = opening.minX + (opening.maxX - opening.minX) * fractionX;
        const z = opening.minZ + (opening.maxZ - opening.minZ) * fractionZ;
        expect(downward(room.floor, x, z)).toHaveLength(0);
      }
      expect(rims.getObjectByName('stair-landing-opening')).toBeUndefined();
      expect(rims.getObjectByName('stairwell-guardrail')).toBeDefined();
      expect(downward(room.floor, 3.5, 3.5).length).toBeGreaterThan(0);
      expect(getStairOpenings(building, 0)).toEqual([]);
      expect(JSON.stringify(building)).toBe(saved);
    } finally { disposeGroup(room.group); }
  });

  it.each([0, 90, 180, 270] as const)('reveals the actual resized lower stair treads at rotation %i', rotation => {
    const building = fixture(rotation, true), upper = building.upperFloors![0], stair = building.items[0];
    const opening = getStairOpenings(building, 1)[0], rise = getWallHeight(building) + SLAB;
    const room = buildRoom(upper, { slabDepth: SLAB, floorOpenings: [opening] });
    const actual = buildItem(stair, rise), footprint = getItemFootprint(stair);
    actual.position.set(stair.x - building.width / 2 + footprint.width / 2, 0.038, stair.z - building.depth / 2 + footprint.depth / 2);
    actual.rotation.y = -THREE.MathUtils.degToRad(rotation);
    const stack = new THREE.Group(); room.group.position.y = rise; stack.add(room.group, actual);
    try {
      const midpoint = actual.localToWorld(new THREE.Vector3(0, 0, 0));
      const hits = downward(stack, midpoint.x, midpoint.z);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].object.name).toBe('stair-tread');
      expect(hits[0].point.y).toBeLessThan(rise - 0.9);
      expect(hits[0].point.y).toBeGreaterThan(0.5);
      const holeWidth = opening.maxX - opening.minX, holeDepth = opening.maxZ - opening.minZ;
      expect(holeWidth).toBeCloseTo(rotation % 180 === 0 ? 3 * 0.96 : 4 * 0.88);
      expect(holeDepth).toBeCloseTo(rotation % 180 === 0 ? 4 * 0.88 : 3 * 0.96);
      // Both grids stay centered in the same world; a larger upstairs grid
      // must not shift the opening toward its own cell coordinates.
      const expectedShift = new THREE.Vector3(0, 0, -4 * 0.04).applyAxisAngle(new THREE.Vector3(0, 1, 0), actual.rotation.y);
      expect((opening.minX + opening.maxX) / 2).toBeCloseTo(actual.position.x + expectedShift.x);
      expect((opening.minZ + opening.maxZ) / 2).toBeCloseTo(actual.position.z + expectedShift.z);
    } finally { disposeGroup(stack); }
  });

  it('preserves a concave occupied contour around a partially overlapping stairwell', () => {
    const building = fixture(0), upper = building.upperFloors![0];
    upper.floorCells = [{ x: 3, z: 3 }, { x: 4, z: 3 }, { x: 3, z: 4 }, { x: 5, z: 5 }];
    const holes = getStairOpenings(building, 1), room = buildRoom(upper, { floorOpenings: holes, slabDepth: SLAB });
    try {
      for (let x = -4.5; x < 1; x += 0.25) for (let z = -4.5; z < 1; z += 0.25) {
        const occupied = getFloorCells(upper).some(cell => x > cell.x - upper.width / 2 && x < cell.x + 1 - upper.width / 2 && z > cell.z - upper.depth / 2 && z < cell.z + 1 - upper.depth / 2);
        const cutOut = holes.some(hole => x > hole.minX && x < hole.maxX && z > hole.minZ && z < hole.maxZ);
        // Sample away from edges where the existing low outline intentionally protrudes.
        if (Math.abs(x % 1) < 0.05 || Math.abs(z % 1) < 0.05) continue;
        expect(downward(room.floor, x, z).length > 0, `${x},${z}`).toBe(occupied && !cutOut);
      }
    } finally { disposeGroup(room.group); }
  });

  it('does not create a detached landing when the upper contour misses the stairs', () => {
    const building = fixture(0); building.upperFloors![0].floorCells = [{ x: 10, z: 10 }];
    expect(getStairOpenings(building, 1)).toEqual([]);
    const rims = buildStairwellRims(building, 1);
    try { expect(rims.children).toHaveLength(0); } finally { disposeGroup(rims); }
  });

  it('keeps the stairwell aligned while previewing a larger upper room', () => {
    const building = fixture(90), upper = building.upperFloors![0], hole = getStairOpenings(building, 1)[0];
    const room = buildRoom(upper, { floorOpenings: [hole], slabDepth: SLAB });
    try {
      room.previewDimensions(14, 14, getWallHeight(upper));
      for (const x of [hole.minX + 0.03, (hole.minX + hole.maxX) / 2, hole.maxX - 0.03]) {
        for (const z of [hole.minZ + 0.03, (hole.minZ + hole.maxZ) / 2, hole.maxZ - 0.03]) {
          expect(downward(room.floor, x, z)).toHaveLength(0);
        }
      }
      expect(downward(room.floor, 6.5, 6.5).length).toBeGreaterThan(0);
      expect(room.floor.scale.toArray()).toEqual([1, 1, 1]);
    } finally { disposeGroup(room.group); }
  });

  it('subtracts overlapping holes only once, leaving disjoint surface pieces', () => {
    const pieces = subtractFloorOpenings({ minX: 0, maxX: 4, minZ: 0, maxZ: 4 }, [
      { minX: 1, maxX: 3, minZ: 1, maxZ: 3 },
      { minX: 2, maxX: 4, minZ: 2, maxZ: 4 },
    ]);
    expect(pieces.reduce((sum, piece) => sum + (piece.maxX - piece.minX) * (piece.maxZ - piece.minZ), 0)).toBe(9);
    for (const [index, a] of pieces.entries()) for (const b of pieces.slice(index + 1)) {
      expect(a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ).toBe(false);
    }
  });
});
