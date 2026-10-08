import { describe, expect, it } from 'vitest'
import {
  CATALOG, WALL_CATALOG, canPlace, canPlaceWallItem, createEmptyShop, createItem, createWallItem,
  findWallPlacement, getFloorCells, getItemFootprint, getItemSize, getWallItemSize, getWallItems,
  hasFloorCell, paintFloor, parseShop, placeItem, placeWallItem, resizeShop, rotatedFootprint,
  setWallHeight, updateItem, updateWallItem, type ItemKind, type ShopDocument, type ShopItem,
  type WallItem, type WallItemKind,
} from './model'

const furniture = (kind: ItemKind, patch: Partial<ShopItem> = {}): ShopItem => ({ ...createItem(kind), ...patch })
const accessory = (kind: WallItemKind, patch: Partial<WallItem> = {}): WallItem => ({ ...createWallItem(kind), ...patch })
const expectValid = (doc: ShopDocument) => {
  expect(parseShop(JSON.stringify(doc))).toEqual(doc)
  for (const item of doc.items) expect(canPlace(doc, item, item.id)).toBe(true)
  for (const item of getWallItems(doc)) expect(canPlaceWallItem(doc, item, item.id)).toBe(true)
}

describe('effective sizes and legacy compatibility', () => {
  it('keeps legacy dimensions implicit and returns detached effective-size values', () => {
    for (const entry of CATALOG) {
      const item = createItem(entry.kind)
      expect(getItemSize(item)).toEqual({ width: entry.width, depth: entry.depth })
      expect(item).not.toHaveProperty('width')
      expect(item).not.toHaveProperty('depth')
      const size = getItemSize(item)
      size.width = 24
      expect(getItemSize(item).width).toBe(entry.width)
    }
    for (const entry of WALL_CATALOG) {
      const item = createWallItem(entry.kind)
      expect(getWallItemSize(item)).toEqual({ width: entry.width, height: entry.height, depth: entry.depth })
      expect(item).not.toHaveProperty('width')
      expect(item).not.toHaveProperty('sizeHeight')
    }
    const legacy: ShopDocument = { ...createEmptyShop(), version: 1, items: [createItem('shelf')], wallItems: [accessory('wall-lamp')] }
    expect(parseShop(legacy)).toEqual(legacy)
    expect(getWallItemSize(legacy.wallItems![0]).width).toBe(0.45)
  })

  it('interprets local width and depth independently from rotated footprint', () => {
    const item = furniture('shelf', { width: 4 })
    expect(getItemSize(item)).toEqual({ width: 4, depth: 1 })
    for (const rotation of [0, 90, 180, 270] as const) {
      const resized = { ...item, depth: 2, rotation }
      expect(getItemSize(resized)).toEqual({ width: 4, depth: 2 })
      expect(getItemFootprint(resized)).toEqual(rotation % 180 ? { width: 2, depth: 4 } : { width: 4, depth: 2 })
    }
    expect(rotatedFootprint('shelf', 90)).toEqual({ width: 1, depth: 2 })
    const wall = accessory('window', { width: 3, sizeHeight: 2, height: 1.7 })
    expect(getWallItemSize(wall)).toEqual({ width: 3, height: 2, depth: 0.16 })
    expect(wall.height).toBe(1.7)
  })

  it.each(CATALOG.map(entry => entry.kind))('supports persisted custom dimensions for %s', kind => {
    const source = furniture(kind, { width: 3, depth: 2, x: 1, z: 1 })
    const doc = placeItem(createEmptyShop(), source)
    expect(doc.items[0]).toEqual(source)
    expect(doc.items[0]).not.toBe(source)
    expectValid(doc)
  })
})

describe('resized floor furniture placement and edits', () => {
  it('checks the effective footprint of both moving and existing rotated objects', () => {
    const table = furniture('table', { width: 3, depth: 1, rotation: 90, x: 1, z: 1 })
    const doc = placeItem(createEmptyShop(), table)
    expect(canPlace(doc, furniture('plant', { x: 1, z: 3 }))).toBe(false)
    expect(canPlace(doc, furniture('plant', { x: 2, z: 1 }))).toBe(true)
    expect(canPlace(doc, furniture('shelf', { width: 4, depth: 1, rotation: 90, x: 1, z: 0 }))).toBe(false)
    expect(canPlace(doc, furniture('shelf', { width: 4, depth: 1, rotation: 90, x: 3, z: 0 }))).toBe(true)
    expect(updateItem(doc, table.id, { rotation: 0 }).items[0]).toMatchObject({ width: 3, depth: 1, rotation: 0 })
  })

  it('rejects growth into a neighbor, permits shrinking, and retains size through copy and unrelated updates', () => {
    const shelf = furniture('shelf')
    let doc = placeItem(createEmptyShop(), shelf)
    doc = placeItem(doc, furniture('plant', { x: 2 }))
    expect(updateItem(doc, shelf.id, { width: 3 })).toBe(doc)
    expect(updateItem(doc, shelf.id, { width: 2, depth: 1 })).toBe(doc)
    const smaller = updateItem(doc, shelf.id, { width: 1, depth: 3 })
    expect(smaller.items[0]).toMatchObject({ width: 1, depth: 3 })
    expect(doc.items[0]).not.toHaveProperty('width')
    const recolored = updateItem(smaller, shelf.id, { color: '#112233', stock: 'vinyl' })
    const copy = { ...recolored.items[0], id: 'shelf-copy', x: 4 }
    const copied = placeItem(recolored, copy)
    expect(copied.items.at(-1)).toEqual(copy)
    expect(getItemSize(copied.items.at(-1)!)).toEqual({ width: 1, depth: 3 })
    expectValid(copied)
    expect(updateItem(recolored, shelf.id, { width: 1, depth: 3 })).toBe(recolored)
  })

  it('requires every resized cell to exist inside an L shape or a floor containing holes', () => {
    const cells = Array.from({ length: 16 }, (_, i) => ({ x: i % 4, z: Math.floor(i / 4) }))
    for (const floorCells of [cells.filter(cell => cell.x < 2 || cell.z < 2), cells.filter(cell => cell.x !== 2 || cell.z !== 2)]) {
      const shape = { ...createEmptyShop(), floorCells }
      const shelf = furniture('shelf', { width: 3, depth: 2 })
      const doc = placeItem(shape, shelf)
      expect(doc.items).toHaveLength(1)
      expect(updateItem(doc, shelf.id, { depth: 3 })).toBe(doc)
      expect(canPlace(shape, { ...shelf, x: 1, z: 1 })).toBe(false)
      expectValid(doc)
    }
  })

  it('protects every resized occupied tile from erasing and retains the rug overlap layer', () => {
    const rug = furniture('rug', { width: 3, depth: 2, rotation: 90, x: 1, z: 1 })
    let doc = placeItem(createEmptyShop(), rug)
    doc = placeItem(doc, furniture('stool', { x: 2, z: 3 }))
    expect(canPlace(doc, furniture('rug', { width: 1, depth: 1, x: 2, z: 3 }))).toBe(false)
    const erased = paintFloor(doc, getFloorCells(doc), 'erase')
    expect(getFloorCells(erased)).toHaveLength(6)
    expect(erased.items).toBe(doc.items)
    expect(hasFloorCell(erased, 2, 3)).toBe(true)
    expectValid(erased)
  })

  it('supports the full 24-cell signed coordinate span without overflowing it', () => {
    const floorCells = Array.from({ length: 576 }, (_, i) => ({ x: -8 + i % 24, z: -8 + Math.floor(i / 24) }))
    const full = { ...createEmptyShop(), floorCells }
    const rug = furniture('rug', { x: -8, z: -8, width: 24, depth: 24 })
    expect(canPlace(full, rug)).toBe(true)
    expect(canPlace(full, { ...rug, x: -7 })).toBe(false)
    expectValid(placeItem(full, rug))
    const edge = { ...createEmptyShop(), floorCells: [{ x: 0, z: 14 }] }
    expect(canPlace(edge, furniture('chalkboard', { x: 0, z: 15, depth: 2 }))).toBe(false)
  })

  it('keeps a resized sign entirely on floor or sidewalk and checks its full outdoor bounds', () => {
    const doc = createEmptyShop()
    const sign = furniture('chalkboard', { width: 2, depth: 2, x: 1, z: 6 })
    expect(canPlace(doc, sign)).toBe(true)
    expect(canPlace(doc, { ...sign, z: 4 })).toBe(true)
    expect(canPlace(doc, { ...sign, z: 5 })).toBe(false)
    expect(canPlace(doc, { ...sign, x: 6 })).toBe(false)
    expect(canPlace(doc, { ...sign, depth: 3 })).toBe(false)
    expect(canPlace(doc, { ...sign, width: 3, depth: 1, rotation: 90 })).toBe(false)
  })

  it('preserves resized signs during boundary changes and rejects shrinkage that cannot contain them', () => {
    const sign = furniture('poster-stand', { width: 4, depth: 2, x: 0, z: 6 })
    const doc = placeItem(createEmptyShop(), sign)
    const smaller = resizeShop(doc, 4, 4)!
    expect(smaller.items[0]).toEqual({ ...sign, z: 4 })
    expectValid(smaller)
    const tooWide = placeItem(createEmptyShop(), { ...sign, width: 5 })
    expect(resizeShop(tooWide, 4, 4)).toBeNull()
    const expanded = paintFloor(doc, [{ x: 0, z: 6 }], 'add')
    expect(expanded.items[0].id).toBe(sign.id)
    expect(getItemSize(expanded.items[0])).toEqual({ width: 4, depth: 2 })
    expectValid(expanded)
    expect(doc.items[0]).toEqual(sign)
  })

  it('rejects clipping ordinary resized furniture during room shrink', () => {
    const large = furniture('counter', { width: 5, depth: 2, x: 0, z: 2 })
    const doc = placeItem(createEmptyShop(), large)
    expect(resizeShop(doc, 4, 4)).toBeNull()
    expect(resizeShop(doc, 5, 4)!.items[0]).toEqual(large)
  })

  it('strictly rejects malformed optional floor dimensions in imports and updates', () => {
    const item = furniture('shelf')
    const doc = placeItem(createEmptyShop(), item)
    for (const key of ['width', 'depth']) for (const value of [0, -1, 25, 1.5, NaN, Infinity, '2', null, undefined, true, {}]) {
      const patch = { [key]: value }
      expect(parseShop({ ...doc, items: [{ ...item, ...patch }] })).toBeNull()
      expect(updateItem(doc, item.id, patch as Partial<ShopItem>)).toBe(doc)
    }
    expect(parseShop({ ...doc, items: [{ ...item, width: 2, depth: 1, sizeHeight: 1 }] })).toBeNull()
    expect(parseShop({ ...doc, items: [{ ...item, width: 3 }, furniture('plant', { x: 2 })] })).toBeNull()
  })
})

describe('resized wall accessories', () => {
  it.each(WALL_CATALOG.map(entry => entry.kind))('resizes %s while keeping mounting height and depth independent', kind => {
    const item = accessory(kind, { width: 2.34, sizeHeight: 1.26, offset: 2, height: 1.7 })
    expect(canPlaceWallItem(createEmptyShop(), item)).toBe(true)
    const doc = placeWallItem(createEmptyShop(), item)
    expect(doc.wallItems![0]).toMatchObject({ width: 2.3, sizeHeight: 1.3, offset: 2, height: 1.7 })
    expect(item).toMatchObject({ width: 2.34, sizeHeight: 1.26 })
    expect(getWallItemSize(doc.wallItems![0]).depth).toBe(WALL_CATALOG.find(entry => entry.kind === kind)!.depth)
    expectValid(doc)
  })

  it('checks actual resized widths, vertical overlaps, headroom and uninterrupted wall runs', () => {
    const painting = accessory('painting', { width: 1, sizeHeight: 1, offset: 1, height: 1 })
    let doc = placeWallItem(createEmptyShop(), painting)
    doc = placeWallItem(doc, accessory('painting', { width: 1, sizeHeight: 1, offset: 2.2, height: 1 }))
    doc = placeWallItem(doc, accessory('painting', { width: 1, sizeHeight: 1, offset: 1, height: 2.2 }))
    expect(updateWallItem(doc, painting.id, { width: 1.6 })).toBe(doc)
    expect(updateWallItem(doc, painting.id, { sizeHeight: 1.6 })).toBe(doc)
    expect(updateWallItem(doc, painting.id, { width: 0.5 }).wallItems![0].width).toBe(0.5)
    expect(canPlaceWallItem(createEmptyShop(), accessory('window', { width: 4, offset: 1.5 }))).toBe(false)
    expect(canPlaceWallItem(createEmptyShop(), accessory('window', { sizeHeight: 3, height: 1.5 }))).toBe(false)
    const gaps = { ...createEmptyShop(), floorCells: [{ x: 0, z: 0 }, { x: 2, z: 0 }] }
    expect(canPlaceWallItem(gaps, accessory('window', { width: 2.2, offset: 1.5 }))).toBe(false)
  })

  it('finds space using requested dimensions and preserves them when copying or switching walls', () => {
    const item = accessory('window', { width: 3.2, sizeHeight: 1.2, offset: 2, height: 1.4 })
    const doc = placeWallItem(createEmptyShop(), item)
    const copy = findWallPlacement(doc, { ...item, id: 'window-copy' }, { wall: 'left', line: 0 })!
    expect(copy).toMatchObject({ id: 'window-copy', wall: 'left', width: 3.2, sizeHeight: 1.2 })
    expect(canPlaceWallItem(doc, copy)).toBe(true)
    const copied = placeWallItem(doc, copy)
    expectValid(copied)
    const resized = findWallPlacement(doc, item, { width: 4.26, sizeHeight: 1.24 })!
    expect(resized).toMatchObject({ width: 4.3, sizeHeight: 1.2 })
    expect(canPlaceWallItem(doc, resized, item.id)).toBe(true)
    const tiny = { ...createEmptyShop(), floorCells: [{ x: 0, z: 0 }] }
    expect(findWallPlacement(tiny, item)).toBeNull()
    expect(findWallPlacement(tiny, item, { width: 0.8, sizeHeight: 1.2 })).not.toBeNull()
  })

  it('preserves valid custom-sized accessories and rehomes affected ones without shrinking or deleting them', () => {
    const item = accessory('window', { width: 5, sizeHeight: 1.2, offset: 3, height: 1.5 })
    const doc = placeWallItem(createEmptyShop(), item)
    const resized = resizeShop(doc, 4, 6)!
    expect(resized.wallItems![0]).toMatchObject({ id: item.id, wall: 'right', width: 5, sizeHeight: 1.2 })
    expectValid(resized)
    expect(resizeShop(doc, 4, 4)).toBeNull()
    const strip = { ...createEmptyShop(), floorCells: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }] }
    const attached = placeWallItem(strip, accessory('window', { width: 2.8, sizeHeight: 1, offset: 1.5 }))
    expect(paintFloor(attached, [{ x: 2, z: 0 }], 'erase')).toBe(attached)
    const expanded = paintFloor(attached, [{ x: 3, z: 0 }], 'add')
    expect(expanded.wallItems).toEqual(attached.wallItems)
    expectValid(expanded)
  })

  it('uses resized height when lowering walls and refuses to lose an accessory that cannot fit', () => {
    const item = accessory('painting', { width: 1.2, sizeHeight: 3, offset: 2, height: 2.5 })
    const doc = placeWallItem({ ...createEmptyShop(), wallHeight: 4.5 }, item)
    const lower = setWallHeight(doc, 3.2)
    expect(lower.wallHeight).toBe(3.2)
    expect(lower.wallItems![0]).toMatchObject({ id: item.id, width: 1.2, sizeHeight: 3, height: 1.7 })
    expectValid(lower)
    expect(setWallHeight(doc, 2.3)).toBe(doc)
    expect(doc.wallItems![0].height).toBe(2.5)
  })

  it('round-trips detached optional wall sizes and recognizes semantic no-op sizing', () => {
    const item = accessory('window')
    const doc = placeWallItem(createEmptyShop(), item)
    expect(updateWallItem(doc, item.id, { width: 2.2, sizeHeight: 1.4 })).toBe(doc)
    const resized = updateWallItem(doc, item.id, { width: 2.4, sizeHeight: 1.8, text: 'Jendela besar' })
    expect(resized.wallItems![0]).toMatchObject({ width: 2.4, sizeHeight: 1.8 })
    expect(updateWallItem(resized, item.id, { width: 2.41, sizeHeight: 1.81 })).toBe(resized)
    const changed = updateWallItem(resized, item.id, { color: '#123456', offset: 3, lit: true })
    expect(changed.wallItems![0]).toMatchObject({ width: 2.4, sizeHeight: 1.8 })
    const imported = parseShop(JSON.stringify(changed))!
    expect(imported).toEqual(changed)
    expect(imported.wallItems![0]).not.toBe(changed.wallItems![0])
    expect(doc.wallItems![0]).not.toHaveProperty('width')
  })

  it('rejects malformed wall sizes, unknown dimension fields, and imported resized collisions', () => {
    const item = accessory('window')
    const doc = placeWallItem(createEmptyShop(), item)
    for (const key of ['width', 'sizeHeight']) for (const value of [0, 0.29, -1, NaN, Infinity, '2', null, undefined, true, {}]) {
      const patch = { [key]: value }
      expect(parseShop({ ...doc, wallItems: [{ ...item, ...patch }] })).toBeNull()
      expect(updateWallItem(doc, item.id, patch as Partial<WallItem>)).toBe(doc)
      expect(findWallPlacement(doc, item, patch as Partial<WallItem>)).toBeNull()
    }
    for (const patch of [{ width: 24.1 }, { sizeHeight: 4.6 }, { depth: 1 }, { width: 7, offset: 1.5 }]) {
      expect(parseShop({ ...doc, wallItems: [{ ...item, ...patch }] })).toBeNull()
    }
    const first = accessory('painting', { width: 2, sizeHeight: 1, offset: 1, height: 1 })
    const second = accessory('painting', { width: 2, sizeHeight: 1, offset: 2, height: 1 })
    expect(parseShop({ ...createEmptyShop(), wallItems: [first, second] })).toBeNull()
  })
})
