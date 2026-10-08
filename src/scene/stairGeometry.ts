import * as THREE from 'three';
import { getFloorCells, getItemFootprint, getItemSize, getLevelCount, getLevelDocument, getRooftopDocument, type ShopDocument } from '../model';

export interface FloorOpening { minX: number; maxX: number; minZ: number; maxZ: number }
export interface StairOpening extends FloorOpening {
  stairId: string;
  /** The upper exit remains open; the other edges may carry a guard rail. */
  exitSide: 'north' | 'east' | 'south' | 'west';
}

function overlap(a: FloorOpening, b: FloorOpening) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

function intersection(a: FloorOpening, b: FloorOpening): FloorOpening | null {
  if (!overlap(a, b)) return null;
  return { minX: Math.max(a.minX, b.minX), maxX: Math.min(a.maxX, b.maxX), minZ: Math.max(a.minZ, b.minZ), maxZ: Math.min(a.maxZ, b.maxZ) };
}

function expand(rectangle: FloorOpening, margin: number): FloorOpening {
  return { minX: rectangle.minX - margin, maxX: rectangle.maxX + margin, minZ: rectangle.minZ - margin, maxZ: rectangle.maxZ + margin };
}

/** A crossing rail blocks the whole passage; a parallel rail only conflicts
 * when it runs through its interior, not alongside its exposed outer edge. */
function railPassage(rectangle: FloorOpening, alongZ: boolean, horizontalRail: boolean, margin: number, sideInset: number): FloorOpening {
  const cut = expand(rectangle, margin);
  if (horizontalRail !== alongZ) {
    if (alongZ) { cut.minX = rectangle.minX + sideInset; cut.maxX = rectangle.maxX - sideInset; }
    else { cut.minZ = rectangle.minZ + sideInset; cut.maxZ = rectangle.maxZ - sideInset; }
  }
  return cut;
}

/** Keep only continuous strips of the authored floor, including concave outlines. */
function supportedApproaches(rectangle: FloorOpening, alongZ: boolean, cells: readonly FloorOpening[]): FloorOpening[] {
  const minAcross = alongZ ? rectangle.minX : rectangle.minZ, maxAcross = alongZ ? rectangle.maxX : rectangle.maxZ;
  const minAlong = alongZ ? rectangle.minZ : rectangle.minX, maxAlong = alongZ ? rectangle.maxZ : rectangle.maxX;
  const breaks = [...new Set([minAcross, maxAcross, ...cells.flatMap(cell => alongZ ? [cell.minX, cell.maxX] : [cell.minZ, cell.maxZ])])]
    .filter(value => value >= minAcross && value <= maxAcross).sort((a, b) => a - b);
  const result: FloorOpening[] = [];
  for (let index = 1; index < breaks.length; index++) {
    const start = breaks[index - 1], end = breaks[index], mid = (start + end) / 2;
    if (end - start < 0.000001) continue;
    const spans = cells.filter(cell => alongZ ? mid > cell.minX && mid < cell.maxX : mid > cell.minZ && mid < cell.maxZ)
      .map(cell => alongZ ? [cell.minZ, cell.maxZ] : [cell.minX, cell.maxX]).sort((a, b) => a[0] - b[0]);
    let reached = minAlong;
    for (const [from, to] of spans) {
      if (to < reached) continue;
      if (from > reached + 0.000001) break;
      reached = Math.max(reached, to);
    }
    if (reached < maxAlong - 0.000001) continue;
    result.push(alongZ ? { minX: start, maxX: end, minZ: minAlong, maxZ: maxAlong } : { minX: minAlong, maxX: maxAlong, minZ: start, maxZ: end });
  }
  return result;
}

/** Subtract a union of openings without creating overlapping floor fragments. */
export function subtractFloorOpenings(rectangle: FloorOpening, openings: readonly FloorOpening[]): FloorOpening[] {
  let pieces = [rectangle];
  for (const hole of openings) {
    pieces = pieces.flatMap(piece => {
      if (!overlap(piece, hole)) return [piece];
      const x0 = Math.max(piece.minX, hole.minX), x1 = Math.min(piece.maxX, hole.maxX);
      const z0 = Math.max(piece.minZ, hole.minZ), z1 = Math.min(piece.maxZ, hole.maxZ);
      return [
        { minX: piece.minX, maxX: x0, minZ: piece.minZ, maxZ: piece.maxZ },
        { minX: x1, maxX: piece.maxX, minZ: piece.minZ, maxZ: piece.maxZ },
        { minX: x0, maxX: x1, minZ: piece.minZ, maxZ: z0 },
        { minX: x0, maxX: x1, minZ: z1, maxZ: piece.maxZ },
      ].filter(part => part.maxX - part.minX > 0.000001 && part.maxZ - part.minZ > 0.000001);
    });
  }
  return pieces;
}

/** Derive stairwells from the flight below, without changing saved floor cells. */
export function getStairOpenings(building: ShopDocument, activeLevel: number): StairOpening[] {
  const count = getLevelCount(building);
  if (!Number.isInteger(activeLevel) || activeLevel <= 0 || activeLevel > count) return [];
  const lower = getLevelDocument(building, activeLevel - 1), current = activeLevel === count ? getRooftopDocument(building) : getLevelDocument(building, activeLevel);
  const cells = getFloorCells(current).map(cell => ({ minX: cell.x - current.width / 2, maxX: cell.x + 1 - current.width / 2, minZ: cell.z - current.depth / 2, maxZ: cell.z + 1 - current.depth / 2 }));
  return lower.items.filter(item => item.kind === 'stairs').flatMap(item => {
    const size = getItemSize(item), footprint = getItemFootprint(item);
    const centerX = item.x - lower.width / 2 + footprint.width / 2;
    const centerZ = item.z - lower.depth / 2 + footprint.depth / 2;
    const angle = -THREE.MathUtils.degToRad(item.rotation), c = Math.cos(angle), s = Math.sin(angle);
    // Include the complete flight and its handrails; retain a lip past the top
    // tread so the upper exit connects to the surrounding floor.
    const corners = [-size.width * 0.48, size.width * 0.48].flatMap(x => [-size.depth * 0.48, size.depth * 0.40].map(z => ({ x: centerX + x * c + z * s, z: centerZ - x * s + z * c })));
    const opening: StairOpening = {
      minX: Math.min(...corners.map(p => p.x)), maxX: Math.max(...corners.map(p => p.x)),
      minZ: Math.min(...corners.map(p => p.z)), maxZ: Math.max(...corners.map(p => p.z)),
      stairId: item.id, exitSide: ({ 0: 'north', 90: 'east', 180: 'south', 270: 'west' } as const)[item.rotation],
    };
    return cells.some(cell => overlap(cell, opening)) ? [opening] : [];
  });
}

/** Guard the stairwell, adding only the short landing needed by a continuing flight. */
export function buildStairwellRims(building: ShopDocument, activeLevel: number, options: { guardRails?: boolean } = {}) {
  const group = new THREE.Group(); group.name = 'stair-landings';
  const count = getLevelCount(building);
  if (!Number.isInteger(activeLevel) || activeLevel <= 0 || activeLevel > count) return group;
  const current = activeLevel === count ? getRooftopDocument(building) : getLevelDocument(building, activeLevel), openings = getStairOpenings(building, activeLevel);
  const cells = getFloorCells(current).map(cell => ({ minX: cell.x - current.width / 2, maxX: cell.x + 1 - current.width / 2, minZ: cell.z - current.depth / 2, maxZ: cell.z + 1 - current.depth / 2 }));
  // Remove rails crossing an upper flight or its first-step approach. Its
  // sloping handrails do not replace the horizontal guards beside the hole.
  const flights = current.items.filter(item => item.kind === 'stairs').map(item => {
    const size = getItemFootprint(item);
    return { item, alongZ: item.rotation % 180 === 0, rectangle: { minX: item.x - current.width / 2, maxX: item.x - current.width / 2 + size.width,
      minZ: item.z - current.depth / 2, maxZ: item.z - current.depth / 2 + size.depth } };
  });
  const flightCuts = (horizontalRail: boolean) => flights.map(({ item, rectangle, alongZ }) =>
    // Treads occupy 90% of the authored width; leave the outer side strip for
    // a guard, with a small clearance beside the real tread edge.
    railPassage(rectangle, alongZ, horizontalRail, 0.09, getItemSize(item).width * 0.05 - 0.01));
  const addBox = (parent: THREE.Group, name: string, rectangle: FloorOpening, height: number, y: number, color: string) => {
    const geometry = new THREE.BoxGeometry(rectangle.maxX - rectangle.minX, height, rectangle.maxZ - rectangle.minZ);
    const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    object.name = name; object.position.set((rectangle.minX + rectangle.maxX) / 2, y, (rectangle.minZ + rectangle.maxZ) / 2);
    object.castShadow = true; object.receiveShadow = true; parent.add(object);
    return object;
  };
  const addGuard = (parent: THREE.Group, rectangle: FloorOpening, horizontal: boolean, entry = false) => {
    const length = horizontal ? rectangle.maxX - rectangle.minX : rectangle.maxZ - rectangle.minZ;
    if (length < 0.07) return;
    addBox(parent, entry ? 'stairwell-entry-guardrail' : 'stairwell-guardrail', rectangle, 0.055, 0.77, '#ae8861');
    for (const t of [0.08, 0.92]) {
      const x = horizontal ? rectangle.minX + length * t : (rectangle.minX + rectangle.maxX) / 2;
      const z = horizontal ? (rectangle.minZ + rectangle.maxZ) / 2 : rectangle.minZ + length * t;
      addBox(parent, entry ? 'stairwell-entry-guard-post' : 'stairwell-guard-post', { minX: x - 0.018, maxX: x + 0.018, minZ: z - 0.018, maxZ: z + 0.018 }, 0.70, 0.40, '#746a65');
    }
  };
  const builtBridges: FloorOpening[] = [];
  for (const hole of openings) {
    const landing = new THREE.Group(); landing.name = `landing:${hole.stairId}`; landing.userData.stairOpening = hole;
    group.add(landing);
    const thickness = 0.055;
    const approaches = flights.flatMap(({ item, rectangle }) => {
      if (!overlap(rectangle, hole)) return [];
      const side = ({ 0: 'south', 90: 'west', 180: 'north', 270: 'east' } as const)[item.rotation];
      // The descent exit is already open. Never cap its upper treads with an
      // automatic platform for an opposite-facing flight.
      if (side === hole.exitSide) return [];
      const alongZ = side === 'north' || side === 'south';
      const entry = side === 'south' ? rectangle.maxZ : side === 'north' ? rectangle.minZ : side === 'east' ? rectangle.maxX : rectangle.minX;
      const min = alongZ ? hole.minZ : hole.minX, max = alongZ ? hole.maxZ : hole.maxX;
      if (entry <= min + 0.000001 || entry >= max - 0.000001) return [];
      const inset = getItemSize(item).depth * 0.06;
      const bridge = intersection(hole, side === 'south' ? { ...rectangle, minZ: entry - inset, maxZ: hole.maxZ }
        : side === 'north' ? { ...rectangle, minZ: hole.minZ, maxZ: entry + inset }
        : side === 'east' ? { ...rectangle, minX: entry - inset, maxX: hole.maxX }
        : { ...rectangle, minX: hole.minX, maxX: entry + inset });
      if (!bridge) return [];
      return supportedApproaches(bridge, alongZ, cells).map(rectangle => ({ rectangle, alongZ, side, upperStairId: item.id }));
    });
    const approachCuts = (horizontalRail: boolean) => approaches.map(({ rectangle, alongZ }) =>
      railPassage(rectangle, alongZ, horizontalRail, thickness + 0.001, thickness + 0.001));
    landing.userData.entryBridges = approaches.map(({ rectangle, upperStairId }) => ({ ...rectangle, upperStairId }));
    for (const approach of approaches) {
      for (const cell of cells) {
        const covered = intersection(approach.rectangle, cell);
        if (!covered) continue;
        for (const piece of subtractFloorOpenings(covered, builtBridges)) {
          const mesh = addBox(landing, 'stairwell-entry-bridge', piece, 0.12, -0.036, current.floorColor);
          mesh.userData.upperStairId = approach.upperStairId;
          mesh.userData.lowerStairId = hole.stairId;
          builtBridges.push(piece);
        }
      }
      if (options.guardRails === false) continue;
      const r = approach.rectangle;
      const sides = approach.alongZ ? [
        { minX: r.minX, maxX: r.minX + thickness, minZ: r.minZ, maxZ: r.maxZ },
        { minX: r.maxX - thickness, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ },
      ] : [
        { minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.minZ + thickness },
        { minX: r.minX, maxX: r.maxX, minZ: r.maxZ - thickness, maxZ: r.maxZ },
      ];
      for (const [index, side] of sides.entries()) {
        const edge = approach.alongZ ? (index ? r.maxX : r.minX) : (index ? r.maxZ : r.minZ);
        const holeEdge = approach.alongZ ? (index ? hole.maxX : hole.minX) : (index ? hole.maxZ : hole.minZ);
        if (Math.abs(edge - holeEdge) < 0.000001) continue;
        // Adjacent strips form one landing; only its exposed outer sides need
        // protection, never the seams between the floor-cell strips.
        const neighbor = approach.alongZ ? { ...side, minX: edge + (index ? 0.00001 : -thickness), maxX: edge + (index ? thickness : -0.00001) }
          : { ...side, minZ: edge + (index ? 0.00001 : -thickness), maxZ: edge + (index ? thickness : -0.00001) };
        const coveredNeighbors = approaches.filter(other => other !== approach && overlap(other.rectangle, neighbor)).map(other => expand(other.rectangle, thickness));
        for (const part of subtractFloorOpenings(side, [...flightCuts(!approach.alongZ), ...coveredNeighbors])) addGuard(landing, part, !approach.alongZ, true);
      }
    }
    const edges: { side: StairOpening['exitSide']; rectangle: FloorOpening }[] = [
      { side: 'north', rectangle: { minX: hole.minX, maxX: hole.maxX, minZ: hole.minZ - thickness, maxZ: hole.minZ } },
      { side: 'south', rectangle: { minX: hole.minX, maxX: hole.maxX, minZ: hole.maxZ, maxZ: hole.maxZ + thickness } },
      { side: 'west', rectangle: { minX: hole.minX - thickness, maxX: hole.minX, minZ: hole.minZ, maxZ: hole.maxZ } },
      { side: 'east', rectangle: { minX: hole.maxX, maxX: hole.maxX + thickness, minZ: hole.minZ, maxZ: hole.maxZ } },
    ];
    for (const { side, rectangle } of edges) for (const cell of cells) {
      if (!overlap(rectangle, cell)) continue;
      const intersection = { minX: Math.max(rectangle.minX, cell.minX), maxX: Math.min(rectangle.maxX, cell.maxX), minZ: Math.max(rectangle.minZ, cell.minZ), maxZ: Math.min(rectangle.maxZ, cell.maxZ) };
      for (const part of subtractFloorOpenings(intersection, openings)) {
        addBox(landing, 'stairwell-rim', part, 0.035, 0.042, '#b7a185');
        if (side === hole.exitSide || options.guardRails === false) continue;
        const horizontal = side === 'north' || side === 'south';
        for (const railPart of subtractFloorOpenings(part, [...flightCuts(horizontal), ...approachCuts(horizontal)])) addGuard(landing, railPart, horizontal);
      }
    }
  }
  return group;
}
