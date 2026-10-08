import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, getWallHeight, type ShopDocument, type ShopItem } from '../model';
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
      let y = 0;
      for (let level = 0; level < count; level++) {
        const floor = group.getObjectByName(`exterior-level:${level + 1}`)!;
        expect(floor.position.y).toBeCloseTo(y);
        expect(named(floor, 'exterior-wall-panel')).toHaveLength(4);
        y += getWallHeight(level === 0 ? doc : doc.upperFloors![level - 1]) + LEVEL_SLAB;
      }
      expect(group.getObjectByName('tiled-roof')!.position.y).toBeCloseTo(y - LEVEL_SLAB);
      expect(new THREE.Box3().setFromObject(group).max.y).toBeGreaterThan(y);
      expect(group.getObjectByName('exterior-entrance')).toBeDefined();
    } finally { disposeGroup(group); }
  });

  it('preserves concave contours and courtyard boundaries', () => {
    const doc: ShopDocument = { ...building(1), floorCells: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }] };
    const edges = buildingEdges(doc), group = buildBuilding(doc);
    try {
      expect(edges).toHaveLength(6);
      expect(edges.reduce((sum, edge) => sum + edge.end - edge.start, 0)).toBe(8);
      const slabs = group.getObjectByName('building-level-slab') as THREE.InstancedMesh;
      expect(slabs.count).toBe(3);
      const tiles = group.getObjectByName('terracotta-roof-tiles') as THREE.InstancedMesh;
      expect(tiles.count).toBe(36);
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
      expect((named(group, 'exterior-wall-panel')[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.color.getHexString()).toBe('345678');
      expect(group.getObjectByName('exterior-awning')).toBeUndefined();
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
      expect(top.position.y).toBeCloseTo(4.2625);
      applyItemSize(group, { ...item, width: 4, depth: 6 });
      expect(group.scale.toArray()).toEqual([2, 1, 2]);
      expect(group.userData.stairRise).toBe(4.24);
    } finally { disposeGroup(group); }
  });
  it('shows an upper landing aligned with the lower stair location', () => {
    const doc = building(2); doc.items = [{ ...makeItem('stairs'), x: 1, z: 1 }];
    const group = buildStairLandings(doc, 1);
    try {
      expect(group.getObjectByName('landing:stairs')!.position.x).toBe(-1);
      expect(group.getObjectByName('stair-landing-opening')).toBeDefined();
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
