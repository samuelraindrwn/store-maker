import * as THREE from 'three';
import { getWallHeight, getWallRuns, type ShopDocument, type WallItem } from '../model';

export type WallHit = Pick<WallItem, 'wall' | 'line' | 'offset' | 'height'> & { point: THREE.Vector3; distance: number };

/** Mathematical faces keep window openings usable as placement/drag surfaces. */
export function intersectWall(ray: THREE.Ray, shop: ShopDocument, fallback?: WallItem): WallHit | null {
  const runs = getWallRuns(shop);
  if (!runs.length) return null;
  const intersections: WallHit[] = [];
  for (const run of runs) {
    const normal = run.wall === 'back' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const coordinate = run.line - (run.wall === 'back' ? shop.depth : shop.width) / 2;
    const point = ray.intersectPlane(new THREE.Plane(normal, -coordinate), new THREE.Vector3());
    if (!point) continue;
    const offset = run.wall === 'back' ? point.x + shop.width / 2 : point.z + shop.depth / 2;
    if (offset < run.start - 0.001 || offset > run.end + 0.001 || point.y < 0 || point.y > getWallHeight(shop)) continue;
    intersections.push({ wall: run.wall, line: run.line, offset, height: point.y, point, distance: point.distanceTo(ray.origin) });
  }
  intersections.sort((a, b) => a.distance - b.distance);
  if (intersections[0]) return intersections[0];
  if (!fallback) return null;
  // Outside the wall, keep the object under the cursor and show a rejected drop.
  const normal = fallback.wall === 'back' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const coordinate = fallback.line - (fallback.wall === 'back' ? shop.depth : shop.width) / 2;
  const point = ray.intersectPlane(new THREE.Plane(normal, -coordinate), new THREE.Vector3());
  return point ? { wall: fallback.wall, line: fallback.line, offset: fallback.wall === 'back' ? point.x + shop.width / 2 : point.z + shop.depth / 2, height: point.y, point, distance: point.distanceTo(ray.origin) } : null;
}

export function wallFrame(width: number, height: number, color: string, filled = false) {
  const group = new THREE.Group();
  const x = width / 2 + 0.04, y = height / 2 + 0.04;
  const points = [new THREE.Vector3(-x, -y, 0.12), new THREE.Vector3(x, -y, 0.12), new THREE.Vector3(x, y, 0.12), new THREE.Vector3(-x, y, 0.12)];
  const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, depthTest: false, depthWrite: false }));
  line.renderOrder = 20;
  group.add(line);
  if (filled) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    plane.position.z = 0.11;
    plane.renderOrder = 19;
    group.add(plane);
  }
  points.forEach((point) => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false }));
    dot.position.copy(point);
    dot.renderOrder = 21;
    group.add(dot);
  });
  group.traverse((object) => { object.raycast = () => undefined; });
  return group;
}
