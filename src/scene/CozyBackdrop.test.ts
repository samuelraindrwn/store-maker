import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createBlankShop, createEmptyShop, createInitialShop, getFloorBounds, type ShopDocument } from '../model';
import { CozyBackdrop } from './CozyBackdrop';
import { buildCity } from './city';
import { disposeGroup } from './objects';
import { buildSkyline } from './skyline';

function createGround(width = 180, depth = 180) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial());
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.401;
  return ground;
}

function createCamera(position: [number, number, number], target: [number, number, number], zoom = 1, span = 30) {
  const camera = new THREE.OrthographicCamera(-span, span, span / 1.6, -span / 1.6, 0.1, 100);
  camera.position.set(...position);
  camera.lookAt(new THREE.Vector3(...target));
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

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

  it('keeps opaque terrain and reuses the lighting material as the camera and time change', () => {
    const sky = new CozyBackdrop();
    const ground = createGround();
    const groundMaterial = ground.material, groundGeometry = ground.geometry;
    const compile = ground.material.onBeforeCompile, cacheKey = ground.material.customProgramCacheKey;
    try {
      sky.configureGround(ground);
      const version = ground.material.version;
      const material = sky.mesh.material, geometry = sky.mesh.geometry;
      const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader } as Parameters<THREE.Material['onBeforeCompile']>[0];
      ground.material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
      for (const progress of [0, 0.2, 0.7, 1, 0.4]) {
        sky.setNightProgress(progress);
        sky.configureGround(ground);
        sky.updateGround(createCamera([150 * progress + 10.5, 8.8, 13.5], [150 * progress, 0, 0], 0.55));
      }
      sky.setView('top');
      expect(ground.material.version).toBe(version);
      expect(ground.material).toBe(groundMaterial);
      expect(ground.geometry).toBe(groundGeometry);
      expect(ground.material.onBeforeCompile).toBe(compile);
      expect(ground.material.customProgramCacheKey).toBe(cacheKey);
      expect(sky.mesh.material).toBe(material);
      expect(sky.mesh.geometry).toBe(geometry);
      expect(ground.material.transparent).toBe(false);
      expect(ground.material.depthWrite).toBe(true);
      expect(ground.material.opacity).toBe(1);
      expect(shader.fragmentShader).not.toContain('uBackdropGround');
      expect(shader.fragmentShader).not.toContain('diffuseColor.a *=');
    } finally { sky.dispose(); ground.geometry.dispose(); ground.material.dispose(); }
  });

  it('restores borrowed ground settings and disposes owned resources exactly once', () => {
    const sky = new CozyBackdrop();
    const scene = new THREE.Scene();
    const ground = createGround();
    ground.material.transparent = true;
    ground.material.depthWrite = false;
    ground.material.opacity = 0.37;
    ground.renderOrder = 8;
    ground.position.set(13, -12, -17);
    ground.scale.set(1.2, 0.8, 1);
    const originalScale = ground.scale.clone();
    const compile = ground.material.onBeforeCompile, cacheKey = ground.material.customProgramCacheKey;
    const geometryDispose = vi.fn(), materialDispose = vi.fn(), groundDispose = vi.fn();
    sky.mesh.geometry.addEventListener('dispose', geometryDispose);
    sky.mesh.material.addEventListener('dispose', materialDispose);
    ground.material.addEventListener('dispose', groundDispose);
    scene.add(sky.mesh);
    sky.configureGround(ground);
    sky.updateGround(createCamera([210, 8.8, 13.5], [200, 0, 0], 0.55));
    ground.position.y = -14;
    sky.dispose(); sky.dispose();
    expect(scene.children).not.toContain(sky.mesh);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(groundDispose).not.toHaveBeenCalled();
    expect(ground.material.onBeforeCompile).toBe(compile);
    expect(ground.material.customProgramCacheKey).toBe(cacheKey);
    expect(ground.material.transparent).toBe(true);
    expect(ground.material.depthWrite).toBe(false);
    expect(ground.material.opacity).toBe(0.37);
    expect(ground.renderOrder).toBe(8);
    expect(ground.position.toArray()).toEqual([13, -14, -17]);
    expect(ground.scale.equals(originalScale)).toBe(true);
    ground.geometry.dispose(); ground.material.dispose();
  });

  const cameraCases: [string, [number, number, number], [number, number, number], number, number][] = [
    ['normal orbit', [10.5, 8.8, 13.5], [0, 3.5, 0], 1, 0],
    ['opposite orbit at minimum zoom', [-15, 10, -18], [0, 1, 0], 0.55, 0],
    ['shallow orbit', [0, 1.4, 20], [0, 0, 0], 0.55, 0],
    ['front view', [0.4, 7.4, 20], [0, 0.6, 0], 0.55, 0],
    ['top view', [0, 18, 0.001], [0, 0, 0], 0.55, 0],
    ['panned far outside the original plane', [410.5, 8.8, -286.5], [400, 0, -300], 0.55, 0],
    ['four-storey rooftop after a pan', [-179.5, 8.8, 163.5], [-190, 0, 150], 0.55, 15],
  ];
  it.each(cameraCases)('supports every visible ground ray in %s', (_name, position, target, zoom, floorY) => {
    const sky = new CozyBackdrop();
    // A non-square input catches scaling the wrong local axis after the plane rotates.
    const ground = createGround(80, 30);
    const camera = createCamera(position, target, zoom);
    ground.position.y -= floorY;
    try {
      sky.configureGround(ground);
      sky.updateGround(camera);
      ground.updateMatrixWorld();
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ground.position.y);
      let supportedRays = 0;
      for (const x of [-1, -0.5, 0, 0.5, 1]) for (const y of [-1, -0.5, 0, 0.5, 1]) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
        const expected = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
        if (!expected || Math.abs(expected.clone().project(camera).z) > 1) continue;
        const hit = raycaster.intersectObject(ground)[0];
        expect(hit, `visible ground at viewport ${x}, ${y}`).toBeDefined();
        expect(hit.point.distanceTo(expected)).toBeLessThan(0.0001);
        supportedRays++;
      }
      expect(supportedRays).toBeGreaterThan(0);
      expect(ground.position.y).toBeCloseTo(-0.401 - floorY);
      const bounds = new THREE.Box3().setFromObject(ground);
      expect(bounds.min.x).toBeLessThanOrEqual(-40);
      expect(bounds.max.x).toBeGreaterThanOrEqual(40);
      expect(bounds.min.z).toBeLessThanOrEqual(-15);
      expect(bounds.max.z).toBeGreaterThanOrEqual(15);
    } finally { sky.dispose(); ground.geometry.dispose(); ground.material.dispose(); }
  });
});

type Neighbor = { name: string; x: number; z: number; width: number; depth: number; height: number };
const fixtures: [string, ShopDocument][] = [
  ['default', createInitialShop()], ['empty', createEmptyShop()], ['blank', createBlankShop()],
  ['one offset tile', { ...createEmptyShop(), floorCells: [{ x: -3, z: 7 }] }],
  ['wide footprint', { ...createEmptyShop(), floorCells: Array.from({ length: 24 }, (_, x) => ({ x: x - 8, z: 0 })) }],
];

describe('larger surrounding architecture', () => {
  it.each(fixtures)('keeps land below the entire %s skyline at ground and rooftop elevations', (_label, shop) => {
    const skyline = buildSkyline(shop), sky = new CozyBackdrop(), ground = createGround();
    try {
      sky.configureGround(ground);
      for (const floorY of [0, 15]) {
        skyline.position.y = -floorY;
        ground.position.y = -0.401 - floorY;
        sky.updateGround(createCamera([10.5, 8.8, 13.5], [0, 0, 0], 0.55));
        ground.updateMatrixWorld();
        const skylineBounds = new THREE.Box3().setFromObject(skyline);
        for (const x of [skylineBounds.min.x, skylineBounds.max.x]) for (const z of [skylineBounds.min.z, skylineBounds.max.z]) {
          const raycaster = new THREE.Raycaster(new THREE.Vector3(x, skylineBounds.min.y + 0.5, z), new THREE.Vector3(0, -1, 0));
          const hit = raycaster.intersectObject(ground)[0];
          expect(hit, `terrain beneath skyline at ${x}, ${z}`).toBeDefined();
          // Some facade trim extends slightly below grade; terrain may bury it,
          // but no tower footprint should be left suspended above the ground.
          expect(skylineBounds.min.y - hit.point.y).toBeGreaterThan(-0.25);
          expect(skylineBounds.min.y - hit.point.y).toBeLessThan(0.02);
        }
        expect(ground.material.opacity).toBe(1);
        expect(ground.material.transparent).toBe(false);
      }
    } finally { sky.dispose(); disposeGroup(skyline); ground.geometry.dispose(); ground.material.dispose(); }
  });

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
