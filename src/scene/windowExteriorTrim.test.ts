import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createEmptyShop, createWallItem, wallItemPosition, WINDOW_STYLES, type WallItem, type WallSide } from '../model';
import { buildBuilding } from './buildingObjects';
import { applyWallItemSize, buildWallItem, disposeGroup } from './objects';
import { EXTERIOR_WINDOW_DEPTH } from './windowGeometry';

describe('the same window trim is visible from both wall faces', () => {
  for (const wall of ['back', 'front', 'left', 'right'] as WallSide[]) {
    it.each(WINDOW_STYLES)('$id keeps its colored frame outside the structural ' + wall + ' wall without doubling glass', ({ id: windowStyle }) => {
      const base = createEmptyShop();
      const item: WallItem = { ...createWallItem('window'), id: 'one-window', wall, line: wall === 'front' ? base.depth : wall === 'right' ? base.width : 0,
        offset: 1.5, height: 1.55, width: 2.2, sizeHeight: 1.4, windowStyle, color: '#73528e' };
      const doc = { ...base, wallItems: [item] }, building = buildBuilding(doc);
      try {
        building.updateMatrixWorld(true);
        const p = wallItemPosition(doc, item);
        const normal = { back: new THREE.Vector3(0, 0, 1), front: new THREE.Vector3(0, 0, -1), left: new THREE.Vector3(1, 0, 0), right: new THREE.Vector3(-1, 0, 0) }[wall];
        const along = wall === 'back' || wall === 'front' ? 'x' : 'z';
        const ray = (exterior: boolean, x: number, y: number) => {
          const origin = new THREE.Vector3(p.x, p.y + y, p.z).addScaledVector(normal, exterior ? -0.7 : 0.7);
          origin[along] += x;
          return new THREE.Raycaster(origin, normal.clone().multiplyScalar(exterior ? 1 : -1), 0, 1.4).intersectObject(building, true);
        };
        for (const exterior of [true, false]) {
          const frame = ray(exterior, -1.06, -0.25)[0]?.object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
          expect(frame?.userData.wallItemId).toBe('one-window');
          expect(frame.userData.exteriorWindowTrim).toBe(true);
          expect(frame.material.color.getHexString()).toBe('73528e');
          const pane = ray(exterior, 0.31, 0.17)[0]?.object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
          expect(pane?.name).toBe('wall-window-glass');
          expect(pane.material.transparent).toBe(true);
          expect(pane.material.opacity).toBe(0.25);
          expect(pane.material.depthWrite).toBe(false);
        }
        let windows = 0, panes = 0;
        building.traverse(object => { if (object.name.startsWith('window-style:')) windows++; if (object.name === 'wall-window-glass') panes++; });
        expect(windows).toBe(1);
        expect(panes).toBe(windowStyle === 'sliding' ? 2 : 1);
      } finally { disposeGroup(building); }
    });
  }

  it.each(WINDOW_STYLES)('$id keeps the casing depth and pane count when resized live', ({ id: windowStyle }) => {
    const item = { ...createWallItem('window'), windowStyle }, window = buildWallItem(item);
    try {
      const meshes: THREE.Mesh[] = [];
      window.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
      const geometry = meshes.map(mesh => mesh.geometry);
      const inwardProjection = new THREE.Box3().setFromObject(window).max.z;
      for (const [width, sizeHeight] of [[0.3, 0.3], [4.4, 2.8], [2.2, 1.4]]) {
        applyWallItemSize(window, { ...item, width, sizeHeight });
        const bounds = new THREE.Box3().setFromObject(window);
        expect(bounds.min.z).toBeCloseTo(-EXTERIOR_WINDOW_DEPTH, 5);
        expect(bounds.max.z).toBeCloseTo(inwardProjection, 5);
        expect(bounds.max.z).toBeLessThanOrEqual(0.161);
        expect(meshes.map(mesh => mesh.geometry)).toEqual(geometry);
      }
    } finally { disposeGroup(window); }
  });
});
