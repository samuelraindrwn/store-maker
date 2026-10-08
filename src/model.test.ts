import { describe, expect, it } from 'vitest'
import {
  CATALOG, canPlace, createEmptyShop, createInitialShop, createItem, parseShop,
  placeItem, removeItem, resizeShop, rotatedFootprint, updateItem,
  getEntrance, getEntranceRotation, getWallHeight, setEntrance, setWallHeight,
  getFloorCells, getFloorBounds, hasFloorCell, paintFloor, getEntranceAnchor,
  MIN_FLOOR_COORD, MAX_FLOOR_COORD,
  type Entrance, type ItemKind, type ShopItem,
} from './model'

const item = (kind: ItemKind, x: number, z: number, patch: Partial<ShopItem> = {}): ShopItem => ({
  ...createItem(kind), x, z, ...patch,
})

describe('catalog and starter shops', () => {
  it('provides twenty-five unique kinds with the expected footprints', () => {
    expect(CATALOG.map(entry => entry.kind)).toEqual(['shelf', 'table', 'counter', 'rack', 'plant', 'rug', 'lamp', 'stool', 'chalkboard', 'poster-stand', 'direction-sign', 'glass-cabinet', 'display-plinth', 'pegboard', 'food-display', 'drinks-fridge', 'coffee-station', 'prep-counter', 'stove', 'sink', 'dining-table', 'service-cart', 'stairs', 'warehouse-rack', 'bathroom'])
    expect(CATALOG.map(entry => [entry.kind, entry.width, entry.depth])).toEqual([
      ['shelf', 2, 1], ['table', 2, 2], ['counter', 2, 1], ['rack', 2, 1],
      ['plant', 1, 1], ['rug', 2, 2], ['lamp', 1, 1], ['stool', 1, 1],
      ['chalkboard', 1, 1], ['poster-stand', 1, 1], ['direction-sign', 1, 1],
      ['glass-cabinet', 2, 1], ['display-plinth', 1, 1], ['pegboard', 2, 1],
      ['food-display', 2, 1], ['drinks-fridge', 1, 1], ['coffee-station', 2, 1],
      ['prep-counter', 2, 1], ['stove', 2, 1], ['sink', 2, 1], ['dining-table', 2, 2], ['service-cart', 1, 1],
      ['stairs', 2, 3], ['warehouse-rack', 2, 1], ['bathroom', 2, 2],
    ])
  })

  it('creates unique IDs and appropriate initial stock for every kind', () => {
    const items = CATALOG.flatMap(entry => [createItem(entry.kind), createItem(entry.kind)])
    expect(new Set(items.map(value => value.id)).size).toBe(items.length)
    for (const value of items) {
      expect(canPlace(createEmptyShop(), value)).toBe(true)
      if (!CATALOG.find(entry => entry.kind === value.kind)!.stockable) expect(value.stock).toBe('none')
    }
  })

  it('creates a valid furnished 7×6 shop and independent documents', () => {
    const first = createInitialShop()
    const second = createInitialShop()
    expect(first).toMatchObject({ version: 2, width: 7, depth: 6 })
    expect(first.items.length).toBeGreaterThanOrEqual(8)
    expect(parseShop(first)).toEqual(first)
    expect(parseShop(createEmptyShop())).toEqual(createEmptyShop())
    first.items[0]!.color = '#000000'
    expect(second.items[0]!.color).not.toBe('#000000')
  })
})

describe('placement and rotation', () => {
  it.each([0, 90, 180, 270] as const)('rotates rectangular footprints at %s degrees', rotation => {
    expect(rotatedFootprint('shelf', rotation)).toEqual(rotation === 90 || rotation === 270 ? { width: 1, depth: 2 } : { width: 2, depth: 1 })
    expect(rotatedFootprint('table', rotation)).toEqual({ width: 2, depth: 2 })
  })

  it('allows edge adjacency but rejects any cell overlap', () => {
    const table = item('table', 1, 1)
    const doc = placeItem(createEmptyShop(), table)
    expect(canPlace(doc, item('shelf', 3, 1))).toBe(true)
    expect(canPlace(doc, item('shelf', 0, 1))).toBe(false)
    expect(canPlace(doc, item('plant', 2, 2))).toBe(false)
    expect(canPlace(doc, item('plant', 2, 3))).toBe(true)
  })

  it('uses the rotated footprint of both the new and existing item', () => {
    const rack = item('rack', 2, 1, { rotation: 90 })
    const doc = placeItem(createEmptyShop(), rack)
    expect(canPlace(doc, item('plant', 2, 2))).toBe(false)
    expect(canPlace(doc, item('plant', 3, 1))).toBe(true)
    expect(canPlace(doc, item('shelf', 1, 0, { rotation: 90 }))).toBe(true)
    expect(canPlace(doc, item('shelf', 1, 1))).toBe(false)
  })

  it('checks right/back/front boundaries and rejects fractional or nonfinite coordinates', () => {
    const doc = createEmptyShop()
    expect(canPlace(doc, item('shelf', 5, 5))).toBe(true)
    expect(canPlace(doc, item('shelf', 6, 5))).toBe(false)
    expect(canPlace(doc, item('shelf', 6, 4, { rotation: 90 }))).toBe(true)
    expect(canPlace(doc, item('shelf', 6, 5, { rotation: 90 }))).toBe(false)
    for (const value of [-1, 0.5, NaN, Infinity]) {
      expect(canPlace(doc, item('plant', value, 0))).toBe(false)
      expect(canPlace(doc, item('plant', 0, value))).toBe(false)
    }
  })

  it('allows rugs under furnishings in either insertion order, but not under another rug', () => {
    const rug = item('rug', 1, 1)
    const table = item('table', 1, 1)
    expect(canPlace(placeItem(createEmptyShop(), rug), table)).toBe(true)
    const furnished = placeItem(createEmptyShop(), table)
    expect(canPlace(furnished, rug)).toBe(true)
    const both = placeItem(furnished, rug)
    expect(canPlace(both, item('rug', 2, 2))).toBe(false)
    expect(canPlace(both, item('rug', 3, 1))).toBe(true)
    expect(canPlace(both, item('rug', 6, 5))).toBe(false)
  })

  it('ignores only the item being moved and prevents duplicate IDs', () => {
    const first = item('shelf', 0, 0)
    const second = item('plant', 3, 0)
    const doc = placeItem(placeItem(createEmptyShop(), first), second)
    expect(canPlace(doc, first)).toBe(false)
    expect(canPlace(doc, first, first.id)).toBe(true)
    expect(canPlace(doc, { ...first, x: 2 }, first.id)).toBe(false)
    expect(placeItem(doc, { ...first, x: 4 })).toBe(doc)
  })
})

describe('immutable document changes', () => {
  it('detaches inserted items and returns the original document on rejected placements', () => {
    const doc = createEmptyShop()
    const shelf = item('shelf', 0, 0)
    const next = placeItem(doc, shelf)
    expect(doc.items).toEqual([])
    expect(next.items).toHaveLength(1)
    expect(next.items[0]).not.toBe(shelf)
    shelf.color = '#000000'
    expect(next.items[0]!.color).not.toBe('#000000')
    expect(placeItem(next, item('plant', 0, 0))).toBe(next)
  })

  it('validates movement, rotation, color, stock and immutable identity', () => {
    const shelf = item('shelf', 5, 5)
    const doc = placeItem(createEmptyShop(), shelf)
    expect(updateItem(doc, shelf.id, { rotation: 90 })).toBe(doc)
    expect(updateItem(doc, shelf.id, { color: 'red' })).toBe(doc)
    expect(updateItem(doc, shelf.id, { id: 'different' })).toBe(doc)
    expect(updateItem(doc, 'missing', { x: 0 })).toBe(doc)
    expect(updateItem(doc, shelf.id, {})).toBe(doc)
    const next = updateItem(doc, shelf.id, { x: 4, z: 3, rotation: 90, color: '#AB12CD', stock: 'vinyl' })
    expect(next).not.toBe(doc)
    expect(next.items[0]).toMatchObject({ x: 4, z: 3, rotation: 90, color: '#AB12CD', stock: 'vinyl' })
    expect(doc.items[0]).toEqual(shelf)
    const plant = item('plant', 0, 0)
    const withPlant = placeItem(doc, plant)
    expect(updateItem(withPlant, plant.id, { stock: 'books' })).toBe(withPlant)
  })

  it('removes only the requested object and leaves a rug underneath', () => {
    const table = item('table', 1, 1)
    const rug = item('rug', 1, 1)
    const doc = placeItem(placeItem(createEmptyShop(), table), rug)
    expect(removeItem(doc, table.id).items).toEqual([rug])
    expect(doc.items).toHaveLength(2)
    expect(removeItem(doc, 'missing')).toBe(doc)
  })

  it('resizes only when every object including rugs remains inside', () => {
    const doc = placeItem(createEmptyShop(), item('rug', 5, 4))
    expect(resizeShop(doc, 6, 6)).toBeNull()
    expect(resizeShop(doc, 7, 5)).toBeNull()
    expect(resizeShop(doc, 8, 8)).toMatchObject({ width: 8, depth: 8 })
    expect(resizeShop(doc, 7, 6)).toBe(doc)
    expect(doc).toMatchObject({ width: 7, depth: 6 })
    for (const size of [3, 11, 4.5, NaN, Infinity]) expect(resizeShop(doc, size, 6)).toBeNull()
  })
})

describe('draggable architecture and old save compatibility', () => {
  it('reads old saves without inserting new fields or changing their layout', () => {
    const old = createInitialShop()
    const parsed = parseShop(JSON.stringify(old))!
    expect(parsed).toEqual(old)
    expect(getWallHeight(parsed)).toBe(2.75)
    expect(getEntrance(parsed)).toEqual({ position: 0.72, open: false })
    expect(parsed).not.toHaveProperty('wallHeight')
    expect(parsed).not.toHaveProperty('entrance')
  })

  it('rounds a wall gesture to a tenth while preserving the original document', () => {
    const old = createInitialShop()
    const next = setWallHeight(old, 3.46)
    expect(next.wallHeight).toBe(3.5)
    expect(next.items).toBe(old.items)
    expect(old.wallHeight).toBeUndefined()
    expect(setWallHeight(next, 3.5)).toBe(next)
    for (const height of [2.2, 4.6, Infinity, NaN, -1]) expect(setWallHeight(old, height)).toBe(old)
  })

  it('keeps door opening and position independent and immutable', () => {
    const old = createInitialShop()
    const moved = setEntrance(old, { position: 0.333333 })
    const opened = setEntrance(moved, { open: true })
    expect(opened.entrance).toEqual({ position: 0.333, open: true })
    expect(moved.entrance).toEqual({ position: 0.333, open: false })
    expect(old.entrance).toBeUndefined()
    expect(setEntrance(opened, { open: true })).toBe(opened)
    const detached = getEntrance(opened)
    detached.open = false
    expect(opened.entrance?.open).toBe(true)
    for (const position of [-0.1, 1.1, NaN, Infinity]) expect(setEntrance(old, { position })).toBe(old)
  })

  it('round-trips architecture without losing it when resizing or editing furniture', () => {
    const doc = setEntrance(setWallHeight(createInitialShop(), 3.8), { position: 0.8, open: true })
    const next = resizeShop(doc, 9, 8)!
    expect(next).toMatchObject({ wallHeight: 3.8, entrance: { position: 0.8, open: true } })
    const parsed = parseShop(JSON.stringify(next))!
    expect(parsed).toEqual(next)
    expect(parsed.entrance).not.toBe(next.entrance)
    expect(updateItem(parsed, 'bookshelf', { stock: 'vinyl' }).entrance).toEqual(doc.entrance)
  })

  it('keeps absent legacy entrance rotation as an effective zero without inserting fields', () => {
    for (const version of [1, 2] as const) {
      const old = { ...createEmptyShop(), version, entrance: { position: 0.4, open: true } }
      const parsed = parseShop(JSON.stringify(old))!
      expect(parsed).toEqual(old)
      expect(getEntranceRotation(parsed)).toBe(0)
      expect(getEntrance(parsed)).toEqual({ position: 0.4, open: true })
      expect(setEntrance(parsed, { rotation: 0 })).toBe(parsed)
      expect(setEntrance(parsed, {})).toBe(parsed)
    }
    const absent = createEmptyShop()
    expect(getEntranceRotation(absent)).toBe(0)
    expect(setEntrance(absent, { rotation: 0 })).toBe(absent)
    expect(absent.entrance).toBeUndefined()
  })

  it.each([0, 90, 180, 270] as const)('round-trips explicit %s degree entrance orientation in both document versions', rotation => {
    for (const version of [1, 2] as const) {
      const doc = { ...createEmptyShop(), version, entrance: { position: 0.3, open: true, rotation } }
      const parsed = parseShop(JSON.stringify(doc))!
      expect(parsed).toEqual(doc)
      expect(parsed.entrance).not.toBe(doc.entrance)
      expect(getEntranceRotation(parsed)).toBe(rotation)
      expect(setEntrance(parsed, { rotation })).toBe(parsed)
      const detached = getEntrance(parsed)
      detached.rotation = rotation === 0 ? 90 : 0
      expect(getEntranceRotation(parsed)).toBe(rotation)
    }
  })

  it('preserves orientation while moving and opening, with immutable snapshots for undo', () => {
    const original = createInitialShop()
    const rotated = setEntrance(original, { rotation: 270 })
    const moved = setEntrance(rotated, { position: 0.333333 })
    const opened = setEntrance(moved, { open: true })
    expect(rotated.entrance).toEqual({ position: 0.72, open: false, rotation: 270 })
    expect(moved.entrance).toEqual({ position: 0.333, open: false, rotation: 270 })
    expect(opened.entrance).toEqual({ position: 0.333, open: true, rotation: 270 })
    expect(original.entrance).toBeUndefined()
    expect(opened.items).toBe(original.items)
    expect(opened.wallItems).toBe(original.wallItems)
    const reset = setEntrance(opened, { rotation: 0 })
    expect(reset.entrance).toEqual({ position: 0.333, open: true, rotation: 0 })
    expect(getEntranceRotation(opened)).toBe(270)
    expect(setEntrance(reset, { position: 0.3331, open: true, rotation: 0 })).toBe(reset)
    expect(parseShop(JSON.stringify(reset))).toEqual(reset)
    expect(resizeShop(opened, 9, 8)!.entrance).toEqual(opened.entrance)
    expect(paintFloor(opened, [{ x: -1, z: 0 }], 'add').entrance).toEqual(opened.entrance)
  })

  it('rejects non-quarter-turn and malformed rotations without accepting a partial edit', () => {
    const original = setEntrance(createEmptyShop(), { rotation: 90 })
    for (const rotation of [-90, 45, 360, 90.1, NaN, Infinity, '90', null, undefined, true, {}]) {
      expect(parseShop({ ...original, entrance: { position: 0.3, open: false, rotation } })).toBeNull()
      expect(setEntrance(original, { position: 0.5, rotation } as Partial<Entrance>)).toBe(original)
    }
    expect(parseShop({ ...original, entrance: { rotation: 90, open: false } })).toBeNull()
    expect(parseShop({ ...original, entrance: { position: 0.3, rotation: 90 } })).toBeNull()
    expect(setEntrance(original, { rotation: 180, extra: 1 } as Partial<Entrance>)).toBe(original)
  })

  it('rejects malformed optional architecture and unknown nested fields', () => {
    const doc = createInitialShop()
    for (const patch of [
      { wallHeight: null }, { wallHeight: undefined }, { wallHeight: '3' }, { wallHeight: 9 },
      { entrance: null }, { entrance: [] }, { entrance: { position: -1, open: false } },
      { entrance: { position: 0.5, open: 'true' } }, { entrance: { position: 0.5 } },
      { entrance: { position: 0.5, open: true, extra: 1 } },
    ]) expect(parseShop({ ...doc, ...patch })).toBeNull()
  })
})

describe('free-shaped tile floors', () => {
  const square = () => resizeShop(createEmptyShop(), 4, 4)!
  const lShape = () => paintFloor(square(), [{x:2,z:2},{x:3,z:2},{x:2,z:3},{x:3,z:3}], 'erase')

  it('turns a rectangle into an L without changing the coordinate anchor', () => {
    const source = square()
    const next = paintFloor(source, [{x:2,z:2},{x:3,z:2},{x:2,z:3},{x:3,z:3}], 'erase')
    expect(getFloorCells(next)).toHaveLength(12)
    expect(next.width).toBe(source.width)
    expect(next.depth).toBe(source.depth)
    expect(source.floorCells).toBeUndefined()
    expect(hasFloorCell(next, 1, 3)).toBe(true)
    expect(hasFloorCell(next, 2, 3)).toBe(false)
    expect(canPlace(next, item('table', 0, 2))).toBe(true)
    expect(canPlace(next, item('table', 1, 2))).toBe(false)
    expect(canPlace(next, item('plant', 3, 3))).toBe(false)
    expect(parseShop(next)).toEqual(next)
  })

  it('adds negative and extended coordinates without relocating existing furniture', () => {
    const source = placeItem(square(), item('plant', 1, 1))
    const next = paintFloor(source, [{x:-1,z:0},{x:-1,z:1},{x:4,z:2},{x:5,z:2}], 'add')
    expect(next.items).toBe(source.items)
    expect(next).toMatchObject({width:4,depth:4})
    expect(getFloorBounds(next)).toEqual({minX:-1,minZ:0,maxX:5,maxZ:3,width:7,depth:4})
    const withShelf = placeItem(next, item('shelf', -1, 0, {rotation:90}))
    expect(withShelf.items).toHaveLength(2)
    expect(parseShop(withShelf)).toEqual(withShelf)
    expect(resizeShop(next, 8, 8)).toBeNull()
  })

  it('protects all occupied floor cells including rotated furniture and rugs', () => {
    let doc = placeItem(square(), item('shelf', 0, 0, {rotation:90}))
    doc = placeItem(doc, item('rug', 2, 2))
    const next = paintFloor(doc, getFloorCells(doc), 'erase')
    expect(getFloorCells(next)).toHaveLength(6)
    expect(next.items).toBe(doc.items)
    expect(canPlace(next, next.items[0], next.items[0].id)).toBe(true)
    expect(canPlace(next, next.items[1], next.items[1].id)).toBe(true)
    expect(paintFloor(next, getFloorCells(next), 'erase')).toBe(next)
  })

  it('deduplicates brush input, rejects invalid tiles and allows removing the final unoccupied tile', () => {
    const source = square()
    expect(paintFloor(source, [{x:0,z:0},{x:0,z:0}], 'add')).toBe(source)
    const next = paintFloor(source, [{x:MIN_FLOOR_COORD,z:MAX_FLOOR_COORD},{x:MIN_FLOOR_COORD,z:MAX_FLOOR_COORD}], 'add')
    expect(getFloorCells(next)).toHaveLength(17)
    expect(paintFloor(source, [{x:MIN_FLOOR_COORD-1,z:0},{x:MAX_FLOOR_COORD+1,z:0},{x:.5,z:0},{x:NaN,z:0}], 'add')).toBe(source)
    expect(getFloorCells(paintFloor(source, getFloorCells(source), 'erase'))).toHaveLength(0)
  })

  it('places the entrance on an actual front edge of an L at every position', () => {
    for (const position of [0,.2,.5,.72,1]) {
      const doc = setEntrance(lShape(), {position})
      const anchor = getEntranceAnchor(doc)
      const x = Math.floor(anchor.x + doc.width / 2)
      const z = Math.round(anchor.z + doc.depth / 2 - .09)
      expect(hasFloorCell(doc, x, z-1)).toBe(true)
      expect(hasFloorCell(doc, x, z)).toBe(false)
      expect(anchor.width).toBe(1.84)
    }
    const tiny = {...square(), floorCells:[{x:1,z:1}]}
    expect(getEntranceAnchor(tiny)).toMatchObject({width:.85})
  })

  it('keeps the original rectangular entrance positioning for legacy saves', () => {
    const doc = createEmptyShop()
    expect(getEntranceAnchor(doc).x).toBeCloseTo(-doc.width/2 + 1.1 + .72*(doc.width-2.2))
    expect(getEntranceAnchor(doc).z).toBeCloseTo(doc.depth/2+.09)
  })

  it('round-trips custom shapes and rejects malformed or unsupported floor data', () => {
    const doc = lShape()
    const parsed = parseShop(JSON.stringify(doc))!
    expect(parsed).toEqual(doc)
    expect(parsed.floorCells).not.toBe(doc.floorCells)
    expect(parseShop({...doc,floorCells:[]})).toEqual({...doc,floorCells:[]})
    for (const floorCells of [null,[{x:0,z:0},{x:0,z:0}],[{x:16,z:0}],[{x:0,z:0,extra:1}],[{x:0.1,z:0}]]) {
      expect(parseShop({...doc,floorCells})).toBeNull()
    }
    expect(parseShop({...doc,items:[item('table',2,2)]})).toBeNull()
  })
})

describe('safe import and persistence', () => {
  it('round-trips JSON and returns detached items', () => {
    const source = createInitialShop()
    const parsed = parseShop(JSON.stringify(source))!
    expect(parsed).toEqual(source)
    const detached = parseShop(source)!
    expect(detached).not.toBe(source)
    expect(detached.items[0]).not.toBe(source.items[0])
    detached.items[0]!.color = '#000000'
    expect(source.items[0]!.color).not.toBe('#000000')
  })

  it.each([null, undefined, [], 42, true, 'broken json', '{}', 'x'.repeat(128_001)])('rejects malformed root value %#', value => {
    expect(parseShop(value)).toBeNull()
  })

  it('rejects unsupported versions, dimensions, colors, names and unknown fields', () => {
    const source = createEmptyShop()
    for (const patch of [
      { version: 3 }, { version: '1' }, { width: 3 }, { depth: 11 }, { width: 5.5 },
      { width: NaN }, { wallColor: 'url(javascript:bad)' }, { floorColor: '#fff' },
      { name: '' }, { name: '   ' }, { name: 'x'.repeat(81) }, { name: 'a\u0000b' },
      { items: null }, { extra: 'unsupported' },
    ]) expect(parseShop({ ...source, ...patch })).toBeNull()
    expect(parseShop({ ...source, name: '  Toko Cerita  ' })?.name).toBe('Toko Cerita')
  })

  it('rejects duplicate IDs, collisions, off-grid items, and clipped rugs', () => {
    const first = item('shelf', 0, 0)
    for (const items of [
      [first, { ...first, x: 3 }],
      [first, item('plant', 1, 0)],
      [item('shelf', 6, 5)],
      [item('rug', 6, 5)],
      [item('plant', 0.1, 1)],
    ]) expect(parseShop({ ...createEmptyShop(), items })).toBeNull()
  })

  it('rejects invalid item fields and stock on decor', () => {
    const valid = item('shelf', 0, 0)
    for (const patch of [
      { id: '' }, { id: 'a'.repeat(65) }, { id: '../escape' }, { kind: '__proto__' },
      { kind: 'unknown' }, { rotation: 45 }, { rotation: '90' }, { color: '#ABC' },
      { stock: 'unknown' }, { x: Infinity }, { z: -1 }, { extra: true },
      { kind: 'plant', stock: 'books' },
    ]) expect(parseShop({ ...createEmptyShop(), items: [{ ...valid, ...patch }] })).toBeNull()
    const incomplete = { ...valid } as Partial<ShopItem>
    delete incomplete.color
    expect(parseShop({ ...createEmptyShop(), items: [incomplete] })).toBeNull()
  })

  it('rejects inherited document shapes and prototype pollution properties', () => {
    expect(parseShop(Object.create(createEmptyShop()))).toBeNull()
    const polluted = JSON.stringify(createEmptyShop()).replace('"version":2', '"version":2,"__proto__":{"polluted":true}')
    expect(parseShop(polluted)).toBeNull()
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('rejects excessively large arrays before processing placements', () => {
    expect(parseShop({ ...createEmptyShop(), items: new Array(201).fill(item('plant', 0, 0)) })).toBeNull()
  })
})
