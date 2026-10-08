import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CATALOG, getAllowedStocks, type ItemKind, type ProductKind, type ShopItem } from '../model';
import { buildCatalogItem } from './catalogObjects';
import { buildItem, disposeGroup } from './objects';

const kinds: ItemKind[] = ['glass-cabinet', 'display-plinth', 'pegboard', 'food-display', 'drinks-fridge', 'coffee-station', 'prep-counter', 'stove', 'sink', 'dining-table', 'service-cart'];
const entries = CATALOG.filter(entry => kinds.includes(entry.kind));
const makeItem = (kind: ItemKind, width?: number, depth?: number): ShopItem => ({
  id: `catalog-${kind}`, kind, x: 0, z: 0, rotation: 0, color: '#B99BC7',
  stock: getAllowedStocks(kind).find(stock => stock !== 'none') ?? 'none',
  ...(width === undefined ? {} : { width }), ...(depth === undefined ? {} : { depth }),
});

/** The full callback envelope, larger than many individual product meshes. */
function stockEnvelope(parent: THREE.Object3D, _kind: ProductKind, x: number, y: number, z: number) {
  const product = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.48, 0.35), new THREE.MeshStandardMaterial({ color: '#c48f7a' }));
  product.name = 'test-product-envelope'; product.position.set(x, y + 0.24, z); parent.add(product);
}

function bounded(group: THREE.Group, width: number, depth: number) {
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    group.rotation.y = angle; group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    const turned = angle === Math.PI / 2 || angle === Math.PI * 1.5;
    const w = turned ? depth : width, d = turned ? width : depth;
    expect(bounds.min.x).toBeGreaterThanOrEqual(-w / 2 - 0.0001);
    expect(bounds.max.x).toBeLessThanOrEqual(w / 2 + 0.0001);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-d / 2 - 0.0001);
    expect(bounds.max.z).toBeLessThanOrEqual(d / 2 + 0.0001);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.00001);
    expect(bounds.min.y).toBeLessThan(0.05);
    expect(bounds.max.y).toBeGreaterThan(0.65);
    expect(bounds.max.y).toBeLessThan(2.6);
  }
}

function named(group: THREE.Object3D, name: string) {
  const results: THREE.Object3D[] = [];
  group.traverse(object => { if (object.name === name) results.push(object); });
  return results;
}

describe('new floor catalog procedural models', () => {
  it('contains all eleven supported new catalog kinds and delegates old ones', () => {
    expect(entries).toHaveLength(11);
    const callback = vi.fn();
    for (const kind of ['shelf', 'table', 'counter', 'plant', 'chalkboard'] as ItemKind[]) expect(buildCatalogItem(makeItem(kind), callback)).toBeNull();
    expect(callback).not.toHaveBeenCalled();
  });

  for (const mode of ['minimum', 'default', 'enlarged', 'maximum'] as const) {
    it.each(entries)(`$kind contains its structure and full stock envelopes at ${mode} size in every rotation`, entry => {
      const [width, depth] = mode === 'minimum' ? [1, 1] : mode === 'default' ? [entry.width, entry.depth] : mode === 'enlarged' ? [5, 3] : [24, 24];
      const item = makeItem(entry.kind, width, depth);
      const group = buildCatalogItem(item, stockEnvelope)!;
      expect(group).toBeInstanceOf(THREE.Group);
      try {
        bounded(group, width, depth);
        group.traverse(object => { expect(object).not.toBeInstanceOf(THREE.Light); });
      } finally { disposeGroup(group); }
    });
  }

  const details: [ItemKind, string[]][] = [
    ['glass-cabinet', ['vitrine-side-glass', 'vitrine-door-glass', 'vitrine-shelf', 'vitrine-door-handle']],
    ['display-plinth', ['plinth-foot', 'plinth-body', 'plinth-cap', 'plinth-fluting']],
    ['pegboard', ['pegboard-perforations', 'pegboard-hook', 'pegboard-shelf']],
    ['food-display', ['food-case-sloped-glass', 'food-case-shelf', 'food-case-label']],
    ['drinks-fridge', ['fridge-glass-door', 'fridge-shelf', 'fridge-header-label', 'fridge-light-strip']],
    ['coffee-station', ['coffee-machine-casing', 'coffee-machine-back-support', 'coffee-spout', 'grinder-hopper', 'cup-body']],
    ['prep-counter', ['prep-lower-shelf', 'cutting-board', 'prep-knife-blade', 'prep-bowl']],
    ['stove', ['stove-burner', 'stove-burner-ring', 'oven-glass', 'stove-knob']],
    ['sink', ['sink-basin-bottom', 'sink-faucet', 'sink-drain', 'sink-tap']],
    ['dining-table', ['dining-tabletop', 'dining-chair-seat', 'dining-chair-back', 'dining-plate']],
    ['service-cart', ['cart-wheel', 'cart-tray', 'cart-tray-rim', 'cart-push-handle']],
  ];
  it.each(details)('%s has its own modeled functional details', (kind, names) => {
    const group = buildCatalogItem(makeItem(kind), stockEnvelope)!;
    try { for (const name of names) expect(named(group, name).length, name).toBeGreaterThan(0); }
    finally { disposeGroup(group); }
  });

  it.each(entries.filter(entry => entry.stockable))('$kind caps repeated products at large sizes and omits empty stock', entry => {
    const full = vi.fn(stockEnvelope), empty = vi.fn(stockEnvelope);
    const item = makeItem(entry.kind, 24, 24);
    const group = buildCatalogItem(item, full)!;
    const bare = buildCatalogItem({ ...item, stock: 'none' }, empty)!;
    try {
      expect(full.mock.calls.length).toBeGreaterThan(0);
      expect(full.mock.calls.length).toBeLessThanOrEqual(entry.kind === 'food-display' ? 32 : 36);
      expect(empty).not.toHaveBeenCalled();
    } finally { disposeGroup(group); disposeGroup(bare); }
  });

  it('supports the espresso casing continuously from its base at minimum and default sizes', () => {
    for (const width of [1, 2]) {
      const group = buildCatalogItem(makeItem('coffee-station', width, 1), stockEnvelope)!;
      try {
        group.updateMatrixWorld(true);
        const base = new THREE.Box3().setFromObject(group.getObjectByName('coffee-machine-base')!);
        const casing = new THREE.Box3().setFromObject(group.getObjectByName('coffee-machine-casing')!);
        for (const support of [...named(group, 'coffee-machine-back-support'), ...named(group, 'coffee-machine-side-support')]) {
          const bounds = new THREE.Box3().setFromObject(support);
          expect(bounds.min.y).toBeLessThan(base.max.y);
          expect(bounds.max.y).toBeGreaterThan(casing.min.y);
          expect(bounds.min.x).toBeLessThan(casing.max.x);
          expect(bounds.max.x).toBeGreaterThan(casing.min.x);
        }
      } finally { disposeGroup(group); }
    }
  });

  it('has a genuinely recessed sink basin and transparent display glazing', () => {
    const sink = buildCatalogItem(makeItem('sink', 2, 1), stockEnvelope)!;
    const vitrine = buildCatalogItem(makeItem('glass-cabinet'), stockEnvelope)!;
    try {
      sink.updateMatrixWorld(true);
      const hits = new THREE.Raycaster(new THREE.Vector3(-0.2, 3, 0), new THREE.Vector3(0, -1, 0)).intersectObject(sink, true);
      expect(hits[0].point.y).toBeLessThan(0.8);
      expect(hits[0].point.y).toBeGreaterThan(0.7);
      for (const object of named(vitrine, 'vitrine-door-glass')) {
        const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
        expect(mesh.material.transparent).toBe(true);
        expect(mesh.material.opacity).toBeLessThan(0.4);
        expect(mesh.castShadow).toBe(false);
      }
    } finally { disposeGroup(sink); disposeGroup(vitrine); }
  });

  it('uses repeated full-thickness supports when prep and dining surfaces grow', () => {
    for (const kind of ['prep-counter', 'dining-table'] as ItemKind[]) {
      const small = buildCatalogItem(makeItem(kind, 2, 2), stockEnvelope)!;
      const wide = buildCatalogItem(makeItem(kind, 8, 4), stockEnvelope)!;
      try {
        expect(named(wide, 'support-leg').length).toBeGreaterThan(named(small, 'support-leg').length);
        const first = new THREE.Box3().setFromObject(named(small, 'support-leg')[0]);
        const second = new THREE.Box3().setFromObject(named(wide, 'support-leg')[0]);
        expect(second.max.x - second.min.x).toBeCloseTo(first.max.x - first.min.x);
        expect(second.max.z - second.min.z).toBeCloseTo(first.max.z - first.min.z);
      } finally { disposeGroup(small); disposeGroup(wide); }
    }
  });

  it.each([
    ['glass-cabinet', 'books'], ['display-plinth', 'ceramics'], ['pegboard', 'bags'],
    ['food-display', 'pastries'], ['drinks-fridge', 'drinks'], ['service-cart', 'meals'],
  ] as [ItemKind, ProductKind][])('%s fits its actual default %s products at minimum size through root integration', (kind, stock) => {
    const group = buildItem({ ...makeItem(kind, 1, 1), stock });
    try {
      bounded(group, 1, 1);
      expect(group.userData.itemId).toBe(`catalog-${kind}`);
      expect(group.userData.itemSizeBasis).toEqual({ width: 1, depth: 1 });
    } finally { disposeGroup(group); }
  });
});
