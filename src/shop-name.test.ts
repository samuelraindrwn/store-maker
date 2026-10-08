import { describe, expect, it } from 'vitest';
import { createBlankShop, createInitialShop, createWallItem, getWallItems, parseShop, renameShop, updateWallItem, upgradeShop } from './model';

describe('shop name signs', () => {
  it('renames the existing sign without changing its placement or the previous snapshot', () => {
    const shop = createInitialShop();
    const sign = shop.wallItems!.find(item => item.kind === 'wall-sign')!;
    const next = renameShop(shop, 'Toko Cesco');
    expect(next.name).toBe('Toko Cesco');
    expect(next.wallItems!.find(item => item.id === sign.id)).toEqual({ ...sign, text: 'Toko Cesco' });
    expect(next.items).toBe(shop.items);
    expect(shop.wallItems!.find(item => item.id === sign.id)).toEqual(sign);
    expect(sign.text).toBe(shop.name);
    expect(renameShop(next, next.name)).toBe(next);
    expect(parseShop(JSON.stringify(next))).toEqual(next);
  });

  it('repairs a saved example sign whose shop was already renamed, preserving custom messages', () => {
    const shop = createInitialShop();
    const stale = { ...shop, name: 'Toko Cesco', wallItems: shop.wallItems!.map(item => item.kind === 'wall-sign' ? { ...item, text: 'Sudut Nemu', width: 2.2 } : item) };
    const upgraded = upgradeShop(stale);
    expect(upgraded.wallItems!.find(item => item.id === 'builtin-wall-sign')).toEqual({ ...stale.wallItems.find(item => item.id === 'builtin-wall-sign'), text: 'Toko Cesco' });
    const custom = updateWallItem(upgraded, 'builtin-wall-sign', { text: 'Selamat datang!' });
    const renamed = renameShop(custom, 'Cesco & Co.');
    expect(getWallItems(upgradeShop(parseShop(JSON.stringify(renamed))!)).find(item => item.id === 'builtin-wall-sign')!.text).toBe('Selamat datang!');
  });

  it('keeps additional name signs in sync across blank, padded, and full-length names', () => {
    const shop = createBlankShop();
    const sign = createWallItem('wall-sign', shop.name);
    const named = { ...shop, wallItems: [sign] };
    const blank = renameShop(named, '');
    expect(blank.wallItems![0].text).toBe('Toko Kecilku');
    const padded = renameShop(blank, '  Sudut Sore  ');
    expect(padded.name).toBe('  Sudut Sore  ');
    expect(padded.wallItems![0].text).toBe('Sudut Sore');
    const name = 'Nama toko '.repeat(8);
    expect(renameShop(padded, name).wallItems![0].text).toBe(name.trim());
  });

  it('does not create a sign when removed and keeps implicit legacy decorations implicit', () => {
    expect(renameShop(createBlankShop(), 'Tanpa papan').wallItems).toEqual([]);
    const legacy = createInitialShop();
    delete legacy.wallItems;
    const renamed = renameShop(legacy, 'Nama baru');
    expect(renamed.wallItems).toBeUndefined();
    expect(getWallItems(renamed).find(item => item.kind === 'wall-sign')!.text).toBe('Nama baru');
  });
});
