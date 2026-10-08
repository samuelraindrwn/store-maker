import { describe, expect, it } from 'vitest'
import {
  CATALOG, MIN_FLOOR_COORD, MAX_FLOOR_COORD, canPlace, createEmptyShop, createInitialShop, createItem,
  createWallItem, getFloorCells, getItemPlacementBounds, hasFloorCell, isStandingSign,
  paintFloor, parseShop, placeItem, removeItem, resizeShop, rotatedFootprint, updateItem, upgradeShop,
  type ItemKind, type ShopDocument, type ShopItem,
} from './model'

const kinds = ['chalkboard', 'poster-stand', 'direction-sign'] as const
const item = (kind: ItemKind, x: number, z: number, patch: Partial<ShopItem> = {}): ShopItem => ({ ...createItem(kind), x, z, ...patch })
const legacy = (): ShopDocument => ({ ...createEmptyShop(), version: 1 })
const expectValid = (doc: ShopDocument) => {
  expect(parseShop(JSON.stringify(doc))).toEqual(doc)
  for (const entry of doc.items) expect(canPlace(doc, entry, entry.id)).toBe(true)
}

describe('standing signs and sidewalk placement', () => {
  it('provides three non-stockable one-cell signs in every orientation', () => {
    expect(CATALOG.filter(entry => isStandingSign(entry.kind)).map(entry => entry.name)).toEqual(['Papan kapur', 'Poster berdiri', 'Papan petunjuk'])
    for (const kind of kinds) {
      expect(CATALOG.find(entry => entry.kind === kind)!.stockable).toBe(false)
      expect(createItem(kind).stock).toBe('none')
      for (const rotation of [0, 90, 180, 270] as const) expect(rotatedFootprint(kind, rotation)).toEqual({ width: 1, depth: 1 })
    }
    expect(isStandingSign('shelf')).toBe(false)
  })

  it.each(kinds)('allows %s on real floor or either front row, not other exterior edges', kind => {
    const doc = createEmptyShop()
    for (const [x, z] of [[0, 0], [6, 5], [0, 6], [6, 7]]) expect(canPlace(doc, item(kind, x, z))).toBe(true)
    for (const [x, z] of [[-1, 6], [7, 6], [0, -1], [0, 8]]) expect(canPlace(doc, item(kind, x, z))).toBe(false)
    expect(getItemPlacementBounds(doc, kind)).toEqual({ minX: 0, maxX: 6, minZ: 0, maxZ: 7 })
  })

  it('keeps ordinary furniture on actual floor, including when another sign occupies the sidewalk', () => {
    const doc = placeItem(createEmptyShop(), item('chalkboard', 0, 6))
    for (const entry of CATALOG.filter(entry => !isStandingSign(entry.kind))) {
      expect(canPlace(doc, item(entry.kind, 2, 6))).toBe(false)
      expect(getItemPlacementBounds(doc, entry.kind)).toEqual({ minX: 0, maxX: 6, minZ: 0, maxZ: 5 })
    }
  })

  it('does not mistake holes, L-shaped notches or disconnected gaps for sidewalk', () => {
    const doc: ShopDocument = { ...createEmptyShop(), floorCells: [{ x: -2, z: -1 }, { x: -1, z: -1 }, { x: -2, z: 0 }, { x: 1, z: 2 }] }
    for (const [x, z] of [[-1, 0], [0, 1], [1, -1]]) expect(canPlace(doc, item('chalkboard', x, z))).toBe(false)
    for (const [x, z] of [[-2, -1], [-2, 3], [1, 4]]) expect(canPlace(doc, item('chalkboard', x, z))).toBe(true)
    expect(getItemPlacementBounds(doc, 'chalkboard')).toEqual({ minX: -2, maxX: 1, minZ: -1, maxZ: 4 })
  })

  it('clamps sidewalk search and placement to the finite editable grid', () => {
    const doc: ShopDocument = { ...createEmptyShop(), floorCells: [{ x: MIN_FLOOR_COORD, z: MAX_FLOOR_COORD - 1 }] }
    expect(getItemPlacementBounds(doc, 'chalkboard')).toEqual({ minX: -8, maxX: -8, minZ: 14, maxZ: 15 })
    expect(canPlace(doc, item('chalkboard', -8, 15))).toBe(true)
    expect(canPlace(doc, item('chalkboard', -8, 16))).toBe(false)
    expect(canPlace(doc, item('chalkboard', -9, 15))).toBe(false)
  })

  it('shares regular item collision, edit, copy, remove, and safe import rules', () => {
    const original = item('chalkboard', 0, 6)
    const doc = placeItem(createEmptyShop(), original)
    expect(placeItem(doc, item('poster-stand', 0, 6))).toBe(doc)
    const moved = updateItem(doc, original.id, { x: 2, z: 7, color: '#ABCDEF', rotation: 90 })
    expect(moved.items[0]).toMatchObject({ x: 2, z: 7, color: '#ABCDEF', rotation: 90 })
    expect(doc.items[0]).toEqual(original)
    const copied = placeItem(moved, { ...moved.items[0], id: 'sign-copy', x: 3 })
    expect(copied.items).toHaveLength(2)
    expect(updateItem(copied, original.id, { x: 3 })).toBe(copied)
    expect(updateItem(copied, original.id, { stock: 'books' })).toBe(copied)
    expect(parseShop({ ...copied, items: [{ ...original, stock: 'books' }] })).toBeNull()
    expect(parseShop({ ...copied, items: [{ ...original, z: 8 }] })).toBeNull()
    expect(parseShop({ ...copied, items: [original, original] })).toBeNull()
    expectValid(copied)
    expect(removeItem(copied, original.id).items.map(entry => entry.id)).toEqual(['sign-copy'])
  })
})

describe('one-time standing sign migration', () => {
  it('keeps parsing separate from migration and preserves saved data and optional fields', () => {
    const source: ShopDocument = {
      ...legacy(), name: 'Nama toko lama', wallHeight: 3.5, entrance: { position: 0.3, open: true },
      floorCells: [{ x: -2, z: 1 }, { x: -1, z: 1 }], items: [item('plant', -1, 1)],
    }
    const parsed = parseShop(JSON.stringify(source))!
    expect(parsed.version).toBe(1)
    const upgraded = upgradeShop(parsed)
    expect(upgraded.version).toBe(2)
    expect(upgraded.items.at(-1)).toMatchObject({ id: 'sidewalk-chalkboard', kind: 'chalkboard', x: -2, z: 2 })
    expect({ ...upgraded, version: 1, items: upgraded.items.slice(0, -1) }).toEqual(source)
    expect(source.version).toBe(1)
    expect(source.items).toHaveLength(1)
    expect(upgradeShop(upgraded)).toBe(upgraded)
    expectValid(upgraded)
  })

  it('adds exactly one default board to initial and migrated shops while leaving new empty shops empty', () => {
    const initial = createInitialShop()
    const migrated = upgradeShop(legacy())
    for (const doc of [initial, migrated]) {
      expect(doc.version).toBe(2)
      expect(doc.items.filter(entry => isStandingSign(entry.kind))).toEqual([expect.objectContaining({ id: 'sidewalk-chalkboard', kind: 'chalkboard', x: 0, z: doc.depth })])
      expectValid(doc)
    }
    expect(createEmptyShop().version).toBe(2)
    expect(upgradeShop(createEmptyShop()).items).toEqual([])
  })

  it('never resurrects a removed board after save, parse, reload, or repeated migration', () => {
    const upgraded = upgradeShop(legacy())
    const deleted = removeItem(upgraded, 'sidewalk-chalkboard')
    const saved = JSON.stringify(deleted)
    const reloaded = parseShop(saved)!
    expect(reloaded.version).toBe(2)
    expect(upgradeShop(reloaded)).toBe(reloaded)
    expect(upgradeShop(upgradeShop(reloaded)).items).toEqual([])
  })

  it('does not duplicate an existing sign variant or collide with a floor or wall ID', () => {
    for (const kind of kinds) {
      const doc = placeItem(legacy(), item(kind, 0, 6))
      expect(upgradeShop(doc).items).toEqual(doc.items)
    }
    const floor = placeItem(legacy(), item('plant', 0, 0, { id: 'sidewalk-chalkboard' }))
    expect(upgradeShop(floor).items).toEqual(floor.items)
    const wall = { ...legacy(), wallItems: [{ ...createWallItem('painting'), id: 'sidewalk-chalkboard' }] }
    expect(upgradeShop(wall).items).toEqual([])
    expectValid(upgradeShop(wall))
  })

  it('upgrades edge and full documents without forcing an invalid default sign', () => {
    const edge: ShopDocument = { ...legacy(), floorCells: [{ x: 0, z: MAX_FLOOR_COORD }] }
    expect(upgradeShop(edge)).toEqual({ ...edge, version: 2 })
    const cells = Array.from({ length: 200 }, (_, i) => ({ x: MIN_FLOOR_COORD + i % 20, z: Math.floor(i / 20) }))
    const full: ShopDocument = { ...legacy(), floorCells: cells, items: cells.map((cell, i) => item('plant', cell.x, cell.z, { id: `plant-${i}` })) }
    expect(upgradeShop(full).items).toHaveLength(200)
    expectValid(upgradeShop(full))
  })
})

describe('preserving signs when the floor boundary changes', () => {
  it('rehomes only invalid signs during resize while keeping identity, appearance, order, and valid items fixed', () => {
    const furniture = item('plant', 0, 0)
    const fixed = item('poster-stand', 2, 1)
    const outside = item('chalkboard', 6, 7, { color: '#123456', rotation: 270 })
    const doc = [furniture, fixed, outside].reduce(placeItem, createEmptyShop())
    const resized = resizeShop(doc, 4, 4)!
    expect(resized.items[0]).toBe(doc.items[0])
    expect(resized.items[1]).toEqual(fixed)
    expect(resized.items[2]).toEqual({ ...outside, x: 3, z: 5 })
    expect(doc.items[2]).toEqual(outside)
    expectValid(resized)
    expect(resizeShop(placeItem(doc, item('plant', 6, 5)), 4, 4)).toBeNull()
  })

  it('reconciles a changed custom front edge without moving valid floor furniture', () => {
    const shape: ShopDocument = { ...createEmptyShop(), floorCells: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 2 }] }
    const furniture = item('plant', 1, 0)
    const board = item('chalkboard', 1, 4, { rotation: 180 })
    const doc = placeItem(placeItem(shape, furniture), board)
    const changed = paintFloor(doc, [{ x: 0, z: 2 }], 'erase')
    expect(hasFloorCell(changed, 0, 2)).toBe(false)
    expect(changed.items[0]).toEqual(furniture)
    expect(changed.items[1]).toEqual({ ...board, z: 2 })
    expectValid(changed)
  })

  it('rejects a boundary edit when no valid location can preserve all signs and allows it after space is added', () => {
    const shape: ShopDocument = { ...createEmptyShop(), floorCells: [{ x: 0, z: 0 }, { x: 1, z: 0 }] }
    let doc = placeItem(shape, item('plant', 0, 0))
    for (const [x, z] of [[0, 1], [1, 1], [0, 2], [1, 2]]) doc = placeItem(doc, item('chalkboard', x, z))
    expect(paintFloor(doc, [{ x: 1, z: 0 }], 'erase')).toBe(doc)
    const expanded = paintFloor(doc, [{ x: -1, z: 0 }], 'add')
    const changed = paintFloor(expanded, [{ x: 1, z: 0 }], 'erase')
    expect(hasFloorCell(changed, 1, 0)).toBe(false)
    expect(changed.items.map(entry => entry.id)).toEqual(doc.items.map(entry => entry.id))
    expectValid(changed)
  })

  it('keeps valid signs fixed while floor grows and protects a sign already standing on floor from erasure', () => {
    const board = item('chalkboard', 0, 6)
    const doc = placeItem(createEmptyShop(), board)
    const grown = paintFloor(doc, [{ x: 0, z: 6 }], 'add')
    expect(grown.items).toBe(doc.items)
    expect(hasFloorCell(grown, board.x, board.z)).toBe(true)
    expect(paintFloor(grown, [{ x: 0, z: 6 }], 'erase')).toBe(grown)
    expectValid(grown)
    expect(getFloorCells(grown)).toHaveLength(43)
  })
})
