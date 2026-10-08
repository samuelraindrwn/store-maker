import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, getEntranceAnchor, getEntranceRotation, getInteriorDoorPosition, getInteriorDoorSize, wallItemPosition, type InteriorDoor, type PartitionWall, type ShopDocument, type WallItem, type WallSide } from '../model';
import { buildBuilding } from './buildingObjects';
import { buildItem, buildRoom, disposeGroup } from './objects';

const sides: WallSide[] = ['back', 'left', 'front', 'right'];
const inward = (side: WallSide) => ({ back: new THREE.Vector3(0, 0, 1), left: new THREE.Vector3(1, 0, 0), front: new THREE.Vector3(0, 0, -1), right: new THREE.Vector3(-1, 0, 0) })[side];
function surfaces(root: THREE.Object3D, names: string[]) {
  const result: THREE.Object3D[] = [];
  root.traverse(object => { if (names.includes(object.name)) result.push(object); });
  return result;
}
function fixture(side: WallSide, style: 'classic' | 'arched' = 'classic'): ShopDocument {
  const shop = { ...createEmptyShop(), width: 8, depth: 8, items: [] };
  const window: WallItem = { id: 'four-sides', kind: 'window', wall: side, line: side === 'front' || side === 'right' ? 8 : 0, offset: 2, height: 1.4, width: 1.8, sizeHeight: 1.5, windowStyle: style, color: '#917baa', text: '', lit: false };
  return { ...shop, entrance: { wall: 'front', position: 0.95, open: true }, wallItems: [window] };
}

describe('authored boundary walls on all four sides', () => {
  for (const side of sides) it.each(['classic', 'arched'] as const)(`shares a real %s window opening on the ${side} side`, style => {
    const shop = fixture(side, style), item = shop.wallItems![0], room = buildRoom(shop), exterior = buildBuilding(shop);
    try {
      room.group.updateMatrixWorld(true); exterior.updateMatrixWorld(true);
      const p = wallItemPosition(shop, item), n = inward(side);
      for (const root of [room.group, exterior]) {
        const solids = surfaces(root, ['structural-wall-panel', 'exterior-wall-panel', 'structural-window-spandrel']);
        const rayAt = (along: number, up: number) => {
          const origin = new THREE.Vector3(p.x, p.y + up, p.z).addScaledVector(n, -0.5);
          if (side === 'back' || side === 'front') origin.x += along; else origin.z += along;
          return new THREE.Raycaster(origin, n, 0, 0.8).intersectObjects(solids, false);
        };
        expect(rayAt(0, 0.5)).toHaveLength(0);
        expect(rayAt(1.1, 0).length).toBeGreaterThan(0);
        expect(rayAt(0.65, 0.5).length > 0).toBe(style === 'arched');
      }
      expect(room.frontWall.visible).toBe(false); expect(room.rightWall.visible).toBe(false);
      expect(exterior.getObjectByName('room-front-wall')!.visible).toBe(true);
      expect(exterior.getObjectByName('room-right-wall')!.visible).toBe(true);
      const accessory = exterior.getObjectByName(`wall-item:${item.id}`)!;
      expect(accessory.position.toArray()).toEqual([p.x, p.y, p.z]);
      expect(accessory.rotation.y).toBe(p.rotation);
    } finally { disposeGroup(room.group); disposeGroup(exterior); }
  });

  it.each(sides)('moves the same entrance and structural doorway onto the %s facade', side => {
    const shop: ShopDocument = { ...createEmptyShop(), entrance: { wall: side, position: 0.6, open: true }, wallItems: [] };
    const room = buildRoom(shop), exterior = buildBuilding(shop), anchor = getEntranceAnchor(shop);
    try {
      exterior.updateMatrixWorld(true); room.group.updateMatrixWorld(true);
      const outside = inward(side).multiplyScalar(-1);
      const expected = -THREE.MathUtils.degToRad(getEntranceRotation(shop));
      expect(room.entrance.rotation.y).toBeCloseTo(expected);
      expect(exterior.getObjectByName('shop-entrance')!.rotation.y).toBeCloseTo(expected);
      expect(room.entrance.position.toArray()).toEqual([anchor.x, 0, anchor.z]);
      const origin = new THREE.Vector3(anchor.x, 1, anchor.z).addScaledVector(outside, 0.5);
      const direction = outside.clone().negate();
      for (const root of [room.group, exterior]) {
        const solids = surfaces(root, ['structural-wall-panel', 'exterior-wall-panel', 'wall-plinth']);
        expect(new THREE.Raycaster(origin, direction, 0, 0.8).intersectObjects(solids, false)).toHaveLength(0);
      }
      const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), expected);
      expect(normal.distanceTo(outside)).toBeLessThan(0.00001);
      expect(room.entrance.userData.centerAxis).toBe(side === 'back' || side === 'front' ? 'x' : 'z');
    } finally { disposeGroup(room.group); disposeGroup(exterior); }
  });

  it('keeps an upstairs facade closed where no separate entrance is authored', () => {
    const upper: ShopDocument = { ...createEmptyShop(), entrance: { wall: 'right', position: 0.5, open: true }, wallItems: [] };
    const building = buildBuilding({ ...createEmptyShop(), upperFloors: [upper] });
    try {
      building.updateMatrixWorld(true);
      const level = building.getObjectByName('exterior-level:2')!, anchor = getEntranceAnchor(upper);
      const ray = new THREE.Raycaster(new THREE.Vector3(anchor.x + 0.5, level.position.y + 1, anchor.z), new THREE.Vector3(-1, 0, 0), 0, 0.8);
      expect(ray.intersectObjects(surfaces(level, ['exterior-wall-panel']), false).length).toBeGreaterThan(0);
      expect(level.getObjectByName('shop-entrance')).toBeUndefined();
    } finally { disposeGroup(building); }
  });
});

describe('independent interior partitions and doors', () => {
  it.each(['x', 'z'] as const)('keeps an actual open passage through an %s-axis partition', axis => {
    const wall: PartitionWall = { id: 'wc-wall', axis, line: 3, start: 1, end: 6, color: '#c9d0c5' };
    const door: InteriorDoor = { id: 'wc-door', wallId: wall.id, offset: 4.25, width: 1, color: '#997893', open: true };
    const shop: ShopDocument = { ...createEmptyShop(), width: 8, depth: 8, partitions: [wall], interiorDoors: [door] };
    const room = buildRoom(shop), exterior = buildBuilding(shop), point = getInteriorDoorPosition(shop, door)!;
    try {
      for (const root of [room.group, exterior]) {
        root.updateMatrixWorld(true);
        const n = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), point.rotation);
        const origin = new THREE.Vector3(point.x, 1, point.z).addScaledVector(n, -0.4);
        const solids = surfaces(root, ['partition-wall-panel', 'partition-wall-plinth', 'interior-door-leaf']);
        expect(new THREE.Raycaster(origin, n, 0, 0.8).intersectObjects(solids, false)).toHaveLength(0);
        const beside = origin.clone(); if (axis === 'x') beside.x += 1; else beside.z += 1;
        expect(new THREE.Raycaster(beside, n, 0, 0.8).intersectObjects(solids, false).length).toBeGreaterThan(0);
        const above = origin.clone(); above.y = getInteriorDoorSize(shop, door).height + 0.2;
        expect(new THREE.Raycaster(above, n, 0, 0.8).intersectObjects(solids, false).length).toBeGreaterThan(0);
        const leaf = root.getObjectByName('interior-door-leaf')!;
        expect(leaf.userData).toMatchObject({ partitionId: wall.id, interiorDoorId: door.id, interaction: 'interior-door' });
        expect(root.getObjectByName(`partition:${wall.id}`)!.visible).toBe(true);
      }
      const closed = buildRoom({ ...shop, interiorDoors: [{ ...door, open: false }] });
      try {
        closed.group.updateMatrixWorld(true);
        const n = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), point.rotation);
        expect(new THREE.Raycaster(new THREE.Vector3(point.x, 1, point.z).addScaledVector(n, -0.4), n, 0, 0.8)
          .intersectObject(closed.partitions, true).length).toBeGreaterThan(0);
      } finally { disposeGroup(closed.group); }
    } finally { disposeGroup(room.group); disposeGroup(exterior); }
  });
});

describe('lighter open stairs', () => {
  it('leaves an unobstructed space under the upper flight while retaining its treads and rails', () => {
    const item = { id: 'open-flight', kind: 'stairs' as const, x: 0, z: 0, rotation: 0 as const, color: '#bb9977', stock: 'none' as const };
    const stair = buildItem(item, 3.2);
    try {
      stair.updateMatrixWorld(true);
      expect(stair.getObjectByName('stair-riser')).toBeUndefined();
      expect(surfaces(stair, ['stair-stringer'])).toHaveLength(2);
      expect(surfaces(stair, ['stair-tread'])).toHaveLength(14);
      // A transverse ray below the high steps would hit the former solid wedge.
      expect(new THREE.Raycaster(new THREE.Vector3(-2, 0.5, -0.8), new THREE.Vector3(1, 0, 0), 0, 4).intersectObject(stair, true)).toHaveLength(0);
      expect(new THREE.Raycaster(new THREE.Vector3(0, 6, -0.8), new THREE.Vector3(0, -1, 0)).intersectObject(stair, true)[0].object.name).toBe('stair-tread');
    } finally { disposeGroup(stair); }
  });
});
