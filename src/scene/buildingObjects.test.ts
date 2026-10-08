import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, createInitialShop, getFloorCells, getWallHeight, type ShopDocument, type ShopItem } from '../model';
import { buildBuilding, buildingEdges, buildStairLandings, getBuildingBounds, LEVEL_SLAB } from './buildingObjects';
import { applyItemSize, buildItem, disposeGroup } from './objects';

function building(levels: number): ShopDocument {
  const ground = { ...createEmptyShop(), width: 6, depth: 5, items: [] };
  return { ...ground, upperFloors: Array.from({ length: levels - 1 }, (_, i) => ({ ...ground, wallHeight: 2.75 + i * 0.5 })) };
}
function named(group: THREE.Object3D, name: string) {
  const objects: THREE.Object3D[] = [];
  group.traverse(object => { if (object.name === name) objects.push(object); });
  return objects;
}

describe('closed multi-floor exterior', () => {
  it('frames shifted upper floors using the union of their world bounds', () => {
    const doc = building(2);
    doc.upperFloors![0].floorCells = [{ x: -8, z: -6 }, { x: -7, z: -6 }, { x: -8, z: -5 }];
    const bounds = getBuildingBounds(doc);
    expect(bounds).toMatchObject({ minX: -11, maxX: 3, minZ: -8.5, maxZ: 2.5, width: 14, depth: 11, centerX: -4, centerZ: -3 });
    // Roof rise uses the top footprint, not the horizontal distance between floors.
    expect(bounds.height).toBeCloseTo(2 * (2.75 + LEVEL_SLAB) + 0.52);
  });

  it('centers floors of different sizes and keeps empty plots finite', () => {
    const doc = building(2);
    doc.upperFloors![0] = { ...doc.upperFloors![0], width: 10, depth: 8 };
    expect(getBuildingBounds(doc)).toMatchObject({ width: 10, depth: 8, centerX: 0, centerZ: 0 });
    doc.floorCells = []; doc.upperFloors![0].floorCells = [];
    for (const value of Object.values(getBuildingBounds(doc))) expect(Number.isFinite(value)).toBe(true);
  });

  it.each([1, 2, 3, 4])('stacks %i floors continuously with four enclosing sides and a roof', count => {
    const doc = building(count), group = buildBuilding(doc);
    try {
      group.updateMatrixWorld(true);
      let y = 0;
      for (let level = 0; level < count; level++) {
        const floor = group.getObjectByName(`exterior-level:${level + 1}`)!;
        expect(floor.position.y).toBeCloseTo(y);
        // The authored back/left walls stay in place; exterior mode closes the
        // two cutaway sides around the original ground-floor entrance.
        expect(named(floor, 'structural-wall-panel')).toHaveLength(2);
        expect(floor.getObjectByName('room-front-wall')!.visible).toBe(true);
        expect(floor.getObjectByName('room-right-wall')!.visible).toBe(true);
        const panels = [...named(floor, 'structural-wall-panel'), ...named(floor, 'exterior-wall-panel')];
        for (const [x, z, dx, dz] of [[0, -3.5, 0, 1], [-2.65, 3.5, 0, -1], [-4, 0, 1, 0], [4, 0, -1, 0]]) {
          const ray = new THREE.Raycaster(new THREE.Vector3(x, y + 1, z), new THREE.Vector3(dx, 0, dz));
          expect(ray.intersectObjects(panels, false).length).toBeGreaterThan(0);
        }
        expect(Boolean(floor.getObjectByName('shop-entrance'))).toBe(level === 0);
        y += getWallHeight(level === 0 ? doc : doc.upperFloors![level - 1]) + LEVEL_SLAB;
      }
      expect(group.getObjectByName('tiled-roof')!.position.y).toBeCloseTo(y - LEVEL_SLAB);
      expect(new THREE.Box3().setFromObject(group).max.y).toBeGreaterThan(y);
      expect(named(group, 'shop-entrance')).toHaveLength(1);
      expect(group.getObjectByName('entrance-canopy')).toBeDefined();
    } finally { disposeGroup(group); }
  });

  it('preserves concave contours and courtyard boundaries', () => {
    const doc: ShopDocument = { ...building(1), floorCells: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }] };
    const edges = buildingEdges(doc), group = buildBuilding(doc);
    try {
      expect(edges).toHaveLength(6);
      expect(edges.reduce((sum, edge) => sum + edge.end - edge.start, 0)).toBe(8);
      const slabs = group.getObjectByName('floor-cell-slabs') as THREE.InstancedMesh;
      expect(slabs.count).toBe(3);
      const roofSlab = group.getObjectByName('roof-slab') as THREE.InstancedMesh;
      expect(roofSlab.count).toBe(3);
      group.updateMatrixWorld(true);
      // Both floor and roof follow the occupied cells, leaving the notch open.
      for (const slab of [slabs, roofSlab]) {
        const bounds = new THREE.Box3().setFromObject(slab);
        expect(bounds.min.x).toBeCloseTo(-3); expect(bounds.max.x).toBeCloseTo(-1);
        expect(bounds.min.z).toBeCloseTo(-2.5); expect(bounds.max.z).toBeCloseTo(-0.5);
        expect(new THREE.Raycaster(new THREE.Vector3(-2.5, 20, -2), new THREE.Vector3(0, -1, 0)).intersectObject(slab).length).toBeGreaterThan(0);
        expect(new THREE.Raycaster(new THREE.Vector3(-1.5, 20, -1), new THREE.Vector3(0, -1, 0)).intersectObject(slab)).toHaveLength(0);
      }
      const tiles = group.getObjectByName('terracotta-roof-tiles') as THREE.InstancedMesh;
      expect(tiles.count).toBe(36);
    } finally { disposeGroup(group); }
  });

  it.each([false, true])('keeps upper-floor support inside its slab allowance and occupied footprint (custom: %s)', custom => {
    const doc = building(4);
    if (custom) {
      for (const floor of doc.upperFloors!) floor.floorCells = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }];
    }
    const group = buildBuilding(doc);
    try {
      group.updateMatrixWorld(true);
      for (let level = 1; level < 4; level++) {
        const floor = group.getObjectByName(`exterior-level:${level + 1}`)!;
        const docFloor = doc.upperFloors![level - 1], cells = getFloorCells(docFloor);
        const slab = floor.getObjectByName('floor-cell-slabs') as THREE.InstancedMesh;
        const bounds = new THREE.Box3().setFromObject(slab);
        expect(slab.count).toBe(cells.length);
        expect(bounds.min.y).toBeCloseTo(floor.position.y - LEVEL_SLAB);
        expect(bounds.max.y).toBeCloseTo(floor.position.y - 0.09);
        expect(bounds.min.x).toBeCloseTo(Math.min(...cells.map(cell => cell.x)) - docFloor.width / 2);
        expect(bounds.max.x).toBeCloseTo(Math.max(...cells.map(cell => cell.x + 1)) - docFloor.width / 2);
        expect(bounds.min.z).toBeCloseTo(Math.min(...cells.map(cell => cell.z)) - docFloor.depth / 2);
        expect(bounds.max.z).toBeCloseTo(Math.max(...cells.map(cell => cell.z + 1)) - docFloor.depth / 2);
        const tiles = floor.getObjectByName('floor-cell-tiles') as THREE.InstancedMesh;
        expect(tiles.count).toBe(cells.length);
        expect(new THREE.Box3().setFromObject(tiles).max.y).toBeCloseTo(floor.position.y + 0.0245);
      }
    } finally { disposeGroup(group); }
  });

  it('leaves the example entrance canopy visible below the upper floor', () => {
    const group = buildBuilding(createInitialShop());
    try {
      group.updateMatrixWorld(true);
      const canopy = group.getObjectByName('entrance-canopy')!;
      const upperFloor = group.getObjectByName('exterior-level:2')!.getObjectByName('room-floor')!;
      // The rear edge is mounted into the facade. Every exposed stripe center
      // must remain clear of the upstairs floor and its foundation from above.
      expect(canopy.children).toHaveLength(24);
      for (const stripe of canopy.children) {
        const point = stripe.getWorldPosition(new THREE.Vector3());
        const ray = new THREE.Raycaster(new THREE.Vector3(point.x, 10, point.z), new THREE.Vector3(0, -1, 0));
        expect(ray.intersectObject(upperFloor, true)).toHaveLength(0);
      }
    } finally { disposeGroup(group); }
  });

  it('switches between pitched tile geometry and a flat parapet roof with optional garden', () => {
    const doc = building(2);
    const pitched = buildBuilding({ ...doc, roof: { style: 'tiles', color: '#b86b51', garden: true } });
    const terrace = buildBuilding({ ...doc, roof: { style: 'rooftop', color: '#c8b89a', garden: false } });
    const garden = buildBuilding({ ...doc, roof: { style: 'rooftop', color: '#c8b89a', garden: true } });
    try {
      expect(pitched.getObjectByName('terracotta-roof-tiles')).toBeDefined();
      expect(pitched.getObjectByName('rooftop-pergola')).toBeUndefined();
      expect(terrace.getObjectByName('terracotta-roof-tiles')).toBeUndefined();
      expect(named(terrace, 'rooftop-parapet')).toHaveLength(4);
      expect(terrace.getObjectByName('rooftop-garden')).toBeUndefined();
      expect(garden.getObjectByName('rooftop-pergola')).toBeDefined();
      expect(named(garden, 'rooftop-greenery')).toHaveLength(4);
    } finally { [pitched, terrace, garden].forEach(disposeGroup); }
  });

  it('applies facade colors and removes the awning from the whole exterior', () => {
    const group = buildBuilding({ ...building(1), exterior: { wallColor: '#345678', trimColor: '#abcdef', awning: false } });
    try {
      for (const panel of [...named(group, 'structural-wall-panel'), ...named(group, 'exterior-wall-panel')]) {
        expect((panel as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.color.getHexString()).toBe('345678');
      }
      const perimeterTrim = named(group, 'exterior-floor-band');
      group.traverse(object => { if (object.userData.wallCoping) perimeterTrim.push(object); });
      expect(perimeterTrim).toHaveLength(4);
      for (const coping of perimeterTrim) {
        expect((coping as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.color.getHexString()).toBe('abcdef');
      }
      expect(group.getObjectByName('entrance-canopy')).toBeUndefined();
    } finally { disposeGroup(group); }
  });
});

describe('stairs, stockroom and bathroom geometry', () => {
  const makeItem = (kind: ShopItem['kind']): ShopItem => ({ id: kind, kind, x: 0, z: 0, rotation: 0, color: '#9caaa1', stock: 'none' });
  it('stairs reach the next slab and preserve their rise when resized', () => {
    const item = makeItem('stairs'), group = buildItem(item, 4.24);
    try {
      expect(named(group, 'stair-tread')).toHaveLength(14);
      const top = named(group, 'stair-tread').at(-1)!;
      const treadBounds = new THREE.Box3().setFromObject(top);
      expect(treadBounds.max.y).toBeGreaterThanOrEqual(4.24);
      expect(treadBounds.max.y).toBeLessThan(4.27);
      applyItemSize(group, { ...item, width: 4, depth: 6 });
      expect(group.scale.toArray()).toEqual([2, 1, 2]);
      expect(group.userData.stairRise).toBe(4.24);
    } finally { disposeGroup(group); }
  });
  it('shows an upper landing aligned with the lower stair location', () => {
    const doc = building(2); doc.items = [{ ...makeItem('stairs'), x: 1, z: 1 }];
    const group = buildStairLandings(doc, 1);
    try {
      const opening = group.getObjectByName('landing:stairs')!.userData.stairOpening;
      expect((opening.minX + opening.maxX) / 2).toBeCloseTo(-1);
      expect(group.getObjectByName('stairwell-rim')).toBeDefined();
      expect(group.getObjectByName('stairwell-guardrail')).toBeDefined();
      expect(group.getObjectByName('stair-landing-opening')).toBeUndefined();
    } finally { disposeGroup(group); }
  });
  it('models stocked shelves and recognizable bathroom fittings', () => {
    const warehouse = buildItem(makeItem('warehouse-rack')), bathroom = buildItem(makeItem('bathroom'));
    try {
      expect(named(warehouse, 'warehouse-box')).toHaveLength(9);
      expect(named(warehouse, 'warehouse-shelf')).toHaveLength(4);
      for (const detail of ['toilet-seat', 'toilet-tank', 'bathroom-basin', 'bathroom-mirror', 'bathroom-door-header']) expect(bathroom.getObjectByName(detail)).toBeDefined();
    } finally { disposeGroup(warehouse); disposeGroup(bathroom); }
  });
});
