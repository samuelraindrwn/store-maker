import * as THREE from 'three';
import { getItemSize, isOutdoorCover, type ShopItem } from '../model';

const WOOD = '#B5916F';
const CREAM = '#F5EAD6';

function box(parent: THREE.Group, name: string, width: number, height: number, depth: number, color: string, x: number, y: number, z: number) {
  const object = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color, roughness: 0.83 }));
  object.name = name; object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object);
  return object;
}

function fabric(parent: THREE.Group, name: string, corners: number[], color: string) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners, 3));
  geometry.computeVertexNormals();
  const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.95 }));
  object.name = name; object.castShadow = true; object.receiveShadow = true; parent.add(object);
}

/** Covers occupy an overhead layer so chairs and tables can sit below their shade. */
export function buildOutdoorFurniture(item: ShopItem): THREE.Group | null {
  if (!isOutdoorCover(item.kind)) return null;
  const { width, depth } = getItemSize(item), group = new THREE.Group();
  group.name = `item:${item.id}`; group.userData.itemId = item.id;
  group.userData.itemSizeBasis = { width, depth };
  group.userData.outdoorCover = true;
  const halfW = width / 2 - 0.04, halfD = depth / 2 - 0.04;
  if (item.kind === 'canopy') {
    for (const x of [-halfW + 0.09, halfW - 0.09]) for (const z of [-halfD + 0.09, halfD - 0.09]) {
      box(group, 'canopy-post', 0.085, 2.12, 0.085, WOOD, x, 1.10, z);
      box(group, 'canopy-foot', 0.18, 0.08, 0.18, '#A99D90', x, 0.04, z);
    }
    for (const x of [-halfW, halfW]) box(group, 'canopy-frame', 0.055, 0.065, depth - 0.08, CREAM, x, 2.13, 0);
    for (const z of [-halfD, halfD]) box(group, 'canopy-frame', width - 0.08, 0.065, 0.055, CREAM, 0, 2.13, z);
    const stripes = Math.min(24, Math.max(2, Math.ceil(depth / 0.45)));
    for (let stripe = 0; stripe < stripes; stripe++) {
      const z0 = -halfD + stripe * 2 * halfD / stripes, z1 = -halfD + (stripe + 1) * 2 * halfD / stripes;
      const color = stripe % 2 ? CREAM : item.color;
      for (const x of [-halfW, halfW]) fabric(group, 'canopy-fabric', [x, 2.18, z0, 0, 2.65, z0, 0, 2.65, z1, x, 2.18, z0, 0, 2.65, z1, x, 2.18, z1], color);
      for (const x of [-halfW, halfW]) box(group, 'canopy-valance', 0.02, 0.14, z1 - z0, color, x, 2.12, (z0 + z1) / 2);
    }
    box(group, 'canopy-ridge', 0.05, 0.045, depth - 0.05, item.color, 0, 2.65, 0);
  } else {
    // A side-mounted pole keeps the center free for a table instead of piercing it.
    const poleX = -halfW + 0.17, poleZ = -halfD + 0.17;
    box(group, 'umbrella-base', 0.3, 0.09, 0.3, '#AAA093', poleX, 0.045, poleZ);
    box(group, 'umbrella-pole', 0.07, 2.47, 0.07, WOOD, poleX, 1.28, poleZ);
    const armStart = new THREE.Vector3(poleX, 2.48, poleZ), armEnd = new THREE.Vector3(0, 2.60, 0);
    const arm = box(group, 'umbrella-arm', 0.055, armStart.distanceTo(armEnd), 0.055, WOOD, 0, 0, 0);
    arm.position.copy(armStart).add(armEnd).multiplyScalar(0.5);
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), armEnd.clone().sub(armStart).normalize());
    const sides = 8;
    for (let index = 0; index < sides; index++) {
      const a = index / sides * Math.PI * 2, b = (index + 1) / sides * Math.PI * 2;
      const x0 = Math.sin(a) * halfW, z0 = Math.cos(a) * halfD, x1 = Math.sin(b) * halfW, z1 = Math.cos(b) * halfD;
      fabric(group, 'umbrella-fabric', [0, 2.64, 0, x0, 2.17, z0, x1, 2.17, z1], index % 2 ? CREAM : item.color);
      fabric(group, 'umbrella-valance', [x0, 2.17, z0, x0, 2.07, z0, x1, 2.07, z1, x0, 2.17, z0, x1, 2.07, z1, x1, 2.17, z1], index % 2 ? CREAM : item.color);
    }
    box(group, 'umbrella-cap', 0.065, 0.07, 0.065, WOOD, 0, 2.675, 0);
  }
  return group;
}
