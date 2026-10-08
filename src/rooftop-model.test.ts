import { describe, expect, it } from 'vitest'
import {
  MAX_LEVELS, canPlace, canPlaceLevelItem, canPlaceRooftop, createBlankShop, createEmptyShop, createInitialShop, createItem,
  ensureRooftopAccess, getFloorCells, getItemFootprint, getLevelCount, getLevelDocument, getRoof, getRooftopDocument, hasRooftopAccess,
  paintFloor, parseShop, placeItem, removeItem, replaceLevelDocument, replaceRooftopDocument, setLevelCount, setRoof,
  updateItem, type Rotation, type ShopDocument,
} from './model'

describe('authored outdoor rooftop', () => {
  it('converts a tiled shop to an editable deck with seating, plants, and an accessible flight', () => {
    const before = createInitialShop()
    const snapshot = JSON.stringify(before)
    const building = setRoof(before, { style: 'rooftop' })
    const roof = getRooftopDocument(building)
    const top = getLevelDocument(building, 1)
    const stairs = top.items.find(item => item.kind === 'stairs')!
    expect(getLevelCount(building)).toBe(2)
    expect(stairs).toMatchObject({ x: 0, z: 1, depth: 4 })
    expect(canPlace(top, stairs, stairs.id)).toBe(true)
    expect(top.items.filter(item => item.kind !== 'stairs')).toEqual(before.upperFloors![0].items)
    expect(roof.items.map(item => item.kind)).toEqual(['dining-table', 'stool', 'stool', 'plant', 'plant'])
    expect(roof.width).toBe(top.width)
    expect(roof.depth).toBe(top.depth)
    expect(getFloorCells(roof)).toEqual(getFloorCells(top))
    expect(roof.wallItems).toEqual([])
    expect(roof.partitions).toEqual([])
    expect(roof.interiorDoors).toEqual([])
    for (const item of roof.items) expect(canPlaceRooftop(building, item, item.id)).toBe(true)
    expect(JSON.stringify(before)).toBe(snapshot)
    expect(parseShop(JSON.stringify(building))).toEqual(building)
    expect(ensureRooftopAccess(building)).toBe(building)
    expect(setRoof(building, { style: 'rooftop' })).toBe(building)
  })

  it('edits outdoor furniture without changing the floor below, and persists it through tiled mode', () => {
    const building = setRoof(createInitialShop(), { style: 'rooftop' })
    const roof = getRooftopDocument(building)
    const table = roof.items.find(item => item.kind === 'dining-table')!
    const changed = updateItem(roof, table.id, { color: '#123456' })
    const edited = replaceRooftopDocument(building, { ...changed, floorColor: '#AA9988' })
    expect(edited.items).toBe(building.items)
    expect(edited.upperFloors).toBe(building.upperFloors)
    expect(edited.rooftop!.floorColor).toBe('#AA9988')
    expect(edited.rooftop!.items.find(item => item.id === table.id)!.color).toBe('#123456')
    expect(replaceRooftopDocument(edited, getRooftopDocument(edited))).toBe(edited)
    const tiled = setRoof(edited, { style: 'tiles' })
    const restored = setRoof(parseShop(JSON.stringify(tiled))!, { style: 'rooftop' })
    expect(restored.rooftop).toEqual(edited.rooftop)
    expect(building.rooftop!.items.find(item => item.id === table.id)!.color).not.toBe('#123456')
    expect(getRoof(tiled).style).toBe('tiles')
    const parsed = parseShop(edited)!
    parsed.rooftop!.items[0].color = '#000000'
    expect(edited.rooftop!.items[0].color).toBe('#123456')
  })

  it('respects a deliberately cleared roof and does not respawn starter furniture', () => {
    const building = setRoof(createInitialShop(), { style: 'rooftop', garden: true })
    const cleared = replaceRooftopDocument(building, { ...getRooftopDocument(building), items: [] })
    expect(getRooftopDocument(cleared).items).toEqual([])
    expect(getRooftopDocument(parseShop(cleared)!).items).toEqual([])
    expect(setRoof(setRoof(cleared, { style: 'tiles' }), { style: 'rooftop' }).rooftop!.items).toEqual([])
  })

  it('presents legacy gardens as deterministic editable furniture without mutating the saved source', () => {
    const legacy: ShopDocument = { ...createEmptyShop(), roof: { style: 'rooftop', color: '#DDDABC', garden: true } }
    expect(parseShop(legacy)).toEqual(legacy)
    const first = getRooftopDocument(legacy)
    const second = getRooftopDocument(legacy)
    expect(first).toEqual(second)
    expect(first.items.some(item => item.kind === 'plant')).toBe(true)
    expect(first.items.some(item => item.kind === 'dining-table')).toBe(true)
    expect(first.items[0]).not.toBe(second.items[0])
    expect(legacy).not.toHaveProperty('rooftop')
    const edited = replaceRooftopDocument(legacy, removeItem(first, first.items[0].id))
    expect(edited.rooftop!.items).toHaveLength(first.items.length - 1)
    expect(parseShop(edited)).toEqual(edited)
  })

  it('follows irregular supported contours and refuses structural roof edits', () => {
    const top = paintFloor(createEmptyShop(), [{ x: 3, z: 3 }], 'erase')
    const building = setRoof({ ...top, items: [] }, { style: 'rooftop' })
    const roof = getRooftopDocument(building)
    expect(getFloorCells(roof)).toEqual(getFloorCells(top))
    expect(canPlaceRooftop(building, { ...createItem('plant'), x: 3, z: 3 })).toBe(false)
    expect(replaceRooftopDocument(building, { ...roof, width: 9 })).toBe(building)
    expect(replaceRooftopDocument(building, paintFloor(roof, [{ x: 7, z: 0 }], 'add'))).toBe(building)
    expect(replaceRooftopDocument(building, { ...roof, partitions: [{ id: 'wall', axis: 'x', line: 2, start: 2, end: 4, color: '#FFFFFF' }] })).toBe(building)
  })
})

describe('rooftop access and placement', () => {
  it.each([0, 90, 180, 270] as Rotation[])('reserves the stair flight and its upper landing for rotation %s', rotation => {
    const stairs = { ...createItem('stairs'), x: 2, z: 2, rotation }
    const building: ShopDocument = { ...createEmptyShop(), width: 10, depth: 10, items: [stairs], rooftop: { items: [], floorColor: '#DDCCAA' } }
    const size = getItemFootprint(stairs)
    for (let x = stairs.x; x < stairs.x + size.width; x++) for (let z = stairs.z; z < stairs.z + size.depth; z++) {
      const plant = { ...createItem('plant'), x, z }
      expect(canPlace(getRooftopDocument(building), plant)).toBe(true)
      expect(canPlaceRooftop(building, plant)).toBe(false)
      expect(replaceRooftopDocument(building, placeItem(getRooftopDocument(building), plant))).toBe(building)
    }
    const exit = {
      0: { x: stairs.x, z: stairs.z - 1 }, 90: { x: stairs.x + size.width, z: stairs.z },
      180: { x: stairs.x, z: stairs.z + size.depth }, 270: { x: stairs.x - 1, z: stairs.z },
    }[rotation]
    expect(canPlaceRooftop(building, { ...createItem('plant'), ...exit })).toBe(false)
    expect(canPlaceRooftop(building, { ...createItem('rug'), x: stairs.x, z: stairs.z })).toBe(false)
    expect(canPlaceRooftop(building, { ...createItem('plant'), x: 9, z: 9 })).toBe(true)
  })

  it('rejects colliding roof furniture, stairs that lead nowhere, and signs outside the deck', () => {
    const building: ShopDocument = { ...createEmptyShop(), rooftop: { items: [{ ...createItem('plant'), id: 'existing', x: 4, z: 4 }], floorColor: '#DDCCAA' } }
    expect(canPlaceRooftop(building, { ...createItem('stool'), x: 4, z: 4 })).toBe(false)
    expect(canPlaceRooftop(building, { ...createItem('stairs'), x: 0, z: 0 })).toBe(false)
    const sign = { ...createItem('chalkboard'), x: 2, z: 6 }
    expect(canPlace(getRooftopDocument(building), sign)).toBe(true)
    expect(canPlaceRooftop(building, sign)).toBe(false)
    expect(canPlaceRooftop(building, building.rooftop!.items[0], 'existing')).toBe(true)
  })

  it('adds a compact access flight on a four-by-four shop, or leaves occupied/unbuilt layouts intact', () => {
    const compact = ensureRooftopAccess({ ...createEmptyShop(), width: 4, depth: 4 })
    expect(compact.items).toHaveLength(1)
    expect(compact.items[0]).toMatchObject({ kind: 'stairs', x: 0, z: 1, depth: 3 })
    const full: ShopDocument = {
      ...createEmptyShop(), width: 4, depth: 4,
      items: Array.from({ length: 16 }, (_, index) => ({ ...createItem('plant'), x: index % 4, z: Math.floor(index / 4) })),
    }
    expect(ensureRooftopAccess(full)).toBe(full)
    expect(setRoof(full, { style: 'rooftop' }).items).toBe(full.items)
    const blank = createBlankShop()
    expect(ensureRooftopAccess(blank)).toBe(blank)
    const blankRoof = setRoof(blank, { style: 'rooftop' })
    expect(blankRoof.rooftop!.items).toEqual([])
    expect(parseShop(blankRoof)).toEqual(blankRoof)
  })

  it('does not add or move stairs through previously authored roof furniture', () => {
    const roofItems = Array.from({ length: 42 }, (_, index) => ({ ...createItem('plant'), x: index % 7, z: Math.floor(index / 7) }))
    const fullRoof: ShopDocument = { ...createEmptyShop(), rooftop: { items: roofItems, floorColor: '#DDCCAA' } }
    expect(ensureRooftopAccess(fullRoof)).toBe(fullRoof)
    expect(getRooftopDocument(fullRoof).items).toEqual(roofItems)
    const building = setRoof(createInitialShop(), { style: 'rooftop' })
    const top = getLevelDocument(building, 1)
    const stair = top.items.find(item => item.kind === 'stairs')!
    const emptyTop = { ...top, items: [stair] }
    const uncluttered = replaceLevelDocument(building, 1, emptyTop)
    const moved = updateItem(getLevelDocument(uncluttered, 1), stair.id, { x: 6, z: 5 })
    expect(moved).not.toBe(getLevelDocument(uncluttered, 1))
    expect(replaceLevelDocument(uncluttered, 1, moved)).toBe(uncluttered)
  })

  it('recovers from unusable edge stairs and never restores deleted access merely by selecting the roof', () => {
    const edgeStair = { ...createItem('stairs'), x: 0, z: 0 }
    const edge: ShopDocument = { ...createEmptyShop(), items: [edgeStair], rooftop: { items: [{ ...createItem('plant'), x: 6, z: 5 }], floorColor: '#DDCCAA' } }
    expect(hasRooftopAccess(edge)).toBe(false)
    const repaired = ensureRooftopAccess(edge)
    expect(hasRooftopAccess(repaired)).toBe(true)
    expect(repaired.items).toContainEqual(edgeStair)
    expect(repaired.rooftop).toBe(edge.rooftop)
    expect(parseShop(repaired)).toEqual(repaired)
    const converted = setRoof(createEmptyShop(), { style: 'rooftop' })
    const noAccess = replaceLevelDocument(converted, 0, { ...converted, items: [] })
    expect(hasRooftopAccess(noAccess)).toBe(false)
    expect(setRoof(noAccess, { style: 'rooftop' })).toBe(noAccess)
    expect(hasRooftopAccess(setRoof(noAccess, { color: '#123456' }))).toBe(false)
    const legacy: ShopDocument = { ...createEmptyShop(), roof: { style: 'rooftop', color: '#DDCCAA', garden: false } }
    expect(setRoof(legacy, { style: 'rooftop' })).toBe(legacy)
  })

  it.each([1, 2])('previews top-storey stair moves, rotations, and sizes consistently in a %s-storey building', count => {
    const stairs = { ...createItem('stairs'), x: 2, z: 2 }
    const floor: ShopDocument = { ...createEmptyShop(), width: 10, depth: 10, items: [stairs] }
    const building: ShopDocument = {
      ...(count === 1 ? floor : { ...createEmptyShop(), width: 10, depth: 10, upperFloors: [floor] }),
      rooftop: { items: [{ ...createItem('plant'), x: 4, z: 3 }], floorColor: '#DDCCAA' },
    }
    const level = count - 1
    expect(parseShop(building)).toEqual(building)
    for (const patch of [{ x: 3 }, { rotation: 90 as const }, { width: 3 }]) {
      const candidate = { ...stairs, ...patch }
      expect(canPlace(floor, candidate, stairs.id)).toBe(true)
      expect(canPlaceLevelItem(building, level, candidate, stairs.id)).toBe(false)
      expect(replaceLevelDocument(building, level, updateItem(floor, stairs.id, patch))).toBe(building)
    }
    const clear = { ...stairs, x: 6, z: 2 }
    expect(canPlaceLevelItem(building, level, clear, stairs.id)).toBe(true)
    expect(replaceLevelDocument(building, level, updateItem(floor, stairs.id, clear))).not.toBe(building)
    const addedStairs = { ...createItem('stairs'), x: 4, z: 4 }
    expect(canPlace(floor, addedStairs)).toBe(true)
    expect(canPlaceLevelItem(building, level, addedStairs)).toBe(false)
    expect(canPlaceLevelItem(building, level, { ...createItem('plant'), x: 4, z: 4 })).toBe(true)
    if (count > 1) expect(canPlaceLevelItem(building, 0, addedStairs)).toBe(true)
    for (const invalid of [-1, count, 0.5, NaN]) expect(canPlaceLevelItem(building, invalid, clear, stairs.id)).toBe(false)
  })
})

describe('rooftop persistence across building edits', () => {
  it.each([1, 2, 3, 4])('retains the rooftop and its access above %s interior floors', count => {
    const original = setRoof(createInitialShop(), { style: 'rooftop' })
    const snapshot = JSON.stringify(original)
    const building = setLevelCount(original, count)
    expect(MAX_LEVELS).toBe(4)
    expect(getLevelCount(building)).toBe(count)
    expect(building.rooftop).toEqual(original.rooftop)
    expect(getLevelDocument(building, count - 1).items.some(item => item.kind === 'stairs')).toBe(true)
    expect(parseShop(JSON.stringify(building))).toEqual(building)
    expect(JSON.stringify(original)).toBe(snapshot)
    expect(setLevelCount(building, 5)).toBe(building)
  })

  it('rejects contour changes or floor removal that would leave authored roof furniture unsupported', () => {
    const smallGround = { ...createEmptyShop(), width: 4, depth: 4 }
    const wideTop = { ...createEmptyShop(), width: 10, depth: 10 }
    const building: ShopDocument = { ...smallGround, upperFloors: [wideTop], rooftop: { items: [{ ...createItem('plant'), x: 9, z: 9 }], floorColor: '#DDCCAA' } }
    expect(parseShop(building)).toEqual(building)
    expect(setLevelCount(building, 1)).toBe(building)
    const removedSupport = paintFloor(wideTop, [{ x: 9, z: 9 }], 'erase')
    expect(replaceLevelDocument(building, 1, removedSupport)).toBe(building)
    const groundChange = replaceLevelDocument(building, 0, { ...smallGround, floorColor: '#AABBCC', rooftop: { items: [], floorColor: '#000000' } })
    expect(groundChange.rooftop).toBe(building.rooftop)
    expect(groundChange.floorColor).toBe('#AABBCC')
  })

  it('strictly validates rooftop payloads and forbids nested building metadata', () => {
    const building = createEmptyShop()
    const item = { ...createItem('plant'), x: 3, z: 3 }
    const valid = { items: [item], floorColor: '#DDCCAA' }
    for (const rooftop of [null, [], {}, { ...valid, extra: true }, { ...valid, floorColor: 'red' }, { ...valid, items: 'items' }, { ...valid, items: [item, item] }, { ...valid, items: [createItem('stairs')] }, { ...valid, items: [{ ...item, z: 7 }] }]) {
      expect(parseShop({ ...building, rooftop })).toBeNull()
    }
    expect(parseShop({ ...building, upperFloors: [{ ...building, rooftop: valid }] })).toBeNull()
    const saved = { ...building, rooftop: valid }
    const parsed = parseShop(saved)!
    expect(parsed).toEqual(saved)
    expect(parsed.rooftop).not.toBe(saved.rooftop)
    expect(parsed.rooftop!.items).not.toBe(saved.rooftop.items)
    expect(parsed.rooftop!.items[0]).not.toBe(saved.rooftop.items[0])
    const stairCollision = { ...saved, items: [{ ...createItem('stairs'), x: 2, z: 2 }] }
    expect(parseShop(stairCollision)).toBeNull()
  })
})
