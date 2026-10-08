import * as THREE from 'three';
import { getFloorCells, getItemFootprint, getItemPlacementBounds, getWallHeight, getWallItemSize, getWallMountRuns, isStandingSign, wallItemPosition, type ShopDocument, type ShopItem, type WallItem } from '../model';
import { wallInwardNormal } from './interactionWalls';

export type ResizeEdge = 'min-x' | 'max-x' | 'min-z' | 'max-z' | 'min-y' | 'max-y';
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const tenth = (value: number) => Math.round((value + 1e-9) * 10) / 10;

function floorDimensions(item: ShopItem, x: number, z: number, width: number, depth: number): ShopItem {
  const turned = item.rotation === 90 || item.rotation === 270;
  return { ...item, x, z, width: turned ? depth : width, depth: turned ? width : depth };
}

/** Keep the opposite edge fixed, including furniture turned by a quarter turn. */
export function resizeFloorEdge(item: ShopItem, edge: ResizeEdge, coordinate: number): ShopItem {
  const size = getItemFootprint(item);
  let { x, z } = item;
  let { width, depth } = size;
  const boundary = Math.round(coordinate);
  if (edge === 'min-x') { width = clamp(x + width - boundary, 1, 24); x = item.x + size.width - width; }
  if (edge === 'max-x') width = clamp(boundary - x, 1, 24);
  if (edge === 'min-z') { depth = clamp(z + depth - boundary, 1, 24); z = item.z + size.depth - depth; }
  if (edge === 'max-z') depth = clamp(boundary - z, 1, 24);
  return floorDimensions(item, x, z, width, depth);
}

/** A tile chooses the outer corner; tiles before the origin extend the near edge. */
export function resizeFloorToTile(item: ShopItem, tile: { x: number; z: number }): ShopItem {
  const size = getItemFootprint(item);
  const x = Math.min(item.x, tile.x), z = Math.min(item.z, tile.z);
  return floorDimensions(item, x, z,
    clamp((tile.x < item.x ? item.x + size.width : tile.x + 1) - x, 1, 24),
    clamp((tile.z < item.z ? item.z + size.depth : tile.z + 1) - z, 1, 24));
}

export function resizeWallEdge(item: WallItem, edge: ResizeEdge, coordinate: number): WallItem {
  const size = getWallItemSize(item);
  let { width, height } = size;
  let offset = item.offset, mountingHeight = item.height;
  if (edge === 'min-x') { width = tenth(clamp(item.offset + size.width / 2 - coordinate, 0.3, 24)); offset = item.offset + (size.width - width) / 2; }
  if (edge === 'max-x') { width = tenth(clamp(coordinate - (item.offset - size.width / 2), 0.3, 24)); offset = item.offset + (width - size.width) / 2; }
  if (edge === 'min-y') { height = tenth(clamp(item.height + size.height / 2 - coordinate, 0.3, 4.5)); mountingHeight = item.height + (size.height - height) / 2; }
  if (edge === 'max-y') { height = tenth(clamp(coordinate - (item.height - size.height / 2), 0.3, 4.5)); mountingHeight = item.height + (height - size.height) / 2; }
  return edge.endsWith('x')
    ? { ...item, width, offset: tenth(offset) }
    : { ...item, sizeHeight: height, height: tenth(mountingHeight) };
}

export function resizeWallToTile(item: WallItem, along: number, height: number): WallItem {
  const size = getWallItemSize(item);
  const left = item.offset - size.width / 2, bottom = item.height - size.height / 2;
  const horizontal = along < left ? 'min-x' : 'max-x';
  const vertical = height < bottom ? 'min-y' : 'max-y';
  const alongEdge = horizontal === 'min-x' ? Math.floor(along * 2) / 2 : (Math.floor(along * 2) + 1) / 2;
  const topEdge = vertical === 'min-y' ? Math.floor(height * 2) / 2 : (Math.floor(height * 2) + 1) / 2;
  return resizeWallEdge(resizeWallEdge(item, horizontal, alongEdge), vertical, topEdge);
}

export class ObjectResizeTools {
  readonly group = new THREE.Group();
  readonly handles: { edge: ResizeEdge; object: THREE.Group }[] = [];
  readonly targets: { x: number; z?: number; height?: number; point: THREE.Vector3 }[] = [];
  private readonly tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.94, 0.94), new THREE.MeshBasicMaterial({ color: '#9371c2', transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }), 576);
  private readonly outline = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)), new THREE.LineBasicMaterial({ color: '#8058b5', depthTest: false, depthWrite: false }));
  private tileKey = '';

  constructor() {
    this.group.name = 'object-resize-tools';
    this.group.visible = false;
    this.tiles.frustumCulled = false;
    this.tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tiles.count = 0;
    this.outline.frustumCulled = false;
    this.outline.renderOrder = 25;
    this.group.add(this.tiles, this.outline);
    for (const edge of ['min-x', 'max-x', 'min-z', 'max-z', 'min-y', 'max-y'] as ResizeEdge[]) {
      const object = new THREE.Group();
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), new THREE.MeshBasicMaterial({ color: '#8058b5', depthTest: false, depthWrite: false }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.17, 24), new THREE.MeshBasicMaterial({ color: '#fffdf5', depthTest: false, depthWrite: false }));
      dot.renderOrder = ring.renderOrder = 40;
      object.add(dot, ring);
      this.handles.push({ edge, object }); this.group.add(object);
    }
    this.group.traverse(object => { object.raycast = () => undefined; });
  }

  private border(points: THREE.Vector3[], valid: boolean) {
    const positions = this.outline.geometry.getAttribute('position') as THREE.BufferAttribute;
    points.forEach((point, i) => positions.setXYZ(i, point.x, point.y, point.z));
    positions.needsUpdate = true;
    this.outline.material.color.set(valid ? '#8058b5' : '#c45d69');
  }

  private grips(points: Partial<Record<ResizeEdge, THREE.Vector3>>, camera: THREE.Camera, scale: number) {
    for (const { edge, object } of this.handles) {
      const point = points[edge]; object.visible = !!point;
      if (point) object.position.copy(point);
      object.quaternion.copy(camera.quaternion);
      object.scale.setScalar(scale);
    }
  }

  floor(shop: ShopDocument, item: ShopItem, camera: THREE.Camera, scale: number, valid: boolean, y: number, handleItem = item, ground?: { key: string; height: (x: number, z: number) => number }) {
    const size = getItemFootprint(item);
    const x = item.x - shop.width / 2, z = item.z - shop.depth / 2;
    const point = (dx: number, dz: number) => new THREE.Vector3(x + dx, y, z + dz);
    this.border([point(0, 0), point(size.width, 0), point(size.width, size.depth), point(0, size.depth)], valid);
    const gripSize = getItemFootprint(handleItem);
    const gripPoint = (dx: number, dz: number) => new THREE.Vector3(handleItem.x - shop.width / 2 + dx, y, handleItem.z - shop.depth / 2 + dz);
    this.grips({ 'min-x': gripPoint(0, gripSize.depth / 2), 'max-x': gripPoint(gripSize.width, gripSize.depth / 2), 'min-z': gripPoint(gripSize.width / 2, 0), 'max-z': gripPoint(gripSize.width / 2, gripSize.depth) }, camera, scale);
    const tileKey = JSON.stringify(['floor', shop.width, shop.depth, shop.floorCells, isStandingSign(item.kind), ground?.key]);
    if (tileKey === this.tileKey) return;
    this.tileKey = tileKey;
    const cells = getFloorCells(shop);
    if (cells.length && isStandingSign(item.kind)) {
      const bounds = getItemPlacementBounds(shop, item.kind);
      const lastRow = Math.max(...cells.map(cell => cell.z));
      for (let z = lastRow + 1; z <= bounds.maxZ; z++) for (let x = bounds.minX; x <= bounds.maxX; x++) cells.push({ x, z });
    }
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    this.targets.length = 0;
    const matrix = new THREE.Matrix4();
    cells.forEach((cell, i) => {
      const point = new THREE.Vector3(cell.x - shop.width / 2 + 0.5, ground?.height(cell.x, cell.z) ?? 0.052, cell.z - shop.depth / 2 + 0.5);
      this.tiles.setMatrixAt(i, matrix.compose(point, rotation, new THREE.Vector3(1, 1, 1)));
      this.targets.push({ ...cell, point });
    });
    this.tiles.count = cells.length;
    this.tiles.instanceMatrix.needsUpdate = true;
  }

  wall(shop: ShopDocument, item: WallItem, camera: THREE.Camera, scale: number, valid: boolean, handleItem = item) {
    const size = getWallItemSize(item);
    const position = wallItemPosition(shop, item);
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), position.rotation);
    // Saved offsets always increase along world X/Z, even when the front or
    // left mounting rotation reverses the mesh's local X axis.
    const inwardOffset = wallInwardNormal(item.wall).multiplyScalar(0.15);
    const point = (x: number, y: number) => {
      const target = wallItemPosition(shop, { ...item, offset: item.offset + x, height: item.height + y });
      return new THREE.Vector3(target.x, target.y, target.z).add(inwardOffset);
    };
    this.border([point(-size.width / 2, -size.height / 2), point(size.width / 2, -size.height / 2), point(size.width / 2, size.height / 2), point(-size.width / 2, size.height / 2)], valid);
    const gripSize = getWallItemSize(handleItem);
    const dx = handleItem.offset - item.offset, dy = handleItem.height - item.height;
    this.grips({ 'min-x': point(dx - gripSize.width / 2, dy), 'max-x': point(dx + gripSize.width / 2, dy), 'min-y': point(dx, dy - gripSize.height / 2), 'max-y': point(dx, dy + gripSize.height / 2) }, camera, scale);
    const run = getWallMountRuns(shop, item).find(run => run.wall === item.wall && run.line === item.line && run.partitionId === item.partitionId && item.offset >= run.start && item.offset <= run.end);
    const tileKey = JSON.stringify(['wall', shop.width, shop.depth, run, getWallHeight(shop)]);
    if (tileKey === this.tileKey) return;
    this.tileKey = tileKey;
    this.targets.length = 0;
    const matrix = new THREE.Matrix4();
    if (run) for (let along = run.start; along < run.end; along += 0.5) for (let height = 0; height + 0.5 <= getWallHeight(shop) + 0.001; height += 0.5) {
      const target = wallItemPosition(shop, { ...item, offset: along + 0.25, height: height + 0.25 });
      const point = new THREE.Vector3(0, 0, 0.04).applyQuaternion(rotation).add(new THREE.Vector3(target.x, target.y, target.z));
      this.tiles.setMatrixAt(this.targets.length, matrix.compose(point, rotation, new THREE.Vector3(0.5, 0.5, 1)));
      this.targets.push({ x: along + 0.25, height: height + 0.25, point });
    }
    this.tiles.count = this.targets.length;
    this.tiles.instanceMatrix.needsUpdate = true;
  }
}
