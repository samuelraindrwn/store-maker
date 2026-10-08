import * as THREE from 'three';
import { getInteriorDoors, getInteriorDoorPosition, getInteriorDoorSize, getPartitions, getPartitionPosition, getWallHeight, type InteriorDoor, type ShopDocument } from '../model';
import { wallPanels } from './wallGeometry';

function block(parent: THREE.Group, name: string, width: number, height: number, depth: number, color: string, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color, roughness: 0.78 }));
  object.name = name; object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object);
  return object;
}

/** A separate movable leaf leaves the structural wall's aperture genuinely open. */
export function buildInteriorDoor(shop: ShopDocument, door: InteriorDoor) {
  const group = new THREE.Group(); group.name = `interior-door:${door.id}`;
  const point = getInteriorDoorPosition(shop, door);
  if (!point) return group;
  const size = getInteriorDoorSize(shop, door), w = size.width, h = size.height;
  group.position.set(point.x, 0, point.z); group.rotation.y = point.rotation;
  const frameColor = '#b29b80', frame = 0.07;
  for (const x of [-w / 2 + frame / 2, w / 2 - frame / 2]) block(group, 'interior-door-jamb', frame, h, 0.19, frameColor, x, h / 2);
  block(group, 'interior-door-header', w, frame, 0.19, frameColor, 0, h - frame / 2);
  const pivot = new THREE.Group(); pivot.name = 'interior-door-pivot';
  pivot.position.set(-w / 2 + frame, 0, 0); pivot.rotation.y = door.open ? -Math.PI / 2 : 0; group.add(pivot);
  const leafWidth = w - frame * 2 - 0.018, leafHeight = h - frame - 0.038;
  block(pivot, 'interior-door-leaf', leafWidth, leafHeight, 0.055, door.color, leafWidth / 2, 0.028 + leafHeight / 2);
  const inset = `#${new THREE.Color(door.color).multiplyScalar(1.12).getHexString()}`;
  for (const face of [-1, 1]) {
    block(pivot, 'interior-door-inset', Math.max(0.2, leafWidth - 0.18), leafHeight * 0.55, 0.009, inset, leafWidth / 2, leafHeight * 0.66, face * 0.032);
    block(pivot, 'interior-door-inset', Math.max(0.2, leafWidth - 0.18), leafHeight * 0.22, 0.009, inset, leafWidth / 2, leafHeight * 0.20, face * 0.032);
    block(pivot, 'interior-door-handle-plate', 0.055, 0.15, 0.012, '#ab8b55', leafWidth - 0.095, h * 0.45, face * 0.039);
    block(pivot, 'interior-door-handle', 0.13, 0.027, 0.042, '#d4b67b', leafWidth - 0.135, h * 0.45, face * 0.062);
  }
  group.traverse(object => {
    object.userData.partitionId = door.wallId;
    object.userData.interiorDoorId = door.id;
    object.userData.interaction = 'interior-door';
  });
  return group;
}

/** Partition walls and their real door openings share one saved layout on every view. */
export function buildInteriorPartitions(shop: ShopDocument) {
  const group = new THREE.Group(); group.name = 'interior-partitions';
  const height = getWallHeight(shop), doors = getInteriorDoors(shop);
  for (const partition of getPartitions(shop)) {
    const wall = new THREE.Group(); wall.name = `partition:${partition.id}`;
    const position = getPartitionPosition(shop, partition), center = (partition.start + partition.end) / 2;
    const direction = partition.axis === 'x' ? 1 : -1;
    wall.position.set(position.x, 0, position.z); wall.rotation.y = position.rotation;
    const openings = doors.filter(door => door.wallId === partition.id).map(door => {
      const size = getInteriorDoorSize(shop, door);
      return { start: door.offset - size.width / 2, end: door.offset + size.width / 2, bottom: 0, top: size.height };
    });
    for (const panel of wallPanels(partition.start, partition.end, height, openings)) {
      const object = block(wall, 'partition-wall-panel', panel.end - panel.start, panel.top - panel.bottom, 0.13, partition.color,
        direction * ((panel.start + panel.end) / 2 - center), (panel.bottom + panel.top) / 2);
      object.userData.wallPanel = { bottom: panel.bottom, top: panel.top, ceiling: panel.top === height };
    }
    block(wall, 'partition-wall-coping', position.length + 0.03, 0.08, 0.17, '#e4d4bf', 0, height + 0.015).userData.partitionCoping = true;
    for (const panel of wallPanels(partition.start, partition.end, 0.10, openings)) for (const face of [-1, 1]) {
      block(wall, 'partition-wall-plinth', panel.end - panel.start, panel.top - panel.bottom, 0.025, '#c6b3a2',
        direction * ((panel.start + panel.end) / 2 - center), (panel.bottom + panel.top) / 2, face * 0.0775);
    }
    wall.traverse(object => { object.userData.partitionId = partition.id; object.userData.interaction = 'partition'; });
    group.add(wall);
  }
  for (const door of doors) group.add(buildInteriorDoor(shop, door));
  return group;
}
