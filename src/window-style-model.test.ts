import { describe, expect, it } from 'vitest'
import {
  WINDOW_STYLES, canPlaceWallItem, createEmptyShop, createItem, createWallItem, findWallPlacement,
  getWallItems, getWindowStyle, paintFloor, parseShop, placeWallItem, resizeShop, setWallHeight,
  updateWallItem, type ShopDocument, type WallItem, type WallItemKind,
} from './model'

const windowItem = (patch: Partial<WallItem> = {}): WallItem => ({ ...createWallItem('window'), ...patch })

describe('window style catalog and legacy compatibility', () => {
  it('exports five distinct styles and treats missing style as classic without changing old data', () => {
    expect(WINDOW_STYLES).toEqual([
      { id: 'classic', label: 'Klasik' }, { id: 'picture', label: 'Panoramik' },
      { id: 'grid', label: 'Kisi-kisi' }, { id: 'sliding', label: 'Geser' }, { id: 'arched', label: 'Lengkung' },
    ])
    for (const version of [1, 2] as const) {
      const item = windowItem()
      const doc = { ...createEmptyShop(), version, wallItems: [item] }
      const imported = parseShop(JSON.stringify(doc))!
      expect(imported).toEqual(doc)
      expect(getWindowStyle(imported.wallItems![0])).toBe('classic')
      expect(imported.wallItems![0]).not.toHaveProperty('windowStyle')
      expect(updateWallItem(imported, item.id, { windowStyle: 'classic' })).toBe(imported)
    }
    const legacy = createEmptyShop()
    delete legacy.wallItems
    const synthesized = getWallItems(legacy).find(item => item.kind === 'window')!
    expect(getWindowStyle(synthesized)).toBe('classic')
    expect(synthesized).not.toHaveProperty('windowStyle')
    expect(legacy.wallItems).toBeUndefined()
  })

  it.each(WINDOW_STYLES)('persists explicit $id style across both save versions with detached imports', ({ id }) => {
    for (const version of [1, 2] as const) {
      const item = windowItem({ windowStyle: id, width: 2.6, sizeHeight: 1.8 })
      const doc = placeWallItem({ ...createEmptyShop(), version }, item)
      expect(doc.wallItems).toHaveLength(1)
      const imported = parseShop(JSON.stringify(doc))!
      expect(imported).toEqual(doc)
      expect(imported.wallItems![0]).not.toBe(doc.wallItems![0])
      expect(getWindowStyle(imported.wallItems![0])).toBe(id)
      expect(canPlaceWallItem(imported, imported.wallItems![0], item.id)).toBe(true)
    }
  })
})

describe('window style edits and preservation', () => {
  it('commits style-only changes immutably and recognizes effective style no-ops', () => {
    const item = windowItem()
    const original = placeWallItem(createEmptyShop(), item)
    const arched = updateWallItem(original, item.id, { windowStyle: 'arched' })
    expect(arched).not.toBe(original)
    expect(arched.wallItems![0]).toEqual({ ...item, windowStyle: 'arched' })
    expect(original.wallItems![0]).toEqual(item)
    expect(original.wallItems![0]).not.toHaveProperty('windowStyle')
    expect(updateWallItem(arched, item.id, { windowStyle: 'arched' })).toBe(arched)
    expect(updateWallItem(arched, item.id, { width: 2.2, sizeHeight: 1.4, windowStyle: 'arched' })).toBe(arched)
    const classic = updateWallItem(arched, item.id, { windowStyle: 'classic' })
    expect(classic).not.toBe(arched)
    expect(getWindowStyle(classic.wallItems![0])).toBe('classic')
    expect(getWindowStyle(arched.wallItems![0])).toBe('arched')
  })

  it('retains selected style through moving, resizing, recoloring, cloning, and finding another wall', () => {
    const item = windowItem({ windowStyle: 'sliding', offset: 2 })
    const original = placeWallItem(createEmptyShop(), item)
    const moved = updateWallItem(original, item.id, { offset: 3, height: 1.6 })
    const resized = updateWallItem(moved, item.id, { width: 3.2, sizeHeight: 1.8 })
    const recolored = updateWallItem(resized, item.id, { color: '#123456' })
    expect(recolored.wallItems![0]).toMatchObject({ windowStyle: 'sliding', offset: 3, height: 1.6, width: 3.2, sizeHeight: 1.8, color: '#123456' })
    const copy = findWallPlacement(recolored, { ...recolored.wallItems![0], id: 'window-copy' }, { wall: 'left', line: 0 })!
    expect(copy).toMatchObject({ windowStyle: 'sliding', wall: 'left', width: 3.2, sizeHeight: 1.8 })
    const copied = placeWallItem(recolored, copy)
    expect(copied.wallItems).toHaveLength(2)
    expect(copied.wallItems!.map(getWindowStyle)).toEqual(['sliding', 'sliding'])
    expect(parseShop(copied)).toEqual(copied)
    expect(original.wallItems![0]).toEqual(item)
  })

  it('preserves style when room edits rehome a wide or high window', () => {
    const wide = windowItem({ windowStyle: 'picture', width: 5, sizeHeight: 1.2, offset: 3 })
    const original = placeWallItem(createEmptyShop(), wide)
    const narrower = resizeShop(original, 4, 6)!
    expect(narrower.wallItems![0]).toMatchObject({ id: wide.id, windowStyle: 'picture', wall: 'right', width: 5 })
    expect(canPlaceWallItem(narrower, narrower.wallItems![0], wide.id)).toBe(true)
    const high = windowItem({ windowStyle: 'grid', height: 3.5 })
    const taller = placeWallItem({ ...createEmptyShop(), wallHeight: 4.5 }, high)
    const lowered = setWallHeight(taller, 2.3)
    expect(lowered.wallItems![0].height).toBeLessThan(high.height)
    expect(lowered.wallItems![0].windowStyle).toBe('grid')
    const painted = paintFloor(lowered, [{ x: -1, z: 5 }], 'add')
    expect(painted.wallItems![0].windowStyle).toBe('grid')
    expect(parseShop(painted)).toEqual(painted)
  })

  it('can change a synthesized legacy window style without changing the other legacy decoration', () => {
    const legacy: ShopDocument = { ...createEmptyShop(), version: 1 }
    delete legacy.wallItems
    const before = getWallItems(legacy)
    const changed = updateWallItem(legacy, 'builtin-window', { windowStyle: 'arched' })
    expect(changed).not.toBe(legacy)
    expect(changed.wallItems!.find(item => item.id === 'builtin-window')!.windowStyle).toBe('arched')
    expect(changed.wallItems!.find(item => item.id === 'builtin-wall-sign')).toEqual(before.find(item => item.id === 'builtin-wall-sign'))
    expect(legacy.wallItems).toBeUndefined()
    expect(parseShop(changed)).toEqual(changed)
  })
})

describe('strict window style validation', () => {
  it('rejects unknown enum values and malformed optional styles in import, placement, search and edit', () => {
    const item = windowItem()
    const doc = placeWallItem(createEmptyShop(), item)
    for (const windowStyle of ['unknown', '', 'CLASSIC', '__proto__', 0, false, null, undefined, {}, ['classic']]) {
      const patch = { windowStyle } as Partial<WallItem>
      expect(parseShop({ ...doc, wallItems: [{ ...item, ...patch }] })).toBeNull()
      expect(updateWallItem(doc, item.id, patch)).toBe(doc)
      expect(findWallPlacement(doc, item, patch)).toBeNull()
      expect(placeWallItem(createEmptyShop(), { ...item, ...patch }).wallItems).toEqual([])
    }
    expect(parseShop({ ...doc, wallItems: [{ ...item, windowStyle: 'grid', style: 'grid' }] })).toBeNull()
  })

  it('rejects style fields on every non-window kind, even an explicit classic or a kind change', () => {
    const kinds: WallItemKind[] = ['wall-lamp', 'wall-shelf', 'painting', 'wall-sign', 'wall-clock']
    for (const kind of kinds) {
      const item = createWallItem(kind)
      const doc = placeWallItem(createEmptyShop(), item)
      expect(parseShop({ ...doc, wallItems: [{ ...item, windowStyle: 'classic' }] })).toBeNull()
      expect(updateWallItem(doc, item.id, { windowStyle: 'classic' })).toBe(doc)
      expect(findWallPlacement(doc, item, { windowStyle: 'grid' })).toBeNull()
    }
    const window = windowItem({ windowStyle: 'grid' })
    const doc = placeWallItem(createEmptyShop(), window)
    expect(updateWallItem(doc, window.id, { kind: 'painting' })).toBe(doc)
    expect(parseShop({ ...createEmptyShop(), items: [{ ...createItem('shelf'), windowStyle: 'classic' }] })).toBeNull()
  })
})
