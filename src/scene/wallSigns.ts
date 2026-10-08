import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getWallItemSize, getWallSignStyle, type WallItem } from '../model';

type MakeTexture = (text: string, background: string, foreground: string, aspect?: number) => THREE.Texture | null;

/** Store fascia and two-sided blade signs, with all resources owned by this group. */
export function buildWallSignVariant(item: WallItem, makeTexture: MakeTexture) {
  const group = new THREE.Group(), style = getWallSignStyle(item);
  const { width: w, height: h, depth } = getWallItemSize(item);
  group.name = `wall-sign-style:${style}`;
  const block = (name: string, width: number, height: number, d: number, color: string, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, d, 2, Math.min(0.016, width / 4, height / 4, d / 4)), new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.12 }));
    mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const face = (width: number, height: number, x: number, y: number, z: number, rotation = 0) => {
    const texture = makeTexture(item.text || 'Toko kecilku', '#fff4dd', item.color, width / height);
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', map: texture, roughness: 0.42,
      emissive: '#fff0cf', emissiveMap: texture, emissiveIntensity: item.lit ? 0.18 : 0 });
    if (item.lit) material.userData.nightGlow = { color: '#fff0cf', dayIntensity: 0.18, nightIntensity: 1.25 };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.name = 'store-sign-face'; mesh.position.set(x, y, z); mesh.rotation.y = rotation; group.add(mesh);
  };
  if (style === 'projecting') {
    const boardHeight = h * 0.76, boardDepth = depth - 0.16, center = (depth + 0.08) / 2;
    block('sign-wall-bracket', Math.min(w, 0.13), h * 0.85, 0.065, item.color, 0, 0, 0.04);
    block('sign-projecting-arm', 0.042, 0.044, depth - 0.03, item.color, 0, h / 2 - 0.025, depth / 2);
    block('sign-projecting-board', 0.10, boardHeight, boardDepth, item.color, 0, -h * 0.08, center);
    for (const z of [center - boardDepth * 0.31, center + boardDepth * 0.31]) block('sign-hanging-link', 0.028, h * 0.16, 0.028, '#615c66', 0, h * 0.36, z);
    face(boardDepth - 0.035, boardHeight - 0.055, 0.051, -h * 0.08, center, Math.PI / 2);
    face(boardDepth - 0.035, boardHeight - 0.055, -0.051, -h * 0.08, center, -Math.PI / 2);
  } else {
    block('store-sign-casing', w, h, 0.14, item.color, 0, 0, 0.075);
    block('store-sign-raised-face', w - 0.09, h - 0.09, 0.018, '#fff4dd', 0, 0, 0.146);
    face(w - 0.12, h - 0.12, 0, 0, 0.156);
    for (const x of [-w / 2 + 0.027, w / 2 - 0.027]) block('store-sign-end-cap', 0.022, h - 0.03, 0.015, '#ddc39a', x, 0, 0.15);
  }
  if (item.lit) {
    const anchor = new THREE.Object3D(); anchor.name = 'wall-sign-light-anchor';
    anchor.position.set(0, -h * 0.1, style === 'projecting' ? depth * 0.55 : depth);
    anchor.userData.nightLight = { color: '#fff0cf', dayIntensity: 0, nightIntensity: 1.8, distance: 3.2, kind: 'shop' };
    group.add(anchor);
  }
  return group;
}
