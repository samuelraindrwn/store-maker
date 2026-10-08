import * as THREE from 'three';
import { getEntranceAnchor, getEntranceRotation, getExterior, getFloorBounds, getFloorCells, getItemFootprint, getLevelCount, getLevelDocument, getRoof, getWallHeight, isStandingSign, type ShopDocument } from '../model';
import { box, buildItem, textTexture } from './objects';

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

function window(parent: THREE.Group, x: number, y: number, width: number, height: number, trim: string, shopWindow: boolean) {
  const frame = new THREE.Group(); frame.name = shopWindow ? 'storefront-window' : 'upper-floor-window'; frame.position.set(x, y, 0.12); parent.add(frame);
  const pane = box(frame, width, height, 0.035, '#7dabae', 0, 0, 0, 0.01);
  pane.name = 'exterior-glass'; pane.material.roughness = 0.23; pane.material.metalness = 0.16;
  pane.material.userData.nightGlow = { color: '#f5d997', dayIntensity: 0, nightIntensity: 0.58 };
  for (const sx of [-1, 1]) box(frame, 0.075, height + 0.10, 0.09, trim, sx * (width / 2 + 0.025), 0, 0.035);
  for (const sy of [-1, 1]) box(frame, width + 0.15, 0.075, 0.10, trim, 0, sy * (height / 2 + 0.025), 0.035);
  box(frame, 0.05, height, 0.08, '#f0e6ce', 0, 0, 0.025);
  box(frame, width, 0.05, 0.08, '#f0e6ce', 0, shopWindow ? height * 0.23 : 0, 0.025);
  box(frame, width + 0.24, 0.075, 0.26, '#eadbc0', 0, -height / 2 - 0.05, 0.055);
  const reflection = box(frame, width * 0.16, height * 0.76, 0.007, '#c5ddd4', -width * 0.29, 0, 0.023, 0);
  reflection.material.transparent = true; reflection.material.opacity = 0.4;
}

function addEntrance(parent: THREE.Group, shop: ShopDocument, trim: string, awning: boolean) {
  const anchor = getEntranceAnchor(shop), group = new THREE.Group();
  group.name = 'exterior-entrance'; group.position.set(anchor.x, 0, anchor.z + 0.06);
  group.rotation.y = -THREE.MathUtils.degToRad(getEntranceRotation(shop));
  const w = Math.min(1.65, anchor.width - 0.12);
  box(group, w + 0.2, 2.24, 0.16, trim, 0, 1.12, 0);
  window(group, 0, 1.28, Math.max(0.5, w - 0.15), 1.55, trim, true);
  box(group, w - 0.13, 0.42, 0.07, trim, 0, 0.29, 0.11);
  box(group, 0.045, 0.3, 0.12, '#dac68e', w * 0.32, 1.02, 0.25);
  box(group, w + 0.28, 0.11, 0.75, '#e2cdb0', 0, -0.015, 0.23);
  box(group, w * 0.80, 0.02, 0.38, '#ad9780', 0, 0.053, 0.36);
  const signW = Math.min(2.3, anchor.width + 0.46);
  box(group, signW, 0.32, 0.1, trim, 0, 2.48, 0.08);
  const texture = textTexture(shop.name, trim, '#fff1d7', signW / 0.27);
  if (texture) {
    const label = new THREE.Mesh(new THREE.PlaneGeometry(signW - 0.1, 0.26), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }));
    label.position.set(0, 2.48, 0.136); label.name = 'exterior-shop-name'; group.add(label);
  }
  if (awning) {
    const canopy = new THREE.Group(); canopy.name = 'exterior-awning'; canopy.position.set(0, 2.7, 0.36); canopy.rotation.x = 0.16;
    const stripeW = (signW + 0.2) / 12;
    for (let stripe = 0; stripe < 12; stripe++) {
      const x = -(signW + 0.2) / 2 + stripeW * (stripe + 0.5), tone = stripe % 2 ? '#f8eddb' : trim;
      box(canopy, stripeW + 0.002, 0.055, 0.9, tone, x, 0, 0, 0.007);
      box(canopy, stripeW + 0.002, 0.15, 0.05, tone, x, -0.07, 0.45, 0.012);
    }
    group.add(canopy);
  }
  parent.add(group);
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

/** The exterior is a separate closed shell; the editable floor keeps its stable y=0 coordinates. */
export function buildBuilding(building: ShopDocument) {
  const group = new THREE.Group(); group.name = 'shop-building-exterior';
  const facade = getExterior(building), count = getLevelCount(building); let base = 0;
  for (let level = 0; level < count; level++) {
    const shop = getLevelDocument(building, level), height = getWallHeight(shop), floor = new THREE.Group();
    floor.name = `exterior-level:${level + 1}`; floor.position.y = base; floor.userData.level = level; floor.userData.floorY = base; group.add(floor);
    tileSlab(floor, shop, facade.trimColor, -LEVEL_SLAB / 2, LEVEL_SLAB, 'building-level-slab');
    const anchor = getEntranceAnchor(shop);
    for (const edge of buildingEdges(shop)) {
      const wall = edgeFrame(shop, edge), length = edge.end - edge.start; wall.name = `exterior-wall:${edge.side}`; floor.add(wall);
      box(wall, length + 0.09, height, 0.17, facade.wallColor, 0, height / 2, 0, 0).name = 'exterior-wall-panel';
      box(wall, length + 0.17, 0.14, 0.25, facade.trimColor, 0, height - 0.03, 0, 0.01).name = 'exterior-floor-band';
      box(wall, length + 0.1, 0.20, 0.20, '#d0bca4', 0, 0.1, 0).name = 'exterior-plinth';
      const bayCount = Math.floor(length / 1.75), bayWidth = length / Math.max(1, bayCount);
      for (let bay = 0; bay < bayCount; bay++) {
        const x = -length / 2 + (bay + 0.5) * bayWidth;
        const atDoor = level === 0 && edge.side === 'south' && Math.abs(wall.position.z + 0.09 - anchor.z) < 0.02 && Math.abs(wall.position.x + x - anchor.x) < 1.1 + bayWidth / 2;
        if (atDoor) continue;
        window(wall, x, level === 0 ? 1.3 : height * 0.55, Math.min(level === 0 ? 1.3 : 1.04, bayWidth - 0.5), level === 0 ? 1.6 : Math.min(1.35, height - 0.9), facade.trimColor, level === 0);
      }
      for (const x of [-length / 2 + 0.10, length / 2 - 0.10]) box(wall, 0.11, height - 0.2, 0.07, '#f3e7d2', x, height / 2, 0.10);
    }
    if (level === 0 && getFloorCells(shop).length) {
      addEntrance(floor, building, facade.trimColor, facade.awning);
      for (const item of shop.items.filter(item => isStandingSign(item.kind))) {
        const object = buildItem(item), footprint = getItemFootprint(item);
        object.position.set(item.x - shop.width / 2 + footprint.width / 2, 0.038, item.z - shop.depth / 2 + footprint.depth / 2); object.rotation.y = -THREE.MathUtils.degToRad(item.rotation); floor.add(object);
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
