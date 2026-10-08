import { describe, expect, it } from 'vitest';
import { canPlaceWallItem, createEmptyShop, createWallItem, getExteriorWallMaterial, getWallItemMount, getWallItemSize, getWallLampStyle, getWallSignStyle, parseShop, placeWallItem, setExterior, updateWallItem, wallItemPosition, type WallItem } from './model';

describe('exterior wall decoration', () => {
  it('saves wide illuminated fascia signs and scales a projecting blade with its width', () => {
    const sign = { ...createWallItem('wall-sign'), offset: 3.5, width: 3.2, sizeHeight: 0.8, mount: 'exterior' as const, wallSignStyle: 'fascia' as const, lit: true, text: 'TOKO RUMAH CERITA' };
    expect(getWallSignStyle(createWallItem('wall-sign'))).toBe('plaque');
    const shop = placeWallItem(createEmptyShop(), sign);
    expect(parseShop(JSON.parse(JSON.stringify(shop)))).toEqual(shop);
    expect(getWallItemSize(sign)).toEqual({ width: 3.2, height: 0.8, depth: 0.16 });
    const projecting = updateWallItem(shop, sign.id, { wallSignStyle: 'projecting' });
    expect(getWallSignStyle(projecting.wallItems![0])).toBe('projecting');
    expect(getWallItemSize(projecting.wallItems![0]).depth).toBeCloseTo(1.44);
    expect(getWallItemSize({ ...projecting.wallItems![0], width: 1.6 }).depth).toBeCloseTo(0.72);
    expect(updateWallItem(shop, sign.id, { wallSignStyle: 'invalid' as 'plaque' })).toBe(shop);
    expect(placeWallItem(createEmptyShop(), { ...createWallItem('window'), wallSignStyle: 'fascia' }).wallItems).toEqual([]);
  });

  it('preserves old plaster walls and interior sconces while saving new facade materials and lamp variants', () => {
    const initial = createEmptyShop(), oldLamp = createWallItem('wall-lamp');
    expect(getExteriorWallMaterial(initial)).toBe('plaster');
    expect(getWallItemMount(oldLamp)).toBe('interior');
    expect(getWallLampStyle(oldLamp)).toBe('sconce');
    const lamp = { ...oldLamp, mount: 'exterior' as const, wallLampStyle: 'lantern' as const, offset: 3 };
    const shop = setExterior(placeWallItem(initial, lamp), { wallMaterial: 'brick' });
    const restored = parseShop(JSON.parse(JSON.stringify(shop)))!;
    expect(restored).toEqual(shop);
    expect(getExteriorWallMaterial(restored)).toBe('brick');
    expect(getWallItemMount(restored.wallItems![0])).toBe('exterior');
    expect(getWallLampStyle(restored.wallItems![0])).toBe('lantern');
    const changed = updateWallItem(restored, lamp.id, { wallLampStyle: 'bulkhead' });
    expect(changed.wallItems![0].wallLampStyle).toBe('bulkhead');
    expect(updateWallItem(changed, lamp.id, { wallLampStyle: 'bulkhead' })).toBe(changed);
    expect(getExteriorWallMaterial(setExterior(changed, { wallMaterial: 'plaster' }))).toBe('plaster');
  });

  it('allows accessories on opposite faces but prevents covering shared window openings', () => {
    const inside = { ...createWallItem('wall-sign'), id: 'inside', offset: 3 };
    const doc = placeWallItem(createEmptyShop(), inside);
    const outside = { ...createWallItem('wall-lamp'), id: 'outside', offset: 3, mount: 'exterior' as const };
    expect(canPlaceWallItem(doc, outside)).toBe(true);
    expect(canPlaceWallItem(doc, { ...outside, mount: 'interior' })).toBe(false);
    const paired = placeWallItem(doc, outside);
    expect(paired.wallItems).toHaveLength(2);
    expect(updateWallItem(paired, outside.id, { mount: 'interior' })).toBe(paired);
    const window = { ...createWallItem('window'), offset: 3 };
    expect(canPlaceWallItem(paired, window)).toBe(false);
    const glazed = placeWallItem(createEmptyShop(), window);
    expect(canPlaceWallItem(glazed, outside)).toBe(false);
    expect(canPlaceWallItem(glazed, { ...outside, mount: 'interior' })).toBe(false);
  });

  it.each(['back', 'front', 'left', 'right'] as const)('mounts accessories beyond the outer %s face and keeps one window position', wall => {
    const doc = createEmptyShop();
    const interior = { ...createWallItem('wall-lamp'), wall, line: wall === 'front' ? doc.depth : wall === 'right' ? doc.width : 0 };
    const inside = wallItemPosition(doc, interior), outside = wallItemPosition(doc, { ...interior, mount: 'exterior' });
    expect(outside.rotation - inside.rotation).toBeCloseTo(Math.PI);
    const sign = wall === 'back' || wall === 'left' ? -1 : 1;
    expect((wall === 'front' || wall === 'back' ? outside.z - inside.z : outside.x - inside.x) * sign).toBeCloseTo(0.174);
    const window: WallItem = { ...interior, kind: 'window', lit: false };
    expect(wallItemPosition(doc, { ...window, mount: 'exterior' })).toEqual(wallItemPosition(doc, window));
  });

  it('rejects invalid materials, attachment faces and lamp styles without modifying saved layouts', () => {
    const doc = placeWallItem(createEmptyShop(), createWallItem('wall-lamp'));
    expect(setExterior(doc, { wallMaterial: 'invalid' as 'brick' })).toBe(doc);
    expect(updateWallItem(doc, doc.wallItems![0].id, { mount: 'invalid' as 'exterior' })).toBe(doc);
    expect(updateWallItem(doc, doc.wallItems![0].id, { wallLampStyle: 'invalid' as 'lantern' })).toBe(doc);
    const invalid = { ...createWallItem('window'), wallLampStyle: 'lantern' as const };
    expect(placeWallItem(createEmptyShop(), invalid).wallItems).toEqual([]);
    expect(parseShop({ ...doc, exterior: { wallColor: '#cccccc', trimColor: '#aaaaaa', awning: true, wallMaterial: 'stone' } })).toBeNull();
  });
});
