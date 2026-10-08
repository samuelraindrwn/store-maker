import * as THREE from 'three';
import { getItemFootprint, type ShopDocument } from '../model';

export type BuildHandleId = 'right' | 'front' | 'corner' | 'left' | 'back' | 'walltop' | 'door';
export type HandleEntry = { id: BuildHandleId; axis: 'x' | 'z' | 'xz' | 'y'; object: THREE.Group };
export type Dimensions = { width: number; depth: number; wallHeight: number; entrancePosition: number };

export function minimumSize(shop: ShopDocument) {
  return shop.items.reduce((size, item) => {
    const footprint = getItemFootprint(item);
    return { width: Math.max(size.width, item.x + footprint.width), depth: Math.max(size.depth, item.z + footprint.depth) };
  }, { width: 4, depth: 4 });
}

export function makeBuildHandles() {
  const group = new THREE.Group();
  const axes: [BuildHandleId, HandleEntry['axis']][] = [['right', 'x'], ['front', 'z'], ['corner', 'xz'], ['left', 'x'], ['back', 'z'], ['walltop', 'y'], ['door', 'x']];
  const entries: HandleEntry[] = axes.map(([id, axis]) => {
    const object = new THREE.Group();
    object.name = `handle:${id}`;
    object.userData.handleId = id;
    const material = new THREE.MeshBasicMaterial({ color: id === 'door' ? '#6d927d' : '#835caf', depthTest: false, depthWrite: false, transparent: true, opacity: 0.95 });
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), material);
    center.renderOrder = 40;
    object.add(center);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 8, 24), new THREE.MeshBasicMaterial({ color: '#fffaf1', depthTest: false, depthWrite: false }));
    ring.renderOrder = 41;
    object.add(ring);
    // The ring faces the camera in layout; the arrowheads show the drag direction.
    for (const direction of [-1, 1]) {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.105, 3), new THREE.MeshBasicMaterial({ color: '#fffaf1', depthTest: false, depthWrite: false }));
      arrow.position.x = direction * 0.076;
      arrow.position.z = 0.143;
      arrow.rotation.z = direction * -Math.PI / 2;
      if (axis === 'y') {
        arrow.position.set(0, direction * 0.076, 0.143);
        arrow.rotation.z = direction === 1 ? 0 : Math.PI;
      }
      arrow.renderOrder = 42;
      object.add(arrow);
    }
    group.add(object);
    return { id, axis, object };
  });
  return { group, entries };
}

export function positionBuildHandles(entries: HandleEntry[], dimensions: Dimensions, camera: THREE.Camera, screenScale: number, doorX: number) {
  const { width: w, depth: d, wallHeight: h } = dimensions;
  const positions: Record<BuildHandleId, [number, number, number]> = {
    right: [w / 2 + 0.24, 0.075, 0],
    front: [0, 0.075, d / 2 + 0.4],
    corner: [w / 2 + 0.18, 0.075, d / 2 + 0.22],
    left: [-w / 2 - 0.08, h * 0.57, 0],
    back: [0, h * 0.57, -d / 2 - 0.05],
    walltop: [0, h + 0.14, -d / 2],
    door: [doorX, 1.1, d / 2 + 0.22],
  };
  entries.forEach(({ id, object }) => {
    object.position.set(...positions[id]);
    object.quaternion.copy(camera.quaternion);
    object.scale.setScalar(screenScale);
  });
}
