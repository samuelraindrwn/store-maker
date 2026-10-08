import * as THREE from 'three';
import { getFloorBounds } from '../model';
import type { ShopDocument } from '../model';
import { buildSkyline } from './skyline';

type Primitive = 'box' | 'cylinder' | 'sphere' | 'roof' | 'glow' | 'umbrella' | 'window';
type Part = { matrix: THREE.Matrix4; color: THREE.Color };

/** Decorative city blocks; repeated street details share instanced geometry. */
export function buildCity(shop: ShopDocument): THREE.Group {
  const group = new THREE.Group();
  group.name = 'nemu-neighbourhood';
  group.userData.environment = true;
  const parts: Record<Primitive, Part[]> = { box: [], cylinder: [], sphere: [], roof: [], glow: [], umbrella: [], window: [] };
  const transform = new THREE.Object3D();
  const add = (kind: Primitive, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) => {
    transform.position.set(x, y, z);
    transform.scale.set(sx, sy, sz);
    transform.rotation.set(rx, ry, rz);
    transform.updateMatrix();
    parts[kind].push({ matrix: transform.matrix.clone(), color: new THREE.Color(color) });
  };
  const block = (color: string, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0) => add('box', color, x, y, z, w, h, d, 0, ry);
  const glass = (color: string, x: number, y: number, z: number, w: number, h: number, d: number) => add('window', color, x, y, z, w, h, d);
  const post = (color: string, x: number, y: number, z: number, radius: number, height: number) => add('cylinder', color, x, y, z, radius * 2, height, radius * 2);
  const orb = (color: string, x: number, y: number, z: number, sx: number, sy: number, sz = sx) => add('sphere', color, x, y, z, sx, sy, sz);
  const bounds = getFloorBounds(shop);
  const front = bounds.maxZ + 1 - shop.depth / 2;
  const back = bounds.minZ - shop.depth / 2;
  const left = bounds.minX - shop.width / 2;
  const right = bounds.maxX + 1 - shop.width / 2;
  const centerX = (left + right) / 2;
  const centerZ = (back + front) / 2;
  const streetWidth = Math.max(34, bounds.width + 18);
  group.add(buildSkyline(shop));

  // A continuous walking level meets the shop's raised plinth; the road is lower.
  block('#c9d1bd', centerX, -0.48, centerZ - 2, streetWidth + 4, 0.18, Math.max(30, bounds.depth + 24));
  block('#b6adb8', centerX, -0.3, front + 4, streetWidth + 4, 0.17, 3.6);
  block('#d5c8b9', centerX, -0.22, front + 1.18, streetWidth, 0.28, 2.05);
  block('#ece1cd', centerX, -0.13, front + 2.15, streetWidth, 0.18, 0.19);
  block('#ddcfbd', centerX, -0.24, front + 6.3, streetWidth, 0.18, 1.1);
  block('#e7ddcd', centerX, -0.17, front + 5.75, streetWidth, 0.15, 0.17);
  block('#d6cbbd', left - 2.5, -0.23, back - 1.2, 2.7, 0.25, bounds.depth + 8);
  block('#d6cbbd', right + 2.55, -0.23, back - 1.2, 2.6, 0.25, bounds.depth + 8);
  block('#d6cbbd', centerX, -0.22, back - 2.2, streetWidth - 4, 0.25, 2.3);
  // A second lane and planted courtyards connect the surrounding blocks.
  block('#bfc1c2', centerX, -0.3, back - 8.5, streetWidth, 0.17, 2.5);
  block('#dce0cc', left - 6.2, -0.32, back - 4, 9.5, 0.13, 12.5);
  block('#d9dfca', right + 6.1, -0.32, back - 4, 9.5, 0.13, 12.5);
  for (let x = centerX - streetWidth / 2 + 1; x < centerX + streetWidth / 2; x += 3.4) block('#eee8d6', x, -0.207, back - 8.5, 1.35, 0.012, 0.075);
  for (let x = centerX - streetWidth / 2 + 1; x <= centerX + streetWidth / 2 - 1; x += 1.25) {
    block('#beb3a8', x, -0.074, front + 1.16, 0.015, 0.012, 1.82);
    block('#e4d9c6', x, -0.034, front + 2.15, 0.56, 0.012, 0.19);
  }
  for (let x = centerX - streetWidth / 2 + 1; x <= centerX + streetWidth / 2 - 1; x += 3.4) block('#eee8d6', x, -0.207, front + 4, 1.5, 0.012, 0.085);
  for (let z = front + 2.55; z < front + 5.55; z += 0.44) block('#f7efda', left - 1.7, -0.203, z, 1.45, 0.018, 0.23);

  const sign = (label: string, color: string, x: number, y: number, z: number, width: number, height: number) => {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#fff4dc';
    ctx.font = '700 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 67, 470);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }));
    mesh.position.set(x, y, z);
    group.add(mesh);
  };

  const building = (x: number, z: number, w: number, h: number, d: number, color: string, trim: string, label: string, roof = false) => {
    block(color, x, h / 2 - 0.07, z, w, h, d);
    block('#f1e5d2', x, 0.09, z, w + 0.14, 0.26, d + 0.16);
    const face = z + d / 2;
    block(trim, x, 1.07, face + 0.035, w - 0.48, 1.83, 0.08);
    glass('#92afb0', x, 1.1, face + 0.082, w - 0.69, 1.55, 0.025);
    block('#eee2cc', x, 1.1, face + 0.12, 0.07, 1.7, 0.055);
    block('#eee2cc', x - (w - 0.62) / 2, 1.1, face + 0.12, 0.075, 1.7, 0.055);
    block('#eee2cc', x + (w - 0.62) / 2, 1.1, face + 0.12, 0.075, 1.7, 0.055);
    block('#eee2cc', x, 0.7, face + 0.115, w - 0.58, 0.065, 0.045);
    block('#f0cd84', x + 0.18, 0.98, face + 0.16, 0.04, 0.19, 0.04);
    block(trim, x, 2.12, face + 0.24, w + 0.18, 0.16, 0.7);
    for (let i = 0; i < 8; i++) block(i % 2 ? '#f5e9d5' : trim, x - w / 2 + (i + 0.5) * w / 8, 2.03, face + 0.57, w / 8, 0.16, 0.075);
    sign(label, trim, x, 2.45, face + 0.06, w - 0.4, 0.42);
    for (let y = 3.35; y < h - 0.35; y += 1.15) {
      const columns = w > 3.7 ? 3 : 2;
      for (let i = 0; i < columns; i++) {
        const wx = x + (i - (columns - 1) / 2) * (w - 0.6) / columns;
        block('#eee5d6', wx, y, face + 0.04, 0.8, 0.9, 0.1);
        glass(i % 2 ? '#9ab4b9' : '#a9c0bf', wx, y, face + 0.103, 0.65, 0.72, 0.03);
        block('#eee5d6', wx, y, face + 0.13, 0.035, 0.79, 0.025);
        block('#eee5d6', wx, y, face + 0.13, 0.71, 0.035, 0.025);
        block(trim, wx, y - 0.46, face + 0.13, 0.93, 0.065, 0.23);
      }
    }
    if (h > 4) {
      // A shallow balcony, flowering sill, and side windows break up blank facades.
      block('#ebdeca', x, 2.89, face + 0.31, w - 0.5, 0.08, 0.59);
      block(trim, x, 3.15, face + 0.57, w - 0.55, 0.045, 0.045);
      for (let i = 0; i < 7; i++) block(trim, x - (w - 0.7) / 2 + i * (w - 0.7) / 6, 3.01, face + 0.57, 0.03, 0.3, 0.035);
      block('#bc917c', x + w * 0.25, 2.96, face + 0.39, 0.56, 0.15, 0.25);
      for (let i = 0; i < 3; i++) orb(i % 2 ? '#d4a29b' : '#8ba381', x + w * 0.25 - 0.18 + i * 0.18, 3.08, face + 0.39, 0.25, 0.21, 0.24);
    }
    for (const side of [-1, 1]) for (const dz of [-0.65, 0.65]) {
      block('#ede3d2', x + side * (w / 2 + 0.018), h > 4 ? 3.45 : 1.75, z + dz, 0.05, 0.94, 0.72);
      glass('#9cafad', x + side * (w / 2 + 0.046), h > 4 ? 3.45 : 1.75, z + dz, 0.018, 0.78, 0.57);
    }
    block('#ecdfca', x, h + 0.025, z, w + 0.23, 0.17, d + 0.23);
    if (roof) {
      add('roof', '#b77e68', x, h + 0.59, z, (w + 0.4) * 0.72, 1.05, (d + 0.4) * 0.72, 0, Math.PI / 4);
    } else {
      block(trim, x, h + 0.14, z - d / 2, w + 0.14, 0.24, 0.12);
      block(trim, x, h + 0.14, face, w + 0.14, 0.24, 0.12);
      block(trim, x - w / 2, h + 0.14, z, 0.12, 0.24, d);
      block(trim, x + w / 2, h + 0.14, z, 0.12, 0.24, d);
      block('#b9b8b0', x + w * 0.2, h + 0.31, z - 0.25, 0.65, 0.43, 0.58);
      for (let i = 0; i < 4; i++) block('#899697', x + w * 0.2, h + 0.27 + i * 0.06, z + 0.045, 0.46, 0.016, 0.02);
      block('#c4a68b', x - w * 0.25, h + 0.23, z + 0.35, 0.6, 0.31, 0.5);
      orb('#94a68a', x - w * 0.25, h + 0.49, z + 0.35, 0.83, 0.45, 0.69);
    }
    // A tiny shop planter lends scale without individual foliage meshes.
    block('#bc8c70', x - w * 0.38, 0.14, face + 0.37, 0.34, 0.39, 0.34);
    orb('#85a37a', x - w * 0.38, 0.58, face + 0.37, 0.5, 0.6, 0.45);
  };
  building(left - 3.6, back - 0.5, 3.25, 3.15, 3.1, '#e2c2ad', '#af8678', 'KOPI PAGI', true);
  building(left - 3.1, back - 5.3, 3.9, 3.1, 3.2, '#c6d1bd', '#819a8f', 'RUMAH BUKU');
  building(centerX + 0.75, back - 5.9, 3.4, 3.05, 3.1, '#dbc6da', '#a08ba9', 'SUDUT SENI');
  building(right + 3.2, back - 4.8, 3.8, 3.65, 3.4, '#eed4b3', '#bf9b78', 'ROTI & RASA');
  building(right + 4.0, back + 0.1, 3.1, 2.95, 2.9, '#c4d3cf', '#809e9b', 'TOKO BUNGA', true);
  building(left - 7.55, back - 1.5, 3.4, 4.65, 3.1, '#e4d4aa', '#ab9873', 'TOKO MUSIK');
  building(right + 8.0, back - 0.9, 3.55, 4.4, 3.3, '#d3c9dd', '#9589a6', 'STUDIO KECIL');
  building(left - 7.3, back - 6.1, 3.5, 3.2, 2.9, '#c9d6d0', '#8ba699', 'KEDAI TEH', true);
  building(right + 7.7, back - 6.6, 3.7, 5.35, 3.1, '#ddc4b6', '#b09591', 'RUMAH KARYA');
  // Narrow infill shops make a continuous, varied rear streetscape.
  building(centerX - 2.85, back - 5.7, 2.6, 3.15, 2.9, '#e8d4bb', '#ba9985', 'KIOS KERTAS');

  const tree = (x: number, z: number, height = 2.8) => {
    block('#ded0b8', x, -0.03, z, 0.95, 0.13, 0.95);
    block('#8e9d73', x, 0.045, z, 0.77, 0.07, 0.77);
    post('#a27e60', x, height * 0.36, z, 0.12, height * 0.73);
    orb('#91a97e', x, height * 0.83, z, 1.63, 1.6, 1.43);
    orb('#7f9d75', x - 0.42, height * 0.74, z + 0.22, 1.25, 1.2, 1.1);
    orb('#a4b88c', x + 0.35, height * 0.92, z - 0.13, 1.18, 1.3, 1.2);
  };
  tree(left - 1.8, back - 1.65, 2.8);
  tree(right + 1.7, back - 1.6, 3.2);
  tree(left - 5.65, front + 0.9, 2.7);
  tree(right + 5.5, front + 0.9, 2.65);
  tree(centerX + 4.2, back - 9.1, 3.4);
  tree(left - 5.3, back - 6.9, 2.4);
  tree(right + 5.2, back - 6.8, 2.6);
  tree(left - 9.7, back - 3.9, 3.15);
  tree(right + 10.25, back - 3.6, 2.8);
  tree(centerX - 4.4, back - 9.7, 2.6);

  const streetlamp = (x: number, z: number, groundY = -0.068, maxPoolZ = front + 2.04) => {
    post('#726878', x, 0.06, z, 0.15, 0.19);
    post('#847888', x, 1.35, z, 0.045, 2.65);
    block('#847888', x + 0.16, 2.62, z, 0.38, 0.055, 0.055);
    add('glow', '#ffe6ad', x + 0.3, 2.5, z, 0.28, 0.3, 0.28);
    post('#847888', x + 0.3, 2.68, z, 0.18, 0.055);
    const anchor = new THREE.Object3D();
    anchor.name = 'street-lamp-light-anchor';
    anchor.position.set(x + 0.3, 2.42, z);
    anchor.userData.nightLight = { color: '#ffde98', dayIntensity: 0, nightIntensity: 5, distance: 5.5, kind: 'street' };
    group.add(anchor);

    // Each rebuilt city owns its pool texture; no editable object's bounds grow.
    const size = 32;
    const radius = 1.125;
    const minZ = z - radius;
    // Clip front pools before the curb, rather than floating over the lower road.
    const maxZ = Math.min(z + radius, maxPoolZ);
    const data = new Uint8Array(size * size * 4);
    for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
      const distance = Math.hypot((px + 0.5 - size / 2) / (size / 2), (maxZ - (py + 0.5) / size * (maxZ - minZ) - z) / radius);
      data.set([255, 222, 152, Math.round(Math.max(0, 1 - distance) ** 2 * 255)], (py * size + px) * 4);
    }
    const texture = new THREE.DataTexture(data, size, size);
    texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, maxZ - minZ), new THREE.MeshBasicMaterial({
      map: texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
    }));
    pool.name = 'street-lamp-light-pool';
    pool.position.set(x + 0.3, groundY + 0.001, (minZ + maxZ) / 2);
    pool.rotation.x = -Math.PI / 2;
    pool.material.userData.nightOpacity = { day: 0, night: 0.3 };
    pool.renderOrder = 1;
    group.add(pool);
  };
  streetlamp(left - 3.1, front + 1.75);
  streetlamp(right + 2.35, front + 1.75);
  streetlamp(right + 6.0, back - 2.1, -0.248, Infinity);

  const bench = (x: number, z: number) => {
    for (const offset of [-0.61, 0.61]) {
      block('#716776', x + offset, 0.23, z, 0.055, 0.5, 0.54);
      block('#716776', x + offset, 0.6, z - 0.19, 0.045, 0.65, 0.045);
    }
    for (let i = 0; i < 3; i++) block('#ba9575', x, 0.46, z - 0.16 + i * 0.16, 1.6, 0.065, 0.12);
    for (let i = 0; i < 2; i++) block('#ba9575', x, 0.66 + i * 0.18, z - 0.2, 1.6, 0.13, 0.065);
  };
  bench(left - 3.7, front + 0.9);
  bench(right + 4.0, front + 0.9);

  const flowerBed = (x: number, z: number, w = 1.3) => {
    block('#cab5a2', x, 0.02, z, w, 0.22, 0.53);
    block('#84927a', x, 0.17, z, w - 0.1, 0.13, 0.44);
    for (let i = 0; i < 6; i++) orb(['#d4a49b', '#dacc9b', '#b5a5c6'][i % 3], x - w * 0.36 + i * w * 0.14, 0.28 + i % 2 * 0.035, z, 0.21, 0.17, 0.23);
  };
  flowerBed(left - 2.8, back + 1.6);
  flowerBed(right + 2.7, back + 1.95, 1.55);
  flowerBed(left - 6.8, front + 1.65, 1.7);
  flowerBed(right + 7.2, front + 1.65, 1.7);

  const cafeTable = (x: number, z: number, umbrella = false) => {
    post('#85747c', x, 0.3, z, 0.036, 0.73);
    post('#8f7e7b', x, -0.025, z, 0.22, 0.06);
    post('#d8bb92', x, 0.68, z, 0.43, 0.075);
    for (const dx of [-0.67, 0.67]) {
      for (const dz of [-0.14, 0.14]) post('#a18871', x + dx, 0.12, z + dz, 0.022, 0.38);
      block('#d7b791', x + dx, 0.33, z, 0.39, 0.07, 0.39);
      block('#bca18b', x + dx, 0.56, z - 0.17, 0.38, 0.39, 0.05);
    }
    post('#eee0c8', x + 0.18, 0.78, z, 0.055, 0.12);
    post('#bd9b80', x - 0.13, 0.8, z + 0.06, 0.07, 0.15);
    orb('#8ca283', x - 0.13, 0.92, z + 0.06, 0.19, 0.2, 0.17);
    if (umbrella) {
      post('#9b8873', x, 0.97, z, 0.027, 2.05);
      add('umbrella', '#d8b5a2', x, 2.06, z, 2.05, 0.4, 2.05);
      post('#bda38b', x, 2.32, z, 0.042, 0.15);
    }
  };
  cafeTable(left - 3.7, back + 2.5, true);
  cafeTable(left - 6.4, back + 2.55);
  cafeTable(right + 7.45, back + 2.6, true);

  // Small, static pedestrians give scale; all scenery remains outside editing hit tests.
  const pedestrian = (x: number, z: number, shirt: string, facing = 0, bag = false) => {
    const skin = '#cda98b';
    for (const dx of [-0.065, 0.065]) {
      post('#777583', x + dx, 0.18, z, 0.041, 0.45);
      block('#675f6f', x + dx, -0.034, z + 0.035, 0.1, 0.085, 0.18);
    }
    orb(shirt, x, 0.64, z, 0.32, 0.53, 0.26);
    for (const dx of [-0.17, 0.17]) add('cylinder', shirt, x + dx, 0.61, z, 0.072, 0.39, 0.072, 0, 0, dx > 0 ? 0.17 : -0.17);
    orb(skin, x, 1.02, z, 0.255, 0.29, 0.25);
    orb('#64565d', x, 1.105, z - 0.025, 0.267, 0.17, 0.263);
    if (bag) block('#c3aa82', x + 0.23, 0.46, z, 0.17, 0.3, 0.2, facing);
  };
  pedestrian(left - 1.8, front + 1.1, '#9aafad', 0, true);
  pedestrian(right + 1.25, back + 1.85, '#b2a1b8', 0, true);
  pedestrian(left - 5.0, back + 2.9, '#c79c86');
  pedestrian(centerX - 1.6, front + 6.3, '#b4ad87', 0, true);
  pedestrian(centerX - 1.1, front + 6.1, '#a4b0bd');
  pedestrian(right + 6.5, back - 1.9, '#c4a0a2');

  // A small neighborhood notice kiosk and bollards finish the street corners.
  for (const x of [left - 1.65, right + 1.2]) for (const dz of [2.05, 5.9]) {
    post('#8a8290', x, 0.23, front + dz, 0.057, 0.55);
    post('#d9ccb9', x, 0.43, front + dz, 0.061, 0.08);
  }
  block('#9b8aa8', right + 3.1, 0.56, back + 2.45, 0.68, 1.31, 0.34);
  block('#ece1c9', right + 3.1, 0.7, back + 2.63, 0.53, 0.67, 0.025);
  block('#bda285', right + 3.1, 1.3, back + 2.45, 0.83, 0.13, 0.51);
  for (let i = 0; i < 3; i++) block(['#c3ada9', '#a4b4a2', '#cbb888'][i], right + 2.96 + i * 0.14, 0.7, back + 2.65, 0.1, 0.36, 0.01);

  const geometries: Record<Primitive, THREE.BufferGeometry> = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
    sphere: new THREE.IcosahedronGeometry(0.5, 1),
    roof: new THREE.ConeGeometry(1, 1, 4),
    glow: new THREE.IcosahedronGeometry(0.5, 1),
    umbrella: new THREE.ConeGeometry(0.5, 1, 8),
    window: new THREE.BoxGeometry(1, 1, 1),
  };
  for (const kind of Object.keys(parts) as Primitive[]) {
    const batch = parts[kind];
    if (!batch.length) { geometries[kind].dispose(); continue; }
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, ...(kind === 'glow' ? { emissive: '#ffde98', emissiveIntensity: 0.7 } : {}) });
    if (kind === 'glow') material.userData.nightGlow = { color: '#ffde98', dayIntensity: 0.7, nightIntensity: 2.2 };
    if (kind === 'window') material.userData.nightGlow = { color: '#ffe1ae', dayIntensity: 0, nightIntensity: 0.55 };
    const mesh = new THREE.InstancedMesh(geometries[kind], material, batch.length);
    mesh.name = `city-${kind}`;
    batch.forEach((part, index) => { mesh.setMatrixAt(index, part.matrix); mesh.setColorAt(index, part.color); });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  group.traverse(object => {
    object.userData.environment = true;
    object.raycast = () => {};
  });
  return group;
}
