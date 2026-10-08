import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createItem, type ProductKind } from '../model';
import { buildItem, disposeGroup } from './objects';
import { buildStockProduct } from './stockObjects';

const products = ['shoes', 'bags', 'skincare', 'toys', 'bread', 'pastries', 'drinks', 'fruit', 'meals', 'snacks'] as const;
const EPSILON = 0.00001;

function productMeshes(group: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  group.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
  return meshes;
}

describe.each(products)('compact %s stock geometry', kind => {
  it.each([0, 1, 2, 3, 4, 5])('builds a nonempty named product within its display envelope for seed %s', seed => {
    const parent = new THREE.Group();
    try {
      expect(buildStockProduct(parent, kind, 0, 0, 0, seed)).toBe(true);
      expect(parent.children).toHaveLength(1);
      const group = parent.children[0];
      expect(group).toBeInstanceOf(THREE.Group);
      expect(group.name).toBe(`stock:${kind}`);
      const meshes = productMeshes(group);
      expect(meshes.length).toBeGreaterThan(0);
      for (const mesh of meshes) {
        expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
        expect(mesh.visible).toBe(true);
        expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      }
      const bounds = new THREE.Box3().setFromObject(group);
      expect(bounds.isEmpty()).toBe(false);
      expect(bounds.min.x).toBeGreaterThanOrEqual(-0.175 - EPSILON);
      expect(bounds.max.x).toBeLessThanOrEqual(0.175 + EPSILON);
      expect(bounds.min.z).toBeGreaterThanOrEqual(-0.175 - EPSILON);
      expect(bounds.max.z).toBeLessThanOrEqual(0.175 + EPSILON);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-EPSILON);
      expect(bounds.max.y).toBeLessThanOrEqual(0.48 + EPSILON);
      expect(bounds.max.y - bounds.min.y).toBeGreaterThan(0.05);
    } finally { disposeGroup(parent); }
  });
});

describe('stock dispatch and placement', () => {
  it('gives every product category a distinct named group with separately owned render resources', () => {
    const parent = new THREE.Group();
    try {
      products.forEach((kind, index) => expect(buildStockProduct(parent, kind, index, 0, 0, 0)).toBe(true));
      expect(parent.children.map(group => group.name)).toEqual(products.map(kind => `stock:${kind}`));
      expect(new Set(parent.children.map(group => group.name)).size).toBe(products.length);
      expect(new Set(parent.children.map(group => group.uuid)).size).toBe(products.length);
      const geometries = parent.children.map(group => productMeshes(group)[0].geometry);
      const materials = parent.children.map(group => productMeshes(group)[0].material);
      expect(new Set(geometries).size).toBe(products.length);
      expect(new Set(materials).size).toBe(products.length);
      const remaining = parent.children.slice(1);
      disposeGroup(parent.children[0]);
      expect(parent.children).toEqual(remaining);
      for (const group of remaining) expect(new THREE.Box3().setFromObject(group).isEmpty()).toBe(false);
    } finally { disposeGroup(parent); }
  });

  it.each<ProductKind>(['books', 'ceramics', 'plants', 'fashion', 'vinyl', 'none'])('leaves legacy stock %s to its existing renderer without adding objects', kind => {
    const parent = new THREE.Group();
    const existing = new THREE.Group();
    existing.name = 'existing-content';
    parent.add(existing);
    const add = vi.spyOn(parent, 'add');
    try {
      for (const seed of [0, 1, 2, 3, 4, 5]) expect(buildStockProduct(parent, kind, 1, 2, 3, seed)).toBe(false);
      expect(add).not.toHaveBeenCalled();
      expect(parent.children).toEqual([existing]);
    } finally { add.mockRestore(); disposeGroup(parent); }
  });

  it.each(['bags', 'pastries', 'drinks'] as const)('applies the supplied position exactly once for %s', kind => {
    const origin = new THREE.Group();
    const translated = new THREE.Group();
    const offset = new THREE.Vector3(1.375, 2.25, -3.625);
    try {
      buildStockProduct(origin, kind, 0, 0, 0, 4);
      buildStockProduct(translated, kind, offset.x, offset.y, offset.z, 4);
      expect(translated.children[0].position.toArray()).toEqual(offset.toArray());
      expect(translated.children[0].scale.toArray()).toEqual([1, 1, 1]);
      const before = new THREE.Box3().setFromObject(origin);
      const after = new THREE.Box3().setFromObject(translated);
      expect(after.min.distanceTo(before.min.clone().add(offset))).toBeLessThan(EPSILON);
      expect(after.max.distanceTo(before.max.clone().add(offset))).toBeLessThan(EPSILON);
    } finally { disposeGroup(origin); disposeGroup(translated); }
  });
});

describe.each(['shelf', 'table', 'rack'] as const)('new stock on a minimum-size %s', kind => {
  it.each(products)('renders %s within the one-by-one furniture footprint', stock => {
    const item = { ...createItem(kind), width: 1, depth: 1, stock };
    const group = buildItem(item);
    try {
      const products: THREE.Object3D[] = [];
      group.traverse(object => { if (object.name === `stock:${stock}`) products.push(object); });
      expect(products.length).toBeGreaterThan(0);
      const bounds = new THREE.Box3();
      for (const product of products) {
        expect(productMeshes(product).length).toBeGreaterThan(0);
        bounds.union(new THREE.Box3().setFromObject(product));
      }
      expect(bounds.min.x).toBeGreaterThanOrEqual(-0.5 - EPSILON);
      expect(bounds.max.x).toBeLessThanOrEqual(0.5 + EPSILON);
      expect(bounds.min.z).toBeGreaterThanOrEqual(-0.5 - EPSILON);
      expect(bounds.max.z).toBeLessThanOrEqual(0.5 + EPSILON);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-EPSILON);
      expect(bounds.isEmpty()).toBe(false);
    } finally { disposeGroup(group); }
  });
});
