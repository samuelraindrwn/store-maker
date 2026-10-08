import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getItemSize, type ShopItem } from '../model';

const PORCELAIN = '#f8f5ec';
const CHROME = '#96aaa5';

function part(parent: THREE.Group, name: string, geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number, extra: THREE.MeshStandardMaterialParameters = {}) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.38, ...extra }));
  mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function box(parent: THREE.Group, name: string, w: number, h: number, d: number, color: string, x: number, y: number, z: number, radius = 0.018) {
  return part(parent, name, new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), color, x, y, z);
}

function oval(parent: THREE.Group, name: string, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  const mesh = part(parent, name, new THREE.SphereGeometry(1, 20, 12), color, x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

function pipe(parent: THREE.Group, name: string, from: THREE.Vector3, to: THREE.Vector3, radius = 0.022) {
  const delta = to.clone().sub(from);
  const center = from.clone().add(to).multiplyScalar(0.5);
  const mesh = part(parent, name, new THREE.CylinderGeometry(radius, radius, delta.length(), 12), CHROME, center.x, center.y, center.z, { metalness: 0.45, roughness: 0.24 });
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
}

/** Separate movable fixtures; room boundaries and doors are authored independently. */
export function buildUtilityItem(item: ShopItem): THREE.Group | null {
  if (!['toilet', 'washbasin', 'shower'].includes(item.kind)) return null;
  const group = new THREE.Group();
  group.name = `item:${item.id}`;
  group.userData.itemId = item.id;
  group.userData.itemSizeBasis = { width: 1, depth: 1 };
  if (item.kind === 'toilet') {
    oval(group, 'toilet-foot', item.color, 0, 0.075, 0.015, 0.22, 0.075, 0.27);
    oval(group, 'toilet-pedestal', item.color, 0, 0.245, 0.015, 0.19, 0.22, 0.245);
    oval(group, 'toilet-bowl', item.color, 0, 0.395, 0.035, 0.3, 0.165, 0.36);
    box(group, 'toilet-tank', 0.47, 0.54, 0.19, item.color, 0, 0.48, -0.32, 0.035);
    box(group, 'toilet-tank-lid', 0.49, 0.045, 0.215, PORCELAIN, 0, 0.77, -0.32, 0.018);
    oval(group, 'toilet-seat-opening', '#aac6c1', 0, 0.549, 0.045, 0.2, 0.016, 0.275);
    const seat = part(group, 'toilet-seat', new THREE.TorusGeometry(0.247, 0.034, 10, 32), PORCELAIN, 0, 0.559, 0.035);
    seat.rotation.x = -Math.PI / 2; seat.scale.y = 1.3;
    box(group, 'toilet-seat-hinge', 0.3, 0.035, 0.05, CHROME, 0, 0.56, -0.27);
    box(group, 'toilet-flush-button', 0.1, 0.012, 0.065, CHROME, 0.1, 0.799, -0.32, 0.009);
  } else if (item.kind === 'washbasin') {
    for (const x of [-0.29, 0.29]) for (const z of [-0.19, 0.2]) box(group, 'washbasin-foot', 0.075, 0.12, 0.075, '#a38a6c', x, 0.06, z);
    box(group, 'washbasin-cabinet', 0.8, 0.62, 0.58, item.color, 0, 0.425, 0.005, 0.026);
    for (const x of [-0.19, 0.19]) box(group, 'washbasin-cabinet-door', 0.364, 0.49, 0.024, item.color, x, 0.43, 0.31, 0.012);
    for (const x of [-0.09, 0.09]) box(group, 'washbasin-cabinet-handle', 0.024, 0.12, 0.026, '#c4aa81', x, 0.47, 0.335, 0.008);
    box(group, 'washbasin-basin', 0.88, 0.115, 0.66, PORCELAIN, 0, 0.79, 0.025, 0.04);
    oval(group, 'washbasin-recess', '#bdd2cc', 0, 0.85, 0.055, 0.315, 0.012, 0.215);
    oval(group, 'washbasin-drain', CHROME, 0, 0.863, 0.055, 0.033, 0.004, 0.033);
    pipe(group, 'washbasin-faucet', new THREE.Vector3(0, 0.84, -0.22), new THREE.Vector3(0, 1.065, -0.22));
    pipe(group, 'washbasin-spout', new THREE.Vector3(0, 1.065, -0.22), new THREE.Vector3(0, 1.065, -0.07));
    box(group, 'washbasin-tap', 0.13, 0.025, 0.04, CHROME, 0, 0.98, -0.22, 0.012);
    // Slim rear supports make this a movable vanity rather than a floating mirror.
    for (const x of [-0.29, 0.29]) box(group, 'washbasin-mirror-support', 0.025, 0.53, 0.025, '#c1a884', x, 0.99, -0.305, 0.005);
    box(group, 'washbasin-mirror-frame', 0.72, 0.68, 0.05, '#c1a884', 0, 1.44, -0.305, 0.06);
    const mirror = box(group, 'washbasin-mirror', 0.64, 0.6, 0.018, '#c3ddd8', 0, 1.44, -0.268, 0.04);
    mirror.material.metalness = 0.35; mirror.material.roughness = 0.12;
    box(group, 'washbasin-soap', 0.065, 0.13, 0.065, '#d9b29f', 0.32, 0.9, -0.18, 0.018);
  } else {
    box(group, 'shower-tray', 0.96, 0.075, 0.96, PORCELAIN, 0, 0.0375, 0, 0.025);
    box(group, 'shower-tray-inset', 0.86, 0.014, 0.86, '#dce6dd', 0, 0.082, 0, 0.025);
    box(group, 'shower-drain', 0.11, 0.008, 0.11, CHROME, 0.24, 0.094, -0.24, 0.012);
    for (let line = -1; line <= 1; line++) box(group, 'shower-drain-slot', 0.075, 0.003, 0.009, '#657873', 0.24, 0.099, -0.24 + line * 0.026, 0.002);
    for (const [x, z] of [[-0.455, -0.455], [-0.455, 0.455], [0.455, -0.455]]) {
      box(group, 'shower-screen-frame', 0.035, 2.05, 0.035, item.color, x, 1.105, z, 0.009);
    }
    const glass = { transparent: true, opacity: 0.2, depthWrite: false, roughness: 0.1, side: THREE.DoubleSide };
    for (const [w, d, x, z] of [[0.018, 0.89, -0.455, 0], [0.89, 0.018, 0, -0.455]]) {
      const screen = part(group, 'shower-glass', new THREE.BoxGeometry(w, 1.99, d), '#c5e0d8', x, 1.105, z, glass);
      screen.castShadow = false;
    }
    box(group, 'shower-screen-cap', 0.035, 0.04, 0.94, item.color, -0.455, 2.15, 0, 0.009);
    box(group, 'shower-screen-cap', 0.94, 0.04, 0.035, item.color, 0, 2.15, -0.455, 0.009);
    pipe(group, 'shower-riser', new THREE.Vector3(0, 0.79, -0.395), new THREE.Vector3(0, 2.09, -0.395));
    pipe(group, 'shower-arm', new THREE.Vector3(0, 2.09, -0.395), new THREE.Vector3(0, 2.09, -0.09));
    part(group, 'shower-head', new THREE.CylinderGeometry(0.16, 0.16, 0.035, 24), CHROME, 0, 2.065, -0.09, { metalness: 0.4 });
    for (const x of [-0.07, 0, 0.07]) for (const z of [-0.16, -0.09, -0.02]) {
      part(group, 'shower-nozzle', new THREE.CylinderGeometry(0.007, 0.007, 0.006, 6), '#657d77', x, 2.044, z);
    }
    box(group, 'shower-mixer', 0.2, 0.055, 0.085, CHROME, 0, 0.95, -0.35, 0.02);
    box(group, 'shower-control', 0.03, 0.095, 0.035, item.color, 0.065, 1.01, -0.33, 0.009);
  }
  const size = getItemSize(item);
  group.scale.set(size.width, 1, size.depth);
  return group;
}
