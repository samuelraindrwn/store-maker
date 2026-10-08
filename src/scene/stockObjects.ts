import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { ProductKind } from '../model';

const COLORS = ['#dc9d87', '#98ab87', '#bdacd5', '#e1bc76', '#7da2a1', '#eadac0'];
const CREAM = '#fff0d7';
const INK = '#514655';
const NEW_STOCKS: readonly ProductKind[] = ['shoes', 'bags', 'skincare', 'toys', 'bread', 'pastries', 'drinks', 'fruit', 'meals', 'snacks'];

function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.72 }));
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, radius = 0.015) {
  return mesh(parent, new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, w / 3, h / 3, d / 3)), color, x, y, z);
}

function sphere(parent: THREE.Object3D, color: string, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) {
  const object = mesh(parent, new THREE.SphereGeometry(1, 10, 8), color, x, y, z);
  object.scale.set(sx, sy, sz);
  return object;
}

function cylinder(parent: THREE.Object3D, rt: number, rb: number, h: number, color: string, x = 0, y = 0, z = 0) {
  return mesh(parent, new THREE.CylinderGeometry(rt, rb, h, 12), color, x, y, z);
}

function ring(parent: THREE.Object3D, r: number, tube: number, color: string, x: number, y: number, z: number) {
  return mesh(parent, new THREE.TorusGeometry(r, tube, 6, 16), color, x, y, z);
}

function plate(parent: THREE.Object3D, color = CREAM) {
  cylinder(parent, 0.165, 0.145, 0.022, color, 0, 0.011, 0);
  const rim = ring(parent, 0.15, 0.008, color, 0, 0.024, 0);
  rim.rotation.x = Math.PI / 2;
}

function label(parent: THREE.Object3D, color: string, y: number, z: number, width = 0.08, height = 0.07, x = 0) {
  box(parent, width, height, 0.006, color, x, y, z, 0.003);
}

/** Products share a compact footprint, so they fit every resizable shelf and tray. */
export function buildStockProduct(parent: THREE.Object3D, kind: ProductKind, x: number, y: number, z: number, seed: number): boolean {
  if (!NEW_STOCKS.includes(kind)) return false;
  const index = Math.abs(Math.trunc(seed));
  const color = COLORS[index % COLORS.length];
  const group = new THREE.Group();
  group.name = `stock:${kind}`;
  group.position.set(x, y, z);
  parent.add(group);

  switch (kind) {
    case 'shoes':
      for (const px of [-0.083, 0.083]) {
        box(group, 0.136, 0.028, 0.29, CREAM, px, 0.016, 0, 0.025);
        box(group, 0.124, 0.069, 0.25, color, px, 0.058, -0.008, 0.033);
        box(group, 0.11, 0.055, 0.1, color, px, 0.102, -0.08, 0.02);
        box(group, 0.061, 0.012, 0.055, INK, px, 0.133, -0.076, 0.01);
        for (let lace = 0; lace < 3; lace++) box(group, 0.076, 0.008, 0.008, CREAM, px, 0.096, -0.016 + lace * 0.021, 0.002);
      }
      break;
    case 'bags': {
      box(group, 0.265, 0.24, 0.13, color, 0, 0.125, 0, 0.025);
      const handle = ring(group, 0.064, 0.011, '#9b775b', 0, 0.27, 0);
      handle.scale.y = 1.1;
      label(group, '#d4b094', 0.101, 0.068, 0.155, 0.09);
      label(group, CREAM, 0.188, 0.07, 0.032, 0.024);
      break;
    }
    case 'skincare':
      for (let bottle = 0; bottle < 3; bottle++) {
        const px = (bottle - 1) * 0.105;
        const h = 0.2 + bottle * 0.04;
        cylinder(group, 0.038, 0.04, h, bottle === 1 ? CREAM : COLORS[(index + bottle) % COLORS.length], px, h / 2, 0);
        cylinder(group, 0.026, 0.026, 0.026, '#ba9d73', px, h + 0.013, 0);
        label(group, CREAM, h * 0.48, 0.04, 0.055, 0.08, px);
        label(group, color, h * 0.49, 0.044, 0.034, 0.011, px);
        if (bottle === 2) box(group, 0.058, 0.015, 0.026, CREAM, px + 0.01, h + 0.043, 0, 0.004);
      }
      break;
    case 'toys':
      if (index % 2 === 0) {
        sphere(group, color, 0, 0.135, 0, 0.085, 0.1, 0.067);
        sphere(group, color, 0, 0.268, 0, 0.085);
        for (const side of [-1, 1]) {
          sphere(group, color, side * 0.068, 0.333, 0, 0.033);
          sphere(group, color, side * 0.1, 0.162, 0, 0.035, 0.052, 0.038);
          sphere(group, color, side * 0.047, 0.035, 0.022, 0.047, 0.035, 0.057);
          sphere(group, INK, side * 0.029, 0.282, 0.076, 0.007);
        }
        sphere(group, CREAM, 0, 0.247, 0.07, 0.041, 0.028, 0.023);
        sphere(group, INK, 0, 0.259, 0.092, 0.009);
      } else {
        box(group, 0.18, 0.155, 0.13, color, 0, 0.153, 0);
        box(group, 0.21, 0.115, 0.14, CREAM, 0, 0.299, 0);
        for (const side of [-1, 1]) {
          box(group, 0.055, 0.12, 0.065, color, side * 0.127, 0.157, 0);
          box(group, 0.065, 0.08, 0.125, INK, side * 0.052, 0.04, 0.016);
          label(group, INK, 0.314, 0.074, 0.028, 0.028, side * 0.047);
        }
        label(group, '#dcb273', 0.16, 0.069, 0.1, 0.05);
        cylinder(group, 0.009, 0.009, 0.033, '#b49378', 0, 0.372, 0);
        sphere(group, color, 0, 0.394, 0, 0.018);
      }
      break;
    case 'bread':
      if (index % 3 === 0) {
        box(group, 0.29, 0.135, 0.19, '#bf824b', 0, 0.068, 0, 0.05);
        for (let cut = 0; cut < 3; cut++) box(group, 0.018, 0.008, 0.115, '#edc78e', (cut - 1) * 0.068, 0.138, 0, 0.003).rotation.y = -0.22;
      } else if (index % 3 === 1) {
        for (const px of [-0.079, 0.079]) {
          sphere(group, '#dda35f', px, 0.069, 0, 0.075, 0.066, 0.095);
          box(group, 0.014, 0.006, 0.095, '#f3d9a4', px, 0.137, 0, 0.002).rotation.y = 0.4;
        }
      } else {
        const loaf = sphere(group, '#d49a58', 0, 0.065, 0, 0.14, 0.059, 0.064);
        loaf.rotation.y = 0.35;
        for (let cut = 0; cut < 4; cut++) box(group, 0.01, 0.006, 0.057, '#f0ce98', -0.082 + cut * 0.052, 0.12, 0, 0.002).rotation.y = 0.3;
      }
      break;
    case 'pastries':
      plate(group);
      if (index % 3 === 0) {
        const dough = ring(group, 0.078, 0.042, '#cc975c', 0, 0.072, 0);
        dough.rotation.x = Math.PI / 2;
        const icing = ring(group, 0.077, 0.03, '#dda0b3', 0, 0.101, 0);
        icing.rotation.x = Math.PI / 2;
        for (let sprinkle = 0; sprinkle < 7; sprinkle++) {
          const angle = sprinkle * 0.89;
          box(group, 0.021, 0.006, 0.008, COLORS[sprinkle % COLORS.length], Math.cos(angle) * 0.079, 0.132, Math.sin(angle) * 0.079, 0.002).rotation.y = angle;
        }
      } else if (index % 3 === 1) {
        cylinder(group, 0.094, 0.071, 0.112, color, 0, 0.082, 0);
        sphere(group, CREAM, 0, 0.153, 0, 0.097, 0.065, 0.097);
        sphere(group, CREAM, 0, 0.213, 0, 0.046, 0.04, 0.046);
        sphere(group, '#b96869', 0, 0.253, 0, 0.019);
      } else {
        box(group, 0.19, 0.13, 0.17, '#d1a575', 0, 0.098, 0);
        box(group, 0.192, 0.022, 0.172, '#f5e2c3', 0, 0.09, 0, 0.005);
        box(group, 0.2, 0.038, 0.18, '#8b6656', 0, 0.18, 0);
        sphere(group, '#b96869', 0.033, 0.218, 0, 0.022);
      }
      break;
    case 'drinks':
      if (index % 3 === 0) {
        cylinder(group, 0.07, 0.07, 0.24, color, 0, 0.12, 0);
        cylinder(group, 0.066, 0.066, 0.01, '#dddeda', 0, 0.245, 0);
        label(group, CREAM, 0.127, 0.071, 0.093, 0.11);
        label(group, color, 0.134, 0.075, 0.057, 0.017);
        box(group, 0.025, 0.006, 0.05, INK, 0, 0.254, 0, 0.005);
      } else if (index % 3 === 1) {
        cylinder(group, 0.036, 0.065, 0.275, '#8aaf90', 0, 0.138, 0);
        cylinder(group, 0.028, 0.031, 0.065, '#8aaf90', 0, 0.303, 0);
        cylinder(group, 0.033, 0.033, 0.025, color, 0, 0.348, 0);
        label(group, CREAM, 0.15, 0.061, 0.081, 0.106);
        label(group, color, 0.156, 0.065, 0.05, 0.022);
      } else {
        cylinder(group, 0.08, 0.058, 0.213, CREAM, 0, 0.107, 0);
        cylinder(group, 0.066, 0.061, 0.06, color, 0, 0.111, 0);
        cylinder(group, 0.083, 0.083, 0.022, INK, 0, 0.225, 0);
        cylinder(group, 0.01, 0.01, 0.104, '#d6aa81', 0.029, 0.275, 0);
      }
      break;
    case 'fruit':
      cylinder(group, 0.163, 0.108, 0.072, '#c5a477', 0, 0.036, 0);
      for (let fruit = 0; fruit < 5; fruit++) {
        const angle = fruit * Math.PI * 0.5;
        const px = fruit === 4 ? 0 : Math.cos(angle) * 0.074;
        const pz = fruit === 4 ? 0 : Math.sin(angle) * 0.074;
        const py = fruit === 4 ? 0.149 : 0.099;
        sphere(group, (index + fruit) % 2 ? '#d99752' : '#b97368', px, py, pz, 0.046);
        cylinder(group, 0.005, 0.005, 0.018, '#7b6749', px, py + 0.052, pz);
        sphere(group, '#879b68', px + 0.018, py + 0.052, pz, 0.019, 0.005, 0.01);
      }
      break;
    case 'meals':
      plate(group);
      if (index % 2 === 0) {
        sphere(group, CREAM, -0.035, 0.071, 0, 0.084, 0.052, 0.084);
        box(group, 0.09, 0.033, 0.125, '#bd7d51', 0.078, 0.051, 0.022);
        for (let veg = 0; veg < 3; veg++) sphere(group, '#86a266', 0.028 + veg * 0.034, 0.053, -0.081, 0.029, 0.024, 0.022);
      } else {
        cylinder(group, 0.104, 0.098, 0.035, '#c99456', 0, 0.049, 0);
        cylinder(group, 0.107, 0.107, 0.024, '#795642', 0, 0.079, 0);
        box(group, 0.17, 0.01, 0.17, '#e7bb58', 0, 0.096, 0, 0.008).rotation.y = 0.25;
        cylinder(group, 0.107, 0.103, 0.017, '#91a267', 0, 0.112, 0);
        sphere(group, '#daa15c', 0, 0.148, 0, 0.106, 0.042, 0.106);
        for (let sesame = 0; sesame < 4; sesame++) box(group, 0.017, 0.005, 0.006, CREAM, (sesame % 2 ? -1 : 1) * 0.033, 0.189, sesame < 2 ? 0.022 : -0.022, 0.002);
      }
      break;
    case 'snacks':
      if (index % 2 === 0) {
        box(group, 0.195, 0.277, 0.092, color, 0, 0.139, 0, 0.025);
        for (const py of [0.015, 0.27]) box(group, 0.215, 0.02, 0.05, color, 0, py, 0, 0.004);
        label(group, CREAM, 0.156, 0.049, 0.134, 0.13);
        const emblem = cylinder(group, 0.035, 0.035, 0.005, '#d4a25e', 0, 0.155, 0.055);
        emblem.rotation.x = Math.PI / 2;
      } else {
        cylinder(group, 0.084, 0.081, 0.225, '#bf986e', 0, 0.113, 0);
        cylinder(group, 0.088, 0.088, 0.035, color, 0, 0.244, 0);
        label(group, CREAM, 0.122, 0.085, 0.115, 0.104);
        label(group, color, 0.124, 0.089, 0.07, 0.021);
      }
      break;
  }
  return true;
}
