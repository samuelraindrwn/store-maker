import * as THREE from 'three';
import { canPlaceWallItem, getWallHeight, getWallMountRuns, getWallRuns, MIN_FLOOR_COORD, MAX_FLOOR_COORD, PARTITION_WALL_MOUNT_OFFSET, wallIsHorizontal, type ShopDocument, type WallItem, type WallRun, type WallSide } from '../model';

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

function intersectWallSurface(ray: THREE.Ray, shop: ShopDocument, run: WallRun): WallHit | null {
  const hit = intersectWallPlane(ray, shop, run);
  const height = getWallHeight(shop);
  // Match the whole visible coping in partitionGeometry, including its top.
  // A top hit can pass above the vertical mounting plane, so testing only that
  // plane's height would accidentally select a distant wall behind this one.
  // Only the facing mount owns the cap; a selected opposite face cannot steal
  // the same physical hit merely because it appears first in the run list.
  if (run.partitionId && ray.direction.dot(wallInwardNormal(run.wall)) < -0.000001) {
    const horizontal = wallIsHorizontal(run.wall);
    const center = run.line - (horizontal ? shop.depth : shop.width) / 2;
    const start = run.start - (horizontal ? shop.width : shop.depth) / 2 - 0.015;
    const end = run.end - (horizontal ? shop.width : shop.depth) / 2 + 0.015;
    const bounds = new THREE.Box3(
      new THREE.Vector3(horizontal ? start : center - 0.085, height - 0.025, horizontal ? center - 0.085 : start),
      new THREE.Vector3(horizontal ? end : center + 0.085, height + 0.055, horizontal ? center + 0.085 : end),
    );
    const coping = ray.intersectBox(bounds, new THREE.Vector3());
    if (coping) {
      // Sort by the visible surface, but retain the mounting-plane coordinates
      // so normal size/height validation still rejects a too-high decoration.
      const distance = coping.distanceTo(ray.origin);
      if (hit) return { ...hit, distance };
      // A nearly vertical ray can start behind the face while still hitting
      // its coping. Project that actual hit normally onto the facing mount.
      const point = coping.clone(), normal = wallInwardNormal(run.wall);
      if (horizontal) point.z = center + normal.z * PARTITION_WALL_MOUNT_OFFSET;
      else point.x = center + normal.x * PARTITION_WALL_MOUNT_OFFSET;
      return { wall: run.wall, line: run.line, partitionId: run.partitionId,
        offset: horizontal ? point.x + shop.width / 2 : point.z + shop.depth / 2,
        height: point.y, point, distance };
    }
  }
  return hit && hit.offset >= run.start - 0.001 && hit.offset <= run.end + 0.001
    && hit.height >= 0 && hit.height <= height + 1e-6 ? hit : null;
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
    const hit = intersectWallSurface(ray, shop, run);
    if (!hit) continue;
    intersections.push(hit);
  }
  intersections.sort((a, b) => a.distance - b.distance);
  // A window cannot mount on a partition, but that partition still blocks a
  // drop aimed through it onto a distant outer wall.
  if (!exterior && source?.kind === 'window') {
    const targetDistance = intersections[0]?.distance ?? Infinity;
    for (const run of getWallMountRuns(shop)) {
      if (!run.partitionId || ray.direction.dot(wallInwardNormal(run.wall)) >= -0.000001) continue;
      const hit = intersectWallSurface(ray, shop, run);
      if (hit && hit.distance < targetDistance) return null;
    }
  }
  if (intersections[0]) return intersections[0];
  if (!fallback) return null;
  // Outside the wall, keep the object under the cursor and show a rejected drop.
  return intersectWallPlane(ray, shop, fallback);
}

/** A small surface-local snap makes narrow clearances usable with a grab offset. */
export function snapWallDragCandidate(shop: ShopDocument, candidate: WallItem, ignoreId: string): WallItem {
  const radius = 0.25;
  if (!candidate.partitionId || !Number.isFinite(candidate.offset) || !Number.isFinite(candidate.height)
    || candidate.offset < MIN_FLOOR_COORD - radius || candidate.offset > MAX_FLOOR_COORD + 1 + radius
    || candidate.height < -radius || candidate.height > getWallHeight(shop) + radius) return candidate;
  const rounded = { ...candidate, offset: Math.round(candidate.offset * 10) / 10, height: Math.round(candidate.height * 10) / 10 };
  if (canPlaceWallItem(shop, candidate, ignoreId) && canPlaceWallItem(shop, rounded, ignoreId)) return candidate;
  const choices: { offset: number; height: number; distance: number }[] = [];
  for (let x = Math.ceil((candidate.offset - radius) * 10 - 1e-9); x <= Math.floor((candidate.offset + radius) * 10 + 1e-9); x++) {
    for (let y = Math.ceil((candidate.height - radius) * 10 - 1e-9); y <= Math.floor((candidate.height + radius) * 10 + 1e-9); y++) {
      const offset = x / 10, height = y / 10;
      const distance = (offset - candidate.offset) ** 2 + (height - candidate.height) ** 2;
      if (distance <= radius ** 2 + 1e-9) choices.push({ offset, height, distance });
    }
  }
  choices.sort((a, b) => a.distance - b.distance);
  for (const { offset, height } of choices) {
    // Preserve the exact host, face, and size: never seek another wall or shrink
    // the decoration to make a rejected drop appear to succeed.
    const adjusted = { ...candidate, offset, height };
    if (canPlaceWallItem(shop, adjusted, ignoreId)) return adjusted;
  }
  return candidate;
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
