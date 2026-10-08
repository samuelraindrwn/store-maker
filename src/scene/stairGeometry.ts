import * as THREE from 'three';
import { getFloorCells, getItemFootprint, getItemSize, getLevelCount, getLevelDocument, type ShopDocument } from '../model';

export interface FloorOpening { minX: number; maxX: number; minZ: number; maxZ: number }
export interface StairOpening extends FloorOpening {
  stairId: string;
  /** The upper exit remains open; the other edges may carry a guard rail. */
  exitSide: 'north' | 'east' | 'south' | 'west';
}

function overlap(a: FloorOpening, b: FloorOpening) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
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
  if (activeLevel <= 0 || activeLevel >= getLevelCount(building)) return [];
  const lower = getLevelDocument(building, activeLevel - 1), current = getLevelDocument(building, activeLevel);
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

/** A rim and three open guard rails make the actual void legible, never cover it. */
export function buildStairwellRims(building: ShopDocument, activeLevel: number) {
  const group = new THREE.Group(); group.name = 'stair-landings';
  if (activeLevel <= 0 || activeLevel >= getLevelCount(building)) return group;
  const current = getLevelDocument(building, activeLevel), openings = getStairOpenings(building, activeLevel);
  const cells = getFloorCells(current).map(cell => ({ minX: cell.x - current.width / 2, maxX: cell.x + 1 - current.width / 2, minZ: cell.z - current.depth / 2, maxZ: cell.z + 1 - current.depth / 2 }));
  const addBox = (parent: THREE.Group, name: string, rectangle: FloorOpening, height: number, y: number, color: string) => {
    const geometry = new THREE.BoxGeometry(rectangle.maxX - rectangle.minX, height, rectangle.maxZ - rectangle.minZ);
    const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    object.name = name; object.position.set((rectangle.minX + rectangle.maxX) / 2, y, (rectangle.minZ + rectangle.maxZ) / 2);
    object.castShadow = true; object.receiveShadow = true; parent.add(object);
  };
  for (const hole of openings) {
    const landing = new THREE.Group(); landing.name = `landing:${hole.stairId}`; landing.userData.stairOpening = hole;
    group.add(landing);
    const thickness = 0.055;
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
        if (side === hole.exitSide) continue;
        addBox(landing, 'stairwell-guardrail', part, 0.055, 0.77, '#ae8861');
        const horizontal = side === 'north' || side === 'south';
        const length = horizontal ? part.maxX - part.minX : part.maxZ - part.minZ;
        if (length < 0.07) continue;
        for (const t of [0.08, 0.92]) {
          const x = horizontal ? part.minX + length * t : (part.minX + part.maxX) / 2;
          const z = horizontal ? (part.minZ + part.maxZ) / 2 : part.minZ + length * t;
          addBox(landing, 'stairwell-guard-post', { minX: x - 0.018, maxX: x + 0.018, minZ: z - 0.018, maxZ: z + 0.018 }, 0.70, 0.40, '#746a65');
        }
      }
    }
  }
  return group;
}
