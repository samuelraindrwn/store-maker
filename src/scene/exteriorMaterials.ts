import * as THREE from 'three';
import type { ExteriorDesign, WallSide } from '../model';

/** A small owned texture tiles in metres, keeping mortar aligned around openings. */
export function createBrickTexture(color: string): THREE.DataTexture {
  const width = 128, height = 64, data = new Uint8Array(width * height * 4);
  const brick = new THREE.Color(color).convertLinearToSRGB();
  const mortar = brick.clone().lerp(new THREE.Color('#fff3de').convertLinearToSRGB(), 0.65);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const row = Math.floor(y / 32), shifted = (x + row * 32) % width, column = Math.floor(shifted / 64);
    const seam = y % 32 < 2 || shifted % 64 < 2;
    const variation = 0.92 + ((row * 3 + column * 5) % 4) * 0.026;
    const source = seam ? mortar : brick;
    const inset = !seam && (y % 32 === 2 || shifted % 64 === 2) ? 0.88 : 1;
    const light = seam ? 1 : variation * inset;
    data.set([Math.round(source.r * light * 255), Math.round(source.g * light * 255), Math.round(source.b * light * 255), 255], (y * width + x) * 4);
  }
  const texture = new THREE.DataTexture(data, width, height);
  texture.name = 'exterior-brick-texture'; texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Apply only to existing solid wall geometry, so doors and every window stay open. */
export function applyExteriorBrickwork(walls: THREE.Object3D, facade: ExteriorDesign) {
  if (facade.wallMaterial !== 'brick') return;
  let brick: THREE.MeshStandardMaterial | undefined;
  const point = new THREE.Vector3();
  walls.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)
      || !['structural-wall-panel', 'exterior-wall-panel', 'structural-window-spandrel'].includes(object.name)) return;
    const side = object.userData.wall as WallSide;
    if (!['front', 'back', 'left', 'right'].includes(side)) return;
    brick ??= new THREE.MeshStandardMaterial({ map: createBrickTexture(facade.wallColor), roughness: 0.94 });
    brick.name = 'exterior-brick-material';
    const base = object.material;
    const positions = object.geometry.getAttribute('position'), uv = object.geometry.getAttribute('uv');
    object.updateWorldMatrix(true, false);
    for (let index = 0; index < positions.count; index++) {
      point.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
      uv.setXY(index, (side === 'front' || side === 'back' ? point.x : point.z) / 0.88, point.y / 0.4);
    }
    uv.needsUpdate = true;
    if (object.name === 'structural-window-spandrel') object.material = [brick, base];
    else {
      const face = { right: 0, left: 1, front: 4, back: 5 }[side];
      object.material = Array.from({ length: 6 }, (_, index) => index === face ? brick! : base);
    }
    object.userData.exteriorWallMaterial = 'brick';
  });
}

/** Shared by the authored building and the active editable exterior room. */
export function applyExteriorWallMaterial(walls: THREE.Object3D, facade: ExteriorDesign) {
  walls.traverse(object => {
    if (object.userData.wallCoping && object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) object.material.color.set(facade.trimColor);
  });
  applyExteriorBrickwork(walls, facade);
}
