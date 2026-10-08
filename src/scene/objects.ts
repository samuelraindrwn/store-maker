import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CATALOG, getEntrance, getEntranceAnchor, getEntranceRotation, getEntranceWall, getExterior, getFloorCells, getItemSize, getWallHeight, getWallItems, getWallItemSize, getWallLampStyle, getWallSignStyle, getWallRuns, wallItemPosition, WALL_CATALOG } from '../model';
import type { ProductKind, ShopDocument, ShopItem, WallItem, WallSide } from '../model';
import { wallPanels } from './wallGeometry';
import { buildWindowGeometry, buildWindowSpandrels } from './windowGeometry';
import { buildStockProduct } from './stockObjects';
import { buildCatalogItem } from './catalogObjects';
import { buildBuildingFurniture } from './buildingFurniture';
import { subtractFloorOpenings, type FloorOpening } from './stairGeometry';
import { buildUtilityItem } from './utilityObjects';
import { buildInteriorPartitions } from './partitionGeometry';
import { buildWallClock } from './wallClock';
import { buildWallSignVariant } from './wallSigns';
export { buildCity } from './city';

const CREAM = '#f5ead6';
const WOOD = '#c69972';
const INK = '#453a4f';
const PRODUCT_COLORS = ['#d98776', '#9aaf91', '#c7b5da', '#e6bf75', '#718a8d', '#eadac2'];

/** All generated resources belong to their group, so rebuilding a room is disposable. */
export function disposeGroup(group: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Line)) return;
    geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : [object.material];
    list.forEach((material) => {
      materials.add(material);
      if ('map' in material && material.map instanceof THREE.Texture) textures.add(material.map);
    });
    // Instancing owns GPU matrix/color buffers in addition to geometry/material.
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  group.removeFromParent();
  group.clear();
}

function material(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...extra });
}

function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number, extra?: THREE.MeshStandardMaterialParameters) {
  const object = new THREE.Mesh(geometry, material(color, extra));
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

export function box(parent: THREE.Object3D, w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, radius = 0.025) {
  const geometry = radius > 0
    ? new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3))
    : new THREE.BoxGeometry(w, h, d);
  return mesh(parent, geometry, color, x, y, z);
}

function cylinder(parent: THREE.Object3D, rTop: number, rBottom: number, height: number, color: string, x: number, y: number, z: number, sides = 16) {
  return mesh(parent, new THREE.CylinderGeometry(rTop, rBottom, height, sides), color, x, y, z);
}

function rod(parent: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, radius: number, color: string) {
  const delta = to.clone().sub(from);
  const object = cylinder(parent, radius, radius, delta.length(), color, 0, 0, 0, 8);
  object.position.copy(from).add(to).multiplyScalar(0.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return object;
}

function leaf(parent: THREE.Object3D, x: number, y: number, z: number, rotation: number, size: number, color: string) {
  const object = mesh(parent, new THREE.SphereGeometry(1, 8, 6), color, x, y, z);
  object.scale.set(size * 0.36, size, size * 0.16);
  object.rotation.set(0.32, rotation, rotation * 0.38);
}

function plant(parent: THREE.Object3D, x: number, y: number, z: number, scale = 1, potColor = '#cc9275') {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  cylinder(group, 0.25, 0.19, 0.42, potColor, 0, 0.21, 0, 12);
  cylinder(group, 0.265, 0.265, 0.07, potColor, 0, 0.41, 0, 12);
  cylinder(group, 0.22, 0.22, 0.025, '#695240', 0, 0.452, 0, 12);
  const points = [
    [-0.19, 0.8, 0.06], [0.18, 1.02, -0.08], [-0.1, 1.23, -0.05],
    [0.28, 0.68, 0.12], [-0.26, 1.06, 0.12], [0.1, 1.35, 0.03],
    [0.1, 0.78, -0.22], [-0.1, 0.62, 0.25],
  ];
  points.forEach(([px, py, pz], index) => {
    rod(group, new THREE.Vector3(0, 0.44, 0), new THREE.Vector3(px, py, pz), 0.013, '#657b53');
    leaf(group, px, py, pz, index * 1.27, 0.25 + (index % 3) * 0.04, index % 2 ? '#819568' : '#537656');
  });
  parent.add(group);
  return group;
}

function vase(parent: THREE.Object3D, x: number, y: number, z: number, seed: number) {
  const h = 0.33 + (seed % 3) * 0.055;
  const profile = [new THREE.Vector2(0.07, 0), new THREE.Vector2(0.12, 0.04), new THREE.Vector2(0.14, h * 0.4), new THREE.Vector2(0.09, h * 0.75), new THREE.Vector2(0.075, h), new THREE.Vector2(0.055, h), new THREE.Vector2(0.055, h * 0.76)];
  const object = mesh(parent, new THREE.LatheGeometry(profile, 14), PRODUCT_COLORS[seed % PRODUCT_COLORS.length], x, y, z, { side: THREE.DoubleSide });
  return object;
}

function stockProduct(parent: THREE.Object3D, kind: ProductKind, x: number, y: number, z: number, seed: number) {
  if (buildStockProduct(parent, kind, x, y, z, seed)) return;
  const color = PRODUCT_COLORS[seed % PRODUCT_COLORS.length];
  if (kind === 'plants') {
    plant(parent, x, y, z, 0.35, color);
  } else if (kind === 'ceramics') {
    vase(parent, x, y, z, seed);
  } else if (kind === 'books') {
    const h = 0.32 + (seed % 3) * 0.05;
    box(parent, 0.15, h, 0.29, color, x, y + h / 2, z, 0.012);
    box(parent, 0.105, h - 0.055, 0.008, CREAM, x, y + h / 2, z - 0.15, 0.002);
    box(parent, 0.085, 0.022, 0.008, CREAM, x, y + h * 0.69, z + 0.15, 0.002);
    box(parent, 0.085, 0.016, 0.008, CREAM, x, y + h * 0.35, z + 0.15, 0.002);
  } else if (kind === 'vinyl') {
    box(parent, 0.33, 0.34, 0.04, color, x, y + 0.17, z, 0.006);
    const record = cylinder(parent, 0.105, 0.105, 0.008, '#302d38', x, y + 0.19, z + 0.026, 24);
    record.rotation.x = Math.PI / 2;
    const label = cylinder(parent, 0.035, 0.035, 0.009, CREAM, x, y + 0.19, z + 0.033, 16);
    label.rotation.x = Math.PI / 2;
    box(parent, 0.15, 0.019, 0.009, CREAM, x, y + 0.05, z + 0.026, 0.002);
  } else if (kind === 'fashion') {
    for (let layer = 0; layer < 3; layer++) {
      box(parent, 0.34, 0.07, 0.28, PRODUCT_COLORS[(seed + layer) % 6], x, y + 0.035 + layer * 0.07, z, 0.035);
      box(parent, 0.055, 0.007, 0.15, '#e9e1d3', x, y + 0.074 + layer * 0.07, z - 0.035, 0.002);
    }
  }
}

function stockRow(parent: THREE.Object3D, stock: ProductKind, y: number, count = 5, span = 1.42, z = 0, seed = 0) {
  if (stock === 'none') return;
  for (let i = 0; i < count; i++) {
    stockProduct(parent, stock, count === 1 ? 0 : -span / 2 + (i * span) / (count - 1), y, z, seed + i);
  }
}

function shirt(parent: THREE.Object3D, x: number, y: number, color: string) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.09, 0);
  shape.lineTo(-0.19, -0.025);
  shape.lineTo(-0.3, -0.19);
  shape.lineTo(-0.21, -0.26);
  shape.lineTo(-0.16, -0.2);
  shape.lineTo(-0.16, -0.55);
  shape.quadraticCurveTo(0, -0.59, 0.16, -0.55);
  shape.lineTo(0.16, -0.2);
  shape.lineTo(0.21, -0.26);
  shape.lineTo(0.3, -0.19);
  shape.lineTo(0.19, -0.025);
  shape.lineTo(0.09, 0);
  shape.quadraticCurveTo(0, -0.11, -0.09, 0);
  const object = mesh(parent, new THREE.ExtrudeGeometry(shape, { depth: 0.055, bevelEnabled: true, bevelSize: 0.013, bevelThickness: 0.012, bevelSegments: 1, steps: 1 }), color, x, y, 0.02);
  object.rotation.y = -0.26;
  const hanger = new THREE.Group();
  rod(hanger, new THREE.Vector3(-0.13, 0, 0), new THREE.Vector3(0, 0.09, 0), 0.012, WOOD);
  rod(hanger, new THREE.Vector3(0, 0.09, 0), new THREE.Vector3(0.13, 0, 0), 0.012, WOOD);
  rod(hanger, new THREE.Vector3(-0.13, 0, 0), new THREE.Vector3(0.13, 0, 0), 0.012, WOOD);
  hanger.position.set(x, y + 0.06, 0.045);
  parent.add(hanger);
}

/** Absolute preview transforms; the authored basis never changes during a gesture. */
export function applyItemSize(group: THREE.Object3D, item: ShopItem): void {
  const basis = group.userData.itemSizeBasis as { width: number; depth: number } | undefined;
  if (!basis) return;
  const size = getItemSize(item);
  group.scale.set(size.width / basis.width, 1, size.depth / basis.depth);
}

export function applyWallItemSize(group: THREE.Object3D, item: WallItem): void {
  const basis = group.userData.wallItemSizeBasis as { width: number; height: number; depth: number } | undefined;
  if (!basis) return;
  const size = getWallItemSize(item);
  group.scale.set(size.width / basis.width, size.height / basis.height, size.depth / basis.depth);
}

export function buildItem(item: ShopItem, floorRise = 2.99): THREE.Group {
  const utilityItem = buildUtilityItem(item);
  if (utilityItem) return utilityItem;
  const buildingFurniture = buildBuildingFurniture(item, floorRise);
  if (buildingFurniture) return buildingFurniture;
  const catalogItem = buildCatalogItem(item, stockProduct);
  if (catalogItem) {
    catalogItem.name = `item:${item.id}`;
    catalogItem.userData.itemId = item.id;
    catalogItem.userData.itemSizeBasis = { ...getItemSize(item) };
    applyItemSize(catalogItem, item);
    return catalogItem;
  }
  const g = new THREE.Group();
  g.name = `item:${item.id}`;
  g.userData.itemId = item.id;
  const color = item.color;
  const { width: w, depth: d } = getItemSize(item);
  const authoredAtSize = ['shelf', 'table', 'counter', 'rack', 'rug'].includes(item.kind);
  g.userData.itemSizeBasis = authoredAtSize ? { width: w, depth: d } : { ...CATALOG.find(entry => entry.kind === item.kind)! };
  switch (item.kind) {
    case 'shelf': {
      box(g, w - 0.16, 2.18, 0.09, color, 0, 1.15, -d / 2 + 0.16);
      for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) box(g, 0.12, 2.28, d - 0.23, color, x, 1.15, 0);
      [0.19, 0.73, 1.27, 1.81, 2.24].forEach(y => box(g, w - 0.15, 0.09, d - 0.2, color, 0, y, 0));
      const columns = Math.min(32, Math.max(1, Math.round((w - 0.6) / (item.stock === 'books' ? 0.2 : 0.46)) + 1));
      for (let level = 0; level < 4; level++) stockRow(g, item.stock, 0.24 + level * 0.54, columns, w - 0.6, d / 2 - 0.41, level * 3);
      for (const x of [-w / 2 + 0.28, w / 2 - 0.28]) box(g, 0.1, 0.15, d - 0.45, WOOD, x, 0.08, 0);
      // Wide shelves gain uprights instead of a single stretched plank.
      const bays = Math.ceil(w / 2);
      for (let bay = 1; bay < bays; bay++) box(g, 0.075, 2.08, d - 0.24, color, -w / 2 + bay * w / bays, 1.2, 0);
      break;
    }
    case 'table': {
      const xLegs = Math.max(2, Math.ceil(w / 3) + 1), zLegs = Math.max(2, Math.ceil(d / 3) + 1);
      for (let x = 0; x < xLegs; x++) for (let z = 0; z < zLegs; z++) {
        box(g, 0.14, 0.84, 0.14, WOOD, -w / 2 + 0.34 + x * (w - 0.68) / (xLegs - 1), 0.42, -d / 2 + 0.34 + z * (d - 0.68) / (zLegs - 1));
      }
      box(g, w - 0.16, 0.16, d - 0.16, color, 0, 0.91, 0, 0.07);
      box(g, w - 0.45, 0.08, d - 0.45, WOOD, 0, 0.82, 0);
      if (item.stock !== 'none') {
        const rows = Math.min(6, Math.round(d)), columns = Math.min(12, Math.max(1, Math.round(w * 1.5)));
        for (let row = 0; row < rows; row++) stockRow(g, item.stock, 1.0, columns, w - 0.85, rows === 1 ? 0 : -d / 2 + 0.56 + row * (d - 1.12) / (rows - 1), row * 3);
        box(g, 0.27, 0.16, 0.035, CREAM, w / 2 - 0.35, 1.08, d / 2 - 0.25, 0.008);
      }
      break;
    }
    case 'counter': {
      box(g, w - 0.22, 0.94, d - 0.22, color, 0, 0.5, 0, 0.06);
      box(g, w - 0.04, 0.12, d - 0.07, CREAM, 0, 1.0, 0, 0.04);
      box(g, w - 0.22, 0.06, 0.07, WOOD, 0, 0.09, d / 2 - 0.1);
      const ribs = Math.min(80, Math.max(4, Math.round(w * 6)));
      for (let i = 0; i < ribs; i++) box(g, 0.025, 0.7, 0.022, WOOD, -w / 2 + 0.22 + i * (w - 0.44) / (ribs - 1), 0.51, d / 2 - 0.095, 0.005);
      const screenX = -w * 0.225;
      box(g, 0.24, 0.035, 0.2, INK, screenX, 1.08, 0.02);
      box(g, 0.055, 0.18, 0.055, INK, screenX, 1.17, 0.02);
      const screen = box(g, 0.38, 0.29, 0.045, INK, screenX, 1.36, 0.02, 0.025);
      screen.rotation.x = -0.18;
      const glass = box(g, 0.32, 0.22, 0.008, '#adc7bd', screenX, 1.36, 0.049, 0.006);
      glass.rotation.x = -0.18;
      stockProduct(g, item.stock, w * 0.235, 1.065, 0.02, 2);
      break;
    }
    case 'rack': {
      for (const x of [-w / 2 + 0.18, w / 2 - 0.18]) {
        rod(g, new THREE.Vector3(x, 0.06, -d / 2 + 0.16), new THREE.Vector3(x, 0.06, d / 2 - 0.16), 0.045, INK);
        cylinder(g, 0.035, 0.035, 1.85, INK, x, 0.98, 0);
      }
      rod(g, new THREE.Vector3(-w / 2 + 0.14, 1.9, 0), new THREE.Vector3(w / 2 - 0.14, 1.9, 0), 0.035, INK);
      if (item.stock === 'fashion') {
        const count = Math.min(28, Math.max(1, Math.round((w - 0.8) / 0.4) + 1));
        for (let i = 0; i < count; i++) shirt(g, count === 1 ? 0 : -w / 2 + 0.4 + i * (w - 0.8) / (count - 1), 1.72, PRODUCT_COLORS[i % PRODUCT_COLORS.length]);
        box(g, w - 0.3, 0.065, d - 0.35, color, 0, 0.34, 0);
        stockRow(g, 'fashion', 0.38, Math.min(24, Math.max(1, Math.round(w * 1.5))), w - 0.85, 0, 1);
      } else {
        for (const y of [0.5, 1.17]) {
          box(g, w - 0.28, 0.07, d - 0.36, color, 0, y, 0);
          stockRow(g, item.stock, y + 0.04, Math.min(24, Math.max(1, Math.round(w * 2))), w - 0.65);
        }
      }
      break;
    }
    case 'plant': {
      const foliage = plant(g, 0, 0, 0, 1, color);
      const bounds = new THREE.Box3().setFromObject(foliage);
      foliage.scale.x = Math.min(1, 0.48 / Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)));
      foliage.scale.z = Math.min(1, 0.48 / Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)));
      break;
    }
    case 'rug': {
      box(g, w - 0.12, 0.035, d - 0.12, color, 0, 0.035, 0, 0.07);
      box(g, w - 0.39, 0.01, d - 0.39, CREAM, 0, 0.057, 0, 0.07);
      box(g, w - 0.56, 0.009, d - 0.56, color, 0, 0.065, 0, 0.055);
      const fringe = Math.min(100, Math.max(4, Math.round(w * 7)));
      for (let i = 0; i < fringe; i++) for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) box(g, 0.035, 0.014, 0.12, CREAM, -w / 2 + 0.15 + i * (w - 0.3) / (fringe - 1), 0.035, z, 0.007);
      break;
    }
    case 'lamp': {
      cylinder(g, 0.29, 0.3, 0.07, INK, 0, 0.045, 0, 24);
      cylinder(g, 0.025, 0.025, 1.67, '#b99665', 0, 0.87, 0, 12);
      const shade = cylinder(g, 0.22, 0.36, 0.39, color, 0, 1.77, 0, 24);
      shade.material.dispose();
      shade.material = material(color, { emissive: '#efd09d', emissiveIntensity: 0.14, side: THREE.DoubleSide });
      shade.material.userData.nightGlow = { color: '#efd09d', dayIntensity: 0.14, nightIntensity: 0.8 };
      const bulb = cylinder(g, 0.27, 0.27, 0.017, '#fff1c7', 0, 1.568, 0, 24);
      bulb.material.userData.nightGlow = { color: '#fff1c7', dayIntensity: 0, nightIntensity: 2 };
      const glow = new THREE.Object3D();
      glow.name = 'floor-lamp-light-anchor';
      glow.userData.nightLight = { color: '#ffd79b', dayIntensity: 0.5, nightIntensity: 5, distance: 2.8, kind: 'shop' };
      glow.position.set(0, 1.5, 0);
      g.add(glow);
      break;
    }
    case 'stool': {
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3;
        rod(g, new THREE.Vector3(Math.cos(a) * 0.29, 0.03, Math.sin(a) * 0.29), new THREE.Vector3(Math.cos(a) * 0.19, 0.48, Math.sin(a) * 0.19), 0.045, WOOD);
      }
      cylinder(g, 0.36, 0.36, 0.1, WOOD, 0, 0.49, 0, 24);
      cylinder(g, 0.35, 0.32, 0.1, color, 0, 0.58, 0, 24);
      break;
    }
    case 'chalkboard': {
      // The former fixed sidewalk easel, now an ordinary movable item.
      for (const x of [-0.24, 0.24]) for (const z of [-0.15, 0.19]) rod(g, new THREE.Vector3(x, 0.025, z), new THREE.Vector3(x, 0.79, 0), 0.027, color);
      box(g, 0.62, 0.66, 0.065, color, 0, 0.49, 0.05, 0.025);
      box(g, 0.55, 0.59, 0.024, INK, 0, 0.49, 0.089, 0.012);
      for (let row = 0; row < 3; row++) box(g, 0.31 - row * 0.045, 0.02, 0.008, CREAM, 0, 0.61 - row * 0.1, 0.107, 0.003);
      const heart = mesh(g, new THREE.SphereGeometry(0.048, 8, 6), '#d4a19a', 0, 0.28, 0.115);
      heart.scale.set(1.6, 0.8, 0.3);
      rod(g, new THREE.Vector3(-0.24, 0.23, -0.1), new THREE.Vector3(-0.24, 0.23, 0.14), 0.014, '#b79875');
      rod(g, new THREE.Vector3(0.24, 0.23, -0.1), new THREE.Vector3(0.24, 0.23, 0.14), 0.014, '#b79875');
      break;
    }
    case 'poster-stand': {
      box(g, 0.68, 0.065, 0.5, INK, 0, 0.0325, 0, 0.06);
      box(g, 0.055, 0.55, 0.07, color, 0, 0.31, -0.035, 0.012);
      box(g, 0.74, 1.03, 0.075, color, 0, 1.035, 0, 0.045);
      box(g, 0.65, 0.93, 0.014, CREAM, 0, 1.035, 0.044, 0.025);
      const sun = cylinder(g, 0.12, 0.12, 0.016, '#dda579', 0.13, 1.29, 0.063, 24);
      sun.rotation.x = Math.PI / 2;
      const arch = new THREE.Shape();
      arch.moveTo(-0.245, 0); arch.lineTo(-0.245, 0.27);
      arch.bezierCurveTo(-0.245, 0.56, 0.245, 0.56, 0.245, 0.27);
      arch.lineTo(0.245, 0); arch.closePath();
      mesh(g, new THREE.ShapeGeometry(arch, 14), '#9ead8e', 0, 0.67, 0.066);
      box(g, 0.43, 0.035, 0.015, color, 0, 0.622, 0.068, 0.01);
      box(g, 0.26, 0.022, 0.015, '#ac907c', 0, 0.582, 0.068, 0.008);
      break;
    }
    case 'direction-sign': {
      cylinder(g, 0.27, 0.3, 0.085, INK, 0, 0.0425, 0, 20);
      cylinder(g, 0.035, 0.035, 1.5, WOOD, 0, 0.805, 0, 12);
      const arrow = (y: number, direction: number, tone: string) => {
        const shape = new THREE.Shape();
        shape.moveTo(-0.4, -0.125); shape.lineTo(0.21, -0.125);
        shape.lineTo(0.21, -0.21); shape.lineTo(0.45, 0);
        shape.lineTo(0.21, 0.21); shape.lineTo(0.21, 0.125);
        shape.lineTo(-0.4, 0.125); shape.closePath();
        const board = mesh(g, new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 1, steps: 1 }), tone, 0, y, 0.035);
        board.scale.x = direction;
        box(g, 0.32, 0.026, 0.01, CREAM, -0.08 * direction, y + 0.04, 0.115, 0.006);
        box(g, 0.21, 0.022, 0.01, CREAM, -0.13 * direction, y - 0.034, 0.115, 0.006);
      };
      arrow(1.32, 1, color);
      arrow(0.9, -1, '#91a68e');
      const cap = mesh(g, new THREE.SphereGeometry(0.06, 12, 8), '#cbb18a', 0, 1.58, 0);
      cap.scale.y = 0.7;
      break;
    }
  }
  applyItemSize(g, item);
  return g;
}

export function textTexture(text: string, background: string, foreground: string, aspect = 4) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.max(128, Math.min(1024, Math.round(1024 / aspect)));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = foreground;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const content = text.trim() || 'Toko kecilku';
  let size = Math.round(canvas.height * 0.32);
  do { ctx.font = `700 ${size}px Georgia, serif`; size -= 2; } while (ctx.measureText(content).width > 930 && size > 24);
  ctx.fillText(content, 512, canvas.height * 0.54, 940);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function entranceCenterX(shop: ShopDocument): number {
  return getEntranceAnchor(shop).x;
}

/** The origin is the mounting center. Local +Z points into the shop. */
export function buildWallItem(item: WallItem, _shop?: ShopDocument): THREE.Group {
  const group = new THREE.Group();
  group.name = 'wall-item-content';
  const color = item.color;
  const size = getWallItemSize(item);
  const { width: w, height: h } = size;
  if (item.kind === 'window') {
    group.add(buildWindowGeometry(item));
  } else if (item.kind === 'wall-clock') {
    group.add(buildWallClock(w, h, color));
  } else if (item.kind === 'wall-lamp') {
    const style = getWallLampStyle(item);
    group.userData.wallLampStyle = style;
    let shade: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    if (style === 'lantern') {
      box(group, 0.12, 0.44, 0.045, color, 0, 0.015, 0.025, 0.018);
      rod(group, new THREE.Vector3(0, 0.25, 0.035), new THREE.Vector3(0, 0.25, 0.22), 0.022, color);
      const cap = mesh(group, new THREE.ConeGeometry(0.24, 0.15, 4).rotateY(Math.PI / 4), color, 0, 0.195, 0.18);
      cap.name = 'lantern-roof';
      shade = box(group, 0.255, 0.34, 0.2, '#f8dfad', 0, -0.05, 0.18, 0.015);
      shade.name = 'lantern-glass';
      shade.material.transparent = true; shade.material.opacity = 0.7; shade.material.depthWrite = false;
      for (const x of [-0.145, 0.145]) for (const z of [0.065, 0.295]) box(group, 0.024, 0.39, 0.024, color, x, -0.05, z, 0.004);
      box(group, 0.34, 0.055, 0.28, color, 0, -0.265, 0.18, 0.012);
      cylinder(group, 0.04, 0.04, 0.07, color, 0, 0.30, 0.18, 10);
    } else if (style === 'bulkhead') {
      const rim = mesh(group, new THREE.SphereGeometry(0.2, 24, 16), color, 0, 0, 0.055);
      rim.scale.set(1.1, 1.55, 0.34); rim.name = 'bulkhead-rim';
      shade = mesh(group, new THREE.SphereGeometry(0.18, 24, 16), '#fff0cb', 0, 0, 0.093);
      shade.scale.set(1, 1.52, 0.49); shade.name = 'bulkhead-glass';
      shade.material.transparent = true; shade.material.opacity = 0.82;
      for (const y of [-0.13, 0.13]) box(group, 0.34, 0.026, 0.028, color, 0, y, 0.17, 0.009);
      box(group, 0.025, 0.47, 0.025, color, 0, 0, 0.185, 0.008);
      for (const y of [-0.275, 0.275]) box(group, 0.08, 0.055, 0.08, color, 0, y, 0.055, 0.013);
    } else {
      box(group, 0.15, 0.42, 0.055, color, 0, -0.025, 0.035, 0.045);
      rod(group, new THREE.Vector3(0, -0.17, 0.05), new THREE.Vector3(0, -0.17, 0.23), 0.025, '#aa885d');
      rod(group, new THREE.Vector3(0, -0.17, 0.23), new THREE.Vector3(0, 0.12, 0.23), 0.025, '#aa885d');
      shade = cylinder(group, 0.12, 0.225, 0.27, color, 0, 0.175, 0.23, 24);
    }
    shade.material.emissive.set('#ffcc7d'); shade.material.emissiveIntensity = item.lit ? 0.5 : 0;
    shade.material.side = THREE.DoubleSide;
    const bulb = mesh(group, new THREE.SphereGeometry(style === 'bulkhead' ? 0.045 : 0.072, 12, 8), '#ffe6a4', 0, style === 'sconce' ? 0.028 : -0.02, style === 'bulkhead' ? 0.12 : style === 'lantern' ? 0.18 : 0.23,
      { emissive: '#ffda8c', emissiveIntensity: item.lit ? 1.4 : 0, roughness: 0.5 });
    bulb.castShadow = false;
    if (item.lit) {
      shade.material.userData.nightGlow = { color: '#ffcc7d', dayIntensity: 0.5, nightIntensity: 0.8 };
      bulb.material.userData.nightGlow = { color: '#ffda8c', dayIntensity: 1.4, nightIntensity: 2 };
      const anchor = new THREE.Object3D();
      anchor.name = 'wall-lamp-light-anchor';
      anchor.position.copy(bulb.position);
      anchor.userData.nightLight = { color: '#ffda8c', dayIntensity: 0, nightIntensity: 3, distance: 3.2, kind: 'shop' };
      group.add(anchor);
      const size = 32;
      const data = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const index = (y * size + x) * 4;
        const radius = Math.hypot((x + 0.5 - size / 2) / (size / 2), (y + 0.5 - size / 2) / (size / 2));
        data.set([255, 204, 116, Math.round(Math.max(0, 1 - radius) ** 2 * 155)], index);
      }
      const texture = new THREE.DataTexture(data, size, size);
      texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.7), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
      pool.name = 'wall-lamp-light-pool'; pool.position.set(0, 0, 0.017); pool.renderOrder = 1;
      pool.material.userData.nightOpacity = { day: 1, night: 1 };
      group.add(pool);
    }
  } else if (item.kind === 'wall-shelf') {
    box(group, w, h, 0.055, color, 0, 0, 0.028, 0.016);
    for (const x of [-w / 2 + 0.0375, w / 2 - 0.0375]) box(group, 0.075, h, 0.33, color, x, 0, 0.165, 0.012);
    const rows = Math.max(1, Math.floor((h - 0.13) / 0.35));
    const columns = Math.min(48, Math.max(1, Math.floor((w - 0.18) / 0.165)));
    const rowHeight = (h - 0.065) / rows;
    for (let row = 0; row <= rows; row++) box(group, w, 0.065, 0.34, color, 0, -h / 2 + 0.0325 + row * rowHeight, 0.17, 0.01);
    for (let row = 0; row < rows; row++) for (let index = 0; index < columns; index++) {
      const bookHeight = Math.min(0.34, rowHeight - 0.08) * (0.82 + ((index + row) % 3) * 0.08);
      const x = columns === 1 ? 0 : -w / 2 + 0.17 + index * (w - 0.34) / (columns - 1);
      const base = -h / 2 + 0.065 + row * rowHeight;
      box(group, 0.115, bookHeight, 0.19, PRODUCT_COLORS[(index + row * 2) % PRODUCT_COLORS.length], x, base + bookHeight / 2, 0.17, 0.006);
      box(group, 0.075, 0.012, 0.008, CREAM, x, base + bookHeight * 0.72, 0.27, 0.002);
    }
  } else if (item.kind === 'painting') {
    box(group, w, h, 0.075, color, 0, 0, 0.04, 0.022);
    box(group, w - 0.12, h - 0.12, 0.012, '#eee4cf', 0, 0, 0.084, 0.003);
    const art = new THREE.Group();
    art.scale.set((w - 0.12) / 0.78, (h - 0.12) / 0.98, 1); group.add(art);
    box(art, 0.65, 0.83, 0.008, '#d9d1bb', 0, 0, 0.094, 0.002);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(0.115, 32), new THREE.MeshBasicMaterial({ color: '#c79365' }));
    sun.position.set(0.14, 0.23, 0.102); art.add(sun);
    const arch = new THREE.Shape();
    arch.moveTo(-0.24, -0.415); arch.lineTo(-0.24, -0.02);
    arch.absarc(-0.015, -0.02, 0.225, Math.PI, 0, true); arch.lineTo(0.21, -0.415); arch.closePath();
    const landscape = new THREE.Mesh(new THREE.ShapeGeometry(arch), new THREE.MeshBasicMaterial({ color: '#889c84' }));
    landscape.position.z = 0.104; art.add(landscape);
    const hill = new THREE.Shape(); hill.moveTo(-0.325, -0.25); hill.quadraticCurveTo(0.03, -0.07, 0.325, -0.3); hill.lineTo(0.325, -0.415); hill.lineTo(-0.325, -0.415); hill.closePath();
    const foreground = new THREE.Mesh(new THREE.ShapeGeometry(hill), new THREE.MeshBasicMaterial({ color: '#ad8774' }));
    foreground.position.z = 0.107; art.add(foreground);
  } else if (item.kind === 'wall-sign' && getWallSignStyle(item) !== 'plaque') {
    group.add(buildWallSignVariant(item, textTexture));
  } else if (item.kind === 'wall-sign') {
    box(group, w, h, 0.09, WOOD, 0, 0, 0.046, 0.025);
    box(group, w - 0.1, h - 0.1, 0.012, color, 0, 0, 0.097, 0.014);
    const ink = new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }).l > 0.52 ? '#493f50' : '#fff1d7';
    const texture = textTexture(item.text || 'Toko kecilku', color, ink, (w - 0.16) / (h - 0.18));
    if (texture) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.16, h - 0.18), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
      sign.position.z = 0.105; group.add(sign);
    }
    for (const x of [-w / 2 + 0.055, w / 2 - 0.055]) for (const y of [-h / 2 + 0.05, h / 2 - 0.05]) {
      const pin = new THREE.Mesh(new THREE.CircleGeometry(0.014, 8), material('#b49a6b'));
      pin.position.set(x, y, 0.102); group.add(pin);
    }
  }
  // Keep the protruding depth within the catalog's mounting envelope. This
  // inner transform is authored geometry; the outer transform is live sizing.
  const front = new THREE.Box3().setFromObject(group).max.z;
  if (front > size.depth) group.scale.z = size.depth / front;
  const root = new THREE.Group();
  root.name = `wall-item:${item.id}`;
  root.userData.wallItemSizeBasis = item.kind === 'wall-lamp'
    ? { ...WALL_CATALOG.find(entry => entry.kind === item.kind)! } : { ...size };
  root.add(group);
  root.traverse(object => { object.userData.wallItemId = item.id; object.userData.interaction = 'wall-item'; });
  applyWallItemSize(root, item);
  return root;
}

type ContourRun = { line: number; start: number; end: number };

function contourRuns(shop: ShopDocument, side: 'north' | 'west' | 'south' | 'east'): ContourRun[] {
  const cells = getFloorCells(shop);
  const occupied = new Set(cells.map(cell => `${cell.x},${cell.z}`));
  const lines = new Map<number, number[]>();
  const horizontal = side === 'north' || side === 'south';
  const dx = side === 'west' ? -1 : side === 'east' ? 1 : 0;
  const dz = side === 'north' ? -1 : side === 'south' ? 1 : 0;
  for (const cell of cells) {
    if (occupied.has(`${cell.x + dx},${cell.z + dz}`)) continue;
    const line = horizontal ? cell.z + (side === 'south' ? 1 : 0) : cell.x + (side === 'east' ? 1 : 0);
    const positions = lines.get(line) ?? [];
    positions.push(horizontal ? cell.x : cell.z);
    lines.set(line, positions);
  }
  const runs: ContourRun[] = [];
  for (const [line, positions] of lines) {
    positions.sort((a, b) => a - b);
    let start = positions[0];
    let last = start;
    for (const position of positions.slice(1)) {
      if (position !== last + 1) { runs.push({ line, start, end: last + 1 }); start = position; }
      last = position;
    }
    runs.push({ line, start, end: last + 1 });
  }
  return runs.sort((a, b) => a.line - b.line || a.start - b.start);
}

/** Only occupied cells have a slab: concave outlines and holes stay visibly open. */
export function buildContourFloor(shop: ShopDocument, floor: THREE.Group, slabDepth = 0.39, openings: readonly FloorOpening[] = []) {
  const cells = getFloorCells(shop);
  const matrix = new THREE.Matrix4();
  const tileColor = new THREE.Color(shop.floorColor);
  const layers = [
    { name: 'floor-cell-slabs', geometry: new THREE.BoxGeometry(1, slabDepth - 0.09, 1), color: '#d3c4ba', y: -(slabDepth + 0.09) / 2, inset: 0 },
    { name: 'floor-cell-edges', geometry: new THREE.BoxGeometry(1, 0.09, 1), color: '#fff4dc', y: -0.055, inset: 0 },
    { name: 'floor-cell-tiles', geometry: new RoundedBoxGeometry(1, 0.055, 1, 1, 0.006), color: '#ffffff', y: -0.003, inset: 0.0075 },
  ];
  for (const layer of layers) {
    const pieces = cells.flatMap(cell => {
      const rectangle = { minX: cell.x - shop.width / 2 + layer.inset, maxX: cell.x + 1 - shop.width / 2 - layer.inset, minZ: cell.z - shop.depth / 2 + layer.inset, maxZ: cell.z + 1 - shop.depth / 2 - layer.inset };
      return subtractFloorOpenings(rectangle, openings).map(rectangle => ({ ...rectangle, tint: (cell.x + cell.z) % 2 ? 0.97 : 1.03 }));
    });
    const batch = new THREE.InstancedMesh(layer.geometry, material(layer.color), pieces.length);
    batch.name = layer.name;
    batch.castShadow = true;
    batch.receiveShadow = true;
    pieces.forEach((piece, index) => {
      matrix.makeScale(piece.maxX - piece.minX, 1, piece.maxZ - piece.minZ);
      matrix.setPosition((piece.minX + piece.maxX) / 2, layer.y, (piece.minZ + piece.maxZ) / 2);
      batch.setMatrixAt(index, matrix);
      if (layer.name === 'floor-cell-tiles') batch.setColorAt(index, tileColor.clone().multiplyScalar(piece.tint));
    });
    batch.instanceMatrix.needsUpdate = true;
    if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
    batch.computeBoundingSphere();
    floor.add(batch);
  }
  // Front and east are cut away; a low outline makes notches and holes legible.
  for (const side of ['south', 'east'] as const) for (const run of contourRuns(shop, side)) {
    const length = run.end - run.start;
    const horizontal = side === 'south';
    const x = (horizontal ? (run.start + run.end) / 2 : run.line) - shop.width / 2;
    const z = (horizontal ? run.line : (run.start + run.end) / 2) - shop.depth / 2;
    const width = horizontal ? length : 0.065, depth = horizontal ? 0.065 : length;
    for (const piece of subtractFloorOpenings({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 }, openings)) {
      box(floor, piece.maxX - piece.minX, 0.055, piece.maxZ - piece.minZ, CREAM, (piece.minX + piece.maxX) / 2, 0.032, (piece.minZ + piece.maxZ) / 2, 0.012);
    }
  }
}

type BoundaryWallGroups = Record<WallSide, THREE.Group>;

/** All four sides share their saved apertures; cutaway visibility is independent. */
function buildStructuralWalls(shop: ShopDocument, groups: BoundaryWallGroups, height: number, hasEntrance = true) {
  const windows = getWallItems(shop).filter(item => item.kind === 'window');
  const entrance = getEntranceAnchor(shop), entranceWall = getEntranceWall(shop);
  for (const run of getWallRuns(shop)) {
    const group = groups[run.wall];
    const horizontal = run.wall === 'back' || run.wall === 'front';
    const inward = run.wall === 'back' || run.wall === 'left' ? 1 : -1;
    const center = (run.start + run.end) / 2;
    const length = run.end - run.start;
    const x = (horizontal ? center : run.line) - shop.width / 2;
    const z = (horizontal ? run.line : center) - shop.depth / 2;
    const runWindows = windows.filter(item => item.wall === run.wall && item.line === run.line && item.offset >= run.start && item.offset < run.end);
    const openings = runWindows.map(item => {
      const size = getWallItemSize(item);
      return {
        start: item.offset - size.width / 2 + 0.08, end: item.offset + size.width / 2 - 0.08,
        bottom: item.height - size.height / 2 + 0.08, top: item.height + size.height / 2 - 0.08,
      };
    });
    const entranceAlong = horizontal ? entrance.x + shop.width / 2 : entrance.z + shop.depth / 2;
    const entrancePlane = horizontal ? entrance.z : entrance.x;
    const runPlane = horizontal ? z : x;
    if (hasEntrance && run.wall === entranceWall && Math.abs(entrancePlane - (runPlane - inward * 0.09)) < 0.001
      && entranceAlong >= run.start && entranceAlong <= run.end) {
      const relativeAngle = THREE.MathUtils.degToRad(getEntrance(shop).rotation ?? 0);
      const scale = Math.min(1, entrance.width / 1.84);
      const halfWidth = (1.52 * scale * Math.abs(Math.cos(relativeAngle)) + 0.24 * Math.abs(Math.sin(relativeAngle))) / 2;
      openings.push({ start: entranceAlong - halfWidth, end: entranceAlong + halfWidth, bottom: 0, top: 2.19 });
      group.userData.entranceOpening = { x: entrance.x, z: entrance.z, width: halfWidth * 2 };
    }
    for (const panel of wallPanels(run.start - 0.05, run.end + 0.05, height, openings)) {
      const span = panel.end - panel.start;
      const along = (panel.start + panel.end) / 2;
      const piece = box(group, horizontal ? span : 0.16, panel.top - panel.bottom, horizontal ? 0.16 : span,
        shop.wallColor, horizontal ? along - shop.width / 2 : x - inward * 0.07, (panel.bottom + panel.top) / 2,
        horizontal ? z - inward * 0.07 : along - shop.depth / 2, 0);
      piece.name = run.wall === 'front' || run.wall === 'right' ? 'exterior-wall-panel' : 'structural-wall-panel'; piece.userData.wallLine = run.line;
      piece.userData.wallPanel = { bottom: panel.bottom, top: panel.top, ceiling: panel.top === height };
    }
    for (const item of runWindows) {
      for (const spandrel of buildWindowSpandrels(item, shop.wallColor)) {
        const mount = wallItemPosition(shop, item);
        spandrel.rotation.y = mount.rotation;
        if (horizontal) {
          spandrel.position.x = item.offset - shop.width / 2;
          spandrel.position.z = run.line - shop.depth / 2 - inward * 0.15;
        } else {
          spandrel.position.x = run.line - shop.width / 2 - inward * 0.15;
          spandrel.position.z = item.offset - shop.depth / 2;
        }
        group.add(spandrel);
      }
    }
    for (const panel of wallPanels(run.start, run.end, 0.12, openings)) {
      const span = panel.end - panel.start, along = (panel.start + panel.end) / 2;
      box(group, horizontal ? span : 0.09, panel.top - panel.bottom, horizontal ? 0.08 : span, '#c6b3a2',
        horizontal ? along - shop.width / 2 : x + inward * 0.05, (panel.top + panel.bottom) / 2 + 0.025,
        horizontal ? z + inward * 0.05 : along - shop.depth / 2, 0.012).name = 'wall-plinth';
    }
    const coping = box(group, horizontal ? length + 0.12 : 0.23, 0.1, horizontal ? 0.23 : length + 0.12, CREAM,
      horizontal ? x : x - inward * 0.07, height + 0.04, horizontal ? z - inward * 0.07 : z, 0.02);
    coping.userData.wallCoping = true;
  }
  for (const [side, group] of Object.entries(groups)) group.traverse(object => { object.userData.wall = side; object.userData.interaction = 'wall'; });
}

/** Structural surfaces that can support a freestanding sign, excluding door/awning geometry. */
export function standingSignSupports(floor: THREE.Object3D, entrance?: THREE.Object3D) {
  return [floor, ...['entrance-step-surface', 'entrance-mat'].flatMap(name => {
    const object = entrance?.getObjectByName(name);
    return object ? [object] : [];
  })];
}

export function standingSignGroundY(floor: THREE.Object3D, entrance: THREE.Object3D | undefined, x: number, z: number, showCity: boolean) {
  const ground = showCity ? -0.08 : -0.401;
  const supports = standingSignSupports(floor, entrance);
  supports.forEach(object => object.updateWorldMatrix(true, true));
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObjects(supports, true)[0];
  return Math.max(ground, hit?.point.y ?? ground);
}

/** Keep interior and exterior entrances anchored to the same saved doorway. */
export function applyEntranceTransform(shop: ShopDocument, entrance: THREE.Object3D) {
  const anchor = getEntranceAnchor(shop);
  entrance.position.set(anchor.x, 0, anchor.z);
  entrance.rotation.y = -THREE.MathUtils.degToRad(getEntranceRotation(shop));
  entrance.scale.x = Math.min(1, anchor.width / 1.84);
  entrance.userData.centerX = anchor.x;
  entrance.userData.centerZ = anchor.z;
  const side = getEntranceWall(shop), horizontal = side === 'back' || side === 'front';
  const start = getEntranceAnchor({ ...shop, entrance: { ...getEntrance(shop), position: 0 } });
  const end = getEntranceAnchor({ ...shop, entrance: { ...getEntrance(shop), position: 1 } });
  entrance.userData.centerAxis = horizontal ? 'x' : 'z';
  entrance.userData.centerRange = [horizontal ? start.x : start.z, horizontal ? end.x : end.z];
}

/** One authored doorway, including its leaf, sign, landing, mat, and optional canopy. */
export function buildEntrance(shop: ShopDocument) {
  const entrance = new THREE.Group();
  entrance.name = 'shop-entrance';
  // Reuse the framed doorway in both the cutaway interior and the closed exterior.
  for (const x of [-0.84, 0.84]) box(entrance, 0.16, 2.3, 0.2, '#a88368', x, 1.15, 0, 0.02);
  box(entrance, 1.84, 0.15, 0.23, '#a88368', 0, 2.265, 0);
  box(entrance, 1.7, 0.085, 0.35, '#d8c2a1', 0, 0.035, 0.035);
  const doorPivot = new THREE.Group();
  doorPivot.name = 'entrance-door-pivot';
  doorPivot.position.set(-0.75, 0, 0.01);
  doorPivot.rotation.y = getEntrance(shop).open ? -Math.PI / 2 : 0;
  entrance.add(doorPivot);
  const doorWood = '#997893';
  for (const x of [0.045, 1.455]) box(doorPivot, 0.09, 2.2, 0.11, doorWood, x, 1.14, 0, 0.015);
  for (const y of [0.085, 0.65, 2.195]) box(doorPivot, 1.5, 0.09, 0.11, doorWood, 0.75, y, 0, 0.015);
  box(doorPivot, 1.33, 0.48, 0.075, '#ae93b1', 0.75, 0.366, 0, 0.022);
  box(doorPivot, 1.15, 0.31, 0.018, doorWood, 0.75, 0.366, 0.047, 0.025);
  const doorHit = box(doorPivot, 1.32, 1.45, 0.026, '#aacac8', 0.75, 1.42, 0, 0);
  doorHit.name = 'entrance-door-glass';
  doorHit.material.dispose();
  doorHit.material = material('#b9d8d1', { transparent: true, opacity: 0.36, depthWrite: false, roughness: 0.16, metalness: 0.1, side: THREE.DoubleSide });
  doorHit.castShadow = false;
  box(doorPivot, 1.35, 0.042, 0.046, doorWood, 0.75, 1.48, 0.018, 0.008);
  box(doorPivot, 0.13, 0.24, 0.028, '#dfc28b', 1.3, 1.08, 0.07, 0.018);
  rod(doorPivot, new THREE.Vector3(1.3, 1.015, 0.12), new THREE.Vector3(1.3, 1.145, 0.12), 0.027, '#967b50');
  for (const y of [0.37, 1.92]) cylinder(doorPivot, 0.037, 0.037, 0.12, '#a1855f', 0.008, y, 0, 10);
  // Small hanging welcome plaque moves with the door leaf.
  box(doorPivot, 0.47, 0.17, 0.023, CREAM, 0.75, 1.72, 0.052, 0.015);
  const welcome = textTexture('HELLO', '#f5ead6', '#75607e');
  if (welcome) {
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.14), new THREE.MeshStandardMaterial({ map: welcome, roughness: 0.9 }));
    plaque.position.set(0.75, 1.72, 0.067);
    doorPivot.add(plaque);
  }
  // The landing overlaps the floor edge behind the door and reaches below both
  // the city terrain and the bare scene ground. Keep its whole stack in the
  // entrance group so dragging or narrowing the doorway cannot detach the mat.
  // Turned landings can overlap the shop tiles. Keep their top just above the
  // tiles so the mat stays visible instead of sinking into the interior floor.
  const landingTop = getEntranceRotation(shop) === 0 ? -0.025 : 0.03;
  const landingThickness = 0.07;
  const landingBottom = landingTop - landingThickness;
  const foundationBottom = -0.41;
  const matThickness = 0.035;
  const matTop = landingTop + matThickness;
  box(entrance, 1.84, landingBottom - foundationBottom, 1.26, '#d3c4ba', 0, (landingBottom + foundationBottom) / 2, 0.41, 0.015).name = 'entrance-step-base';
  box(entrance, 1.88, landingThickness, 1.26, CREAM, 0, landingTop - landingThickness / 2, 0.41, 0.015).name = 'entrance-step-surface';
  box(entrance, 1.52, matThickness, 0.65, '#ac9478', 0, landingTop + matThickness / 2, 0.63, 0.015).name = 'entrance-mat';
  for (let i = 0; i < 12; i++) box(entrance, 0.024, 0.01, 0.53, '#cbb48f', -0.65 + i * 0.118, matTop + 0.005, 0.63, 0.003);
  box(entrance, 2.06, 0.32, 0.13, '#8f749b', 0, 2.47, 0.015, 0.035);
  const entranceSign = textTexture(shop.name, '#8f749b', '#fff1d7');
  if (entranceSign) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.91, 0.24), new THREE.MeshStandardMaterial({ map: entranceSign, roughness: 0.9 }));
    sign.position.set(0, 2.47, 0.085);
    entrance.add(sign);
  }
  if (getExterior(shop).awning) {
    const canopy = new THREE.Group();
    canopy.name = 'entrance-canopy';
    canopy.position.set(0, 2.7, 0.35);
    canopy.rotation.x = 0.17;
    for (let i = 0; i < 12; i++) {
      const color = i % 2 ? '#f8ebd3' : '#a18aaa';
      box(canopy, 0.197, 0.055, 1.08, color, -1.0835 + i * 0.197, 0, 0, 0.008);
      box(canopy, 0.197, 0.19, 0.055, color, -1.0835 + i * 0.197, -0.1, 0.54, 0.035);
    }
    entrance.add(canopy);
  }

  entrance.traverse(object => { object.userData.door = true; object.userData.interaction = 'door'; });
  applyEntranceTransform(shop, entrance);
  return { entrance, doorPivot, doorHit };
}

export function buildRoom(shop: ShopDocument, options: { slabDepth?: number; floorOpenings?: readonly FloorOpening[]; enclosed?: boolean; hasEntrance?: boolean } = {}) {
  const group = new THREE.Group();
  group.name = 'shop-room';
  const walls = new THREE.Group();
  const floor = new THREE.Group();
  const backWall = new THREE.Group();
  const leftWall = new THREE.Group();
  const frontWall = new THREE.Group();
  const rightWall = new THREE.Group();
  const boundaryWalls: BoundaryWallGroups = { back: backWall, left: leftWall, front: frontWall, right: rightWall };
  const partitions = buildInteriorPartitions(shop);
  floor.name = 'room-floor';
  backWall.name = 'room-back-wall';
  leftWall.name = 'room-left-wall';
  frontWall.name = 'room-front-wall'; rightWall.name = 'room-right-wall';
  frontWall.visible = rightWall.visible = options.enclosed ?? false;
  group.add(floor, walls);
  walls.add(backWall, leftWall, frontWall, rightWall, partitions);
  const w = shop.width;
  const d = shop.depth;
  const h = getWallHeight(shop);
  const customFloor = shop.floorCells !== undefined;

  if (getFloorCells(shop).length === 0) {
    const entrance = new THREE.Group();
    entrance.name = 'shop-entrance';
    walls.add(entrance);
    // Keep stable renderer references without allocating a floor or doorway.
    // The inert hit mesh owns no vertices and is never a picking target.
    const doorPivot = new THREE.Group();
    const doorHit = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    doorHit.raycast = () => undefined;
    doorHit.visible = false;
    doorPivot.add(doorHit);
    entrance.add(doorPivot);
    entrance.visible = false;
    const previewDimensions = (_width: number, _depth: number, _height: number, _entrancePosition?: number) => undefined;
    const previewWallItems = (_items: WallItem[]) => undefined;
    return { group, walls, floor, backWall, leftWall, frontWall, rightWall, partitions, entrance, doorPivot, doorHit, previewDimensions, previewWallItems, hasFloor: false };
  }

  if (customFloor || options.slabDepth !== undefined || options.floorOpenings?.length) {
    // Stacked floors use their exact footprint and a shallower support slab;
    // the broad ground-level foundation would cover the lower entrance canopy.
    buildContourFloor(shop, floor, options.slabDepth, options.floorOpenings);
  } else {
  box(floor, w + 0.72, 0.3, d + 1.1, '#d3c4ba', 0, -0.24, 0.16, 0.14);
  box(floor, w + 0.48, 0.09, d + 0.5, '#fff4dc', 0, -0.055, 0, 0.055);
  const floorColor = new THREE.Color(shop.floorColor);
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
    const color = floorColor.clone().multiplyScalar((x + z) % 2 ? 0.97 : 1.03);
    box(floor, 0.985, 0.055, 0.985, `#${color.getHexString()}`, x - w / 2 + 0.5, -0.003, z - d / 2 + 0.5, 0.006);
  }
  }
  buildStructuralWalls(shop, boundaryWalls, h, options.hasEntrance ?? true);

  const { entrance, doorPivot, doorHit } = buildEntrance(shop);
  if (options.hasEntrance === false) {
    entrance.visible = false;
    entrance.traverse(object => { object.raycast = () => undefined; });
  }
  walls.add(entrance);
  floor.userData.interaction = 'floor';

  let previewHeight = h;
  const previewWallHeight = (height: number) => {
    previewHeight = height;
    // Openings remain at absolute mounting heights. Stretch only the solid
    // strips that reach the ceiling, without rebuilding geometry during a drag.
    for (const wall of Object.values(boundaryWalls)) for (const object of wall.children) {
      if (object.userData.wallCoping) object.position.y = height + 0.04;
      const panel = object.userData.wallPanel;
      if (!panel) continue;
      const top = panel.ceiling ? height : Math.min(panel.top, height);
      object.visible = top > panel.bottom;
      object.scale.y = Math.max(0, top - panel.bottom) / (panel.top - panel.bottom);
      object.position.y = (panel.bottom + top) / 2;
    }
    partitions.traverse(object => {
      if (object.userData.partitionCoping) object.position.y = height + 0.015;
      const panel = object.userData.wallPanel;
      if (!panel) return;
      const top = panel.ceiling ? height : Math.min(panel.top, height);
      object.visible = top > panel.bottom;
      object.scale.y = Math.max(0, top - panel.bottom) / (panel.top - panel.bottom);
      object.position.y = (panel.bottom + top) / 2;
    });
  };

  let previewShop = shop;
  let previewItems = getWallItems(shop);
  const rebuildBoundaryWalls = () => {
    // Preserve the groups referenced by the renderer, their transforms, and every
    // floor/entrance resource. Only structural wall geometry needs new openings.
    const previous = new THREE.Group();
    previous.add(...Object.values(boundaryWalls).flatMap(wall => wall.children));
    disposeGroup(previous);
    buildStructuralWalls({ ...previewShop, wallItems: previewItems }, boundaryWalls, h, options.hasEntrance ?? true);
    previewWallHeight(previewHeight);
  };
  const previewWallItems = (items: WallItem[]) => {
    previewItems = items;
    rebuildBoundaryWalls();
  };

  let previewFloorWidth = w, previewFloorDepth = d;
  const previewDimensions = (width: number, depth: number, height: number, entrancePosition = getEntrance(shop).position) => {
    const fixedOpenings = Boolean(options.floorOpenings?.length);
    // The stairs belong to the floor below: resizing this room must not stretch
    // their opening or move it away from the flight's shared world coordinates.
    if (fixedOpenings && !customFloor && (width !== previewFloorWidth || depth !== previewFloorDepth)) {
      const previous = new THREE.Group(); previous.add(...floor.children); disposeGroup(previous);
      buildContourFloor({ ...shop, width, depth }, floor, options.slabDepth, options.floorOpenings);
      previewFloorWidth = width; previewFloorDepth = depth;
    }
    floor.scale.set(customFloor || fixedOpenings ? 1 : width / w, 1, customFloor || fixedOpenings ? 1 : depth / d);
    const nextShop = { ...shop, width: customFloor ? w : width, depth: customFloor ? d : depth, entrance: { ...getEntrance(shop), position: entrancePosition } };
    if (nextShop.width !== previewShop.width || nextShop.depth !== previewShop.depth || entrancePosition !== getEntrance(previewShop).position) {
      previewShop = nextShop;
      rebuildBoundaryWalls();
      partitions.position.set((w - nextShop.width) / 2, 0, (d - nextShop.depth) / 2);
    }
    previewWallHeight(height);
    applyEntranceTransform(previewShop, entrance);
  };
  previewDimensions(w, d, h);
  return { group, walls, floor, backWall, leftWall, frontWall, rightWall, partitions, entrance, doorPivot, doorHit, previewDimensions, previewWallItems, hasFloor: true };
}
