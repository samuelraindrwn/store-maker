import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, getWallHeight, wallItemPosition, type ShopDocument, type WallItem, type WindowStyle } from '../model';
import { buildBuilding, LEVEL_SLAB } from './buildingObjects';
import { buildWallItem, disposeGroup } from './objects';

const styles: WindowStyle[] = ['classic', 'picture', 'grid', 'sliding', 'arched'];
const windowItem = (windowStyle: WindowStyle, wall: WallItem['wall'] = 'back'): WallItem => ({
  id: 'saved-window', kind: 'window', wall, line: 0, offset: 3, height: 1.5,
  color: '#347869', text: '', lit: false, width: 2.2, sizeHeight: 1.4, windowStyle,
});

function named(root: THREE.Object3D, name: string) {
  const objects: THREE.Object3D[] = [];
  root.traverse(object => { if (object.name === name) objects.push(object); });
  return objects;
}

function windowRoots(root: THREE.Object3D) {
  const objects: THREE.Object3D[] = [];
  root.traverse(object => { if (object.name.startsWith('window-style:')) objects.push(object); });
  return objects;
}

function wallHit(building: THREE.Object3D, shop: ShopDocument, item: WallItem, along: number, up: number, base = 0) {
  const p = wallItemPosition(shop, item);
  const inward = item.wall === 'back' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const origin = new THREE.Vector3(p.x, base + p.y + up, p.z).addScaledVector(inward, -0.5);
  if (item.wall === 'back') origin.x += along; else origin.z += along;
  const solids = [...named(building, 'exterior-wall-panel'), ...named(building, 'structural-wall-panel'),
    ...named(building, 'structural-window-spandrel')];
  return new THREE.Raycaster(origin, inward, 0, 0.8).intersectObjects(solids, false);
}

function meshSignature(root: THREE.Object3D) {
  const meshes: { name: string; geometry: string; color: string; min: number[]; max: number[] }[] = [];
  root.updateWorldMatrix(true, true);
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const bounds = new THREE.Box3().setFromObject(object);
    const material = object.material as THREE.MeshStandardMaterial;
    meshes.push({ name: object.name, geometry: object.geometry.type, color: material.color.getHexString(),
      min: bounds.min.toArray().map(n => +n.toFixed(6)), max: bounds.max.toArray().map(n => +n.toFixed(6)) });
  });
  return meshes;
}

describe('the exterior preserves the authored windows', () => {
  it('keeps all four facades windowless when every floor has no windows', () => {
    const ground = createEmptyShop();
    const group = buildBuilding({ ...ground, upperFloors: [createEmptyShop(), createEmptyShop(), createEmptyShop()] });
    try {
      expect(windowRoots(group)).toHaveLength(0);
      expect(named(group, 'storefront-window')).toHaveLength(0);
      expect(named(group, 'upper-floor-window')).toHaveLength(0);
      expect(named(group, 'exterior-glass')).toHaveLength(0);
      expect(named(group, 'entrance-door-glass')).toHaveLength(1);
    } finally { disposeGroup(group); }
  });

  for (const wall of ['back', 'left'] as const) {
    it.each(styles)(`preserves the saved %s window geometry, color, size and mounting plane on the ${wall} wall`, style => {
      const item = windowItem(style, wall);
      const shop: ShopDocument = { ...createEmptyShop(), wallItems: [item], exterior: { wallColor: '#dedac9', trimColor: '#bc89ad', awning: true } };
      const building = buildBuilding(shop), authored = buildWallItem(item);
      const p = wallItemPosition(shop, item);
      authored.position.set(p.x, p.y, p.z); authored.rotation.y = p.rotation;
      try {
        expect(windowRoots(building)).toHaveLength(1);
        const actual = building.getObjectByName(`wall-item:${item.id}`);
        expect(actual).toBeDefined();
        expect(meshSignature(actual!)).toEqual(meshSignature(authored));
        expect(actual!.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([p.x, p.y, p.z]);
      } finally { disposeGroup(building); disposeGroup(authored); }
    });

    it.each(['classic', 'arched'] as const)(`cuts a real %s aperture on the ${wall} wall with solid adjacent walls`, style => {
      const item = windowItem(style, wall), shop = { ...createEmptyShop(), wallItems: [item] };
      const building = buildBuilding(shop);
      try {
        building.updateMatrixWorld(true);
        expect(wallHit(building, shop, item, 0, 0.55)).toHaveLength(0);
        expect(wallHit(building, shop, item, 0.85, 0.05)).toHaveLength(0);
        expect(wallHit(building, shop, item, 1.25, 0).length).toBeGreaterThan(0);
        for (const along of [-0.85, 0.85]) {
          const hits = wallHit(building, shop, item, along, 0.55);
          if (style === 'arched') expect(hits.length).toBeGreaterThan(0);
          else expect(hits).toHaveLength(0);
        }
      } finally { disposeGroup(building); }
    });
  }

  it('adds an arched window once on its saved disconnected boundary run', () => {
    const item = { ...windowItem('arched'), width: 1.2, offset: 5.5 };
    const shop: ShopDocument = { ...createEmptyShop(), wallItems: [item],
      floorCells: Array.from({ length: 3 }, (_, z) => [0, 1, 4, 5, 6].map(x => ({ x, z }))).flat() };
    const building = buildBuilding(shop);
    try {
      building.updateMatrixWorld(true);
      expect(windowRoots(building)).toHaveLength(1);
      expect(named(building, 'structural-window-spandrel')).toHaveLength(2);
      expect(wallHit(building, shop, item, 0, 0.55)).toHaveLength(0);
      expect(wallHit(building, shop, item, 0.45, 0.55).length).toBeGreaterThan(0);
    } finally { disposeGroup(building); }
  });

  it('preserves an inset west window instead of moving it to the outer bounding box', () => {
    const item = { ...windowItem('arched', 'left'), line: 2, offset: 4.5 };
    const shop: ShopDocument = { ...createEmptyShop(), wallItems: [item],
      floorCells: Array.from({ length: 6 }, (_, z) => Array.from({ length: z < 3 ? 7 : 5 }, (_, x) => ({ x: x + (z < 3 ? 0 : 2), z }))).flat() };
    const building = buildBuilding(shop);
    try {
      building.updateMatrixWorld(true);
      const p = wallItemPosition(shop, item), actual = building.getObjectByName(`wall-item:${item.id}`)!;
      expect(actual).toBeDefined();
      expect(actual.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([p.x, p.y, p.z]);
      expect(wallHit(building, shop, item, 0, 0.55)).toHaveLength(0);
      expect(wallHit(building, shop, item, 0.85, 0.55).length).toBeGreaterThan(0);
    } finally { disposeGroup(building); }
  });

  it('keeps independent upper-floor windows at the height and origin of their own floor', () => {
    const upper: ShopDocument = { ...createEmptyShop(), width: 9, depth: 8, wallItems: [windowItem('sliding', 'left')] };
    const ground: ShopDocument = { ...createEmptyShop(), wallHeight: 3.5, upperFloors: [upper] };
    const building = buildBuilding(ground);
    try {
      building.updateMatrixWorld(true);
      const downstairs = building.getObjectByName('exterior-level:1')!, upstairs = building.getObjectByName('exterior-level:2')!;
      const base = getWallHeight(ground) + LEVEL_SLAB, p = wallItemPosition(upper, upper.wallItems![0]);
      expect(windowRoots(downstairs)).toHaveLength(0);
      expect(windowRoots(upstairs)).toHaveLength(1);
      const actual = upstairs.getObjectByName('wall-item:saved-window')!;
      expect(actual.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([p.x, p.y + base, p.z]);
      expect(wallHit(building, upper, upper.wallItems![0], 0.2, 0.2, base)).toHaveLength(0);
    } finally { disposeGroup(building); }
  });
});
