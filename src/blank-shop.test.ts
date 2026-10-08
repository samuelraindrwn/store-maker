import { describe, expect, it } from 'vitest'
import {
  canPlace, canPlaceWallItem, createBlankShop, createEmptyShop, createInitialShop, createItem, createWallItem,
  getEntrance, getEntranceAnchor, getFloorBounds, getFloorCells, getItemPlacementBounds, getWallItems, getWallRuns,
  hasFloorCell, paintFloor, parseShop, placeItem, placeWallItem, removeItem, removeWallItem, resizeShop,
  setEntrance, setWallHeight, upgradeShop, type ShopDocument,
} from './model'

describe('completely blank shop documents', () => {
  it('creates a new unbuilt plot while retaining the old furnished and empty-room constructors', () => {
    const blank = createBlankShop()
    expect(blank).toEqual({ ...createEmptyShop(), floorCells: [] })
    expect(blank).toMatchObject({ version: 2, name: 'Toko Kecilku', width: 7, depth: 6, items: [], wallItems: [], floorCells: [] })
    expect(getFloorCells(blank)).toEqual([])
    expect(getWallRuns(blank)).toEqual([])
    expect(getWallItems(blank)).toEqual([])
    expect(getFloorCells(createEmptyShop())).toHaveLength(42)
    expect(createEmptyShop()).not.toHaveProperty('floorCells')
    expect(createInitialShop().items).toHaveLength(13)
    expect(createInitialShop().wallItems).toHaveLength(2)
    const other = createBlankShop()
    expect(other.items).not.toBe(blank.items)
    expect(other.wallItems).not.toBe(blank.wallItems)
    expect(other.floorCells).not.toBe(blank.floorCells)
  })

  it('round-trips an intentional blank design through autosave and migration without restoring decorations', () => {
    const source = createBlankShop()
    let saved = JSON.stringify(source)
    for (let i = 0; i < 4; i++) {
      const loaded = parseShop(saved)!
      expect(loaded).toEqual(source)
      expect(loaded.floorCells).not.toBe(source.floorCells)
      expect(loaded.items).not.toBe(source.items)
      expect(loaded.wallItems).not.toBe(source.wallItems)
      expect(upgradeShop(loaded)).toBe(loaded)
      expect(getWallItems(loaded)).toEqual([])
      saved = JSON.stringify(upgradeShop(loaded))
    }
    expect(parseShop(source)).toEqual(source)
  })

  it('provides finite logical bounds and a dormant entrance anchor for camera and build-grid layout', () => {
    const blank = createBlankShop()
    expect(getFloorBounds(blank)).toEqual({ minX: 0, minZ: 0, maxX: 6, maxZ: 5, width: 7, depth: 6 })
    expect(getItemPlacementBounds(blank, 'chalkboard')).toEqual({ minX: 0, minZ: 0, maxX: 6, maxZ: 5 })
    expect(getEntrance(blank)).toEqual({ position: 0.72, open: false })
    expect(Object.values(getEntranceAnchor(blank)).every(Number.isFinite)).toBe(true)
    const resized = resizeShop(blank, 4, 10)!
    expect(resized.floorCells).toEqual([])
    expect(getFloorBounds(resized)).toEqual({ minX: 0, minZ: 0, maxX: 3, maxZ: 9, width: 4, depth: 10 })
    expect(Object.values(getEntranceAnchor(resized)).every(Number.isFinite)).toBe(true)
    expect(parseShop(resized)).toEqual(resized)
  })

  it('accepts zero tiles only in version two and rejects unsupported items on that empty plot', () => {
    const blank = createBlankShop()
    expect(parseShop({ ...blank, version: 1 })).toBeNull()
    expect(parseShop({ ...blank, floorCells: null })).toBeNull()
    for (const item of [createItem('plant'), { ...createItem('chalkboard'), z: 6 }]) {
      expect(canPlace(blank, item)).toBe(false)
      expect(placeItem(blank, item)).toBe(blank)
      expect(parseShop({ ...blank, items: [item] })).toBeNull()
    }
    const lamp = createWallItem('wall-lamp')
    expect(canPlaceWallItem(blank, lamp)).toBe(false)
    expect(placeWallItem(blank, lamp)).toBe(blank)
    expect(parseShop({ ...blank, wallItems: [lamp] })).toBeNull()
    const implicitWalls = { ...blank }
    delete implicitWalls.wallItems
    expect(parseShop(implicitWalls)).toEqual(implicitWalls)
    expect(getWallItems(implicitWalls)).toEqual([])
  })
})

describe('building from an empty plot', () => {
  it('adds the first negative tile without changing the coordinate anchor or introducing items', () => {
    const blank = createBlankShop()
    const first = paintFloor(blank, [{ x: -2, z: -1 }], 'add')
    expect(first).not.toBe(blank)
    expect(first).toMatchObject({ width: 7, depth: 6, floorCells: [{ x: -2, z: -1 }], items: [], wallItems: [] })
    expect(getFloorBounds(first)).toEqual({ minX: -2, maxX: -2, minZ: -1, maxZ: -1, width: 1, depth: 1 })
    expect(getWallRuns(first)).toEqual([
      { wall: 'back', line: -1, start: -2, end: -1 }, { wall: 'left', line: -2, start: -1, end: 0 },
    ])
    const furnished = placeItem(first, { ...createItem('plant'), x: -2, z: -1 })
    expect(furnished.items).toHaveLength(1)
    expect(parseShop(furnished)).toEqual(furnished)
    expect(blank.floorCells).toEqual([])
  })

  it('builds an L with deduplicated brush cells and still has no synthesized legacy decorations', () => {
    const blank = createBlankShop()
    const built = paintFloor(blank, [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: 1 }, { x: 0, z: 2 }], 'add')
    expect(getFloorCells(built)).toHaveLength(4)
    expect(hasFloorCell(built, 1, 1)).toBe(false)
    expect(getWallItems(built)).toEqual([])
    expect(built.items).toEqual([])
    expect(parseShop(built)).toEqual(built)
    expect(paintFloor(blank, [{ x: -9, z: 0 }, { x: 0, z: 16 }, { x: 0.5, z: 0 }], 'add')).toBe(blank)
    expect(paintFloor(blank, [{ x: 0, z: 0 }], 'erase')).toBe(blank)
  })

  it('keeps optional entrance and wall settings without creating a shell before the first tile', () => {
    const configured = setEntrance(setWallHeight(createBlankShop(), 3.2), { position: 0.2, open: true, rotation: 90 })
    expect(configured.floorCells).toEqual([])
    expect(configured.wallItems).toEqual([])
    expect(configured.items).toEqual([])
    expect(parseShop(configured)).toEqual(configured)
    const first = paintFloor(configured, [{ x: 2, z: 2 }], 'add')
    expect(first.entrance).toEqual(configured.entrance)
    expect(first.wallHeight).toBe(3.2)
    expect(first.wallItems).toEqual([])
  })
})

describe('removing the final floor tile without losing objects', () => {
  it('can erase the final tile and rebuild it, retaining immutable previous documents for undo', () => {
    const blank = createBlankShop()
    const first = paintFloor(blank, [{ x: 1, z: 2 }], 'add')
    const erased = paintFloor(first, [{ x: 1, z: 2 }], 'erase')
    expect(erased).toEqual(blank)
    expect(first.floorCells).toEqual([{ x: 1, z: 2 }])
    expect(blank.floorCells).toEqual([])
    expect(parseShop(erased)).toEqual(blank)
    expect(paintFloor(erased, [{ x: 1, z: 2 }], 'add')).toEqual(first)
  })

  it('can erase all unoccupied legacy rectangle tiles and saves the new state as version two', () => {
    const source: ShopDocument = { ...createEmptyShop(), version: 1 }
    const cleared = paintFloor(source, getFloorCells(source), 'erase')
    expect(cleared).toEqual(createBlankShop())
    expect(source.version).toBe(1)
    expect(source.floorCells).toBeUndefined()
    expect(parseShop(cleared)).toEqual(cleared)
    expect(upgradeShop(cleared)).toBe(cleared)
  })

  it('protects the last tile supporting floor furniture until that furniture is removed', () => {
    const floor = paintFloor(createBlankShop(), [{ x: 0, z: 0 }], 'add')
    const item = createItem('stool')
    const furnished = placeItem(floor, item)
    expect(paintFloor(furnished, [{ x: 0, z: 0 }], 'erase')).toBe(furnished)
    const cleared = paintFloor(removeItem(furnished, item.id), [{ x: 0, z: 0 }], 'erase')
    expect(cleared).toEqual(createBlankShop())
  })

  it('rejects deleting the last tile when an outdoor sign or wall accessory would lose its support', () => {
    const floor = paintFloor(createBlankShop(), [{ x: 0, z: 0 }], 'add')
    const sign = { ...createItem('chalkboard'), z: 1 }
    const outdoor = placeItem(floor, sign)
    expect(outdoor.items).toHaveLength(1)
    expect(paintFloor(outdoor, [{ x: 0, z: 0 }], 'erase')).toBe(outdoor)
    expect(outdoor.items[0]).toEqual(sign)
    const lamp = { ...createWallItem('wall-lamp'), offset: 0.5 }
    const decorated = placeWallItem(floor, lamp)
    expect(decorated.wallItems).toHaveLength(1)
    expect(paintFloor(decorated, [{ x: 0, z: 0 }], 'erase')).toBe(decorated)
    const cleared = paintFloor(removeWallItem(decorated, lamp.id), [{ x: 0, z: 0 }], 'erase')
    expect(cleared).toEqual(createBlankShop())
  })
})
