import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MAX_LOCAL_LIGHTS, NightLighting, type NightLightTag } from './lighting';
import { disposeGroup } from './objects';

function fixture() {
  const scene = new THREE.Scene();
  const renderer = { toneMappingExposure: 1.12 };
  const ground = new THREE.MeshStandardMaterial({ color: '#e8edf0' });
  const rig = new NightLighting(scene, renderer, ground);
  const shop = new THREE.Group(), wall = new THREE.Group(), city = new THREE.Group();
  scene.add(shop, wall, city);
  return { scene, renderer, ground, rig, shop, wall, city,
    dispose() { rig.dispose(); disposeGroup(scene); ground.dispose(); },
  };
}

function anchor(parent: THREE.Object3D, overrides: Partial<NightLightTag> = {}) {
  const object = new THREE.Object3D();
  object.userData.nightLight = { color: '#ffd79b', dayIntensity: 0, nightIntensity: 5, distance: 4, kind: 'shop', ...overrides } satisfies NightLightTag;
  parent.add(object);
  return object;
}

describe('fixed night lighting rig', () => {
  it('preserves the exact daylight palette, illumination, exposure, fog, and shadow rig', () => {
    const f = fixture();
    try {
      expect(f.rig.mode).toBe('day'); expect(f.rig.nightProgress).toBe(0);
      expect((f.scene.background as THREE.Color).getHexString()).toBe('e8edf0');
      expect((f.scene.fog as THREE.Fog).color.getHexString()).toBe('e8edf0');
      expect([(f.scene.fog as THREE.Fog).near, (f.scene.fog as THREE.Fog).far]).toEqual([32, 70]);
      expect(f.ground.color.getHexString()).toBe('c9d1bd');
      expect(f.rig.hemisphere.color.getHexString()).toBe('fff6e8');
      expect(f.rig.hemisphere.groundColor.getHexString()).toBe('ada3b7');
      expect(f.rig.hemisphere.intensity).toBe(2.4);
      expect(f.rig.sun.color.getHexString()).toBe('fff1db');
      expect(f.rig.sun.intensity).toBe(3.1);
      expect(f.rig.sun.position.toArray()).toEqual([-4, 11, 7]);
      expect(f.rig.fill.color.getHexString()).toBe('d6d2ff');
      expect(f.rig.fill.intensity).toBe(1.15);
      expect(f.rig.fill.position.toArray()).toEqual([7, 5, -3]);
      expect(f.renderer.toneMappingExposure).toBe(1.12);
      expect(f.rig.sun.castShadow).toBe(true);
      expect(f.rig.sun.shadow.mapSize.toArray()).toEqual([2048, 2048]);
      expect(f.rig.localLights.every(light => !light.castShadow && light.visible && light.intensity === 0)).toBe(true);
    } finally { f.dispose(); }
  });

  it('eases to night in 0.8 seconds, keeps usable ambient light, and stops requesting idle renders', () => {
    const f = fixture();
    try {
      f.rig.update(0); expect(f.rig.update(0.016)).toBe(false);
      f.rig.setMode(true);
      expect(f.rig.mode).toBe('night'); expect(f.rig.nightProgress).toBe(0);
      expect(f.rig.update(0.4)).toBe(true);
      expect(f.rig.nightProgress).toBeCloseTo(0.5);
      expect(f.ground.color.getHexString()).toBe('c9d1bd');
      expect(f.rig.update(0.4)).toBe(true);
      expect(f.rig.nightProgress).toBe(1);
      expect(f.ground.color.getHexString()).toBe('c9d1bd');
      expect((f.scene.background as THREE.Color).getHexString()).toBe('111b31');
      expect(f.rig.hemisphere.intensity).toBeGreaterThanOrEqual(1);
      expect(f.rig.sun.intensity + f.rig.fill.intensity).toBeGreaterThan(0.9);
      expect(f.rig.update(0.016, true)).toBe(false);
      expect(f.rig.update(5)).toBe(false);
      f.rig.setMode(false); f.rig.update(0.8);
      expect(f.rig.nightProgress).toBe(0);
      expect(f.renderer.toneMappingExposure).toBe(1.12);
      expect((f.scene.background as THREE.Color).getHexString()).toBe('e8edf0');
    } finally { f.dispose(); }
  });

  it('reverses from the current shade without flashing and supports reduced-motion snapping', () => {
    const f = fixture();
    try {
      f.rig.setMode(true); f.rig.update(0.25);
      const previous = f.rig.nightProgress;
      f.rig.setMode(false);
      expect(f.rig.nightProgress).toBe(previous);
      f.rig.update(0.1);
      expect(f.rig.nightProgress).toBeGreaterThan(0);
      expect(f.rig.nightProgress).toBeLessThan(previous);
      f.rig.setMode(true, true); f.rig.update(0);
      expect(f.rig.nightProgress).toBe(1);
      expect(f.rig.update(0.1)).toBe(false);
      f.rig.setMode(false, true); f.rig.update(0);
      expect(f.rig.nightProgress).toBe(0);
    } finally { f.dispose(); }
  });

  it('caps real lights at eight with shop priority, zero-intensity unused slots, and no light reallocation', () => {
    const f = fixture();
    try {
      const identities = f.rig.localLights.map(light => light.uuid);
      for (let i = 0; i < 12; i++) anchor(f.shop).position.x = i;
      for (let i = 0; i < 3; i++) anchor(f.city, { kind: 'street' }).position.z = i;
      f.rig.refreshSources([f.city, f.shop]); f.rig.setMode(true, true); f.rig.update(0);
      expect(f.rig.activeShopLights).toBe(MAX_LOCAL_LIGHTS);
      expect(f.rig.activeCityLights).toBe(0);
      expect(f.rig.localLights.map(light => light.position.x)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      f.shop.visible = false; f.rig.update(0, true);
      expect(f.rig.activeShopLights).toBe(0); expect(f.rig.activeCityLights).toBe(3);
      expect(f.rig.localLights.filter(light => light.intensity === 0)).toHaveLength(5);
      f.city.visible = false; f.rig.update(0, true);
      expect(f.rig.activeCityLights).toBe(0);
      expect(f.rig.localLights.every(light => light.visible && light.intensity === 0)).toBe(true);
      expect(f.rig.localLights.map(light => light.uuid)).toEqual(identities);
      const pointLights: THREE.PointLight[] = [];
      f.scene.traverse(object => { if (object instanceof THREE.PointLight) pointLights.push(object); });
      expect(pointLights).toHaveLength(8);
    } finally { f.dispose(); }
  });

  it('tracks floor/wall lamp counts through ancestor visibility without counting editor ghosts', () => {
    const f = fixture();
    try {
      anchor(f.shop, { dayIntensity: 0.5, distance: 2.8 });
      const litWall = new THREE.Group(); litWall.userData.wallItemId = 'lit-wall'; f.wall.add(litWall); anchor(litWall);
      // An unlit wall lamp has no tag; a tagged editor ghost is deliberately not a source root.
      f.wall.add(new THREE.Object3D()); anchor(f.scene);
      anchor(f.city, { kind: 'street' });
      f.rig.refreshSources([f.shop, f.wall, f.city]); f.rig.update(0);
      expect(f.rig.activeShopLights).toBe(1);
      expect(f.rig.localLights[0].intensity).toBe(0.5);
      expect(f.rig.localLights[0].distance).toBe(2.8);
      f.rig.setMode(true, true); f.rig.update(0);
      expect([f.rig.activeShopLights, f.rig.activeFloorLights, f.rig.activeWallLights, f.rig.activeCityLights]).toEqual([2, 1, 1, 1]);
      f.wall.visible = false; f.rig.update(0, true);
      expect([f.rig.activeShopLights, f.rig.activeWallLights]).toEqual([1, 0]);
      f.city.visible = false; f.rig.update(0, true);
      expect([f.rig.activeShopLights, f.rig.activeCityLights]).toEqual([1, 0]);
    } finally { f.dispose(); }
  });

  it('moves pooled lights with translated, rotated, and resized parent meshes without rescanning', () => {
    const f = fixture();
    try {
      const lamp = new THREE.Group(); f.shop.add(lamp);
      const source = anchor(lamp); source.position.set(0.2, 1.5, 0.3);
      f.rig.refreshSources([f.shop]); f.rig.setMode(true, true); f.rig.update(0);
      lamp.position.set(3, 0.038, -2); lamp.rotation.y = Math.PI / 2; lamp.scale.set(3, 1, 2);
      expect(f.rig.update(0, true)).toBe(true);
      expect(f.rig.localLights[0].position.distanceTo(source.getWorldPosition(new THREE.Vector3()))).toBeLessThan(0.000001);
      expect(f.rig.update(0, true)).toBe(false);
    } finally { f.dispose(); }
  });

  it('restores authored daytime glow after night content refresh and fades tagged pools', () => {
    const f = fixture();
    const material = new THREE.MeshStandardMaterial({ color: '#fff4df', emissive: '#eebb66', emissiveIntensity: 0.14 });
    material.userData.nightGlow = { color: '#ffc36d', dayIntensity: 0.14, nightIntensity: 1.6 };
    const poolMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
    poolMaterial.userData.nightOpacity = { day: 0, night: 0.36 };
    f.shop.add(new THREE.Mesh(new THREE.BoxGeometry(), material), new THREE.Mesh(new THREE.PlaneGeometry(), poolMaterial));
    try {
      f.rig.refreshSources([f.shop]); f.rig.setMode(true); f.rig.update(0.4);
      expect(material.emissiveIntensity).toBeCloseTo(0.87);
      expect(poolMaterial.opacity).toBeCloseTo(0.18);
      f.rig.update(0.4); f.rig.refreshSources([f.shop]);
      expect(material.emissive.getHexString()).toBe('ffc36d');
      f.rig.setMode(false); f.rig.update(0.8);
      expect(material.emissive.getHexString()).toBe('eebb66');
      expect(material.emissiveIntensity).toBe(0.14);
      expect(poolMaterial.opacity).toBe(0);
    } finally { f.dispose(); }
  });

  it('renders exports in the selected mode and restores the transition even when export throws', () => {
    const f = fixture();
    try {
      anchor(f.shop); f.rig.refreshSources([f.shop]); f.rig.setMode(true); f.rig.update(0.2);
      const previous = f.rig.nightProgress, exposure = f.renderer.toneMappingExposure, intensity = f.rig.localLights[0].intensity;
      expect(f.rig.capture(() => {
        expect(f.rig.nightProgress).toBe(1);
        expect(f.rig.localLights[0].intensity).toBe(5);
        return 'png';
      })).toBe('png');
      expect(f.rig.nightProgress).toBe(previous);
      expect(f.renderer.toneMappingExposure).toBe(exposure);
      expect(f.rig.localLights[0].intensity).toBe(intensity);
      expect(() => f.rig.capture(() => { throw new Error('capture failed'); })).toThrow('capture failed');
      expect(f.rig.nightProgress).toBe(previous);
      f.rig.update(0.6); expect(f.rig.nightProgress).toBe(1);
    } finally { f.dispose(); }
  });

  it('drops removed emitters on a content rebuild while allowing night in a blank city or bare area', () => {
    const f = fixture();
    try {
      anchor(f.shop); anchor(f.city, { kind: 'street' });
      f.rig.refreshSources([f.shop, f.wall, f.city]); f.rig.setMode(true, true); f.rig.update(0);
      f.shop.clear(); f.rig.refreshSources([f.shop, f.wall, f.city]); f.rig.update(0);
      expect(f.rig.activeShopLights).toBe(0); expect(f.rig.activeCityLights).toBe(1);
      f.city.visible = false; f.rig.update(0, true);
      expect(f.rig.activeCityLights).toBe(0);
      expect(f.rig.localLights.every(light => Number.isFinite(light.intensity) && light.position.toArray().every(Number.isFinite))).toBe(true);
      expect(f.rig.nightProgress).toBe(1);
    } finally { f.dispose(); }
  });
});
