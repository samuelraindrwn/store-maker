import * as THREE from 'three';
import { getFloorBounds, getFloorCells, getWallHeight, MAX_FLOOR_COORD, MIN_FLOOR_COORD, type ShopDocument } from '../model';

export type FloorCell = { x: number; z: number };
const capacity = 24 * 24;
const key = (cell: FloorCell) => `${cell.x},${cell.z}`;

/** Includes every traversed cell, even when pointer events are farther apart than one tile. */
export function strokeCells(from: FloorCell, to: FloorCell): FloorCell[] {
  const cells: FloorCell[] = [];
  let x = from.x, z = from.z;
  const dx = Math.abs(to.x - x), dz = Math.abs(to.z - z);
  const sx = x < to.x ? 1 : -1, sz = z < to.z ? 1 : -1;
  let error = dx - dz;
  while (true) {
    cells.push({ x, z });
    if (x === to.x && z === to.z) break;
    const twice = error * 2;
    if (twice > -dz) { error -= dz; x += sx; }
    if (twice < dx) { error += dx; z += sz; }
  }
  return cells;
}

export function workCells(shop: ShopDocument): FloorCell[] {
  const bounds = getFloorBounds(shop);
  const cells: FloorCell[] = [];
  for (let x = Math.max(MIN_FLOOR_COORD, bounds.minX - 2); x <= Math.min(MAX_FLOOR_COORD, bounds.maxX + 2); x++) {
    for (let z = Math.max(MIN_FLOOR_COORD, bounds.minZ - 2); z <= Math.min(MAX_FLOOR_COORD, bounds.maxZ + 2); z++) cells.push({ x, z });
  }
  return cells;
}

export function floorOutline(cells: FloorCell[]) {
  const occupied = new Set(cells.map(key));
  const edges: { x1: number; z1: number; x2: number; z2: number; side: string }[] = [];
  cells.forEach(({ x, z }) => {
    if (!occupied.has(`${x},${z - 1}`)) edges.push({ x1: x, z1: z, x2: x + 1, z2: z, side: 'back' });
    if (!occupied.has(`${x - 1},${z}`)) edges.push({ x1: x, z1: z, x2: x, z2: z + 1, side: 'left' });
    if (!occupied.has(`${x},${z + 1}`)) edges.push({ x1: x, z1: z + 1, x2: x + 1, z2: z + 1, side: 'front' });
    if (!occupied.has(`${x + 1},${z}`)) edges.push({ x1: x + 1, z1: z, x2: x + 1, z2: z + 1, side: 'right' });
  });
  return edges;
}

function lineBuffer(segments: number, material: THREE.LineBasicMaterial) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segments * 6), 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0, 0);
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  return lines;
}

/** Fixed GPU pools: painting updates matrices and line buffers, never rebuilds room meshes. */
export class FloorPainter {
  readonly group = new THREE.Group();
  readonly preview = new THREE.Group();
  readonly work = new THREE.Group();
  readonly outlines = lineBuffer(capacity * 12, new THREE.LineBasicMaterial({ color: '#9573b8', transparent: true, opacity: 0.62, depthTest: false, depthWrite: false }));
  private readonly base = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.31, 1), new THREE.MeshStandardMaterial({ color: '#d6c8bd', roughness: 1 }), capacity);
  private readonly tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.985, 0.055, 0.985), new THREE.MeshStandardMaterial({ roughness: 0.9 }), capacity);
  private readonly candidates = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.955, 0.955), new THREE.MeshBasicMaterial({ color: '#a890c9', transparent: true, opacity: 0.19, side: THREE.DoubleSide, depthWrite: false }), capacity);
  private readonly grid = lineBuffer(capacity * 4, new THREE.LineBasicMaterial({ color: '#aa93c1', transparent: true, opacity: 0.42, depthWrite: false }));
  private readonly hover = new THREE.Mesh(new THREE.PlaneGeometry(0.955, 0.955), new THREE.MeshBasicMaterial({ color: '#9160cb', transparent: true, opacity: 0.36, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
  private readonly matrix = new THREE.Matrix4();
  private workKey = '';
  private paintKey = '';

  constructor() {
    this.group.name = 'floor-paint-tools';
    for (const mesh of [this.base, this.tiles, this.candidates]) {
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.raycast = () => undefined;
    }
    this.tiles.receiveShadow = true;
    this.base.receiveShadow = true;
    this.candidates.renderOrder = 1;
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.renderOrder = 12;
    this.hover.visible = false;
    this.outlines.renderOrder = 8;
    this.work.add(this.candidates, this.grid, this.hover);
    this.preview.add(this.base, this.tiles, this.outlines);
    this.preview.visible = false;
    this.group.add(this.preview, this.work);
    this.group.visible = false;
  }

  updateWork(shop: ShopDocument, erase: boolean) {
    const cells = getFloorCells(shop);
    const nextKey = JSON.stringify([shop.width, shop.depth, cells, erase]);
    if (nextKey === this.workKey) return;
    this.workKey = nextKey;
    const occupied = new Set(cells.map(key));
    const candidates = workCells(shop);
    const vertices = this.grid.geometry.getAttribute('position') as THREE.BufferAttribute;
    let vertex = 0, instance = 0;
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const line = (x1: number, z1: number, x2: number, z2: number) => {
      vertices.setXYZ(vertex++, x1 - shop.width / 2, 0.045, z1 - shop.depth / 2);
      vertices.setXYZ(vertex++, x2 - shop.width / 2, 0.045, z2 - shop.depth / 2);
    };
    candidates.forEach(({ x, z }) => {
      const exists = occupied.has(`${x},${z}`);
      if (!exists || erase) {
        this.matrix.compose(new THREE.Vector3(x - shop.width / 2 + 0.5, 0.04, z - shop.depth / 2 + 0.5), rotation, new THREE.Vector3(1, 1, 1));
        this.candidates.setMatrixAt(instance++, this.matrix);
      }
      line(x, z, x + 1, z); line(x + 1, z, x + 1, z + 1); line(x + 1, z + 1, x, z + 1); line(x, z + 1, x, z);
    });
    this.candidates.material.color.set(erase ? '#d8959a' : '#a890c9');
    this.candidates.material.opacity = erase ? 0.13 : 0.19;
    this.candidates.count = instance;
    this.candidates.instanceMatrix.needsUpdate = true;
    this.grid.geometry.setDrawRange(0, vertex);
    vertices.needsUpdate = true;
  }

  updatePreview(shop: ShopDocument, showWalls: boolean, showAllWalls = false) {
    const cells = getFloorCells(shop);
    const nextKey = JSON.stringify([shop.width, shop.depth, cells, shop.floorColor, getWallHeight(shop), showWalls, showAllWalls]);
    if (nextKey === this.paintKey) return;
    this.paintKey = nextKey;
    const floorColor = new THREE.Color(shop.floorColor);
    cells.forEach(({ x, z }, index) => {
      this.matrix.makeTranslation(x - shop.width / 2 + 0.5, -0.185, z - shop.depth / 2 + 0.5);
      this.base.setMatrixAt(index, this.matrix);
      this.matrix.makeTranslation(x - shop.width / 2 + 0.5, -0.003, z - shop.depth / 2 + 0.5);
      this.tiles.setMatrixAt(index, this.matrix);
      this.tiles.setColorAt(index, floorColor.clone().multiplyScalar((x + z) % 2 ? 0.97 : 1.03));
    });
    this.base.count = this.tiles.count = cells.length;
    this.base.instanceMatrix.needsUpdate = this.tiles.instanceMatrix.needsUpdate = true;
    if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
    const vertices = this.outlines.geometry.getAttribute('position') as THREE.BufferAttribute;
    let vertex = 0;
    const line = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
      vertices.setXYZ(vertex++, x1 - shop.width / 2, y1, z1 - shop.depth / 2);
      vertices.setXYZ(vertex++, x2 - shop.width / 2, y2, z2 - shop.depth / 2);
    };
    floorOutline(cells).forEach(({ x1, z1, x2, z2, side }) => {
      line(x1, 0.07, z1, x2, 0.07, z2);
      if (showWalls && (showAllWalls || side === 'back' || side === 'left')) {
        const height = getWallHeight(shop);
        line(x1, height, z1, x2, height, z2);
        line(x1, 0.07, z1, x1, height, z1);
        line(x2, 0.07, z2, x2, height, z2);
      }
    });
    this.outlines.geometry.setDrawRange(0, vertex);
    vertices.needsUpdate = true;
  }

  hoverCell(shop: ShopDocument, cell: FloorCell | null, erase: boolean) {
    this.hover.visible = !!cell;
    if (!cell) return;
    this.hover.material.color.set(erase ? '#c16d79' : '#9160cb');
    this.hover.position.set(cell.x - shop.width / 2 + 0.5, 0.06, cell.z - shop.depth / 2 + 0.5);
  }
}
