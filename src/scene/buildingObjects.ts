import * as THREE from 'three';
import { getExterior, getFloorBounds, getFloorCells, getItemFootprint, getLevelCount, getLevelDocument, getRoof, getRooftopDocument, getWallHeight, getWallItemMount, getWallItems, wallItemPosition, type ShopDocument } from '../model';
import { applyWallItemSize, box, buildContourFloor, buildItem, buildRoom, buildWallItem, disposeGroup } from './objects';
import { applyExteriorWallMaterial } from './exteriorMaterials';
import { getItemSupport } from './itemSupport';
import { buildStairwellRims, getStairOpenings } from './stairGeometry';

export const LEVEL_SLAB = 0.24;
type Edge = { side: 'north' | 'south' | 'east' | 'west'; line: number; start: number; end: number };

/** Floor zero starts at ground; each higher floor follows the actual height below it. */
export function getLevelBaseY(building: ShopDocument, level: number): number {
  if (!Number.isInteger(level) || level < 0 || level > getLevelCount(building)) throw new RangeError('Invalid floor index');
  let base = 0;
  for (let lower = 0; lower < level; lower++) base += getWallHeight(getLevelDocument(building, lower)) + LEVEL_SLAB;
  return base;
}

/** Retained legacy/manual stairs under a tiled roof must stay below its slab. */
export function getStairRise(building: ShopDocument, level: number): number {
  const height = getWallHeight(getLevelDocument(building, level));
  return level === getLevelCount(building) - 1 && getRoof(building).style === 'tiles'
    ? height - 0.86 : height + LEVEL_SLAB;
}

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
  // The terrace can hold the whole furniture catalog, including tall racks.
  height += roof.style === 'tiles' ? Math.min(2.1, topWidth * 0.26) : Math.max(getRooftopDocument(building).items.length ? 2.8 : 0.84, roof.stairAccess === 'enclosed' ? 2.4 : 0);
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

/** Shared editor/exterior deck, at the same local elevation as an upstairs room. */
export function buildRooftopStructure(building: ShopDocument) {
  const shop = getRooftopDocument(building), facade = getExterior(building);
  const group = new THREE.Group(); group.name = 'rooftop-structure';
  const floor = new THREE.Group(); floor.name = 'rooftop-floor'; floor.userData.interaction = 'floor';
  // Every slab and paving layer is cut by the actual flight below. A solid roof
  // backing would otherwise hide the staircase even if the tiles had a hole.
  buildContourFloor(shop, floor, LEVEL_SLAB, getStairOpenings(building, getLevelCount(building)));
  group.add(floor);
  const parapets = new THREE.Group(); parapets.name = 'rooftop-parapets'; group.add(parapets);
  for (const edge of buildingEdges(shop)) {
    const rail = edgeFrame(shop, edge), length = edge.end - edge.start;
    box(rail, length + 0.08, 0.66, 0.14, facade.wallColor, 0, 0.37, 0).name = 'rooftop-parapet';
    box(rail, length + 0.15, 0.08, 0.23, facade.trimColor, 0, 0.74, 0).name = 'rooftop-parapet-cap';
    parapets.add(rail);
  }
  const enclosed = getRoof(building).stairAccess === 'enclosed';
  group.add(buildStairwellRims(building, getLevelCount(building), { guardRails: !enclosed }));
  if (enclosed) group.add(buildRooftopStairEnclosures(building));
  return group;
}

/** A small weatherproof stair house with a real, open doorway at the upper exit. */
export function buildRooftopStairEnclosures(building: ShopDocument) {
  const group = new THREE.Group(); group.name = 'rooftop-stair-enclosures';
  const facade = getExterior(building);
  for (const hole of getStairOpenings(building, getLevelCount(building))) {
    const alongZ = hole.exitSide === 'north' || hole.exitSide === 'south';
    const width = alongZ ? hole.maxX - hole.minX : hole.maxZ - hole.minZ;
    const depth = alongZ ? hole.maxZ - hole.minZ : hole.maxX - hole.minX;
    const house = new THREE.Group(); house.name = `stair-access-enclosure:${hole.stairId}`;
    house.userData.stairOpening = hole; house.userData.stairAccess = 'enclosed';
    house.position.set((hole.minX + hole.maxX) / 2, 0, (hole.minZ + hole.maxZ) / 2);
    house.rotation.y = { north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2 }[hole.exitSide];
    const thickness = Math.min(0.06, width * 0.028);
    const wallHeight = 2.22, doorHeight = 1.98, doorWidth = Math.min(1.05, width - 0.18);
    for (const x of [-width / 2 - 0.004, width / 2 + 0.004]) box(house, thickness, wallHeight, depth + thickness, facade.wallColor, x, wallHeight / 2 + 0.04, 0).name = 'stair-access-side-wall';
    box(house, width, wallHeight, thickness, facade.wallColor, 0, wallHeight / 2 + 0.04, depth / 2 + 0.004).name = 'stair-access-back-wall';
    const shoulder = (width - doorWidth) / 2, exitZ = -depth / 2 - 0.004;
    for (const x of [-doorWidth / 2 - shoulder / 2, doorWidth / 2 + shoulder / 2]) box(house, shoulder, wallHeight, thickness, facade.wallColor, x, wallHeight / 2 + 0.04, exitZ).name = 'stair-access-door-jamb';
    box(house, doorWidth, wallHeight - doorHeight, thickness, facade.wallColor, 0, doorHeight + (wallHeight - doorHeight) / 2 + 0.04, exitZ).name = 'stair-access-door-header';
    for (const x of [-doorWidth / 2, doorWidth / 2]) box(house, 0.045, doorHeight + 0.03, thickness + 0.025, facade.trimColor, x, doorHeight / 2 + 0.04, exitZ).name = 'stair-access-door-frame';
    box(house, doorWidth + 0.05, 0.05, thickness + 0.025, facade.trimColor, 0, doorHeight + 0.04, exitZ).name = 'stair-access-door-frame';
    const door = new THREE.Group(); door.name = 'stair-access-open-door';
    door.position.set(-doorWidth / 2, 0.04, exitZ); door.rotation.y = Math.PI * 0.44;
    box(door, doorWidth - 0.04, doorHeight - 0.04, 0.035, facade.trimColor, doorWidth / 2, doorHeight / 2, 0).name = 'stair-access-door-leaf';
    box(door, doorWidth - 0.18, doorHeight * 0.54, 0.012, '#C5D9D4', doorWidth / 2, doorHeight * 0.63, -0.025).name = 'stair-access-door-window';
    box(door, 0.045, 0.13, 0.05, '#D5BD81', doorWidth - 0.12, 0.96, -0.04).name = 'stair-access-door-handle';
    house.add(door);
    box(house, width + thickness + 0.018, 0.12, depth + 0.08, facade.trimColor, 0, wallHeight + 0.10, 0).name = 'stair-access-roof';
    box(house, width + thickness, 0.02, depth + 0.06, '#EFE5D2', 0, wallHeight + 0.17, 0).name = 'stair-access-roof-cap';
    group.add(house);
  }
  return group;
}

function buildAuthoredRooftop(building: ShopDocument, base: number) {
  const shop = getRooftopDocument(building), group = new THREE.Group();
  group.name = 'rooftop-terrace'; group.position.y = base; group.userData.roofStyle = 'rooftop';
  group.add(buildRooftopStructure(building));
  for (const item of shop.items) {
    const object = buildItem(item), footprint = getItemFootprint(item);
    object.position.set(item.x - shop.width / 2 + footprint.width / 2, 0.038, item.z - shop.depth / 2 + footprint.depth / 2);
    object.rotation.y = -THREE.MathUtils.degToRad(item.rotation);
    group.add(object);
  }
  return group;
}

function buildTiledRoof(building: ShopDocument, shop: ShopDocument, base: number) {
  const roof = getRoof(building), facade = getExterior(building), group = new THREE.Group();
  group.name = 'tiled-roof'; group.position.y = base; group.userData.roofStyle = roof.style;
  const cells = getFloorCells(shop), bounds = getFloorBounds(shop), edges = buildingEdges(shop);
  tileSlab(group, shop, facade.trimColor, 0.02, 0.15, 'roof-slab');
  if (!cells.length) return group;
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
  return group;
}

/** Both exterior and floor context use fresh, disposable copies of the authored layout. */
function buildAuthoredLevel(building: ShopDocument, level: number, options: { showCity?: boolean; exterior?: boolean }) {
  const shop = getLevelDocument(building, level), floor = new THREE.Group();
  const facade = getExterior(building), base = getLevelBaseY(building, level);
  const prefix = options.exterior ? 'exterior' : 'interior-context';
  floor.name = `${prefix}-level:${level + 1}`; floor.position.y = base; floor.userData.level = level; floor.userData.floorY = base;
  const room = buildRoom({ ...shop, wallColor: options.exterior ? facade.wallColor : shop.wallColor, exterior: facade }, {
    ...(level > 0 ? { slabDepth: LEVEL_SLAB } : {}), floorOpenings: getStairOpenings(building, level),
    enclosed: options.exterior, hasEntrance: level === 0,
  });
  room.group.name = `${prefix}-room`; floor.add(room.group);
  if (level > 0) floor.add(buildStairwellRims(building, level));
  if (options.exterior) {
    applyExteriorWallMaterial(room.walls, facade);
  }
  if (level > 0) disposeGroup(room.entrance);
  for (const item of getWallItems(shop)) {
    if (item.kind !== 'window' && getWallItemMount(item) !== (options.exterior ? 'exterior' : 'interior')) continue;
    const object = buildWallItem(item, shop), point = wallItemPosition(shop, item);
    applyWallItemSize(object, item);
    object.position.set(point.x, point.y, point.z); object.rotation.y = point.rotation;
    object.userData.wallItemId = item.id;
    object.userData.wallItemKind = item.kind;
    floor.add(object);
  }
  // Saved furniture remains visible through glass, stairwells and the cutaway.
  for (const item of shop.items) {
    const object = buildItem(item, getStairRise(building, level)), footprint = getItemFootprint(item);
    const support = level === 0 ? getItemSupport(shop, item, room.floor, room.entrance, options.showCity ?? true) : { baseY: 0.038 };
    object.position.set(item.x - shop.width / 2 + footprint.width / 2, support.baseY, item.z - shop.depth / 2 + footprint.depth / 2);
    object.rotation.y = -THREE.MathUtils.degToRad(item.rotation); floor.add(object);
    if (support.foundation) {
      const f = support.foundation;
      box(floor, f.width, f.top - f.bottom, f.depth, '#d3c4ba', f.x, (f.top + f.bottom) / 2, f.z, 0).name = 'standing-sign-foundation';
    }
  }
  return floor;
}

/** A closed view of the authored rooms, sharing their floor, entrance, windows and contents. */
export function buildBuilding(building: ShopDocument, options: { showCity?: boolean } = {}) {
  const group = new THREE.Group(); group.name = 'shop-building-exterior';
  const count = getLevelCount(building), base = getLevelBaseY(building, count);
  for (let level = 0; level < count; level++) group.add(buildAuthoredLevel(building, level, { ...options, exterior: true }));
  group.add(getRoof(building).style === 'rooftop'
    ? buildAuthoredRooftop(building, base)
    : buildTiledRoof(building, getLevelDocument(building, count - 1), base - LEVEL_SLAB));
  group.userData.levelCount = count; group.userData.buildingHeight = base;
  return group;
}

/** Faint, inert lower floors establish height without obstructing the active editor. */
export function buildInteriorContext(building: ShopDocument, activeLevel: number, options: { showCity?: boolean; opacity?: number } = {}) {
  if (!Number.isInteger(activeLevel) || activeLevel < 0 || activeLevel > getLevelCount(building)) throw new RangeError('Invalid floor index');
  const group = new THREE.Group(); group.name = 'interior-lower-floor-context';
  const opacity = Number.isFinite(options.opacity) ? THREE.MathUtils.clamp(options.opacity!, 0, 1) : 0.2;
  const stairOpacity = Math.max(opacity, 0.65), materials = new Set<THREE.Material>();
  group.userData.activeLevel = activeLevel;
  group.userData.activeFloorY = getLevelBaseY(building, activeLevel);
  group.userData.levels = Array.from({ length: activeLevel }, (_, level) => level);
  group.userData.opacity = opacity;
  group.userData.connectingStairOpacity = stairOpacity;
  const fade = (object: THREE.Object3D, currentOpacity: number, connectingFloor: boolean) => {
    if (connectingFloor && typeof object.userData.stairRise === 'number') {
      currentOpacity = stairOpacity;
      object.userData.contextOpacity = currentOpacity;
    }
    object.castShadow = false; object.receiveShadow = false; object.renderOrder = -1;
    object.raycast = () => undefined;
    delete object.userData.nightLight;
    delete object.userData.interaction;
    if (object instanceof THREE.Light) object.visible = false;
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (materials.has(material)) continue;
        materials.add(material);
        material.transparent = true; material.opacity *= currentOpacity; material.depthWrite = false;
        delete material.userData.nightGlow;
        delete material.userData.nightOpacity;
        if (material instanceof THREE.MeshStandardMaterial) { material.emissive.set(0); material.emissiveIntensity = 0; }
        material.needsUpdate = true;
      }
    }
    for (const child of object.children) fade(child, currentOpacity, connectingFloor);
  };
  for (let level = 0; level < activeLevel; level++) {
    const floor = buildAuthoredLevel(building, level, options);
    floor.userData.contextOpacity = opacity;
    fade(floor, opacity, level === activeLevel - 1);
    group.add(floor);
  }
  return group;
}

/** Open rims and guard rails surround the real stairwell, without hiding the flight. */
export function buildStairLandings(building: ShopDocument, activeLevel: number) {
  return buildStairwellRims(building, activeLevel);
}
