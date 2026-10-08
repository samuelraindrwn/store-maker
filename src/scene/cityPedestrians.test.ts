import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createEmptyShop } from '../model';
import { buildCity, getCityPedestrianState, setCityTimeOfDay, updateCityPedestrians } from './city';
import { CityPedestrians, PEDESTRIAN_TRANSITION_SECONDS } from './cityPedestrians';
import { disposeGroup } from './objects';

const bounds = { left: -5, right: 5, back: -4.5, front: 4.5, centerX: 0 };
function position(crowd: CityPedestrians, instance = 0) {
  const mesh = crowd.group.getObjectByName('city-pedestrian-sphere') as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(instance, matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix);
}

describe('neighbourhood daily routine', () => {
  it('walks to nearby entrances at night, stays indoors, and walks back out in the morning', () => {
    const crowd = new CityPedestrians(bounds);
    try {
      const outside = position(crowd);
      expect(crowd.state).toEqual({ phase: 'outside', visible: 6, total: 6 });
      expect(crowd.update(1)).toBe(false);
      crowd.setMode(true);
      expect(crowd.state.phase).toBe('going-home');
      crowd.update(2);
      expect(position(crowd).distanceTo(outside)).toBeGreaterThan(0.5);
      expect(crowd.group.visible).toBe(true);
      crowd.update(PEDESTRIAN_TRANSITION_SECONDS);
      expect(crowd.state).toEqual({ phase: 'home', visible: 0, total: 6 });
      expect(crowd.group.visible).toBe(false);
      expect(crowd.update(100)).toBe(false);
      crowd.setMode(false);
      expect(crowd.group.visible).toBe(true);
      expect(crowd.state.phase).toBe('coming-out');
      crowd.update(2);
      expect(crowd.state.visible).toBe(6);
      expect(position(crowd).distanceTo(outside)).toBeGreaterThan(0.5);
      crowd.update(PEDESTRIAN_TRANSITION_SECONDS);
      expect(crowd.state).toEqual({ phase: 'outside', visible: 6, total: 6 });
      expect(position(crowd).distanceTo(outside)).toBeLessThan(0.00001);
      expect(crowd.update(1)).toBe(false);
    } finally { disposeGroup(crowd.group); }
  });

  it('continues an interrupted route without teleporting or restarting on unrelated scene updates', () => {
    const crowd = new CityPedestrians(bounds);
    try {
      const outside = position(crowd);
      crowd.setMode(true); crowd.update(3);
      const halfway = position(crowd);
      crowd.setMode(true);
      expect(position(crowd)).toEqual(halfway);
      crowd.setMode(false);
      const reversed = position(crowd);
      expect(reversed.x).toBeCloseTo(halfway.x);
      expect(reversed.z).toBeCloseTo(halfway.z);
      crowd.update(2);
      expect(position(crowd).distanceTo(outside)).toBeLessThan(halfway.distanceTo(outside));
      crowd.update(10);
      expect(crowd.state.phase).toBe('outside');
      expect(position(crowd)).toEqual(outside);
    } finally { disposeGroup(crowd.group); }
  });

  it('snaps to a resumed night or reduced-motion preference and reuses exactly three GPU batches', () => {
    const crowd = new CityPedestrians(bounds);
    try {
      const meshes = crowd.group.children.slice();
      const resources = meshes.map(mesh => {
        const instance = mesh as THREE.InstancedMesh;
        return [instance.geometry, instance.material, instance.instanceMatrix, instance.instanceColor];
      });
      crowd.setMode(true, true);
      expect(crowd.state.phase).toBe('home');
      expect(crowd.group.visible).toBe(false);
      expect(crowd.update(2)).toBe(false);
      for (let index = 0; index < 5; index++) {
        crowd.setMode(false); crowd.update(20); crowd.setMode(true); crowd.update(20);
      }
      crowd.setMode(false, true);
      expect(crowd.state.phase).toBe('outside');
      expect(crowd.group.children).toEqual(meshes);
      expect(meshes).toHaveLength(3);
      meshes.forEach((mesh, index) => {
        const instance = mesh as THREE.InstancedMesh;
        expect([instance.geometry, instance.material, instance.instanceMatrix, instance.instanceColor]).toEqual(resources[index]);
      });
    } finally { disposeGroup(crowd.group); }
  });

  it('keeps pedestrians outside editing hit tests and respects the city parent visibility', () => {
    const city = buildCity(createEmptyShop());
    try {
      const crowd = city.getObjectByName('city-pedestrians')!;
      expect(getCityPedestrianState(city)?.visible).toBe(6);
      const hits: THREE.Intersection[] = [];
      crowd.traverse(object => { expect(object.userData.environment).toBe(true); object.raycast(new THREE.Raycaster(), hits); });
      expect(hits).toEqual([]);
      setCityTimeOfDay(city, true, true);
      expect(getCityPedestrianState(city)?.visible).toBe(0);
      city.visible = false;
      setCityTimeOfDay(city, false);
      expect(updateCityPedestrians(city, 20)).toBe(true);
      expect(city.visible).toBe(false);
      expect(getCityPedestrianState(city)?.phase).toBe('outside');
    } finally { disposeGroup(city); }
  });
});
