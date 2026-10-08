import * as THREE from 'three';

/** Local XY is the dial; +Z points into the room, matching other wall accessories. */
export function buildWallClock(width: number, height: number, color: string): THREE.Group {
  const clock = new THREE.Group();
  clock.name = 'wall-clock';
  clock.userData.gameClock = true;
  clock.scale.set(width, height, 1);
  const rim = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const face = new THREE.MeshStandardMaterial({ color: '#FFF4DB', roughness: 0.95 });
  const ink = new THREE.MeshStandardMaterial({ color: '#534652', roughness: 0.8 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, z: number) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = z;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    clock.add(mesh);
    return mesh;
  };

  const caseMesh = add(new THREE.CylinderGeometry(0.5, 0.5, 0.085, 48), rim, 0.043);
  caseMesh.rotation.x = Math.PI / 2;
  add(new THREE.CircleGeometry(0.445, 48), face, 0.095);
  add(new THREE.TorusGeometry(0.468, 0.022, 8, 48), rim, 0.09);
  for (let index = 0; index < 12; index++) {
    const angle = index * Math.PI / 6;
    const tick = add(new THREE.BoxGeometry(index % 3 === 0 ? 0.021 : 0.012, index % 3 === 0 ? 0.067 : 0.038, 0.004), ink, 0.099);
    tick.position.x = Math.sin(angle) * 0.355;
    tick.position.y = Math.cos(angle) * 0.355;
    tick.rotation.z = -angle;
    tick.castShadow = false;
  }

  const hand = (name: string, length: number, thickness: number, z: number) => {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.z = z;
    const pointer = new THREE.Mesh(new THREE.BoxGeometry(thickness, length, 0.004), ink);
    pointer.position.y = length / 2 - 0.025;
    pointer.castShadow = false;
    pivot.add(pointer);
    clock.add(pivot);
  };
  hand('game-clock-hour', 0.235, 0.032, 0.106);
  hand('game-clock-minute', 0.335, 0.019, 0.111);
  add(new THREE.CircleGeometry(0.031, 16), rim, 0.118).castShadow = false;
  setWallClockTime(clock, 6 * 60);
  return clock;
}

/** Update only the hand transforms; never recreate geometry or touch materials. */
export function setWallClockTime(root: THREE.Object3D, gameMinutes: number): void {
  if (!Number.isFinite(gameMinutes)) return;
  const minutes = ((gameMinutes % 1440) + 1440) % 1440;
  root.traverse(object => {
    if (!object.userData.gameClock) return;
    const hour = object.getObjectByName('game-clock-hour');
    const minute = object.getObjectByName('game-clock-minute');
    if (hour) hour.rotation.z = -(minutes % 720) / 720 * Math.PI * 2;
    if (minute) minute.rotation.z = -(minutes % 60) / 60 * Math.PI * 2;
  });
}
