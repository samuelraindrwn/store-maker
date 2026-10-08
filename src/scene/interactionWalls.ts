import * as THREE from 'three';
import { getWallHeight, getWallMountRuns, getWallRuns, PARTITION_WALL_MOUNT_OFFSET, wallIsHorizontal, type ShopDocument, type WallItem, type WallSide } from '../model';

export type WallHit = Pick<WallItem, 'wall' | 'line' | 'offset' | 'height' | 'partitionId'> & { point: THREE.Vector3; distance: number };

/** The side visible from inside the cutaway room. */
export function wallInwardNormal(wall: WallSide): THREE.Vector3 {
  switch (wall) {
    case 'back': return new THREE.Vector3(0, 0, 1);
    case 'left': return new THREE.Vector3(1, 0, 0);
    case 'front': return new THREE.Vector3(0, 0, -1);
    case 'right': return new THREE.Vector3(-1, 0, 0);
  }
}

/** Unbounded mounting plane for a selected object, including backside resizing. */
export function intersectWallPlane(ray: THREE.Ray, shop: ShopDocument, mount: Pick<WallItem, 'wall' | 'line' | 'partitionId'>): WallHit | null {
  const horizontal = wallIsHorizontal(mount.wall), normal = wallInwardNormal(mount.wall);
  if (Math.abs(ray.direction.dot(normal)) < 0.000001) return null;
  const coordinate = mount.line - (horizontal ? shop.depth : shop.width) / 2;
  const origin = horizontal ? new THREE.Vector3(0, 0, coordinate) : new THREE.Vector3(coordinate, 0, 0);
  if (mount.partitionId) origin.addScaledVector(normal, PARTITION_WALL_MOUNT_OFFSET);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin);
  const point = ray.intersectPlane(plane, new THREE.Vector3());
  return point ? { wall: mount.wall, line: mount.line, ...(mount.partitionId ? { partitionId: mount.partitionId } : {}), offset: horizontal ? point.x + shop.width / 2 : point.z + shop.depth / 2,
    height: point.y, point, distance: point.distanceTo(ray.origin) } : null;
}

/** Mathematical faces keep window openings usable as placement/drag surfaces. */
export function intersectWall(ray: THREE.Ray, shop: ShopDocument, fallback?: WallItem, exterior = false, source = fallback): WallHit | null {
  const runs = exterior ? getWallRuns(shop) : getWallMountRuns(shop, source);
  if (!runs.length) return null;
  const intersections: WallHit[] = [];
  for (const run of runs) {
    const sourceWall = run.wall === fallback?.wall && run.line === fallback.line && run.partitionId === fallback.partitionId;
    // Hidden front/right faces must not intercept an ordinary click aimed at
    // the visible back/left wall. An explicitly selected source can be dragged
    // from its outside face, preserving front/right editing from the same view.
    const facing = ray.direction.dot(wallInwardNormal(run.wall));
    if (!sourceWall && (exterior ? facing <= 0.000001 : facing >= -0.000001)) continue;
    const hit = intersectWallPlane(ray, shop, run);
    if (!hit || hit.offset < run.start - 0.001 || hit.offset > run.end + 0.001 || hit.height < 0 || hit.height > getWallHeight(shop)) continue;
    intersections.push(hit);
  }
  intersections.sort((a, b) => a.distance - b.distance);
  // A window cannot mount on a partition, but that partition still blocks a
  // drop aimed through it onto a distant outer wall.
  if (!exterior && source?.kind === 'window') {
    const targetDistance = intersections[0]?.distance ?? Infinity;
    for (const run of getWallMountRuns(shop)) {
      if (!run.partitionId || ray.direction.dot(wallInwardNormal(run.wall)) >= -0.000001) continue;
      const hit = intersectWallPlane(ray, shop, run);
      if (hit && hit.distance < targetDistance && hit.offset >= run.start && hit.offset <= run.end && hit.height >= 0 && hit.height <= getWallHeight(shop)) return null;
    }
  }
  if (intersections[0]) return intersections[0];
  if (!fallback) return null;
  // Outside the wall, keep the object under the cursor and show a rejected drop.
  return intersectWallPlane(ray, shop, fallback);
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
