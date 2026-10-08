import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, createItem, getItemFootprint, type Rotation, type ShopDocument } from '../model';
import { disposeGroup } from './objects';
import { buildStairwellRims, getStairOpenings, type FloorOpening } from './stairGeometry';

function fixture(rotation: Rotation = 0): ShopDocument {
  const lower = { ...createItem('stairs'), id: 'lower', x: 2, z: 2, depth: 4, rotation };
  const upper = { ...lower, id: 'upper', depth: 3 };
  // Keep both high ends aligned as the flight is rotated, leaving the short
  // upper flight's low entry inside the opening from the longer lower flight.
  if (rotation === 90) upper.x++;
  if (rotation === 180) upper.z++;
  return { ...createEmptyShop(), width: 12, depth: 12, items: [lower], upperFloors: [
    { ...createEmptyShop(), width: 12, depth: 12, floorColor: '#BFAE98', items: [upper] },
  ] };
}

function boxes(group: THREE.Group, name: string) {
  group.updateMatrixWorld(true);
  const result: THREE.Box3[] = [];
  group.traverse(object => { if (object.name === name) result.push(new THREE.Box3().setFromObject(object)); });
  return result;
}

function contains(rectangle: FloorOpening, x: number, z: number) {
  return x > rectangle.minX && x < rectangle.maxX && z > rectangle.minZ && z < rectangle.maxZ;
}

function expectSideGuards(group: THREE.Group, hole: FloorOpening, rotation: Rotation) {
  const rails = boxes(group, 'stairwell-guardrail');
  const alongZ = rotation % 180 === 0;
  const minAlong = alongZ ? hole.minZ : hole.minX, maxAlong = alongZ ? hole.maxZ : hole.maxX;
  const sides = alongZ ? [hole.minX - 0.015, hole.maxX + 0.015] : [hole.minZ - 0.015, hole.maxZ + 0.015];
  for (const across of sides) for (const along of [minAlong + 0.12, (minAlong + maxAlong) / 2, maxAlong - 0.12]) {
    const point = new THREE.Vector3(alongZ ? across : along, 0.77, alongZ ? along : across);
    expect(rails.some(rail => rail.containsPoint(point)), `side guard at ${point.x}, ${point.z}`).toBe(true);
  }
  // Side rails are parallel to the flight, never a fence across its entry.
  expect(rails.every(rail => alongZ ? rail.max.z - rail.min.z > rail.max.x - rail.min.x : rail.max.x - rail.min.x > rail.max.z - rail.min.z)).toBe(true);
}

describe('automatic shared stair landings', () => {
  it.each([0, 90, 180, 270] as const)('bridges a short upper flight to the floor and clears its entry at rotation %i', rotation => {
    const doc = fixture(rotation), saved = JSON.stringify(doc), group = buildStairwellRims(doc, 1);
    try {
      const bridges = boxes(group, 'stairwell-entry-bridge');
      expect(bridges.length).toBeGreaterThan(0);
      // The entrance stays open, but the long sides of the descent and its
      // connecting bridge remain protected alongside the continuing flight.
      const hole = getStairOpenings(doc, 1)[0];
      expectSideGuards(group, hole, rotation);
      expect(boxes(group, 'stairwell-entry-guardrail')).toHaveLength(0);
      const point = new THREE.Vector3((hole.minX + hole.maxX) / 2, 1, (hole.minZ + hole.maxZ) / 2);
      if (rotation === 0) point.z = hole.maxZ - 0.1;
      if (rotation === 90) point.x = hole.minX + 0.1;
      if (rotation === 180) point.z = hole.minZ + 0.1;
      if (rotation === 270) point.x = hole.maxX - 0.1;
      if (rotation % 180 === 0) point.x += 0.13;
      else point.z += 0.13;
      const hits = new THREE.Raycaster(point, new THREE.Vector3(0, -1, 0)).intersectObject(group, true);
      expect(hits[0].object.name).toBe('stairwell-entry-bridge');
      expect(hits[0].point.y).toBeCloseTo(0.024);
      expect(hits[0].object.userData.upperStairId).toBe('upper');
      expect(hits[0].object.userData.lowerStairId).toBe('lower');
      expect((hits[0].object as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material.color.getHexString()).toBe('bfae98');
      // The central descent remains a genuine hole, not a filled stairwell.
      const center = new THREE.Vector3((hole.minX + hole.maxX) / 2, 1, (hole.minZ + hole.maxZ) / 2);
      expect(new THREE.Raycaster(center, new THREE.Vector3(0, -1, 0)).intersectObject(group, true)).toHaveLength(0);
      expect(JSON.stringify(doc)).toBe(saved);
    } finally { disposeGroup(group); }
  });

  it.each([0, 90, 180, 270] as const)('keeps both side guards for equal-length stacked flights at rotation %i', rotation => {
    const doc = fixture(rotation);
    doc.upperFloors![0].items = [{ ...doc.items[0], id: 'upper' }];
    const group = buildStairwellRims(doc, 1);
    try {
      expectSideGuards(group, getStairOpenings(doc, 1)[0], rotation);
      expect(boxes(group, 'stairwell-entry-bridge')).toHaveLength(0);
      expect(boxes(group, 'stairwell-entry-guardrail')).toHaveLength(0);
    } finally { disposeGroup(group); }
  });

  it.each([0, 90, 180, 270] as const)('does not leave a side rail crossing a perpendicular upper flight at rotation %i', rotation => {
    const doc = fixture(rotation), lower = doc.items[0];
    const lowerSize = getItemFootprint(lower);
    const upper = { ...lower, id: 'upper', rotation: ((rotation + 90) % 360) as Rotation };
    const upperSize = getItemFootprint(upper);
    upper.x += (lowerSize.width - upperSize.width) / 2;
    upper.z += (lowerSize.depth - upperSize.depth) / 2;
    doc.upperFloors![0].items = [upper];
    const group = buildStairwellRims(doc, 1);
    try {
      const centerX = upper.x - doc.width / 2 + upperSize.width / 2;
      const centerZ = upper.z - doc.depth / 2 + upperSize.depth / 2;
      const direction = upper.rotation % 180 === 0 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      const start = new THREE.Vector3(centerX, 0.77, centerZ).addScaledVector(direction, -1.8);
      // A guard beside the lower hole can be perpendicular to the next flight;
      // its central walking path must still remain unobstructed.
      const hits = new THREE.Raycaster(start, direction, 0, 3.6).intersectObject(group, true);
      expect(hits.filter(hit => ['stairwell-guardrail', 'stairwell-entry-guardrail'].includes(hit.object.name))).toHaveLength(0);
      expect(boxes(group, 'stairwell-guardrail').length).toBeGreaterThan(0);
    } finally { disposeGroup(group); }
  });

  it.each([0, 90, 180, 270] as const)('protects both exposed sides of a narrower entry at rotation %i', rotation => {
    const doc = fixture(rotation); doc.items[0].width = 4;
    const upper = doc.upperFloors![0].items[0];
    if (rotation % 180 === 0) upper.x++;
    else upper.z++;
    const group = buildStairwellRims(doc, 1);
    try {
      expect(boxes(group, 'stairwell-entry-bridge').length).toBeGreaterThan(0);
      expect(boxes(group, 'stairwell-guardrail').length).toBeGreaterThan(0);
      expect(boxes(group, 'stairwell-entry-guardrail')).toHaveLength(2);
      const hole = getStairOpenings(doc, 1)[0];
      const size = getItemFootprint(upper);
      const centerX = upper.x - doc.width / 2 + size.width / 2, centerZ = upper.z - doc.depth / 2 + size.depth / 2;
      const start = rotation === 0 ? new THREE.Vector3(centerX, 0.77, hole.maxZ + 0.1)
        : rotation === 90 ? new THREE.Vector3(hole.minX - 0.1, 0.77, centerZ)
        : rotation === 180 ? new THREE.Vector3(centerX, 0.77, hole.minZ - 0.1)
        : new THREE.Vector3(hole.maxX + 0.1, 0.77, centerZ);
      const direction = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotation * Math.PI / 180);
      expect(new THREE.Raycaster(start, direction, 0, 0.6).intersectObject(group, true)).toHaveLength(0);
      for (const rail of boxes(group, 'stairwell-entry-guardrail')) {
        expect(rail.min.x).toBeGreaterThanOrEqual(hole.minX - 0.001);
        expect(rail.max.x).toBeLessThanOrEqual(hole.maxX + 0.001);
        expect(rail.min.z).toBeGreaterThanOrEqual(hole.minZ - 0.001);
        expect(rail.max.z).toBeLessThanOrEqual(hole.maxZ + 0.001);
        expect(rotation % 180 === 0 ? rail.max.z - rail.min.z > rail.max.x - rail.min.x : rail.max.x - rail.min.x > rail.max.z - rail.min.z).toBe(true);
      }
    } finally { disposeGroup(group); }
  });

  it('uses each level centered grid, including an offset partly overlapping flight', () => {
    const doc = fixture(); doc.upperFloors![0].width = 14; doc.upperFloors![0].depth = 14;
    doc.upperFloors![0].items[0].x += 2; doc.upperFloors![0].items[0].z++;
    const group = buildStairwellRims(doc, 1), hole = getStairOpenings(doc, 1)[0];
    try {
      const bridges = boxes(group, 'stairwell-entry-bridge');
      expect(bridges.length).toBeGreaterThan(0);
      for (const bridge of bridges) {
        expect(bridge.min.x).toBeGreaterThanOrEqual(-3);
        expect(bridge.max.x).toBeLessThanOrEqual(hole.maxX + 0.001);
        expect(bridge.max.z).toBeLessThanOrEqual(hole.maxZ + 0.001);
      }
      expect(boxes(group, 'stairwell-entry-guardrail').length).toBeGreaterThan(0);
    } finally { disposeGroup(group); }
  });

  it.each(['outside', 'entry-outside', 'opposite', 'removed'] as const)('does not create a landing for a %s flight', scenario => {
    const doc = fixture();
    if (scenario === 'outside') doc.upperFloors![0].items[0].x = 7;
    if (scenario === 'entry-outside') doc.upperFloors![0].items[0].z = 4;
    if (scenario === 'opposite') doc.upperFloors![0].items[0].rotation = 180;
    if (scenario === 'removed') doc.upperFloors![0].items = [];
    const group = buildStairwellRims(doc, 1);
    try {
      expect(boxes(group, 'stairwell-entry-bridge')).toHaveLength(0);
      if (scenario === 'outside' || scenario === 'removed') expect(boxes(group, 'stairwell-guardrail').length).toBeGreaterThan(0);
    } finally { disposeGroup(group); }
  });

  it('clips a joined approach to occupied cells and guards the remaining open edge', () => {
    const doc = fixture();
    doc.upperFloors![0].floorCells = [{ x: 2, z: 4 }, { x: 2, z: 5 }, { x: 3, z: 4 }];
    const group = buildStairwellRims(doc, 1);
    try {
      const bridges = boxes(group, 'stairwell-entry-bridge');
      expect(bridges.length).toBeGreaterThan(0);
      for (const bridge of bridges) {
        const p = bridge.getCenter(new THREE.Vector3());
        expect(doc.upperFloors![0].floorCells!.some(cell => contains({ minX: cell.x - 6, maxX: cell.x - 5, minZ: cell.z - 6, maxZ: cell.z - 5 }, p.x, p.z))).toBe(true);
        expect(bridge.max.x).toBeLessThanOrEqual(-3);
      }
      expect(boxes(group, 'stairwell-entry-guardrail').length).toBeGreaterThan(0);
    } finally { disposeGroup(group); }
  });
});
