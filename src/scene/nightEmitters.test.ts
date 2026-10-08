import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBlankShop, createEmptyShop, createItem, createWallItem } from '../model';
import { applyWallItemSize, buildItem, buildWallItem, disposeGroup } from './objects';
import { buildCity } from './city';
import { buildSkyline } from './skyline';

function emitters(group: THREE.Object3D) {
  const anchors: THREE.Object3D[] = [];
  group.traverse(object => {
    expect(object).not.toBeInstanceOf(THREE.Light);
    if (object.userData.nightLight) anchors.push(object);
  });
  return anchors;
}

function materials(group: THREE.Object3D) {
  const found = new Set<THREE.Material>();
  group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) found.add(material);
    }
  });
  return [...found];
}

function named(group: THREE.Object3D, name: string) {
  const found: THREE.Object3D[] = [];
  group.traverse(object => { if (object.name === name) found.push(object); });
  return found;
}

function resources(group: THREE.Object3D) {
  const found = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture | THREE.InstancedMesh>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    found.add(object.geometry);
    if (object instanceof THREE.InstancedMesh) found.add(object);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      found.add(material);
      if ('map' in material && material.map instanceof THREE.Texture) found.add(material.map);
    }
  });
  return found;
}

describe('owned night emitters and emissive surfaces', () => {
  it('replaces the floor lamp light with one pooled-light anchor while retaining daytime light and glow', () => {
    const group = buildItem(createItem('lamp'));
    try {
      const [anchor] = emitters(group);
      expect(emitters(group)).toHaveLength(1);
      expect(anchor.position.toArray()).toEqual([0, 1.5, 0]);
      expect(anchor.userData.nightLight).toMatchObject({ kind: 'shop', color: '#ffd79b', dayIntensity: 0.5, distance: 2.8 });
      expect(anchor.userData.nightLight.nightIntensity).toBeGreaterThan(anchor.userData.nightLight.dayIntensity);
      const glows = materials(group).filter(material => material.userData.nightGlow) as THREE.MeshStandardMaterial[];
      expect(glows).toHaveLength(2);
      expect(glows.map(material => material.userData.nightGlow.dayIntensity).sort()).toEqual([0, 0.14]);
      for (const material of glows) {
        const tag = material.userData.nightGlow;
        const originalEmission = Math.max(material.emissive.r, material.emissive.g, material.emissive.b) * material.emissiveIntensity;
        const taggedEmission = Math.max(...new THREE.Color(tag.color).toArray()) * tag.dayIntensity;
        expect(taggedEmission).toBeCloseTo(originalEmission);
        expect(tag.nightIntensity).toBeGreaterThan(tag.dayIntensity);
      }
      const before = new THREE.Box3().setFromObject(group);
      anchor.removeFromParent();
      expect(new THREE.Box3().setFromObject(group).equals(before)).toBe(true);
    } finally { disposeGroup(group); }
  });

  it('keeps a wall emitter at the actual bulb through mounting transforms and live resizing', () => {
    const item = { ...createWallItem('wall-lamp'), lit: true };
    const group = buildWallItem(item);
    try {
      const [anchor] = emitters(group);
      expect(emitters(group)).toHaveLength(1);
      const bulb = named(group, 'wall-item-content')[0].children.find(object => object instanceof THREE.Mesh && object.geometry instanceof THREE.SphereGeometry)!;
      group.position.set(3, 1.7, -2); group.rotation.y = Math.PI / 2;
      for (const [width, sizeHeight] of [[0.45, 0.7], [1.8, 2.1]]) {
        applyWallItemSize(group, { ...item, width, sizeHeight });
        group.updateMatrixWorld(true);
        expect(anchor.getWorldPosition(new THREE.Vector3()).distanceTo(bulb.getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-8);
      }
      expect(anchor.userData.nightLight).toMatchObject({ kind: 'shop', dayIntensity: 0 });
      const glows = materials(group).filter(material => material.userData.nightGlow) as THREE.MeshStandardMaterial[];
      expect(glows.map(material => material.userData.nightGlow.dayIntensity).sort()).toEqual([0.5, 1.4]);
      for (const material of glows) expect(material.emissiveIntensity).toBe(material.userData.nightGlow.dayIntensity);
      const pool = group.getObjectByName('wall-lamp-light-pool') as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
      expect(pool.material.userData.nightOpacity).toEqual({ day: 1, night: 1 });
      expect(pool.material.opacity).toBe(1);
    } finally { disposeGroup(group); }
  });

  it('never relights a switched-off wall lamp via emitter, glow, or opacity metadata', () => {
    const group = buildWallItem({ ...createWallItem('wall-lamp'), lit: false });
    try {
      expect(emitters(group)).toHaveLength(0);
      expect(group.getObjectByName('wall-lamp-light-pool')).toBeUndefined();
      for (const material of materials(group)) {
        expect(material.userData.nightGlow).toBeUndefined();
        expect(material.userData.nightOpacity).toBeUndefined();
        if (material instanceof THREE.MeshStandardMaterial) {
          expect(Math.max(...material.emissive.toArray()) * material.emissiveIntensity).toBe(0);
        }
      }
    } finally { disposeGroup(group); }
  });

  it('tags only the fridge light strip without allocating a direct light or altering the footprint', () => {
    const group = buildItem({ ...createItem('drinks-fridge'), stock: 'none' });
    try {
      expect(emitters(group)).toHaveLength(0);
      const strip = group.getObjectByName('fridge-light-strip') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      expect(strip.material.userData.nightGlow).toEqual({ color: '#fff0b3', dayIntensity: 0.4, nightIntensity: 1.2 });
      expect(strip.material.emissiveIntensity).toBe(0.4);
      expect(materials(group).filter(material => material.userData.nightGlow)).toEqual([strip.material]);
      const bounds = new THREE.Box3().setFromObject(group);
      expect(bounds.min.x).toBeGreaterThanOrEqual(-0.5); expect(bounds.max.x).toBeLessThanOrEqual(0.5);
      expect(bounds.min.z).toBeGreaterThanOrEqual(-0.5); expect(bounds.max.z).toBeLessThanOrEqual(0.5);
    } finally { disposeGroup(group); }
  });

  it('separates city windows from opaque building batches and retains the street bulb daytime glow', () => {
    const city = buildCity(createEmptyShop());
    try {
      expect(emitters(city)).toHaveLength(3);
      for (const anchor of emitters(city)) expect(anchor.userData.nightLight).toMatchObject({ kind: 'street', dayIntensity: 0 });
      const solids = city.getObjectByName('city-box') as THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
      const glass = city.getObjectByName('city-window') as THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
      const bulbs = city.getObjectByName('city-glow') as THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      expect(glass.count).toBeGreaterThan(40);
      expect(solids.material.userData.nightGlow).toBeUndefined();
      expect(glass.material.userData.nightGlow).toMatchObject({ dayIntensity: 0 });
      expect(glass.material.userData.nightGlow.nightIntensity).toBeGreaterThan(0);
      expect(bulbs.material.emissiveIntensity).toBe(0.7);
      expect(bulbs.material.userData.nightGlow).toEqual({ color: '#ffde98', dayIntensity: 0.7, nightIntensity: 2.2 });
    } finally { disposeGroup(city); }
  });

  it('places soft, non-pickable street pools on their own surfaces and clips before the lower road', () => {
    const shop = createEmptyShop();
    const city = buildCity(shop);
    try {
      const pools = named(city, 'street-lamp-light-pool') as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[];
      expect(pools).toHaveLength(3);
      city.updateMatrixWorld(true);
      for (const pool of pools) {
        expect(pool.material.opacity).toBe(0);
        expect(pool.material.userData.nightOpacity).toEqual({ day: 0, night: 0.3 });
        expect(pool.material.depthWrite).toBe(false);
        expect(pool.material.map).toBeInstanceOf(THREE.DataTexture);
        expect(pool.castShadow).toBe(false);
        expect(new THREE.Raycaster(pool.position.clone().add(new THREE.Vector3(0, 10, 0)), new THREE.Vector3(0, -1, 0)).intersectObject(pool)).toEqual([]);
        const data = (pool.material.map as THREE.DataTexture).image.data!;
        const alpha = Array.from(data).filter((_, index) => index % 4 === 3);
        expect(Math.min(...alpha)).toBe(0); expect(Math.max(...alpha)).toBeGreaterThan(200);
      }
      for (const pool of pools.slice(0, 2)) {
        expect(pool.position.y).toBeCloseTo(-0.067);
        expect(new THREE.Box3().setFromObject(pool).max.z).toBeLessThan(shop.depth / 2 + 2.055);
      }
      expect(pools[2].position.y).toBeCloseTo(-0.247);
      expect(new Set(pools.map(pool => pool.material.map)).size).toBe(3);
    } finally { disposeGroup(city); }
  });

  it('keeps deterministic warm skyline windows to a minority and at most four instanced draw calls', () => {
    const first = buildSkyline(createEmptyShop());
    const second = buildSkyline(createEmptyShop());
    try {
      expect(emitters(first)).toHaveLength(0);
      expect(first.children).toHaveLength(4);
      const lit = first.getObjectByName('skyline-lit-window') as THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
      const dark = first.getObjectByName('skyline-window') as THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
      const fraction = lit.count / (lit.count + dark.count);
      expect(fraction).toBeGreaterThanOrEqual(0.3); expect(fraction).toBeLessThanOrEqual(0.45);
      expect(lit.material.userData.nightGlow).toMatchObject({ dayIntensity: 0 });
      expect(materials(first).filter(material => material.userData.nightGlow)).toEqual([lit.material]);
      for (const object of first.children) {
        expect(object).toBeInstanceOf(THREE.InstancedMesh);
        const a = object as THREE.InstancedMesh;
        const b = second.getObjectByName(a.name) as THREE.InstancedMesh;
        expect(Array.from(a.instanceMatrix.array)).toEqual(Array.from(b.instanceMatrix.array));
        expect(Array.from(a.instanceColor!.array)).toEqual(Array.from(b.instanceColor!.array));
        expect(a.castShadow).toBe(false);
      }
    } finally { disposeGroup(first); disposeGroup(second); }
  });

  it.each([
    ['lamp', () => buildItem(createItem('lamp'))],
    ['wall lamp', () => buildWallItem({ ...createWallItem('wall-lamp'), lit: true })],
    ['city', () => buildCity(createBlankShop())],
  ] as const)('owns and releases every %s resource across rebuilds, including pool textures', (_name, build) => {
    const first = build();
    const second = build();
    const previous = resources(first);
    const current = resources(second);
    expect([...current].some(resource => previous.has(resource))).toBe(false);
    const disposed = new Map<unknown, number>();
    for (const resource of previous) {
      const recordDisposal = () => { disposed.set(resource, (disposed.get(resource) ?? 0) + 1); };
      if (resource instanceof THREE.InstancedMesh) resource.addEventListener('dispose', recordDisposal);
      else resource.addEventListener('dispose', recordDisposal);
    }
    try {
      disposeGroup(first);
      expect(disposed.size).toBe(previous.size);
      expect([...disposed.values()].every(count => count === 1)).toBe(true);
      expect(first.children).toEqual([]);
      expect(second.children.length).toBeGreaterThan(0);
      expect(resources(second).size).toBe(current.size);
    } finally { disposeGroup(second); }
  });
});
