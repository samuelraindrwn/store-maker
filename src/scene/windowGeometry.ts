import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getWallItemSize, getWindowStyle, type WallItem } from '../model';

const INSET = 0.08;
const WOOD = '#c69972';
/** From the inward mounting origin, past the structural wall's outer face. */
export const EXTERIOR_WINDOW_DEPTH = 0.2;

function material(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, ...extra });
}

function block(parent: THREE.Group, name: string, w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0.035, radius = 0.012) {
  const geometry = radius > 0
    ? new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3))
    : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function glass(parent: THREE.Group, geometry: THREE.BufferGeometry, x = 0, z = 0.022) {
  const mesh = new THREE.Mesh(geometry, material('#bfdcd7', {
    transparent: true, opacity: 0.25, depthWrite: false, roughness: 0.17, metalness: 0.05, side: THREE.DoubleSide,
  }));
  mesh.name = 'wall-window-glass'; mesh.position.set(x, 0, z); mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function rectangleFrame(parent: THREE.Group, w: number, h: number, color: string, thickness = 0.09, depth = 0.14, z = 0.035, name = 'window-frame') {
  for (const x of [-w / 2 + thickness / 2, w / 2 - thickness / 2]) block(parent, name, thickness, h, depth, color, x, 0, z);
  for (const y of [-h / 2 + thickness / 2, h / 2 - thickness / 2]) block(parent, name, w, thickness, depth, color, 0, y, z);
}

/** A shared affine crown keeps the frame, glass, and structural opening aligned. */
export function windowArchProfile(width: number, height: number, inset = 0) {
  const halfWidth = width / 2 - inset;
  const top = height / 2 - inset, bottom = -height / 2 + inset;
  const rise = (top - bottom) * 0.48;
  return { halfWidth, top, bottom, rise, spring: top - rise };
}

function archShape(width: number, height: number, inset = 0) {
  const p = windowArchProfile(width, height, inset);
  const shape = new THREE.Shape();
  shape.moveTo(-p.halfWidth, p.bottom); shape.lineTo(p.halfWidth, p.bottom); shape.lineTo(p.halfWidth, p.spring);
  shape.absellipse(0, p.spring, p.halfWidth, p.rise, 0, Math.PI, false, 0);
  shape.closePath();
  return shape;
}

/** Carry the original trim through the wall; keep its one set of glass panes. */
function extendFrameToExterior(group: THREE.Group, inwardDepth: number) {
  const forward = new THREE.Box3().setFromObject(group).max.z;
  // buildWallItem normalizes the inward projection to the catalog depth. Keep
  // the outer casing at its physical mounting depth after that same transform.
  const depthScale = Math.min(1, inwardDepth / forward);
  group.updateMatrixWorld(true);
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.name === 'wall-window-glass' || object.name.endsWith('-handle')) return;
    const geometry = object.geometry;
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!, previousMin = bounds.min.z, previousMax = bounds.max.z;
    if (previousMax <= previousMin) return;
    const back = -EXTERIOR_WINDOW_DEPTH / depthScale - object.matrixWorld.elements[14];
    const positions = geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) {
      const progress = (positions.getZ(index) - previousMin) / (previousMax - previousMin);
      positions.setZ(index, THREE.MathUtils.lerp(back, previousMax, progress));
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    object.userData.exteriorWindowTrim = true;
  });
}

/** One window spans both wall faces; +Z points into the room. */
export function buildWindowGeometry(item: WallItem): THREE.Group {
  const group = new THREE.Group();
  const style = getWindowStyle(item);
  const { width: w, height: h, depth } = getWallItemSize(item);
  const color = item.color;
  group.name = `window-style:${style}`;
  group.userData.windowStyle = style;

  if (style === 'arched') {
    const outline = archShape(w, h);
    outline.holes.push(archShape(w, h, INSET));
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.14, bevelEnabled: false, curveSegments: 48 }), material(color));
    frame.name = 'window-arched-frame'; frame.position.z = -0.035; frame.castShadow = frame.receiveShadow = true;
    group.add(frame);
    glass(group, new THREE.ShapeGeometry(archShape(w, h, INSET), 48));
    const p = windowArchProfile(w, h, INSET);
    block(group, 'window-arch-mullion', 0.045, h - 0.16, 0.075, color, 0, 0, 0.065);
    block(group, 'window-arch-spring-bar', w - 0.16, 0.04, 0.075, color, 0, p.spring, 0.065);
    block(group, 'window-sill', w, 0.065, 0.3, WOOD, 0, -h / 2 + 0.0325, 0.11);
  } else if (style === 'sliding') {
    rectangleFrame(group, w, h, color, 0.07);
    const innerWidth = w - 0.16;
    const panelWidth = innerWidth / 2 + 0.035;
    const panelHeight = h - 0.14;
    for (const side of [-1, 1]) {
      const panel = new THREE.Group();
      panel.name = side < 0 ? 'window-sliding-rear-panel' : 'window-sliding-front-panel';
      panel.position.set(side * (innerWidth / 4 - 0.0175), 0, side < 0 ? 0.025 : 0.075);
      rectangleFrame(panel, panelWidth, panelHeight, color, 0.035, 0.05, 0, 'window-sliding-sash');
      glass(panel, new THREE.BoxGeometry(panelWidth - 0.07, panelHeight - 0.07, 0.01), 0, 0.01);
      group.add(panel);
    }
    for (const y of [-h / 2 + 0.055, h / 2 - 0.055]) block(group, 'window-sliding-rail', w - 0.08, 0.018, 0.12, '#776f6c', 0, y, 0.045, 0.003);
    for (const x of [-1, 1]) block(group, 'window-sliding-handle', 0.026, Math.min(0.2, h * 0.3), 0.045, '#9c805e', x * Math.min(0.09, innerWidth * 0.18), 0, 0.13, 0.007);
  } else {
    glass(group, new THREE.BoxGeometry(w - 0.16, h - 0.16, 0.014));
    rectangleFrame(group, w, h, color, style === 'picture' ? 0.075 : 0.09);
    if (style === 'classic') {
      const panes = Math.max(2, Math.ceil(w / 1.4));
      for (let i = 1; i < panes; i++) block(group, 'window-classic-mullion', 0.055, h - 0.15, 0.09, color, -w / 2 + i * w / panes, 0, 0.07, 0.007);
      block(group, 'window-classic-crossbar', w - 0.12, 0.045, 0.09, color, 0, -h * 0.0857, 0.07, 0.007);
      block(group, 'window-classic-handle', 0.035, Math.min(0.13, h * 0.25), 0.055, '#ac8b5e', Math.min(0.08, w * 0.15), -0.01, 0.13, 0.007);
    } else if (style === 'grid') {
      const columns = Math.max(3, Math.ceil(w / 0.65)), rows = Math.max(2, Math.ceil(h / 0.55));
      const bar = Math.min(0.035, Math.min(w, h) * 0.08);
      for (let i = 1; i < columns; i++) block(group, 'window-grid-vertical', bar, h - 0.16, 0.075, color, -w / 2 + INSET + i * (w - 0.16) / columns, 0, 0.07, 0.004);
      for (let i = 1; i < rows; i++) block(group, 'window-grid-horizontal', w - 0.16, bar, 0.075, color, 0, -h / 2 + INSET + i * (h - 0.16) / rows, 0.07, 0.004);
    }
    block(group, 'window-sill', w, style === 'picture' ? 0.045 : 0.065, style === 'picture' ? 0.22 : 0.32,
      style === 'picture' ? color : WOOD, 0, -h / 2 + (style === 'picture' ? 0.0225 : 0.0325), style === 'picture' ? 0.07 : 0.12);
  }
  extendFrameToExterior(group, depth);
  return group;
}

/** Solid curved corner infills above an arched aperture, in its mounting plane. */
export function buildWindowSpandrels(item: WallItem, wallColor: string): THREE.Mesh[] {
  if (getWindowStyle(item) !== 'arched') return [];
  const size = getWallItemSize(item);
  const p = windowArchProfile(size.width, size.height, INSET);
  const middle = (p.spring + p.top) / 2;
  return [-1, 1].map(side => {
    const shape = new THREE.Shape();
    if (side < 0) {
      shape.moveTo(-p.halfWidth, p.spring); shape.lineTo(-p.halfWidth, p.top); shape.lineTo(0, p.top);
      shape.absellipse(0, p.spring, p.halfWidth, p.rise, Math.PI / 2, Math.PI, false, 0);
    } else {
      shape.moveTo(0, p.top); shape.lineTo(p.halfWidth, p.top); shape.lineTo(p.halfWidth, p.spring);
      shape.absellipse(0, p.spring, p.halfWidth, p.rise, 0, Math.PI / 2, false, 0);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false, curveSegments: 48 });
    geometry.translate(0, -middle, 0);
    const mesh = new THREE.Mesh(geometry, material(wallColor));
    mesh.name = 'structural-window-spandrel'; mesh.position.y = item.height + middle;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.wallPanel = { bottom: item.height + p.spring, top: item.height + p.top, ceiling: false };
    mesh.userData.wallLine = item.line;
    return mesh;
  });
}
