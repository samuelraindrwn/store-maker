import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createBlankShop, createEmptyShop, createInitialShop, getFloorBounds, type ShopDocument } from '../model';
import { CozyBackdrop } from './CozyBackdrop';
import { buildCity } from './city';
import { disposeGroup } from './objects';
import { buildSkyline } from './skyline';

describe('cozy sky backdrop', () => {
  it('fills the viewport without intercepting editing rays or writing depth', () => {
    const sky = new CozyBackdrop();
    try {
      expect(sky.mesh.frustumCulled).toBe(false);
      expect(sky.mesh.material.depthTest).toBe(false);
      expect(sky.mesh.material.depthWrite).toBe(false);
      expect(sky.mesh.renderOrder).toBeLessThan(0);
      expect(new THREE.Raycaster(new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, -1)).intersectObject(sky.mesh)).toEqual([]);
      sky.resize(0, 0);
      expect(sky.mesh.material.uniforms.uAspect.value).toBe(1);
      sky.resize(1600, 900);
      expect(sky.mesh.material.uniforms.uAspect.value).toBeCloseTo(16 / 9);
      sky.setNightProgress(NaN);
      expect(sky.mesh.material.uniforms.uNight.value).toBe(0);
      sky.setNightProgress(1.5);
      expect(sky.mesh.material.uniforms.uNight.value).toBe(1);
    } finally { sky.dispose(); }
  });

  it('updates ground bounds and lighting uniforms without recompiling or replacing GPU resources', () => {
    const sky = new CozyBackdrop();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial());
    try {
      sky.configureGround(ground, createEmptyShop());
      const version = ground.material.version;
      const material = sky.mesh.material, geometry = sky.mesh.geometry;
      const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader } as Parameters<THREE.Material['onBeforeCompile']>[0];
      ground.material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
      const uniforms = shader.uniforms as Record<string, THREE.IUniform>;
      const previousCenter = uniforms.uBackdropGroundCenter.value.clone();
      const shifted = { ...createEmptyShop(), floorCells: [{ x: -4, z: 8 }, { x: -3, z: 8 }] };
      sky.configureGround(ground, shifted);
      for (const progress of [0, 0.2, 0.7, 1, 0.4]) sky.setNightProgress(progress);
      sky.setView('top');
      expect(uniforms.uBackdropGroundCenter.value.equals(previousCenter)).toBe(false);
      expect(ground.material.version).toBe(version);
      expect(sky.mesh.material).toBe(material);
      expect(sky.mesh.geometry).toBe(geometry);
      expect(ground.material.transparent).toBe(true);
      expect(ground.material.depthWrite).toBe(false);
      expect(shader.fragmentShader).toContain('diffuseColor.a *=');
    } finally { sky.dispose(); ground.geometry.dispose(); ground.material.dispose(); }
  });

  it('restores borrowed ground settings and disposes owned resources exactly once', () => {
    const sky = new CozyBackdrop();
    const scene = new THREE.Scene();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial());
    const compile = ground.material.onBeforeCompile, cacheKey = ground.material.customProgramCacheKey;
    const geometryDispose = vi.fn(), materialDispose = vi.fn(), groundDispose = vi.fn();
    sky.mesh.geometry.addEventListener('dispose', geometryDispose);
    sky.mesh.material.addEventListener('dispose', materialDispose);
    ground.material.addEventListener('dispose', groundDispose);
    scene.add(sky.mesh);
    sky.configureGround(ground, createEmptyShop());
    sky.dispose(); sky.dispose();
    expect(scene.children).not.toContain(sky.mesh);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(groundDispose).not.toHaveBeenCalled();
    expect(ground.material.onBeforeCompile).toBe(compile);
    expect(ground.material.customProgramCacheKey).toBe(cacheKey);
    expect(ground.material.transparent).toBe(false);
    expect(ground.material.depthWrite).toBe(true);
    expect(ground.renderOrder).toBe(0);
    ground.geometry.dispose(); ground.material.dispose();
  });

  it('finishes the ground fade at the real city base edge rather than leaving a dark strip outside it', () => {
    const shop = createInitialShop(), city = buildCity(shop), sky = new CozyBackdrop();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial());
    try {
      sky.configureGround(ground, shop);
      const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader } as Parameters<THREE.Material['onBeforeCompile']>[0];
      ground.material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
      const size = new THREE.Vector3(), position = new THREE.Vector3(), matrix = new THREE.Matrix4();
      (city.getObjectByName('city-box') as THREE.InstancedMesh).getMatrixAt(0, matrix);
      matrix.decompose(position, new THREE.Quaternion(), size);
      const half = shader.uniforms.uBackdropGroundHalfSize.value as THREE.Vector2;
      const center = shader.uniforms.uBackdropGroundCenter.value as THREE.Vector2;
      const fade = shader.uniforms.uBackdropGroundFeather.value as number;
      expect(half.x + fade).toBeCloseTo(size.x / 2);
      expect(half.y + fade).toBeCloseTo(size.z / 2);
      expect(center.x).toBeCloseTo(position.x);
      expect(center.y).toBeCloseTo(position.z);
    } finally { sky.dispose(); disposeGroup(city); ground.geometry.dispose(); ground.material.dispose(); }
  });
});

type Neighbor = { name: string; x: number; z: number; width: number; depth: number; height: number };
const fixtures: [string, ShopDocument][] = [
  ['default', createInitialShop()], ['empty', createEmptyShop()], ['blank', createBlankShop()],
  ['one offset tile', { ...createEmptyShop(), floorCells: [{ x: -3, z: 7 }] }],
  ['wide footprint', { ...createEmptyShop(), floorCells: Array.from({ length: 24 }, (_, x) => ({ x: x - 8, z: 0 })) }],
];

describe('larger surrounding architecture', () => {
  it.each(fixtures)('keeps neighboring shops separate from each other and the %s shop', (_label, shop) => {
    const city = buildCity(shop);
    try {
      const neighbors = city.userData.shopBounds as Neighbor[];
      const floor = getFloorBounds(shop);
      const left = floor.minX - shop.width / 2, right = floor.maxX + 1 - shop.width / 2;
      const back = floor.minZ - shop.depth / 2, front = floor.maxZ + 1 - shop.depth / 2;
      expect(neighbors).toHaveLength(10);
      expect(Math.max(...neighbors.map(neighbor => neighbor.height))).toBeGreaterThan(6.5);
      for (const neighbor of neighbors) {
        const minX = neighbor.x - neighbor.width / 2, maxX = neighbor.x + neighbor.width / 2;
        const minZ = neighbor.z - neighbor.depth / 2, maxZ = neighbor.z + neighbor.depth / 2;
        expect(maxX < left || minX > right || maxZ < back || minZ > front, neighbor.name).toBe(true);
        for (const other of neighbors) {
          if (neighbor === other) continue;
          // Include a little eave clearance, not just the wall boxes.
          const separateX = Math.abs(neighbor.x - other.x) > (neighbor.width + other.width) / 2 + 0.28;
          const separateZ = Math.abs(neighbor.z - other.z) > (neighbor.depth + other.depth) / 2 + 0.28;
          expect(separateX || separateZ, `${neighbor.name} / ${other.name}`).toBe(true);
        }
      }
    } finally { disposeGroup(city); }
  });

  it('extends the skyline width and height while retaining four instanced draw calls', () => {
    const skyline = buildSkyline(createInitialShop());
    try {
      const bounds = new THREE.Box3().setFromObject(skyline);
      const size = bounds.getSize(new THREE.Vector3());
      expect(size.y).toBeGreaterThan(12);
      expect(Math.max(size.x, size.z)).toBeGreaterThan(50);
      expect(skyline.children).toHaveLength(4);
      expect(skyline.children.every(object => object instanceof THREE.InstancedMesh)).toBe(true);
      expect(skyline.userData.towerCount).toBe(16);
    } finally { disposeGroup(skyline); }
  });
});
