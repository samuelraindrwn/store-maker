import * as THREE from 'three';
import { getItemSize, type ShopItem } from '../model';

function box(parent: THREE.Object3D, name: string, w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.78 }));
  mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}

function ellipsoid(parent: THREE.Object3D, name: string, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.36 }));
  mesh.name = name; mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}

/** Local footprints are authored at their catalog size, then sized by the usual item transform. */
export function buildBuildingFurniture(item: ShopItem, floorRise = 2.99): THREE.Group | null {
  if (!['stairs', 'warehouse-rack', 'bathroom'].includes(item.kind)) return null;
  const group = new THREE.Group();
  group.name = `item:${item.id}`; group.userData.itemId = item.id;
  const color = item.color;
  if (item.kind === 'stairs') {
    group.userData.itemSizeBasis = { width: 2, depth: 3 };
    group.userData.stairRise = floorRise;
    const steps = 14, tread = 2.7 / steps;
    for (let step = 0; step < steps; step++) {
      const h = (step + 1) * floorRise / steps;
      const z = 1.35 - (step + 0.5) * tread;
      // Open risers and thin wooden steps reveal the space beneath the flight.
      box(group, 'stair-step', 1.76, 0.075, tread + 0.035, color, 0, h - 0.0375, z);
      box(group, 'stair-tread', 1.80, 0.018, tread + 0.055, '#e9d2ac', 0, h + 0.009, z);
      for (const x of [-0.91, 0.91]) if (step % 2 === 0 || step === steps - 1) {
        box(group, 'stair-baluster', 0.04, 0.72, 0.04, '#746a65', x, h + 0.36, z);
      }
    }
    for (const x of [-0.70, 0.70]) {
      const from = new THREE.Vector3(x, floorRise / steps - 0.09, 1.35 - tread / 2);
      const to = new THREE.Vector3(x, floorRise - 0.09, -1.35 + tread / 2);
      const stringer = box(group, 'stair-stringer', 0.11, to.distanceTo(from), 0.14, color);
      stringer.position.copy(from).add(to).multiplyScalar(0.5);
      stringer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
    }
    for (const x of [-0.91, 0.91]) {
      const from = new THREE.Vector3(x, floorRise / steps + 0.75, 1.35 - tread / 2);
      const to = new THREE.Vector3(x, floorRise + 0.75, -1.35 + tread / 2);
      const rail = box(group, 'stair-handrail', 0.065, to.distanceTo(from), 0.065, '#ae8861');
      rail.position.copy(from).add(to).multiplyScalar(0.5);
      rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
    }
  } else if (item.kind === 'warehouse-rack') {
    group.userData.itemSizeBasis = { width: 2, depth: 1 };
    for (const x of [-0.9, 0.9]) for (const z of [-0.4, 0.4]) {
      box(group, 'warehouse-upright', 0.085, 2.42, 0.085, color, x, 1.21, z);
      box(group, 'warehouse-foot', 0.16, 0.06, 0.16, '#575f63', x, 0.03, z);
      for (let y = 0.3; y < 2.3; y += 0.3) box(group, 'warehouse-upright-slot', 0.025, 0.035, 0.008, '#4a535a', x, y, z + 0.045);
    }
    [0.16, 0.88, 1.60, 2.32].forEach((y, level) => {
      box(group, 'warehouse-shelf', 1.86, 0.07, 0.88, '#c9c7b6', 0, y, 0);
      for (const z of [-0.43, 0.43]) box(group, 'warehouse-crossbeam', 1.86, 0.105, 0.06, color, 0, y - 0.025, z);
      if (level === 3) return;
      for (let i = 0; i < 3; i++) {
        const x = -0.59 + i * 0.59, h = 0.36 + ((i + level) % 2) * 0.14;
        box(group, 'warehouse-box', 0.49, h, 0.6, ['#c39767', '#d4b086', '#c4a580'][(i + level) % 3], x, y + 0.035 + h / 2, 0);
        box(group, 'warehouse-box-tape', 0.06, 0.008, 0.61, '#e9d2a2', x, y + 0.04 + h, 0);
        box(group, 'warehouse-box-label', 0.17, 0.095, 0.006, '#f4ebd7', x + 0.07, y + 0.15, 0.304);
      }
      box(group, 'warehouse-bay-label', 0.23, 0.07, 0.015, '#eee2ba', -0.55, y - 0.022, 0.465);
    });
  } else {
    group.userData.itemSizeBasis = { width: 2, depth: 2 };
    box(group, 'bathroom-tile-base', 1.96, 0.07, 1.96, '#dddccf', 0, 0.035, 0);
    for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) {
      box(group, 'bathroom-floor-tile', 0.38, 0.01, 0.38, (x + z) % 2 ? '#d3ded6' : '#f2f0e5', -0.78 + x * 0.39, 0.075, -0.78 + z * 0.39);
    }
    // Two full privacy walls and low cutaway faces leave the fittings easy to inspect.
    box(group, 'bathroom-back-wall', 1.96, 2.28, 0.1, color, 0, 1.21, -0.93);
    box(group, 'bathroom-privacy-wall', 0.1, 2.28, 1.86, color, -0.93, 1.21, 0.05);
    box(group, 'bathroom-side-cutaway', 0.08, 0.72, 1.86, color, 0.94, 0.43, 0.02);
    box(group, 'bathroom-door-jamb', 0.1, 2.12, 0.1, '#b79873', -0.79, 1.13, 0.91);
    box(group, 'bathroom-door-jamb', 0.1, 2.12, 0.1, '#b79873', 0.14, 1.13, 0.91);
    box(group, 'bathroom-door-header', 1.03, 0.1, 0.1, '#b79873', -0.325, 2.16, 0.91);
    box(group, 'bathroom-front-cutaway', 0.69, 0.72, 0.08, color, 0.56, 0.43, 0.93);
    for (const y of [0.5, 0.92, 1.34]) box(group, 'bathroom-wall-grout', 1.78, 0.018, 0.008, '#eef0e6', 0, y, -0.875);
    // Toilet tank, pedestal, bowl and an open oval seat.
    box(group, 'toilet-tank', 0.48, 0.63, 0.20, '#f7f6ed', -0.40, 0.57, -0.66);
    box(group, 'toilet-flush', 0.12, 0.02, 0.07, '#a2b5b2', -0.40, 0.895, -0.66);
    ellipsoid(group, 'toilet-pedestal', '#f2f2e8', -0.40, 0.28, -0.24, 0.21, 0.2, 0.26);
    ellipsoid(group, 'toilet-bowl', '#f9f9f2', -0.40, 0.47, -0.22, 0.31, 0.19, 0.39);
    ellipsoid(group, 'toilet-bowl-water', '#a5c7c7', -0.40, 0.642, -0.20, 0.20, 0.016, 0.28);
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.047, 8, 24), new THREE.MeshStandardMaterial({ color: '#fffdf3', roughness: 0.28 }));
    seat.name = 'toilet-seat'; seat.rotation.x = -Math.PI / 2; seat.scale.set(1, 1.35, 1); seat.position.set(-0.40, 0.66, -0.22); group.add(seat);
    box(group, 'bathroom-basin-cabinet', 0.59, 0.68, 0.48, '#b19a80', 0.49, 0.42, -0.55);
    box(group, 'bathroom-basin', 0.65, 0.14, 0.53, '#f8f5ea', 0.49, 0.82, -0.55);
    ellipsoid(group, 'bathroom-basin-recess', '#b4ccca', 0.49, 0.894, -0.52, 0.23, 0.015, 0.16);
    box(group, 'bathroom-faucet', 0.045, 0.21, 0.045, '#96aaa9', 0.49, 0.985, -0.73);
    box(group, 'bathroom-faucet-spout', 0.045, 0.04, 0.16, '#96aaa9', 0.49, 1.075, -0.66);
    box(group, 'bathroom-mirror-frame', 0.62, 0.75, 0.045, '#c3aa82', 0.49, 1.57, -0.86);
    box(group, 'bathroom-mirror', 0.54, 0.67, 0.015, '#b6d4d5', 0.49, 1.57, -0.827);
    box(group, 'bathroom-towel', 0.035, 0.35, 0.3, '#dfbcad', -0.863, 1.19, 0.43);
  }
  const size = getItemSize(item), basis = group.userData.itemSizeBasis;
  group.scale.set(size.width / basis.width, 1, size.depth / basis.depth);
  return group;
}
