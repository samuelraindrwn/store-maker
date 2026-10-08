import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createEmptyShop, createWallItem, getWallItemSize, wallItemPosition, type ShopDocument, type WallItem, type WallLampStyle, type WallSignStyle } from '../model';
import { buildBuilding, buildInteriorContext } from './buildingObjects';
import { applyWallItemSize, buildWallItem, disposeGroup } from './objects';

describe('authored exterior finishes', () => {
  it.each(['fascia', 'projecting'] as WallSignStyle[])('builds a lit %s sign with visible text faces, live dimensions and an independent off switch', wallSignStyle => {
    const item = { ...createWallItem('wall-sign'), width: 3.2, sizeHeight: 0.8, wallSignStyle, lit: true };
    const group = buildWallItem(item), off = buildWallItem({ ...item, lit: false });
    try {
      const faces: THREE.Object3D[] = [];
      group.traverse(object => { if (object.name === 'store-sign-face') faces.push(object); });
      expect(faces).toHaveLength(wallSignStyle === 'projecting' ? 2 : 1);
      expect(group.getObjectByName('wall-sign-light-anchor')).toBeDefined();
      expect(off.getObjectByName('wall-sign-light-anchor')).toBeUndefined();
      const original = new THREE.Box3().setFromObject(group);
      applyWallItemSize(group, { ...item, width: 1.6, sizeHeight: 0.4 });
      const resized = new THREE.Box3().setFromObject(group), size = getWallItemSize({ ...item, width: 1.6, sizeHeight: 0.4 });
      expect(resized.max.z).toBeLessThanOrEqual(size.depth + 0.00001);
      expect(resized.max.y - resized.min.y).toBeCloseTo((original.max.y - original.min.y) / 2);
      if (wallSignStyle === 'projecting') expect(resized.max.z).toBeCloseTo(original.max.z / 2);
      off.traverse(object => {
        if (object instanceof THREE.Mesh) expect((object.material as THREE.Material).userData.nightGlow).toBeUndefined();
      });
    } finally { disposeGroup(group); disposeGroup(off); }
  });

  it('shows exterior signs and lamps on their saved outer face and shares windows with the interior', () => {
    const interior = { ...createWallItem('wall-sign'), id: 'inside', offset: 2 };
    const exterior = { ...interior, id: 'outside', mount: 'exterior' as const };
    const window = { ...createWallItem('window'), id: 'shared-window', offset: 5 };
    const lamp = { ...createWallItem('wall-lamp'), id: 'outside-lamp', offset: 2, height: 2.4, mount: 'exterior' as const, wallLampStyle: 'lantern' as const };
    const doc: ShopDocument = { ...createEmptyShop(), wallItems: [interior, exterior, window, lamp], upperFloors: [createEmptyShop()] };
    const building = buildBuilding(doc), context = buildInteriorContext(doc, 1);
    try {
      expect(building.getObjectByName('wall-item:inside')).toBeUndefined();
      expect(context.getObjectByName('wall-item:outside')).toBeUndefined();
      expect(context.getObjectByName('wall-item:inside')).toBeDefined();
      for (const id of ['outside', 'outside-lamp', 'shared-window']) expect(building.getObjectByName(`wall-item:${id}`)).toBeDefined();
      expect(context.getObjectByName('wall-item:shared-window')).toBeDefined();
      const sign = building.getObjectByName('wall-item:outside')!, point = wallItemPosition(doc, exterior);
      expect(sign.position.toArray()).toEqual([point.x, point.y, point.z]);
      expect(sign.rotation.y).toBe(point.rotation);
    } finally { disposeGroup(building); disposeGroup(context); }
  });

  it.each(['classic', 'arched'] as const)('keeps the %s window aperture open with disposable brick textures at consistent scale', windowStyle => {
    const window: WallItem = { ...createWallItem('window'), id: 'window', wall: 'back', offset: 3, windowStyle };
    const doc: ShopDocument = { ...createEmptyShop(), wallItems: [window], exterior: { wallColor: '#bd8468', trimColor: '#a3a092', awning: true, wallMaterial: 'brick' } };
    const building = buildBuilding(doc);
    const textures = new Set<THREE.Texture>();
    let disposed = 0;
    try {
      const panels: THREE.Mesh[] = [];
      building.traverse(object => {
        if (!(object instanceof THREE.Mesh) || object.userData.exteriorWallMaterial !== 'brick') return;
        panels.push(object);
        const materials = object.material as THREE.MeshStandardMaterial[];
        for (const material of materials) if (material.map) textures.add(material.map);
        expect(materials.filter(material => material.name === 'exterior-brick-material')).toHaveLength(1);
      });
      expect(panels.length).toBeGreaterThan(4);
      expect(textures.size).toBe(1);
      for (const texture of textures) {
        expect(texture).toBeInstanceOf(THREE.DataTexture);
        expect(texture.wrapS).toBe(THREE.RepeatWrapping);
        texture.addEventListener('dispose', () => disposed++);
      }
      building.updateMatrixWorld(true);
      const p = wallItemPosition(doc, window);
      const ray = new THREE.Raycaster(new THREE.Vector3(p.x, p.y, p.z - 0.5), new THREE.Vector3(0, 0, 1), 0, 0.8);
      expect(ray.intersectObjects(panels, false)).toHaveLength(0);
      ray.ray.origin.x += 1.3;
      expect(ray.intersectObjects(panels, false).length).toBeGreaterThan(0);
    } finally { disposeGroup(building); }
    expect(disposed).toBe(1);
  });

  it.each(['sconce', 'lantern', 'bulkhead'] as WallLampStyle[])('builds a distinct %s lamp with one sized emission point and no direct GPU lights', wallLampStyle => {
    const item = { ...createWallItem('wall-lamp'), wallLampStyle, lit: true, mount: 'exterior' as const };
    const group = buildWallItem(item), off = buildWallItem({ ...item, lit: false });
    try {
      const geometryName = { sconce: 'wall-item-content', lantern: 'lantern-roof', bulkhead: 'bulkhead-rim' }[wallLampStyle];
      expect(group.getObjectByName(geometryName)).toBeDefined();
      let lights = 0, anchors = 0;
      group.traverse(object => { if (object instanceof THREE.Light) lights++; if (object.userData.nightLight) anchors++; });
      expect(lights).toBe(0); expect(anchors).toBe(1);
      const bounds = new THREE.Box3().setFromObject(group), size = getWallItemSize(item);
      expect(bounds.max.z).toBeLessThanOrEqual(size.depth + 0.00001);
      expect(bounds.max.x - bounds.min.x).toBeLessThanOrEqual(size.width + 0.00001);
      expect(bounds.max.y - bounds.min.y).toBeLessThanOrEqual(size.height + 0.00001);
      expect(off.getObjectByName('wall-lamp-light-anchor')).toBeUndefined();
      expect(off.getObjectByName('wall-lamp-light-pool')).toBeUndefined();
    } finally { disposeGroup(group); disposeGroup(off); }
  });
});
