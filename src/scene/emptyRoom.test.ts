import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBlankShop, getFloorCells, paintFloor, type ShopItem, type WallItem } from '../model';
import { buildCity, buildRoom, disposeGroup } from './objects';
import { FloorPainter, floorOutline, workCells } from './interactionFloor';
import { ObjectResizeTools } from './interactionObjectResize';
import { intersectWall } from './interactionWalls';

function authoredVertices(group: THREE.Object3D) {
  let count = 0;
  group.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) count += object.geometry.getAttribute('position')?.count ?? 0;
  });
  return count;
}

function expectFiniteTransforms(group: THREE.Object3D) {
  group.updateMatrixWorld(true);
  group.traverse(object => {
    expect(object.matrixWorld.elements.every(Number.isFinite)).toBe(true);
    if (object instanceof THREE.InstancedMesh) {
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix);
        expect(matrix.elements.every(Number.isFinite)).toBe(true);
      }
    }
  });
}

const windowItem: WallItem = { id: 'old-window', kind: 'window', wall: 'back', line: 0, offset: 2, height: 1.5, color: '#ffffff', text: '', lit: false };

describe('a genuinely empty building area', () => {
  it('authors no floor, walls, doorstep, mat, or raycastable doorway', () => {
    const room = buildRoom(createBlankShop());
    try {
      expect(room.hasFloor).toBe(false);
      expect(authoredVertices(room.group)).toBe(0);
      expect(room.floor.children).toHaveLength(0);
      expect(room.backWall.children).toHaveLength(0);
      expect(room.leftWall.children).toHaveLength(0);
      expect(room.entrance.visible).toBe(false);
      expect(room.group.getObjectByName('entrance-mat')).toBeUndefined();
      expect(room.group.getObjectByName('entrance-step-base')).toBeUndefined();
      room.group.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 1, 10), new THREE.Vector3(0, 0, -1));
      expect(ray.intersectObject(room.group, true)).toEqual([]);
      room.previewDimensions(10, 9, 4.5, 1);
      room.previewWallItems([windowItem]);
      expect(authoredVertices(room.group)).toBe(0);
      expectFiniteTransforms(room.group);
    } finally { disposeGroup(room.group); }
  });

  it('keeps the decorative city finite without inserting a shop shell', () => {
    const city = buildCity(createBlankShop());
    try {
      expect(authoredVertices(city)).toBeGreaterThan(0);
      expectFiniteTransforms(city);
      const bounds = new THREE.Box3().setFromObject(city);
      expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
      expect(city.getObjectByName('room-floor')).toBeUndefined();
      expect(city.getObjectByName('shop-entrance')).toBeUndefined();
    } finally { disposeGroup(city); }
  });

  it('shows finite transparent work tiles and previews the first real tile without changing the blank document', () => {
    const blank = createBlankShop();
    const painter = new FloorPainter();
    try {
      const cells = workCells(blank);
      expect(cells).toContainEqual({ x: 3, z: 2 });
      expect(cells.length).toBeGreaterThan(42);
      expect(cells.every(cell => Number.isFinite(cell.x) && Number.isFinite(cell.z))).toBe(true);
      painter.updateWork(blank, false);
      painter.updatePreview(blank, true);
      const candidates = painter.work.children.find(object => object instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
      expect(candidates.count).toBe(cells.length);
      expect((candidates.material as THREE.Material).transparent).toBe(true);
      expect((candidates.material as THREE.Material).opacity).toBeLessThan(0.5);
      expect(painter.outlines.geometry.drawRange.count).toBe(0);
      const painted = paintFloor(blank, [{ x: 3, z: 2 }], 'add');
      painter.updatePreview(painted, true);
      expect(getFloorCells(blank)).toEqual([]);
      expect(getFloorCells(painted)).toEqual([{ x: 3, z: 2 }]);
      const layers = painter.preview.children.filter(object => object instanceof THREE.InstancedMesh) as THREE.InstancedMesh[];
      expect(layers.map(mesh => mesh.count)).toEqual([1, 1]);
      expect(painter.outlines.geometry.drawRange.count).toBeGreaterThan(0);
      painter.updatePreview(blank, true); // Escape restores the empty preview.
      expect(layers.map(mesh => mesh.count)).toEqual([0, 0]);
      expect(painter.outlines.geometry.drawRange.count).toBe(0);
      expectFiniteTransforms(painter.group);
    } finally { disposeGroup(painter.group); }
  });

  it('rebuilds only the first painted cell and returns to zero structure after erasing it', () => {
    const blank = createBlankShop();
    const painted = paintFloor(blank, [{ x: -1, z: 2 }], 'add');
    const room = buildRoom(painted);
    const cleared = buildRoom(paintFloor(painted, [{ x: -1, z: 2 }], 'erase'));
    try {
      expect(room.hasFloor).toBe(true);
      expect(room.entrance.visible).toBe(true);
      expect(floorOutline(getFloorCells(painted))).toHaveLength(4);
      expect(room.floor.children.filter(object => object instanceof THREE.InstancedMesh).map(object => (object as THREE.InstancedMesh).count)).toEqual([1, 1, 1]);
      room.group.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(new THREE.Vector3(-1 - blank.width / 2 + 0.5, 5, 2 - blank.depth / 2 + 0.5), new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObject(room.floor, true).length).toBeGreaterThan(0);
      ray.ray.origin.x += 1;
      expect(ray.intersectObject(room.floor, true)).toEqual([]);
      expect(cleared.hasFloor).toBe(false);
      expect(authoredVertices(cleared.group)).toBe(0);
    } finally { disposeGroup(room.group); disposeGroup(cleared.group); }
  });

  it('does not invent a mounting wall from a stale drag fallback', () => {
    const ray = new THREE.Ray(new THREE.Vector3(0, 1.5, 10), new THREE.Vector3(0, 0, -1));
    expect(intersectWall(ray, createBlankShop())).toBeNull();
    expect(intersectWall(ray, createBlankShop(), windowItem)).toBeNull();
  });

  it('clears sign resize targets on an empty floor without iterating from an infinite bound', () => {
    const blank = createBlankShop();
    const sign: ShopItem = { id: 'old-sign', kind: 'chalkboard', x: 0, z: 1, rotation: 0, color: '#BC8F69', stock: 'none' };
    const tools = new ObjectResizeTools();
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5);
    try {
      tools.floor(paintFloor(blank, [{ x: 0, z: 0 }], 'add'), sign, camera, 1, true, 0.052);
      expect(tools.targets.length).toBeGreaterThan(0);
      tools.floor(blank, sign, camera, 1, false, 0.052);
      expect(tools.targets).toEqual([]);
      expectFiniteTransforms(tools.group);
    } finally { disposeGroup(tools.group); }
  });
});
