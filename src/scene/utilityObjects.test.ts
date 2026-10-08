import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createItem, type ItemKind } from '../model';
import { applyItemSize, buildItem, disposeGroup } from './objects';
import { buildUtilityItem } from './utilityObjects';

const fixtures: { kind: ItemKind; detail: string[]; colored: string; height: number }[] = [
  { kind: 'toilet', detail: ['toilet-tank', 'toilet-seat', 'toilet-seat-opening', 'toilet-flush-button'], colored: 'toilet-tank', height: 0.75 },
  { kind: 'washbasin', detail: ['washbasin-cabinet', 'washbasin-basin', 'washbasin-faucet', 'washbasin-mirror'], colored: 'washbasin-cabinet', height: 1.7 },
  { kind: 'shower', detail: ['shower-tray', 'shower-drain', 'shower-head', 'shower-glass'], colored: 'shower-screen-frame', height: 2.1 },
];

describe('separate bathroom fixtures', () => {
  it.each(fixtures)('$kind is a recognizable independently selectable fixture within one floor cell', ({ kind, detail, colored, height }) => {
    const item = { ...createItem(kind), id: `fixture-${kind}`, color: '#9eabc4' }, group = buildItem(item);
    try {
      expect(group.name).toBe(`item:${item.id}`);
      expect(group.userData.itemId).toBe(item.id);
      expect(group.userData.itemSizeBasis).toEqual({ width: 1, depth: 1 });
      for (const name of detail) expect(group.getObjectByName(name)).toBeDefined();
      const surface = group.getObjectByName(colored) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      expect(surface.material.color.getHexString()).toBe('9eabc4');
      for (const rotation of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        group.rotation.y = rotation;
        const bounds = new THREE.Box3().setFromObject(group);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-0.5);
        expect(bounds.max.x).toBeLessThanOrEqual(0.5);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-0.5);
        expect(bounds.max.z).toBeLessThanOrEqual(0.5);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
        expect(bounds.max.y).toBeGreaterThan(height);
      }
      // The new fixture does not quietly bring the old bundled room with it.
      expect(group.getObjectByName('bathroom-back-wall')).toBeUndefined();
      expect(group.getObjectByName('bathroom-privacy-wall')).toBeUndefined();
      expect(group.getObjectByName('bathroom-door-header')).toBeUndefined();
    } finally { disposeGroup(group); }
  });

  it.each(fixtures)('$kind resizes horizontally without stretching its height or replacing resources', ({ kind }) => {
    const item = createItem(kind), group = buildUtilityItem(item)!;
    const original = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    const first = group.children[0] as THREE.Mesh, geometry = first.geometry;
    try {
      applyItemSize(group, { ...item, width: 3, depth: 2 });
      const resized = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
      expect(resized.x).toBeCloseTo(original.x * 3);
      expect(resized.z).toBeCloseTo(original.z * 2);
      expect(resized.y).toBeCloseTo(original.y);
      expect(first.geometry).toBe(geometry);
      applyItemSize(group, item);
      expect(new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).toArray()).toEqual(original.toArray());
    } finally { disposeGroup(group); }
  });

  it('leaves legacy bathroom modules and other furniture on their original renderer', () => {
    expect(buildUtilityItem(createItem('bathroom'))).toBeNull();
    expect(buildUtilityItem(createItem('sink'))).toBeNull();
    const legacy = buildItem(createItem('bathroom'));
    try {
      expect(legacy.getObjectByName('bathroom-back-wall')).toBeDefined();
      expect(legacy.getObjectByName('bathroom-basin')).toBeDefined();
      expect(legacy.getObjectByName('toilet-seat')).toBeDefined();
    } finally { disposeGroup(legacy); }
  });
});
