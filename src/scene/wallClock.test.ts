import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { canPlaceWallItem, createEmptyShop, createInitialShop, createWallItem, getWallItemSize, parseShop, placeWallItem, updateWallItem } from '../model';
import { applyWallItemSize, buildWallItem, disposeGroup } from './objects';
import { buildWallClock, setWallClockTime } from './wallClock';

describe('authored wall clocks', () => {
  it('adds a valid clock to the example without changing existing saved designs', () => {
    const example = createInitialShop();
    const clock = example.wallItems!.find(item => item.kind === 'wall-clock')!;
    expect(clock).toMatchObject({ id: 'ground-wall-clock', wall: 'back', offset: 2.5, height: 2.35 });
    for (const item of example.wallItems!) expect(canPlaceWallItem(example, item, item.id)).toBe(true);
    expect(parseShop(JSON.stringify(example))?.wallItems).toEqual(example.wallItems);
    const savedWithoutClock = { ...example, wallItems: example.wallItems!.filter(item => item.kind !== 'wall-clock') };
    expect(parseShop(JSON.stringify(savedWithoutClock))?.wallItems).toEqual(savedWithoutClock.wallItems);
  });

  it.each(['back', 'left', 'front', 'right'] as const)('places, resizes and saves a clock on the %s wall', wall => {
    const item = { ...createWallItem('wall-clock'), wall, line: wall === 'front' ? 6 : wall === 'right' ? 7 : 0, offset: 2, height: 1.7 };
    const placed = placeWallItem(createEmptyShop(), item);
    expect(placed.wallItems).toEqual([item]);
    const resized = updateWallItem(placed, item.id, { width: 1.2, sizeHeight: 0.8, color: '#927FA3' });
    expect(parseShop(JSON.stringify(resized))?.wallItems![0]).toMatchObject({ ...item, width: 1.2, sizeHeight: 0.8, color: '#927FA3' });
    expect(getWallItemSize(resized.wallItems![0])).toEqual({ width: 1.2, height: 0.8, depth: 0.12 });
  });

  it.each([360, 1080])('shows 06:00 and 18:00 as six o’clock (%s game minutes)', minutes => {
    const clock = buildWallClock(0.7, 0.7, '#B98D64');
    try {
      setWallClockTime(clock, minutes);
      expect(clock.userData.gameClock).toBe(true);
      expect(clock.getObjectByName('game-clock-hour')!.rotation.z).toBeCloseTo(-Math.PI);
      expect(clock.getObjectByName('game-clock-minute')!.rotation.z).toBeCloseTo(0);
    } finally { disposeGroup(clock); }
  });

  it('advances both hands without replacing the selected clock or any render resources', () => {
    const item = createWallItem('wall-clock');
    const group = buildWallItem(item);
    try {
      const geometryIds: string[] = [];
      const materialIds: string[] = [];
      group.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        geometryIds.push(object.geometry.uuid);
        materialIds.push(...(Array.isArray(object.material) ? object.material : [object.material]).map(material => material.uuid));
      });
      setWallClockTime(group, 6 * 60 + 30);
      expect(group.getObjectByName('game-clock-hour')!.rotation.z).toBeCloseTo(-13 * Math.PI / 12);
      expect(group.getObjectByName('game-clock-minute')!.rotation.z).toBeCloseTo(-Math.PI);
      let meshIndex = 0;
      group.traverse(object => {
        expect(object.userData.wallItemId).toBe(item.id);
        if (!(object instanceof THREE.Mesh)) return;
        expect(object.geometry.uuid).toBe(geometryIds[meshIndex]);
        expect((object.material as THREE.Material).uuid).toBe(materialIds[meshIndex]);
        meshIndex++;
      });
      setWallClockTime(group, 25 * 60);
      expect(group.getObjectByName('game-clock-hour')!.rotation.z).toBeCloseTo(-Math.PI / 6);
    } finally { disposeGroup(group); }
  });

  it('keeps the case and moving hands inside a live-resized mounting envelope', () => {
    const item = createWallItem('wall-clock');
    const group = buildWallItem(item);
    try {
      const resized = { ...item, width: 1.5, sizeHeight: 0.4 };
      applyWallItemSize(group, resized);
      for (const minutes of [0, 195, 450, 720, 1091]) {
        setWallClockTime(group, minutes);
        group.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(group);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-0.751);
        expect(bounds.max.x).toBeLessThanOrEqual(0.751);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.201);
        expect(bounds.max.y).toBeLessThanOrEqual(0.201);
        expect(bounds.max.z).toBeLessThanOrEqual(0.121);
      }
    } finally { disposeGroup(group); }
  });
});
