import * as THREE from 'three';
import { getEntranceAnchor, getEntranceRotation, getExterior, getFloorBounds, getFloorCells, getItemFootprint, getLevelCount, getLevelDocument, getRoof, getWallHeight, getWallItems, wallItemPosition, type ShopDocument } from '../model';
import { applyWallItemSize, box, buildItem, buildRoom, buildWallItem, disposeGroup } from './objects';
import { wallPanels } from './wallGeometry';
import { getItemSupport } from './itemSupport';

export const LEVEL_SLAB = 0.24;
type Edge = { side: 'north' | 'south' | 'east' | 'west'; line: number; start: number; end: number };

/** Each level has its own grid origin: frame their union in shared world coordinates. */
export function getBuildingBounds(building: ShopDocument) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, height = 0;
  const count = getLevelCount(building);
  for (let level = 0; level < count; level++) {
    const floor = getLevelDocument(building, level), bounds = getFloorBounds(floor);
    minX = Math.min(minX, bounds.minX - floor.width / 2);
    maxX = Math.max(maxX, bounds.maxX + 1 - floor.width / 2);
    minZ = Math.min(minZ, bounds.minZ - floor.depth / 2);
    maxZ = Math.max(maxZ, bounds.maxZ + 1 - floor.depth / 2);
    height += getWallHeight(floor) + LEVEL_SLAB;
  }
  const roof = getRoof(building), topWidth = getFloorBounds(getLevelDocument(building, count - 1)).width;
  height += roof.style === 'tiles' ? Math.min(2.1, topWidth * 0.26) : roof.garden ? 2 : 0.8;
  return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ, centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2, height };
}

/** Boundary runs, including courtyards and concave outlines. */
export function buildingEdges(shop: ShopDocument): Edge[] {
  const cells = getFloorCells(shop), occupied = new Set(cells.map(cell => `${cell.x},${cell.z}`));
  const edges: Edge[] = [];
  for (const [side, dx, dz] of [['north', 0, -1], ['south', 0, 1], ['west', -1, 0], ['east', 1, 0]] as const) {
    const horizontal = dz !== 0, lines = new Map<number, number[]>();
    for (const cell of cells) {
      if (occupied.has(`${cell.x + dx},${cell.z + dz}`)) continue;
      const line = horizontal ? cell.z + (dz > 0 ? 1 : 0) : cell.x + (dx > 0 ? 1 : 0);
      const positions = lines.get(line) ?? []; positions.push(horizontal ? cell.x : cell.z); lines.set(line, positions);
    }
    for (const [line, positions] of lines) {
      positions.sort((a, b) => a - b);
      let start = positions[0], last = start;
      for (const position of positions.slice(1)) {
        if (position !== last + 1) { edges.push({ side, line, start, end: last + 1 }); start = position; }
        last = position;
      }
      edges.push({ side, line, start, end: last + 1 });
    }
  }
  return edges;
}

function tileSlab(parent: THREE.Group, shop: ShopDocument, color: string, y: number, thickness: number, name: string) {
  const cells = getFloorCells(shop);
  const batch = new THREE.InstancedMesh(new THREE.BoxGeometry(1, thickness, 1), new THREE.MeshStandardMaterial({ color, roughness: 0.92 }), cells.length);
  batch.name = name; batch.castShadow = true; batch.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  cells.forEach((cell, index) => batch.setMatrixAt(index, matrix.makeTranslation(cell.x - shop.width / 2 + 0.5, y, cell.z - shop.depth / 2 + 0.5)));
  batch.instanceMatrix.needsUpdate = true; batch.computeBoundingSphere(); parent.add(batch);
  return batch;
}

function edgeFrame(shop: ShopDocument, edge: Edge) {
  const group = new THREE.Group(), horizontal = edge.side === 'north' || edge.side === 'south';
  group.position.set((horizontal ? (edge.start + edge.end) / 2 : edge.line) - shop.width / 2, 0, (horizontal ? edge.line : (edge.start + edge.end) / 2) - shop.depth / 2);
  group.rotation.y = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[edge.side];
  return group;
}

function planter(parent: THREE.Group, x: number, z: number) {
  box(parent, 0.63, 0.38, 0.63, '#be9272', x, 0.23, z);
  box(parent, 0.69, 0.075, 0.69, '#d3b18e', x, 0.4, z);
  box(parent, 0.54, 0.025, 0.54, '#776348', x, 0.442, z);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshStandardMaterial({ color: '#84a078', roughness: 0.9 }));
  leaves.name = 'rooftop-greenery'; leaves.position.set(x, 0.79, z); leaves.scale.y = 1.2; leaves.castShadow = true; parent.add(leaves);
}

function buildRoof(building: ShopDocument, shop: ShopDocument, base: number) {
  const roof = getRoof(building), facade = getExterior(building), group = new THREE.Group();
  group.name = roof.style === 'tiles' ? 'tiled-roof' : 'rooftop-terrace'; group.position.y = base; group.userData.roofStyle = roof.style;
  const cells = getFloorCells(shop), bounds = getFloorBounds(shop), edges = buildingEdges(shop);
  tileSlab(group, shop, roof.style === 'rooftop' ? roof.color : facade.trimColor, 0.02, 0.15, 'roof-slab');
  if (!cells.length) return group;
  if (roof.style === 'tiles') {
    const center = bounds.minX + bounds.width / 2, slope = Math.min(0.52, 2.1 / Math.max(1, bounds.width / 2));
    const roofY = (x: number) => 0.19 + (bounds.width / 2 - Math.abs(x - center)) * slope;
    const geometry = new THREE.BoxGeometry(0.267 / Math.cos(Math.atan(slope)), 0.085, 0.36);
    const tiles = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), cells.length * 12);
    tiles.name = 'terracotta-roof-tiles'; tiles.castShadow = true; tiles.receiveShadow = true;
    const dummy = new THREE.Object3D(), tint = new THREE.Color(roof.color); let index = 0;
    for (const cell of cells) for (let col = 0; col < 4; col++) for (let row = 0; row < 3; row++) {
      const x = cell.x + (col + 0.5) / 4;
      dummy.position.set(x - shop.width / 2, roofY(x), cell.z + (row + 0.5) / 3 - shop.depth / 2);
      dummy.rotation.z = (x < center ? 1 : -1) * Math.atan(slope); dummy.updateMatrix(); tiles.setMatrixAt(index, dummy.matrix);
      tiles.setColorAt(index++, tint.clone().multiplyScalar(0.89 + ((cell.x * 7 + cell.z * 11 + col + row + 1000) % 5) * 0.046));
    }
    tiles.instanceMatrix.needsUpdate = true; tiles.instanceColor!.needsUpdate = true; tiles.computeBoundingSphere(); group.add(tiles);
    // Close the gable under each exposed contour edge, including notches.
    for (const edge of edges) {
      const horizontal = edge.side === 'north' || edge.side === 'south', length = edge.end - edge.start;
      const panel = new THREE.Shape(); panel.moveTo(-length / 2, 0.04); panel.lineTo(length / 2, 0.04);
      if (horizontal) {
        panel.lineTo(length / 2, roofY(edge.end));
        if (center > edge.start && center < edge.end) panel.lineTo(center - (edge.start + edge.end) / 2, roofY(center));
        panel.lineTo(-length / 2, roofY(edge.start));
      } else { panel.lineTo(length / 2, roofY(edge.line)); panel.lineTo(-length / 2, roofY(edge.line)); }
      panel.closePath();
      const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(panel, { depth: 0.075, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: facade.wallColor, roughness: 0.88 }));
      gable.name = 'roof-gable'; gable.castShadow = true;
      // North/west flip the local along axis; reflect asymmetric gables to match the slope.
      if (edge.side === 'north') gable.scale.x = -1;
      const edgeGroup = edgeFrame(shop, edge); edgeGroup.add(gable); group.add(edgeGroup);
    }
    for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
      if (!cells.some(cell => cell.z === z && cell.x <= center && cell.x + 1 >= center)) continue;
      box(group, 0.21, 0.15, 1.04, roof.color, center - shop.width / 2, roofY(center) + 0.025, z + 0.5 - shop.depth / 2, 0.035).name = 'roof-ridge-cap';
    }
  } else {
    tileSlab(group, shop, roof.color, 0.115, 0.045, 'rooftop-paving');
    for (const edge of edges) {
      const rail = edgeFrame(shop, edge), length = edge.end - edge.start;
      box(rail, length + 0.08, 0.66, 0.14, facade.wallColor, 0, 0.43, 0).name = 'rooftop-parapet';
      box(rail, length + 0.15, 0.08, 0.23, facade.trimColor, 0, 0.8, 0).name = 'rooftop-parapet-cap'; group.add(rail);
    }
    if (roof.garden) {
      const garden = new THREE.Group(); garden.name = 'rooftop-garden'; garden.position.y = 0.14; group.add(garden);
      const occupied = new Set(cells.map(cell => `${cell.x},${cell.z}`));
      const corners = cells.filter(cell => [bounds.minX, bounds.maxX].includes(cell.x) && [bounds.minZ, bounds.maxZ].includes(cell.z));
      corners.forEach(cell => planter(garden, cell.x + 0.5 - shop.width / 2, cell.z + 0.5 - shop.depth / 2));
      const origin = cells.find(cell => [0, 1].every(dx => [0, 1].every(dz => occupied.has(`${cell.x + dx},${cell.z + dz}`))));
      if (origin) {
        const pergola = new THREE.Group(); pergola.name = 'rooftop-pergola'; pergola.position.set(origin.x + 1 - shop.width / 2, 0, origin.z + 1 - shop.depth / 2); garden.add(pergola);
        for (const x of [-0.78, 0.78]) for (const z of [-0.78, 0.78]) box(pergola, 0.09, 1.75, 0.09, '#b19774', x, 0.875, z);
        for (let i = 0; i < 7; i++) box(pergola, 0.13, 0.09, 1.9, '#c8ad88', -0.87 + i * 0.29, 1.80, 0);
        box(pergola, 1.30, 0.12, 0.46, '#c8ab89', 0, 0.45, -0.5).name = 'rooftop-bench';
        for (const x of [-0.49, 0.49]) box(pergola, 0.1, 0.4, 0.38, '#ae9270', x, 0.2, -0.5);
      }
    }
  }
  return group;
}

/** Close the two cutaway sides around the saved doorway; do not invent facade openings. */
function closeCutawayWalls(parent: THREE.Group, shop: ShopDocument, groundFloor: boolean, color: string, trim: string) {
  const anchor = getEntranceAnchor(shop), height = getWallHeight(shop);
  for (const edge of buildingEdges(shop).filter(edge => edge.side === 'south' || edge.side === 'east')) {
    const wall = edgeFrame(shop, edge), length = edge.end - edge.start;
    wall.name = `exterior-wall:${edge.side}`; parent.add(wall);
    const holes = [];
    if (groundFloor && edge.side === 'south' && Math.abs(wall.position.z + 0.09 - anchor.z) < 0.001
      && anchor.x >= wall.position.x - length / 2 && anchor.x <= wall.position.x + length / 2) {
      const angle = THREE.MathUtils.degToRad(getEntranceRotation(shop));
      const scale = Math.min(1, anchor.width / 1.84);
      const halfWidth = (1.52 * scale * Math.abs(Math.cos(angle)) + 0.24 * Math.abs(Math.sin(angle))) / 2;
      const center = anchor.x - wall.position.x;
      holes.push({ start: center - halfWidth, end: center + halfWidth, bottom: 0, top: 2.19 });
      wall.userData.entranceOpening = { x: anchor.x, z: anchor.z, width: halfWidth * 2 };
    }
    for (const panel of wallPanels(-length / 2 - 0.05, length / 2 + 0.05, height, holes)) {
      const mesh = box(wall, panel.end - panel.start, panel.top - panel.bottom, 0.16, color,
        (panel.start + panel.end) / 2, (panel.bottom + panel.top) / 2, 0.07, 0);
      mesh.name = 'exterior-wall-panel';
    }
    box(wall, length + 0.12, 0.1, 0.23, trim, 0, height + 0.04, 0.07, 0.02).name = 'exterior-floor-band';
    for (const panel of wallPanels(-length / 2, length / 2, 0.12, holes)) {
      box(wall, panel.end - panel.start, panel.top - panel.bottom, 0.08, '#c6b3a2',
        (panel.start + panel.end) / 2, (panel.bottom + panel.top) / 2, 0.17, 0.012).name = 'exterior-plinth';
    }
  }
}

/** A closed view of the authored rooms, sharing their floor, entrance, windows and contents. */
export function buildBuilding(building: ShopDocument, options: { showCity?: boolean } = {}) {
  const group = new THREE.Group(); group.name = 'shop-building-exterior';
  const facade = getExterior(building), count = getLevelCount(building); let base = 0;
  for (let level = 0; level < count; level++) {
    const shop = getLevelDocument(building, level), height = getWallHeight(shop), floor = new THREE.Group();
    floor.name = `exterior-level:${level + 1}`; floor.position.y = base; floor.userData.level = level; floor.userData.floorY = base; group.add(floor);
    // Reuse the actual room instead of generating a second, unrelated shop facade.
    const room = buildRoom({ ...shop, wallColor: facade.wallColor, exterior: facade }, level > 0 ? { slabDepth: LEVEL_SLAB } : {});
    room.group.name = 'exterior-room'; floor.add(room.group);
    room.walls.traverse(object => {
      if (object.userData.wallCoping && object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) {
        object.material.color.set(facade.trimColor);
      }
    });
    if (level > 0) disposeGroup(room.entrance);
    if (room.hasFloor) closeCutawayWalls(floor, shop, level === 0, facade.wallColor, facade.trimColor);
    for (const item of getWallItems(shop)) {
      const object = buildWallItem(item, shop), point = wallItemPosition(shop, item);
      applyWallItemSize(object, item);
      object.position.set(point.x, point.y, point.z); object.rotation.y = point.rotation;
      object.userData.wallItemId = item.id;
      object.userData.wallItemKind = item.kind;
      floor.add(object);
    }
    // Saved furniture remains visible through real glass/open doors at its actual position.
    for (const item of shop.items) {
      const object = buildItem(item, height + LEVEL_SLAB), footprint = getItemFootprint(item);
      const support = level === 0 ? getItemSupport(shop, item, room.floor, room.entrance, options.showCity ?? true) : { baseY: 0.038 };
      object.position.set(item.x - shop.width / 2 + footprint.width / 2, support.baseY, item.z - shop.depth / 2 + footprint.depth / 2);
      object.rotation.y = -THREE.MathUtils.degToRad(item.rotation); floor.add(object);
      if (support.foundation) {
        const f = support.foundation;
        box(floor, f.width, f.top - f.bottom, f.depth, '#d3c4ba', f.x, (f.top + f.bottom) / 2, f.z, 0).name = 'standing-sign-foundation';
      }
    }
    base += height + LEVEL_SLAB;
  }
  group.add(buildRoof(building, getLevelDocument(building, count - 1), base - LEVEL_SLAB));
  group.userData.levelCount = count; group.userData.buildingHeight = base;
  return group;
}

/** Visible landing hatches line up with the top of the flight on the floor below. */
export function buildStairLandings(building: ShopDocument, activeLevel: number) {
  const group = new THREE.Group(); group.name = 'stair-landings';
  if (activeLevel <= 0) return group;
  const lower = getLevelDocument(building, activeLevel - 1), current = getLevelDocument(building, activeLevel);
  for (const item of lower.items.filter(item => item.kind === 'stairs')) {
    const footprint = getItemFootprint(item), landing = new THREE.Group(); landing.name = `landing:${item.id}`;
    landing.position.set(item.x - lower.width / 2 + footprint.width / 2, 0.04, item.z - lower.depth / 2 + footprint.depth / 2);
    landing.rotation.y = -THREE.MathUtils.degToRad(item.rotation);
    const w = item.width ?? 2, d = item.depth ?? 3;
    box(landing, w * 0.87, 0.018, d * 0.36, '#81736c', 0, 0.009, -d * 0.30).name = 'stair-landing-opening';
    for (let step = 0; step < 4; step++) box(landing, w * 0.81, 0.01, 0.035, '#bca282', 0, 0.023, -d * 0.45 + step * d * 0.085);
    // Do not add disconnected hatches where the upper floor was removed.
    const center = landing.position;
    const cellX = Math.floor(center.x + current.width / 2), cellZ = Math.floor(center.z + current.depth / 2);
    if (getFloorCells(current).some(cell => cell.x === cellX && cell.z === cellZ)) group.add(landing);
  }
  return group;
}
