import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, getFloorCells, getWallHeight, type Rotation, type ShopDocument } from '../model';
import { buildRoom, disposeGroup } from './objects';

const EPSILON = 0.00001;
// The lower of the city terrain and the bare ground used by ShopScene.
const BARE_GROUND_Y = -0.401;
const positions = [0, 0.3, 0.72, 1];
const fixtures: { name: string; shop: ShopDocument }[] = [
  { name: 'rectangle', shop: createEmptyShop() },
  {
    name: 'stepped floor with several front edges',
    shop: {
      ...createEmptyShop(),
      floorCells: [6, 5, 3, 1].flatMap((width, z) => Array.from({ length: width }, (_, x) => ({ x, z }))),
    },
  },
  { name: 'single-cell front', shop: { ...createEmptyShop(), floorCells: [{ x: -2, z: 1 }] } },
];

function meshNamed(root: THREE.Object3D, name: string): THREE.Mesh {
  const object = root.getObjectByName(name);
  expect(object, name).toBeInstanceOf(THREE.Mesh);
  return object as THREE.Mesh;
}

function containsFootprint(support: THREE.Box3, supported: THREE.Box3) {
  expect(support.min.x).toBeLessThanOrEqual(supported.min.x + EPSILON);
  expect(support.max.x).toBeGreaterThanOrEqual(supported.max.x - EPSILON);
  expect(support.min.z).toBeLessThanOrEqual(supported.min.z + EPSILON);
  expect(support.max.z).toBeGreaterThanOrEqual(supported.max.z - EPSILON);
}

/** Find the actual tile boundary without relying on the entrance's placement offset. */
function floorEdgeBehindDoor(shop: ShopDocument, entrance: THREE.Group): number {
  const cells = getFloorCells(shop);
  const occupied = new Set(cells.map(cell => `${cell.x},${cell.z}`));
  const edges = cells.filter(cell => {
    const left = cell.x - shop.width / 2;
    return !occupied.has(`${cell.x},${cell.z + 1}`)
      && entrance.position.x >= left - EPSILON && entrance.position.x <= left + 1 + EPSILON;
  }).map(cell => cell.z + 1 - shop.depth / 2);
  expect(edges.length).toBeGreaterThan(0);
  return edges.sort((a, b) => Math.abs(entrance.position.z - a) - Math.abs(entrance.position.z - b))[0];
}

describe.each(fixtures)('entrance landing on $name', ({ shop }) => {
  it.each(positions)('remains connected and supports the mat at entrance position %s', position => {
    const room = buildRoom(shop);
    try {
      room.previewDimensions(shop.width, shop.depth, getWallHeight(shop), position);
      room.group.updateMatrixWorld(true);
      const baseMesh = meshNamed(room.entrance, 'entrance-step-base');
      const surfaceMesh = meshNamed(room.entrance, 'entrance-step-surface');
      const matMesh = meshNamed(room.entrance, 'entrance-mat');
      const base = new THREE.Box3().setFromObject(baseMesh);
      const surface = new THREE.Box3().setFromObject(surfaceMesh);
      const mat = new THREE.Box3().setFromObject(matMesh);

      // The entire mat has continuous support down to the lowest scene ground.
      containsFootprint(base, mat);
      containsFootprint(surface, mat);
      expect(base.min.y).toBeLessThanOrEqual(BARE_GROUND_Y);
      expect(base.max.y + EPSILON).toBeGreaterThanOrEqual(surface.min.y);
      expect(Math.abs(surface.max.y - mat.min.y)).toBeLessThan(EPSILON);

      const edge = floorEdgeBehindDoor(shop, room.entrance);
      expect(base.min.z).toBeLessThan(edge - EPSILON);
      expect(surface.min.z).toBeLessThan(edge - EPSILON);
      expect(base.max.z).toBeGreaterThan(edge);

      // Confirm that the rear overlap is over rendered floor, not just a model coordinate.
      const rearProbe = new THREE.Raycaster(
        new THREE.Vector3(room.entrance.position.x, 1, (base.min.z + edge) / 2),
        new THREE.Vector3(0, -1, 0),
      ).intersectObject(room.floor, true)[0];
      expect(rearProbe).toBeDefined();
      expect(rearProbe.point.y).toBeGreaterThan(surface.min.y);

      // Rays across the mat footprint must meet the landing exactly at its underside.
      for (const x of [mat.min.x, (mat.min.x + mat.max.x) / 2, mat.max.x]) {
        for (const z of [mat.min.z, (mat.min.z + mat.max.z) / 2, mat.max.z]) {
          const hit = new THREE.Raycaster(new THREE.Vector3(x, mat.max.y + 1, z), new THREE.Vector3(0, -1, 0))
            .intersectObject(surfaceMesh)[0];
          expect(hit).toBeDefined();
          expect(Math.abs(hit.point.y - mat.min.y)).toBeLessThan(EPSILON);
        }
      }

      // Opening the leaf changes the door geometry while the supported mat stays put.
      const closedDoor = new THREE.Box3().setFromObject(room.doorHit);
      room.doorPivot.rotation.y = -Math.PI / 2;
      room.group.updateMatrixWorld(true);
      expect(new THREE.Box3().setFromObject(room.doorHit).equals(closedDoor)).toBe(false);
      expect(new THREE.Box3().setFromObject(matMesh).equals(mat)).toBe(true);
      expect(new THREE.Box3().setFromObject(baseMesh).equals(base)).toBe(true);
    } finally {
      disposeGroup(room.group);
    }
  });

  it.each<Rotation>([90, 180, 270])('keeps the rotated %s° entrance supported after moving it', rotation => {
    const rotated = { ...shop, entrance: { position: 0.3, open: true, rotation } };
    const room = buildRoom(rotated);
    try {
      room.previewDimensions(shop.width, shop.depth, getWallHeight(shop), 1);
      room.group.updateMatrixWorld(true);
      const baseMesh = meshNamed(room.entrance, 'entrance-step-base');
      const surfaceMesh = meshNamed(room.entrance, 'entrance-step-surface');
      const matMesh = meshNamed(room.entrance, 'entrance-mat');
      const base = new THREE.Box3().setFromObject(baseMesh);
      const surface = new THREE.Box3().setFromObject(surfaceMesh);
      const mat = new THREE.Box3().setFromObject(matMesh);

      expect(room.entrance.rotation.y).toBeCloseTo(-rotation * Math.PI / 180);
      expect(room.doorPivot.rotation.y).toBeCloseTo(-Math.PI / 2);
      containsFootprint(base, mat);
      containsFootprint(surface, mat);
      expect(base.min.y).toBeLessThanOrEqual(BARE_GROUND_Y);
      expect(surface.max.y).toBeCloseTo(mat.min.y);

      // Sample actual rendered surfaces, including the portion turned into the
      // store: the mat rests on its landing and cannot disappear below tiles.
      for (const x of [-0.6, 0, 0.6]) for (const z of [0.4, 0.63, 0.85]) {
        const point = matMesh.localToWorld(new THREE.Vector3(x, 1, z - 0.63));
        const ray = new THREE.Raycaster(point, new THREE.Vector3(0, -1, 0));
        const support = ray.intersectObject(surfaceMesh)[0];
        expect(support).toBeDefined();
        expect(support.point.y).toBeCloseTo(mat.min.y);
        const tile = ray.intersectObject(room.floor, true)[0];
        if (tile) expect(support.point.y).toBeGreaterThan(tile.point.y);
      }

      // Even on a narrow or stepped contour, the turned foundation intersects
      // the floor edge instead of floating away from the room.
      const edge = floorEdgeBehindDoor(shop, room.entrance);
      expect(base.min.z).toBeLessThan(edge);
      expect(base.max.z).toBeGreaterThan(edge);
      const contact = new THREE.Vector3(room.entrance.position.x, 1, edge - 0.1);
      const ray = new THREE.Raycaster(contact, new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObject(room.floor, true)[0]).toBeDefined();
      expect(ray.intersectObject(surfaceMesh)[0]).toBeDefined();
    } finally {
      disposeGroup(room.group);
    }
  });
});
