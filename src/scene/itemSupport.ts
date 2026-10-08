import * as THREE from 'three';
import { getItemFootprint, hasFloorCell, isStandingSign, type ShopDocument, type ShopItem } from '../model';
import { standingSignGroundY, standingSignSupports } from './objects';

export interface ItemFoundation {
  /** World-space center and dimensions, independent from the item's rotation. */
  x: number;
  z: number;
  width: number;
  depth: number;
  bottom: number;
  top: number;
}

export interface ItemSupport { baseY: number; foundation?: ItemFoundation }

/** Preserve ordinary placement, while supporting a larger outdoor sign on uneven ground. */
export function getItemSupport(
  shop: ShopDocument,
  item: ShopItem,
  floor: THREE.Object3D,
  entrance: THREE.Object3D | undefined,
  showCity: boolean,
): ItemSupport {
  if (!isStandingSign(item.kind) || hasFloorCell(shop, item.x, item.z)) return { baseY: 0.038 };
  const size = getItemFootprint(item);
  const left = item.x - shop.width / 2;
  const back = item.z - shop.depth / 2;
  if (size.width === 1 && size.depth === 1) {
    return { baseY: standingSignGroundY(floor, entrance, left + 0.5, back + 0.5, showCity) + 0.002 };
  }

  const ground = showCity ? -0.08 : -0.401;
  const inset = 0.03;
  const footprint = { minX: left + inset, maxX: left + size.width - inset, minZ: back + inset, maxZ: back + size.depth - inset };
  const supports: { mesh: THREE.Mesh; bounds: THREE.Box3 }[] = [];
  for (const root of standingSignSupports(floor, entrance)) {
    root.updateWorldMatrix(true, true);
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const bounds = new THREE.Box3().setFromObject(object);
      if (bounds.max.y < ground || bounds.max.x < footprint.minX || bounds.min.x > footprint.maxX
        || bounds.max.z < footprint.minZ || bounds.min.z > footprint.maxZ) return;
      supports.push({ mesh: object, bounds });
    });
  }

  const samples = new Map<string, { x: number; z: number }>();
  const addSample = (x: number, z: number) => samples.set(`${x.toFixed(7)},${z.toFixed(7)}`, { x, z });
  const sampleRectangle = (minX: number, maxX: number, minZ: number, maxZ: number) => {
    for (const x of [minX, (minX + maxX) / 2, maxX]) for (const z of [minZ, (minZ + maxZ) / 2, maxZ]) addSample(x, z);
  };
  sampleRectangle(footprint.minX, footprint.maxX, footprint.minZ, footprint.maxZ);
  for (let x = 0; x < size.width; x++) for (let z = 0; z < size.depth; z++) addSample(left + x + 0.5, back + z + 0.5);
  // Narrow landing/mat surfaces may fall between tile centers. Probe their actual
  // overlapping bounds too, then use ray hits rather than an AABB's assumed height.
  for (const { bounds } of supports) {
    const minX = Math.max(footprint.minX, bounds.min.x), maxX = Math.min(footprint.maxX, bounds.max.x);
    const minZ = Math.max(footprint.minZ, bounds.min.z), maxZ = Math.min(footprint.maxZ, bounds.max.z);
    const epsilonX = Math.min(0.0001, (maxX - minX) / 4), epsilonZ = Math.min(0.0001, (maxZ - minZ) / 4);
    sampleRectangle(minX + epsilonX, maxX - epsilonX, minZ + epsilonZ, maxZ - epsilonZ);
  }

  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
  const rayHeight = Math.max(10, ...supports.map(({ bounds }) => bounds.max.y + 1));
  let minSurface = Infinity, maxSurface = ground;
  for (const { x, z } of samples.values()) {
    ray.ray.origin.set(x, rayHeight, z);
    let surface = ground;
    for (const { mesh, bounds } of supports) {
      if (x < bounds.min.x || x > bounds.max.x || z < bounds.min.z || z > bounds.max.z) continue;
      const hit = ray.intersectObject(mesh, false)[0];
      if (hit) surface = Math.max(surface, hit.point.y);
    }
    minSurface = Math.min(minSurface, surface);
    maxSurface = Math.max(maxSurface, surface);
  }
  if (maxSurface - minSurface < 0.00001) return { baseY: maxSurface + 0.002 };
  return {
    baseY: maxSurface + 0.002,
    foundation: {
      x: left + size.width / 2, z: back + size.depth / 2,
      width: size.width - inset * 2, depth: size.depth - inset * 2,
      bottom: Math.min(ground, minSurface), top: maxSurface,
    },
  };
}
