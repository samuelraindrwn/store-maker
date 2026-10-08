import * as THREE from 'three';
import { getFloorBounds, type ShopDocument } from '../model';

type Primitive = 'box' | 'cylinder' | 'window' | 'lit-window';
type Instance = { matrix: THREE.Matrix4; color: THREE.Color };

/** Distant architecture uses four batches, including an independently lit window subset. */
export function buildSkyline(shop: ShopDocument): THREE.Group {
  const group = new THREE.Group();
  group.name = 'nemu-distant-skyline';
  group.userData.environment = true;
  group.userData.skyline = true;
  const bounds = getFloorBounds(shop);
  const centerX = (bounds.minX + bounds.maxX + 1) / 2 - shop.width / 2;
  const centerZ = (bounds.minZ + bounds.maxZ + 1) / 2 - shop.depth / 2;
  const breadth = Math.max(38, bounds.width + 26);
  const base = -0.395;
  const parts: Record<Primitive, Instance[]> = { box: [], cylinder: [], window: [], 'lit-window': [] };
  let windowIndex = 0;
  const transform = new THREE.Object3D();
  const haze = new THREE.Color('#dcdce6');
  let towerScale = 1;
  let towerX = 0;
  let towerZ = 0;
  const add = (kind: Primitive, color: THREE.Color, x: number, y: number, z: number, width: number, height: number, depth: number, rotation = 0) => {
    transform.position.set(towerX + (x - towerX) * towerScale, base + (y - base) * towerScale, towerZ + (z - towerZ) * towerScale);
    transform.rotation.set(0, rotation, 0);
    transform.scale.set(width * towerScale, height * towerScale, depth * towerScale);
    transform.updateMatrix();
    parts[kind].push({ matrix: transform.matrix.clone(), color: color.clone() });
  };
  const palettes = [
    ['#b3bbc9', '#cad0da', '#94a9be'],
    ['#bcb5ce', '#d2cddd', '#a5a8c2'],
    ['#b7c6c9', '#d0dad9', '#92adb6'],
    ['#c4bdc7', '#ddd3d7', '#a5b1bf'],
    ['#aebccc', '#c9d5de', '#91a6bc'],
  ];

  const tower = (x: number, z: number, width: number, depth: number, height: number, index: number, distant: boolean, scale: number) => {
    towerScale = scale;
    towerX = x;
    towerZ = z;
    const palette = palettes[index % palettes.length];
    const fade = distant ? 0.38 : 0.12;
    const [stone, trim, glass] = palette.map(color => new THREE.Color(color).lerp(haze, fade));
    const warm = new THREE.Color('#e9dcc1').lerp(haze, distant ? 0.6 : 0.3);
    const bodyHeight = height * 0.82;
    const bodyTop = base + bodyHeight;
    const block = (color: THREE.Color, dx: number, y: number, dz: number, w: number, h: number, d: number, rotation = 0) => add('box', color, x + dx, y, z + dz, w, h, d, rotation);
    const window = (color: THREE.Color, dx: number, y: number, dz: number, w: number, h: number, d: number, rotation = 0) => {
      // The same deterministic occupied offices light up after every rebuild.
      const lit = (windowIndex++ * 37 + index * 17) % 100 < 38;
      add(lit ? 'lit-window' : 'window', color, x + dx, y, z + dz, w, h, d, rotation);
    };
    const round = (color: THREE.Color, y: number, diameter: number, h: number) => add('cylinder', color, x, y, z, diameter, h, diameter);

    // The low podium anchors the silhouette even when viewed from another angle.
    block(trim, 0, base + 0.16, 0, width + 0.26, 0.32, depth + 0.26);
    if (index % 5 === 2) {
      // A rounded corner tower, with floor bands and two slim roof masts.
      const diameter = Math.min(width, depth) * 1.06;
      round(stone, base + bodyHeight / 2, diameter, bodyHeight);
      const floors = distant ? 7 : 10;
      for (let row = 1; row <= floors; row++) {
        const y = base + row * bodyHeight / (floors + 1);
        round(trim, y, diameter + 0.045, 0.065);
        for (let side = 0; side < 7; side++) {
          const angle = -Math.PI / 2 + side * Math.PI / 6;
          const radius = diameter * 0.5 + 0.012;
          window(glass, Math.sin(angle) * radius, y + 0.22, Math.cos(angle) * radius, 0.29, 0.3, 0.025, angle);
        }
      }
      round(trim, bodyTop + height * 0.075, diameter * 0.73, height * 0.15);
      round(stone, bodyTop + height * 0.16, diameter * 0.49, height * 0.05);
      for (const dx of [-0.2, 0.2]) block(trim, dx, base + height + 0.22, 0, 0.035, 0.45, 0.035);
      return;
    }

    block(stone, 0, base + bodyHeight / 2, 0, width, bodyHeight, depth);
    block(trim, 0, bodyTop, 0, width + 0.12, 0.12, depth + 0.12);
    const tiers = index % 3 === 0 ? 3 : 2;
    const tierHeight = height * 0.18 / tiers;
    for (let tier = 0; tier < tiers; tier++) {
      const inset = 0.78 - tier * 0.19;
      const offset = index % 3 === 1 ? -width * 0.08 : 0;
      block(tier % 2 ? trim : stone, offset, bodyTop + tierHeight * (tier + 0.5), 0, width * inset, tierHeight, depth * inset);
      block(trim, offset, bodyTop + tierHeight * (tier + 1), 0, width * inset + 0.06, 0.06, depth * inset + 0.06);
    }

    const rows = distant ? 6 : 9;
    const columns = width > 2.5 ? 4 : 3;
    const sides = depth > 2.2 ? 3 : 2;
    for (let row = 0; row < rows; row++) {
      const y = base + 0.65 + row * (bodyHeight - 1.03) / Math.max(1, rows - 1);
      for (let col = 0; col < columns; col++) {
        const dx = ((col + 0.5) / columns - 0.5) * (width - 0.28);
        const color = (row * 7 + col * 3 + index) % 17 === 0 ? warm : glass;
        // Front and back remain complete when the camera is orbited.
        for (const side of [-1, 1]) window(color, dx, y, side * (depth / 2 + 0.013), width / columns * 0.48, 0.27, 0.027);
      }
      for (let col = 0; col < sides; col++) {
        const dz = ((col + 0.5) / sides - 0.5) * (depth - 0.28);
        for (const side of [-1, 1]) window(glass, side * (width / 2 + 0.013), y, dz, 0.027, 0.27, depth / sides * 0.46);
      }
      if (index % 3 === 1 && row % 2 === 0) block(trim, 0, y - 0.21, depth / 2 + 0.025, width + 0.035, 0.045, 0.055);
    }

    // Different structural rhythms prevent the row from reading as cloned boxes.
    if (index % 3 === 0) {
      for (const side of [-1, 1]) block(trim, side * width * 0.42, base + bodyHeight / 2, depth / 2 + 0.055, 0.055, bodyHeight + 0.32, 0.09);
    } else if (index % 3 === 2) {
      block(trim, 0, base + bodyHeight / 2, depth / 2 + 0.045, 0.11, bodyHeight, 0.06);
    }
    if (index % 4 === 0) {
      block(glass, 0, base + height + 0.08, 0, width * 0.26, 0.16, depth * 0.26);
      block(trim, 0, base + height + 0.42, 0, 0.045, 0.63, 0.045);
    }
  };

  // Full city towers sit beyond the low-rise neighborhood. Their broad footprints
  // and tall facades establish a genuinely larger scale than the editable shop.
  const away = new THREE.Vector2(-10.5, -13.35).normalize();
  const across = new THREE.Vector2(-away.y, away.x);
  const rearExtent = Math.abs(away.x) * bounds.width / 2 + Math.abs(away.y) * bounds.depth / 2;
  const nearDistance = Math.max(16, rearExtent + 11);
  const nearHeights = [7.2, 9.8, 8.2, 11.2, 7.7, 10.6, 8.8, 6.7];
  nearHeights.forEach((height, index) => {
    const lateral = (index / (nearHeights.length - 1) - 0.5) * breadth;
    const distance = nearDistance + (index % 3) * 0.13;
    const x = centerX + away.x * distance + across.x * lateral;
    const z = centerZ + away.y * distance + across.y * lateral;
    tower(x, z, 5.3 + (index % 3) * 0.55, 4.3 + (index % 2) * 0.45, height, index, false, 0.85);
  });
  const farHeights = [10.4, 8.6, 12.4, 9.5, 11.6, 8.8];
  farHeights.forEach((height, index) => {
    const lateral = (index / (farHeights.length - 1) - 0.5) * (breadth + 2) + 0.5;
    const distance = nearDistance + 5 + (index % 2) * 0.3;
    const x = centerX + away.x * distance + across.x * lateral;
    const z = centerZ + away.y * distance + across.y * lateral;
    tower(x, z, 7.4 + (index % 2) * 0.7, 5.8, height, index + 8, true, 0.55);
  });

  const geometries: Record<Primitive, THREE.BufferGeometry> = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    window: new THREE.BoxGeometry(1, 1, 1),
    'lit-window': new THREE.BoxGeometry(1, 1, 1),
  };
  for (const kind of Object.keys(parts) as Primitive[]) {
    const batch = parts[kind];
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.96, metalness: 0, fog: true });
    if (kind === 'lit-window') material.userData.nightGlow = { color: '#ffe1ae', dayIntensity: 0, nightIntensity: 0.65 };
    const mesh = new THREE.InstancedMesh(geometries[kind], material, batch.length);
    mesh.name = `skyline-${kind}`;
    batch.forEach((instance, index) => {
      mesh.setMatrixAt(index, instance.matrix);
      mesh.setColorAt(index, instance.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
    group.add(mesh);
  }
  group.userData.towerCount = nearHeights.length + farHeights.length;
  group.userData.nearestRowDistance = nearDistance;
  group.traverse(object => {
    object.userData.environment = true;
    object.raycast = () => {};
  });
  return group;
}
