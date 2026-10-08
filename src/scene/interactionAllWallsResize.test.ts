import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyShop, getWallItemSize, wallIsHorizontal, wallItemPosition, type WallItem, type WallSide } from '../model';
import { disposeGroup } from './objects';
import { ObjectResizeTools, resizeWallEdge } from './interactionObjectResize';
import { intersectWallPlane, wallInwardNormal } from './interactionWalls';

const sides: WallSide[] = ['back', 'left', 'front', 'right'];

describe('resize grips and tiles on every wall side', () => {
  it.each(sides)('keeps %s grips in grid order and above the correct inward face', wall => {
    const shop = { ...createEmptyShop(), width: 8, depth: 6 }, horizontal = wallIsHorizontal(wall);
    const item: WallItem = { id: 'window', kind: 'window', wall, line: wall === 'front' ? 6 : wall === 'right' ? 8 : 0,
      offset: 2.5, height: 1.4, width: 1.8, sizeHeight: 1.2, color: '#aabbcc', text: '', lit: false };
    const tools = new ObjectResizeTools(), view = new THREE.PerspectiveCamera();
    view.position.set(10, 7, 10); view.lookAt(0, 1, 0); view.updateMatrixWorld(true);
    try {
      tools.wall(shop, item, view, 1, true);
      const grip = (edge: 'min-x' | 'max-x' | 'min-y' | 'max-y') => tools.handles.find(entry => entry.edge === edge)!.object;
      const position = wallItemPosition(shop, item), normal = wallInwardNormal(wall);
      const center = new THREE.Vector3(position.x, position.y, position.z);
      const low = grip('min-x').position.clone(), high = grip('max-x').position.clone();
      expect(high.clone().sub(low).distanceTo(horizontal ? new THREE.Vector3(1.8, 0, 0) : new THREE.Vector3(0, 0, 1.8))).toBeLessThan(0.000001);
      expect(low.clone().add(high).multiplyScalar(0.5).sub(center).dot(normal)).toBeCloseTo(0.15);
      expect(grip('min-y').position.y).toBeCloseTo(0.8);
      expect(grip('max-y').position.y).toBeCloseTo(2);
      const tiles = tools.group.children.find(object => object instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
      const matrix = new THREE.Matrix4();
      for (const [index, target] of tools.targets.entries()) {
        tiles.getMatrixAt(index, matrix);
        expect(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(target.point)).toBeLessThan(0.000001);
        const targetMount = wallItemPosition(shop, { ...item, offset: target.x, height: target.height! });
        expect(target.point.clone().sub(new THREE.Vector3(targetMount.x, targetMount.y, targetMount.z)).dot(normal)).toBeCloseTo(0.04);
      }
      // Drag the increasing-grid edge outward from either face. The opposite
      // saved edge stays fixed even where mounting rotations reverse local X.
      const target = wallItemPosition(shop, { ...item, offset: 4.6 });
      const rayPoint = new THREE.Vector3(target.x, target.y, target.z).addScaledVector(normal, -2);
      const hit = intersectWallPlane(new THREE.Ray(rayPoint, normal), shop, item)!;
      const resized = resizeWallEdge(item, 'max-x', hit.offset), size = getWallItemSize(resized);
      expect(resized.offset - size.width / 2).toBeCloseTo(item.offset - 0.9);
      expect(resized.offset + size.width / 2).toBeCloseTo(4.6);
      tools.wall(shop, resized, view, 1, true, item);
      expect(grip('max-x').position.distanceTo(high)).toBeLessThan(0.000001);
    } finally { disposeGroup(tools.group); }
  });
});
