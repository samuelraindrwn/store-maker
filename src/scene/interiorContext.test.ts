import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, createInitialShop, getEntranceAnchor, getItemFootprint, wallItemPosition, type ShopDocument } from '../model';
import { buildBuilding, buildInteriorContext, getLevelBaseY, LEVEL_SLAB } from './buildingObjects';
import { disposeGroup } from './objects';
import { NightLighting } from './lighting';
import { getStairOpenings } from './stairGeometry';

function fixture(): ShopDocument {
  const building = createInitialShop();
  building.wallHeight = 3.5;
  building.upperFloors = [
    { ...building.upperFloors![0], wallHeight: 2.75,
      items: [{ id: 'upper-stairs', kind: 'stairs', x: 1, z: 2, rotation: 90, color: '#ad947a', stock: 'none' }],
      wallItems: [{ id: 'upper-window', kind: 'window', wall: 'left', line: 0, offset: 2.5, height: 1.5, color: '#768c85', text: '', lit: false, windowStyle: 'arched' }],
    },
    { ...createEmptyShop(), wallHeight: 4 },
    createEmptyShop(),
  ];
  return building;
}

function surfaces(root: THREE.Object3D) {
  const result: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>[] = [];
  root.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); });
  return result;
}

function materials(root: THREE.Object3D) {
  return [...new Set(surfaces(root).flatMap(object => Array.isArray(object.material) ? object.material : [object.material]))];
}

describe('lower-floor interior context', () => {
  it('uses every lower wall height plus its slab for the selected floor elevation', () => {
    const building = fixture();
    expect(getLevelBaseY(building, 0)).toBe(0);
    expect(getLevelBaseY(building, 1)).toBeCloseTo(3.5 + LEVEL_SLAB);
    expect(getLevelBaseY(building, 2)).toBeCloseTo(3.5 + 2.75 + 2 * LEVEL_SLAB);
    expect(getLevelBaseY(building, 3)).toBeCloseTo(3.5 + 2.75 + 4 + 3 * LEVEL_SLAB);
  });

  it.each([0, 1, 2, 3])('shows only floors below selected index %i, with no roof or closed facade', activeLevel => {
    const building = fixture(), context = buildInteriorContext(building, activeLevel);
    try {
      expect(context.children).toHaveLength(activeLevel);
      expect(context.userData).toMatchObject({ activeLevel, activeFloorY: getLevelBaseY(building, activeLevel),
        levels: Array.from({ length: activeLevel }, (_, level) => level), opacity: 0.2, connectingStairOpacity: 0.65 });
      context.children.forEach((floor, level) => {
        expect(floor.name).toBe(`interior-context-level:${level + 1}`);
        expect(floor.position.y).toBe(getLevelBaseY(building, level));
        expect(floor.getObjectByName('exterior-wall:south')).toBeUndefined();
        expect(floor.getObjectByName('exterior-wall:east')).toBeUndefined();
        expect(Boolean(floor.getObjectByName('shop-entrance'))).toBe(level === 0);
      });
      expect(context.getObjectByName('tiled-roof')).toBeUndefined();
      expect(context.getObjectByName('rooftop-terrace')).toBeUndefined();
    } finally { disposeGroup(context); }
  });

  it('keeps saved furniture, window styles and ground entrance at their actual world coordinates', () => {
    const building = fixture(), context = buildInteriorContext(building, 2);
    try {
      context.updateMatrixWorld(true);
      const upper = building.upperFloors![0], item = upper.items[0], size = getItemFootprint(item);
      const furniture = context.getObjectByName(`item:${item.id}`)!;
      expect(furniture.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([
        item.x - upper.width / 2 + size.width / 2, getLevelBaseY(building, 1) + 0.038, item.z - upper.depth / 2 + size.depth / 2,
      ]);
      expect(furniture.rotation.y).toBeCloseTo(-Math.PI / 2);
      const window = upper.wallItems![0], position = wallItemPosition(upper, window);
      const mounted = context.getObjectByName(`wall-item:${window.id}`)!;
      expect(mounted.getObjectByName('window-style:arched')).toBeDefined();
      expect(mounted.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([position.x, position.y + getLevelBaseY(building, 1), position.z]);
      const anchor = getEntranceAnchor(building), entrance = context.getObjectByName('shop-entrance')!;
      expect(entrance.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([anchor.x, 0, anchor.z]);
    } finally { disposeGroup(context); }
  });

  it('uses faint inert surfaces while keeping the connecting stairs clearer than older floors', () => {
    const context = buildInteriorContext(fixture(), 2);
    const groundMaterial = new THREE.MeshStandardMaterial();
    const lighting = new NightLighting(new THREE.Scene(), { toneMappingExposure: 1 }, groundMaterial);
    try {
      context.updateMatrixWorld(true);
      for (const mesh of surfaces(context)) {
        expect(mesh.castShadow).toBe(false); expect(mesh.receiveShadow).toBe(false);
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          expect(material.transparent).toBe(true); expect(material.depthWrite).toBe(false);
          expect(material.opacity).toBeLessThanOrEqual(0.65);
          expect(material.userData.nightGlow).toBeUndefined(); expect(material.userData.nightOpacity).toBeUndefined();
        }
      }
      for (const material of materials(context.getObjectByName('item:upper-stairs')!)) expect(material.opacity).toBeCloseTo(0.65);
      for (const material of materials(context.getObjectByName('item:ground-stairs')!)) expect(material.opacity).toBeCloseTo(0.2);
      for (const material of materials(context.getObjectByName('room-floor')!)) expect(material.opacity).toBeCloseTo(0.2);
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 20, 0), new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObject(context, true)).toHaveLength(0);
      lighting.refreshSources([context]); lighting.setMode(true, true); lighting.update(0, true);
      expect(lighting.activeShopLights).toBe(0); expect(lighting.activeCityLights).toBe(0);
      for (const material of materials(context.getObjectByName('item:upper-stairs')!)) expect(material.opacity).toBeCloseTo(0.65);
    } finally { lighting.dispose(); groundMaterial.dispose(); disposeGroup(context); }
  });

  it('preserves upper-floor contours and slab depth without a ground podium overhang', () => {
    const building = fixture();
    building.items = [];
    building.upperFloors![0] = { ...createEmptyShop(), width: 9, depth: 8, floorCells: [{ x: 2, z: 2 }, { x: 3, z: 2 }, { x: 2, z: 3 }] };
    const context = buildInteriorContext(building, 2);
    try {
      context.updateMatrixWorld(true);
      const upper = context.getObjectByName('interior-context-level:2')!;
      const slab = upper.getObjectByName('floor-cell-slabs') as THREE.InstancedMesh;
      const bounds = new THREE.Box3().setFromObject(slab);
      expect(slab.count).toBe(3);
      expect(bounds.min.toArray()).toEqual([-2.5, expect.closeTo(getLevelBaseY(building, 1) - LEVEL_SLAB), -2]);
      expect(bounds.max.toArray()).toEqual([-0.5, expect.closeTo(getLevelBaseY(building, 1) - 0.09), 0]);
    } finally { disposeGroup(context); }
  });

  it('does not alter the saved design or any materials in an independently rendered exterior', () => {
    const building = fixture(), saved = JSON.stringify(building), exterior = buildBuilding(building);
    const originalMaterials = materials(exterior), opacities = originalMaterials.map(material => material.opacity);
    const context = buildInteriorContext(building, 2);
    try {
      const contextMaterials = new Set(materials(context));
      expect(originalMaterials.some(material => contextMaterials.has(material))).toBe(false);
      expect(originalMaterials.map(material => material.opacity)).toEqual(opacities);
      expect(JSON.stringify(building)).toBe(saved);
      const groundWall = context.getObjectByName('structural-wall-panel') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      expect(groundWall.material.color.getHexString()).toBe(building.wallColor.slice(1).toLowerCase());
    } finally { disposeGroup(exterior); disposeGroup(context); }
  });

  it('uses the real stairwell aperture and open guard rails in both exterior and lower-floor context', () => {
    const building = fixture(), exterior = buildBuilding(building), context = buildInteriorContext(building, 2);
    try {
      exterior.updateMatrixWorld(true); context.updateMatrixWorld(true);
      const opening = getStairOpenings(building, 1)[0];
      const x = (opening.minX + opening.maxX) / 2, z = (opening.minZ + opening.maxZ) / 2;
      const ray = new THREE.Raycaster(new THREE.Vector3(x, getLevelBaseY(building, 1) + 1, z), new THREE.Vector3(0, -1, 0));
      const exteriorFloor = exterior.getObjectByName('exterior-level:2')!.getObjectByName('room-floor')!;
      expect(ray.intersectObject(exteriorFloor, true)).toHaveLength(0);
      const contextLevel = context.getObjectByName('interior-context-level:2')!;
      const contextFloor = contextLevel.getObjectByName('room-floor')!;
      // Context deliberately disables picking. Compare the actual instanced
      // floor fragments to the ray-verified exterior floor at the same height.
      for (const name of ['floor-cell-slabs', 'floor-cell-edges', 'floor-cell-tiles']) {
        const actual = contextFloor.getObjectByName(name) as THREE.InstancedMesh;
        const expected = exteriorFloor.getObjectByName(name) as THREE.InstancedMesh;
        expect(actual.count).toBe(expected.count);
        expect(Array.from(actual.instanceMatrix.array)).toEqual(Array.from(expected.instanceMatrix.array));
      }
      expect(contextLevel.getObjectByName('stairwell-rim')).toBeDefined();
      expect(contextLevel.getObjectByName('stairwell-guardrail')).toBeDefined();
      expect(context.getObjectByName('stair-landing-opening')).toBeUndefined();
    } finally { disposeGroup(exterior); disposeGroup(context); }
  });
});
