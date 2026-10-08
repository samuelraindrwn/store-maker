import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getItemSize, type ProductKind, type ShopItem } from '../model';

type StockBuilder = (parent: THREE.Object3D, kind: ProductKind, x: number, y: number, z: number, seed: number) => void;
const KINDS = new Set(['glass-cabinet', 'display-plinth', 'pegboard', 'food-display', 'drinks-fridge', 'coffee-station', 'prep-counter', 'stove', 'sink', 'dining-table', 'service-cart']);
const CREAM = '#f6ebd7', WOOD = '#ba9270', INK = '#514954', STEEL = '#bdc8c4', DARK_STEEL = '#879692';

function material(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.68, metalness: 0.02, ...extra });
}

function add(parent: THREE.Object3D, name: string, geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number, extra?: THREE.MeshStandardMaterialParameters) {
  const mesh = new THREE.Mesh(geometry, material(color, extra));
  mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}

function box(parent: THREE.Object3D, name: string, w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, radius = 0.018) {
  return add(parent, name, radius > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)) : new THREE.BoxGeometry(w, h, d), color, x, y, z);
}

function cylinder(parent: THREE.Object3D, name: string, radius: number, height: number, color: string, x: number, y: number, z: number, radiusBottom = radius) {
  return add(parent, name, new THREE.CylinderGeometry(radius, radiusBottom, height, 20), color, x, y, z);
}

function rod(parent: THREE.Object3D, name: string, a: THREE.Vector3, b: THREE.Vector3, radius: number, color: string) {
  const delta = b.clone().sub(a);
  const mesh = cylinder(parent, name, radius, delta.length(), color, 0, 0, 0);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
}

function glass(parent: THREE.Object3D, name: string, w: number, h: number, d: number, x: number, y: number, z: number, opacity = 0.2) {
  const mesh = add(parent, name, new THREE.BoxGeometry(w, h, d), '#b9dbd7', x, y, z,
    { transparent: true, opacity, depthWrite: false, roughness: 0.14, metalness: 0.06, side: THREE.DoubleSide });
  mesh.castShadow = false; return mesh;
}

/** Evenly spaced detail with fixed margins and a cap for very large footprints. */
function slots(length: number, margin: number, spacing: number, limit = 16) {
  const span = Math.max(0, length - 2 * margin);
  const count = Math.max(1, Math.min(limit, Math.floor(span / spacing) + 1));
  return Array.from({ length: count }, (_, i) => count === 1 ? 0 : -span / 2 + i * span / (count - 1));
}

function legs(parent: THREE.Group, w: number, d: number, height: number, color: string, inset = 0.13) {
  const xs = slots(w, inset, 2.2, 10), zs = slots(d, inset, 2.2, 10);
  // Every shape has at least four feet; enlarged counters add intermediate support.
  const xx = xs.length === 1 ? [-w / 2 + inset, w / 2 - inset] : xs;
  const zz = zs.length === 1 ? [-d / 2 + inset, d / 2 - inset] : zs;
  for (const x of xx) for (const z of zz) box(parent, 'support-leg', 0.075, height, 0.075, color, x, 0.025 + height / 2, z, 0.012);
}

function stocked(parent: THREE.Group, item: ShopItem, addStock: StockBuilder, y: number, w: number, d: number, seed = 0, centerZ = 0, rows = 1) {
  if (item.stock === 'none') return;
  const xs = slots(w, 0.3, 0.42, rows > 1 ? 8 : 12), zs = slots(d, 0.3, 0.62, rows);
  for (const z of zs) for (const x of xs) addStock(parent, item.stock, x, y, z + centerZ, seed++);
}

function counter(parent: THREE.Group, w: number, d: number, color: string, topColor = CREAM) {
  box(parent, 'counter-body', w - 0.16, 0.86, d - 0.16, color, 0, 0.48, 0, 0.04);
  box(parent, 'counter-plinth', w - 0.25, 0.08, d - 0.25, WOOD, 0, 0.045, 0);
  box(parent, 'counter-top', w - 0.08, 0.105, d - 0.08, topColor, 0, 0.975, 0, 0.035);
  const bays = Math.max(1, Math.ceil(w / 1.4));
  const bayWidth = (w - 0.26) / bays;
  for (let i = 0; i < bays; i++) {
    const x = -(w - 0.26) / 2 + bayWidth * (i + 0.5);
    box(parent, 'cabinet-door', bayWidth - 0.035, 0.65, 0.035, color, x, 0.5, d / 2 - 0.07, 0.012);
    box(parent, 'cabinet-handle', Math.min(0.25, bayWidth * 0.35), 0.025, 0.045, '#806f62', x, 0.73, d / 2 - 0.036, 0.008);
  }
}

function mug(parent: THREE.Group, x: number, y: number, z: number, color = CREAM) {
  cylinder(parent, 'cup-body', 0.065, 0.13, color, x, y + 0.065, z, 0.05);
  cylinder(parent, 'cup-coffee', 0.053, 0.008, '#6b4c3c', x, y + 0.132, z);
  const handle = add(parent, 'cup-handle', new THREE.TorusGeometry(0.038, 0.012, 6, 12), color, x + 0.069, y + 0.071, z);
  handle.rotation.y = Math.PI / 2;
}

function refrigerator(parent: THREE.Group, item: ShopItem, addStock: StockBuilder, w: number, d: number) {
  const color = item.color;
  box(parent, 'fridge-base', w - 0.1, 0.17, d - 0.1, color, 0, 0.115, 0, 0.04);
  box(parent, 'fridge-back', w - 0.12, 2.05, 0.07, '#dae5dc', 0, 1.21, -d / 2 + 0.095);
  for (const x of [-w / 2 + 0.09, w / 2 - 0.09]) box(parent, 'fridge-side', 0.08, 2.1, d - 0.12, color, x, 1.22, 0);
  box(parent, 'fridge-header', w - 0.1, 0.21, d - 0.1, color, 0, 2.265, 0, 0.04);
  box(parent, 'fridge-header-label', Math.min(w - 0.27, 1.1), 0.085, 0.01, CREAM, 0, 2.265, d / 2 - 0.045, 0.014);
  const light = box(parent, 'fridge-light-strip', w - 0.25, 0.035, 0.04, '#fff5cc', 0, 2.11, -d / 2 + 0.18, 0.007);
  light.material.emissive.set('#fff0b3'); light.material.emissiveIntensity = 0.4;
  light.material.userData.nightGlow = { color: '#fff0b3', dayIntensity: 0.4, nightIntensity: 1.2 };
  for (const y of [0.31, 0.91, 1.51]) {
    box(parent, 'fridge-shelf', w - 0.22, 0.045, d - 0.22, '#d4dfd8', 0, y, 0, 0.009);
    stocked(parent, item, addStock, y + 0.024, w - 0.05, d - 0.05, Math.round(y * 20));
  }
  const panels = Math.max(1, Math.ceil(w / 1.25)), panelWidth = (w - 0.2) / panels;
  for (let i = 0; i < panels; i++) {
    const x = -(w - 0.2) / 2 + (i + 0.5) * panelWidth;
    glass(parent, 'fridge-glass-door', panelWidth - 0.035, 1.85, 0.018, x, 1.215, d / 2 - 0.075, 0.17);
    for (const dx of [-panelWidth / 2, panelWidth / 2]) box(parent, 'fridge-door-frame', 0.035, 1.93, 0.04, color, x + dx, 1.215, d / 2 - 0.065, 0.007);
    box(parent, 'fridge-door-handle', 0.035, 0.32, 0.07, STEEL, x + panelWidth / 2 - 0.09, 1.32, d / 2 - 0.045, 0.009);
  }
}

/** New catalog models are authored at their actual dimensions; callers own placement and sizing metadata. */
export function buildCatalogItem(item: ShopItem, addStock: StockBuilder): THREE.Group | null {
  if (!KINDS.has(item.kind)) return null;
  const group = new THREE.Group();
  const { width: w, depth: d } = getItemSize(item);
  const color = item.color;
  switch (item.kind) {
    case 'glass-cabinet': {
      legs(group, w - 0.06, d - 0.06, 0.19, WOOD);
      box(group, 'vitrine-base', w - 0.1, 0.14, d - 0.1, color, 0, 0.245, 0, 0.025);
      box(group, 'vitrine-crown', w - 0.1, 0.12, d - 0.1, color, 0, 2.14, 0, 0.025);
      for (const x of [-w / 2 + 0.09, w / 2 - 0.09]) {
        glass(group, 'vitrine-side-glass', 0.018, 1.84, d - 0.2, x, 1.2, 0);
        for (const z of [-d / 2 + 0.09, d / 2 - 0.09]) box(group, 'vitrine-upright', 0.065, 1.86, 0.065, color, x, 1.2, z);
      }
      glass(group, 'vitrine-back-glass', w - 0.22, 1.82, 0.016, 0, 1.2, -d / 2 + 0.09, 0.12);
      for (const y of [0.32, 0.92, 1.52]) {
        glass(group, 'vitrine-shelf', w - 0.19, 0.045, d - 0.19, 0, y, 0, 0.52);
        stocked(group, item, addStock, y + 0.024, w, d, Math.round(y * 20));
      }
      const panels = Math.max(1, Math.ceil(w / 1.35)), width = (w - 0.2) / panels;
      for (let i = 0; i < panels; i++) {
        const x = -(w - 0.2) / 2 + (i + 0.5) * width;
        glass(group, 'vitrine-door-glass', width - 0.025, 1.78, 0.018, x, 1.22, d / 2 - 0.07);
        box(group, 'vitrine-door-mullion', 0.035, 1.78, 0.035, color, x + width / 2, 1.22, d / 2 - 0.055, 0.006);
        box(group, 'vitrine-door-handle', 0.025, 0.16, 0.045, '#b28e57', x + width / 2 - 0.085, 1.2, d / 2 - 0.035, 0.006);
      }
      break;
    }
    case 'display-plinth': {
      box(group, 'plinth-foot', w - 0.14, 0.09, d - 0.14, WOOD, 0, 0.045, 0, 0.035);
      box(group, 'plinth-body', w - 0.19, 0.67, d - 0.19, color, 0, 0.415, 0, 0.055);
      box(group, 'plinth-cap', w - 0.08, 0.095, d - 0.08, CREAM, 0, 0.7875, 0, 0.04);
      for (const x of slots(w, 0.16, 0.12, 40)) box(group, 'plinth-fluting', 0.016, 0.49, 0.014, WOOD, x, 0.43, d / 2 - 0.091, 0.004);
      stocked(group, item, addStock, 0.837, w, d);
      break;
    }
    case 'pegboard': {
      legs(group, w, d, 0.18, WOOD);
      box(group, 'pegboard-panel', w - 0.16, 1.91, 0.07, color, 0, 1.155, -d / 2 + 0.12);
      for (const x of [-w / 2 + 0.11, w / 2 - 0.11]) box(group, 'pegboard-upright', 0.075, 2.07, 0.12, WOOD, x, 1.06, -d / 2 + 0.12);
      const xs = slots(w, 0.22, 0.18, 40), ys = [0.47, 0.69, 0.91, 1.13, 1.35, 1.57, 1.79, 2.01];
      const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.013, 8), material('#8e715c'), xs.length * ys.length);
      holes.name = 'pegboard-perforations';
      const matrix = new THREE.Matrix4(); let index = 0;
      for (const x of xs) for (const y of ys) holes.setMatrixAt(index++, matrix.makeTranslation(x, y, -d / 2 + 0.156));
      holes.instanceMatrix.needsUpdate = true; group.add(holes);
      const trayDepth = Math.min(0.45, d - 0.2), trayZ = -d / 2 + 0.19 + trayDepth / 2;
      for (const y of [0.27, 0.9, 1.53]) {
        box(group, 'pegboard-shelf', w - 0.23, 0.045, trayDepth, CREAM, 0, y, trayZ);
        if (item.stock !== 'none') for (const x of slots(w, 0.31, 0.45, 12)) addStock(group, item.stock, x, y + 0.024, trayZ, Math.round(y * 10) + Math.round((x + w) * 5));
      }
      for (const x of slots(w, 0.25, 0.5, 16)) for (const y of [0.82, 1.45]) {
        rod(group, 'pegboard-hook', new THREE.Vector3(x, y, -d / 2 + 0.15), new THREE.Vector3(x, y, -d / 2 + 0.31), 0.012, DARK_STEEL);
        rod(group, 'pegboard-hook-tip', new THREE.Vector3(x, y, -d / 2 + 0.31), new THREE.Vector3(x, y + 0.04, -d / 2 + 0.31), 0.012, DARK_STEEL);
      }
      break;
    }
    case 'food-display': {
      box(group, 'food-case-base', w - 0.12, 0.55, d - 0.12, color, 0, 0.31, 0, 0.04);
      box(group, 'food-case-plinth', w - 0.23, 0.07, d - 0.23, WOOD, 0, 0.055, 0);
      box(group, 'food-case-roof', w - 0.12, 0.085, d - 0.18, CREAM, 0, 1.805, -0.02, 0.025);
      const frontZ = d / 2 - 0.14;
      const front = glass(group, 'food-case-sloped-glass', w - 0.23, 1.15, 0.016, 0, 1.2, frontZ, 0.17);
      front.rotation.x = -0.12;
      for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) {
        glass(group, 'food-case-side-glass', 0.018, 1.16, d - 0.3, x, 1.2, -0.045);
        rod(group, 'food-case-sloped-post', new THREE.Vector3(x, 0.625, frontZ + 0.069), new THREE.Vector3(x, 1.775, frontZ - 0.069), 0.022, color);
      }
      for (const y of [0.63, 1.21]) {
        box(group, 'food-case-shelf', w - 0.23, 0.045, d - 0.3, '#e7dfcc', 0, y, -0.045, 0.012);
        stocked(group, item, addStock, y + 0.024, w, d - 0.1, Math.round(y * 10), -0.045, 2);
      }
      for (const x of slots(w, 0.3, 0.65, 10)) box(group, 'food-case-label', 0.22, 0.09, 0.012, CREAM, x, 0.43, d / 2 - 0.054, 0.008);
      break;
    }
    case 'drinks-fridge': refrigerator(group, item, addStock, w, d); break;
    case 'coffee-station': {
      counter(group, w, d, color, '#e8dfcf');
      const machineWidth = Math.min(0.92, w - 0.4), machineDepth = Math.min(0.58, d - 0.3);
      const machineX = -Math.min(w * 0.18, 0.45), machineZ = -d / 2 + 0.13 + machineDepth / 2;
      box(group, 'coffee-machine-base', machineWidth, 0.05, machineDepth, DARK_STEEL, machineX, 1.06, machineZ, 0.02);
      box(group, 'coffee-machine-back-support', machineWidth - 0.04, 0.17, machineDepth * 0.24, DARK_STEEL, machineX, 1.155, machineZ - machineDepth * 0.34, 0.012);
      for (const side of [-1, 1]) box(group, 'coffee-machine-side-support', 0.045, 0.17, machineDepth * 0.5, color, machineX + side * (machineWidth / 2 - 0.025), 1.155, machineZ - machineDepth * 0.14, 0.012);
      box(group, 'coffee-machine-casing', machineWidth, 0.37, machineDepth * 0.58, color, machineX, 1.405, machineZ - machineDepth * 0.17, 0.065);
      box(group, 'coffee-machine-face', machineWidth - 0.09, 0.21, 0.025, STEEL, machineX, 1.415, machineZ + machineDepth * 0.13, 0.018);
      box(group, 'coffee-drip-tray', machineWidth - 0.08, 0.025, machineDepth * 0.43, INK, machineX, 1.099, machineZ + machineDepth * 0.235, 0.01);
      for (const side of [-1, 1]) {
        const x = machineX + side * machineWidth * 0.23;
        const dial = cylinder(group, 'coffee-machine-dial', 0.033, 0.018, INK, x, 1.45, machineZ + machineDepth * 0.16); dial.rotation.x = Math.PI / 2;
        cylinder(group, 'coffee-spout', 0.018, 0.13, STEEL, x, 1.265, machineZ + machineDepth * 0.19);
        mug(group, x - 0.025, 1.113, machineZ + machineDepth * 0.23);
      }
      const grinderX = w / 2 - 0.23, grinderZ = -d / 2 + 0.28;
      box(group, 'grinder-body', 0.21, 0.25, 0.23, INK, grinderX, 1.165, grinderZ, 0.03);
      cylinder(group, 'grinder-hopper', 0.11, 0.18, '#d0b595', grinderX, 1.38, grinderZ, 0.065);
      cylinder(group, 'grinder-lid', 0.12, 0.025, INK, grinderX, 1.482, grinderZ);
      break;
    }
    case 'prep-counter': {
      legs(group, w, d, 0.88, DARK_STEEL);
      box(group, 'prep-top', w - 0.08, 0.085, d - 0.08, STEEL, 0, 0.9475, 0, 0.025);
      box(group, 'prep-lower-shelf', w - 0.2, 0.045, d - 0.2, '#aab8b2', 0, 0.27, 0, 0.012);
      box(group, 'cutting-board', Math.min(0.7, w * 0.4), 0.035, Math.min(0.42, d * 0.4), WOOD, -w * 0.2, 1.01, 0, 0.035);
      box(group, 'prep-knife-blade', 0.22, 0.012, 0.05, '#dce5df', -w * 0.2 + 0.055, 1.034, 0.03, 0.004);
      box(group, 'prep-knife-handle', 0.11, 0.025, 0.04, INK, -w * 0.2 - 0.11, 1.04, 0.03, 0.009);
      const radius = Math.min(0.18, w * 0.12), x = w * 0.25;
      const bowl = add(group, 'prep-bowl', new THREE.LatheGeometry([new THREE.Vector2(radius * 0.35, 0), new THREE.Vector2(radius * 0.65, 0.035), new THREE.Vector2(radius, 0.145), new THREE.Vector2(radius * 0.88, 0.14), new THREE.Vector2(radius * 0.5, 0.025)], 20), '#e9dcc3', x, 0.995, 0, { side: THREE.DoubleSide });
      bowl.castShadow = true;
      for (let i = 0; i < 3; i++) add(group, 'prep-produce', new THREE.SphereGeometry(radius * 0.34, 10, 8), i % 2 ? '#8caa70' : '#ce8b6f', x + (i - 1) * radius * 0.42, 1.095, (i % 2) * radius * 0.35);
      break;
    }
    case 'stove': {
      counter(group, w, d, color, INK);
      const cols = Math.max(2, Math.min(10, Math.round(w))), rows = Math.max(2, Math.min(6, Math.round(d * 2)));
      const radius = Math.min(0.12, w / cols * 0.24, d / rows * 0.24);
      for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++) {
        const px = -w / 2 + 0.24 + x * (w - 0.48) / (cols - 1), pz = -d / 2 + 0.23 + z * (d - 0.46) / (rows - 1);
        cylinder(group, 'stove-burner', radius, 0.018, '#30383a', px, 1.036, pz);
        const ring = add(group, 'stove-burner-ring', new THREE.TorusGeometry(radius * 0.76, 0.012, 6, 16), DARK_STEEL, px, 1.054, pz); ring.rotation.x = Math.PI / 2;
        box(group, 'stove-grate', radius * 2.25, 0.025, 0.02, INK, px, 1.064, pz, 0.003);
        box(group, 'stove-grate', 0.02, 0.025, radius * 2.25, INK, px, 1.064, pz, 0.003);
      }
      box(group, 'oven-frame', w - 0.3, 0.47, 0.045, DARK_STEEL, 0, 0.43, d / 2 - 0.055, 0.035);
      box(group, 'oven-glass', w - 0.4, 0.34, 0.012, '#3e4b4e', 0, 0.41, d / 2 - 0.025, 0.025);
      box(group, 'oven-handle', w - 0.44, 0.035, 0.055, STEEL, 0, 0.72, d / 2 - 0.028, 0.009);
      for (const x of slots(w, 0.25, 0.32, 6)) {
        const knob = cylinder(group, 'stove-knob', 0.035, 0.027, '#e8dfc8', x, 0.845, d / 2 - 0.029); knob.rotation.x = Math.PI / 2;
      }
      break;
    }
    case 'sink': {
      legs(group, w, d, 0.88, DARK_STEEL);
      box(group, 'sink-lower-shelf', w - 0.22, 0.045, d - 0.22, '#a8b8b0', 0, 0.28, 0);
      const outerW = w - 0.08, outerD = d - 0.08, basinW = Math.min(1.2, w - 0.34), basinD = Math.min(0.6, d - 0.3), cx = -Math.min(w * 0.1, 0.3);
      const gap = (outerD - basinD) / 2;
      for (const side of [-1, 1]) box(group, 'sink-counter-rim', outerW, 0.075, gap, STEEL, 0, 0.9775, side * (basinD / 2 + gap / 2));
      const left = cx - basinW / 2 + outerW / 2, right = outerW / 2 - cx - basinW / 2;
      if (left > 0.005) box(group, 'sink-counter-side', left, 0.075, basinD, STEEL, -outerW / 2 + left / 2, 0.9775, 0);
      if (right > 0.005) box(group, 'sink-counter-side', right, 0.075, basinD, STEEL, outerW / 2 - right / 2, 0.9775, 0);
      box(group, 'sink-basin-bottom', basinW, 0.035, basinD, DARK_STEEL, cx, 0.7325, 0, 0.035);
      for (const x of [-basinW / 2 + 0.0175, basinW / 2 - 0.0175]) box(group, 'sink-basin-wall', 0.035, 0.265, basinD, STEEL, cx + x, 0.8675, 0, 0.014);
      for (const z of [-basinD / 2 + 0.0175, basinD / 2 - 0.0175]) box(group, 'sink-basin-wall', basinW, 0.265, 0.035, STEEL, cx, 0.8675, z, 0.014);
      cylinder(group, 'sink-drain', 0.04, 0.008, '#667d78', cx, 0.755, 0);
      const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(cx, 1.015, -basinD / 2 - 0.035), new THREE.Vector3(cx, 1.52, -basinD / 2 - 0.035), new THREE.Vector3(cx, 1.52, -basinD / 2 + 0.21), new THREE.Vector3(cx, 1.27, -basinD / 2 + 0.21));
      add(group, 'sink-faucet', new THREE.TubeGeometry(curve, 24, 0.024, 8, false), '#b9c9c2', 0, 0, 0, { metalness: 0.3, roughness: 0.3 });
      for (const dx of [-0.14, 0.14]) cylinder(group, 'sink-tap', 0.04, 0.05, DARK_STEEL, cx + dx, 1.042, -basinD / 2 - 0.035);
      break;
    }
    case 'dining-table': {
      const tw = Math.max(0.5, w - 0.5), td = Math.max(0.46, d - 0.9);
      legs(group, tw, td, 0.74, WOOD, 0.11);
      box(group, 'dining-tabletop', tw, 0.09, td, color, 0, 0.815, 0, 0.06);
      const seats = slots(w, 0.3, 0.9, 12), chairWidth = Math.min(0.42, w - 0.4);
      for (const x of seats) for (const side of [-1, 1]) {
        const z = side * (d / 2 - 0.17);
        box(group, 'dining-chair-seat', chairWidth, 0.065, 0.265, '#d6c3a4', x, 0.43, z, 0.035);
        box(group, 'dining-chair-back', chairWidth, 0.26, 0.035, color, x, 0.59, z + side * 0.115, 0.025);
        for (const dx of [-chairWidth / 2 + 0.055, chairWidth / 2 - 0.055]) for (const dz of [-0.085, 0.085]) box(group, 'dining-chair-leg', 0.035, 0.39, 0.035, WOOD, x + dx, 0.205, z + dz, 0.006);
      }
      for (const x of slots(tw, 0.2, 0.75, 12)) {
        cylinder(group, 'dining-plate', 0.125, 0.016, CREAM, x, 0.869, 0);
        cylinder(group, 'dining-plate-center', 0.093, 0.006, '#e0ceb0', x, 0.88, 0);
      }
      break;
    }
    case 'service-cart': {
      for (const x of [-w / 2 + 0.13, w / 2 - 0.13]) for (const z of [-d / 2 + 0.14, d / 2 - 0.14]) {
        const wheel = cylinder(group, 'cart-wheel', 0.085, 0.065, INK, x, 0.085, z); wheel.rotation.z = Math.PI / 2;
        const hub = cylinder(group, 'cart-wheel-hub', 0.034, 0.071, DARK_STEEL, x, 0.085, z); hub.rotation.z = Math.PI / 2;
      }
      for (const x of [-w / 2 + 0.11, w / 2 - 0.11]) for (const z of [-d / 2 + 0.12, d / 2 - 0.12]) cylinder(group, 'cart-upright', 0.025, 0.91, color, x, 0.635, z);
      for (const y of [0.255, 0.835]) {
        box(group, 'cart-tray', w - 0.18, 0.045, d - 0.2, CREAM, 0, y, 0, 0.025);
        for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) box(group, 'cart-tray-rim', 0.025, 0.08, d - 0.2, color, x, y + 0.03, 0, 0.007);
        for (const z of [-d / 2 + 0.105, d / 2 - 0.105]) box(group, 'cart-tray-rim', w - 0.2, 0.08, 0.025, color, 0, y + 0.03, z, 0.007);
        stocked(group, item, addStock, y + 0.024, w, d, Math.round(y * 30));
      }
      for (const x of [-w / 2 + 0.11, w / 2 - 0.11]) rod(group, 'cart-push-handle', new THREE.Vector3(x, 1.09, -d / 2 + 0.12), new THREE.Vector3(x, 1.09, d / 2 - 0.12), 0.03, color);
      break;
    }
  }
  return group;
}
