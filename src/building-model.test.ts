import { describe, expect, it } from 'vitest'
import {
  CATALOG, MAX_LEVELS, canPlace, createBlankShop, createEmptyShop, createInitialShop, createItem,
  getExterior, getFloorCells, getLevelCount, getLevelDocument, getRoof, paintFloor, parseShop,
  placeItem, renameShop, replaceLevelDocument, setExterior, setLevelCount, setRoof, updateItem, upgradeShop,
  type ExteriorDesign, type RoofDesign, type ShopDocument,
} from './model'

describe('building floors and starter layout', () => {
  it('starts with a collision-free store, ground bathroom and connecting stairs, and upstairs storage', () => {
    const doc = createInitialShop()
    expect(getLevelCount(doc)).toBe(2)
    for (const kind of ['toilet', 'washbasin', 'shower']) expect(doc.items.filter(item => item.kind === kind)).toHaveLength(1)
    expect(doc.partitions).toHaveLength(2)
    expect(doc.interiorDoors).toHaveLength(1)
    expect(doc.items.filter(item => item.kind === 'stairs')).toHaveLength(1)
    expect(getLevelDocument(doc, 1).items.filter(item => item.kind === 'warehouse-rack').length).toBeGreaterThanOrEqual(4)
    for (let index = 0; index < getLevelCount(doc); index++) {
      const level = getLevelDocument(doc, index)
      for (const item of level.items) expect(canPlace(level, item, item.id)).toBe(true)
    }
    expect(parseShop(JSON.stringify(doc))).toEqual(doc)
    const second = createInitialShop()
    doc.upperFloors![0].items[0].color = '#000000'
    expect(second.upperFloors![0].items[0].color).not.toBe('#000000')
    expect(doc.upperFloors![0]).not.toHaveProperty('upperFloors')
  })

  it('keeps the blank plot unbuilt and the empty shop single-level', () => {
    const blank = createBlankShop()
    expect(getFloorCells(blank)).toEqual([])
    expect(blank.items).toEqual([])
    expect(blank).not.toHaveProperty('upperFloors')
    expect(getLevelCount(createEmptyShop())).toBe(1)
    expect(parseShop(blank)).toEqual(blank)
  })

  it.each(['stairs', 'warehouse-rack', 'bathroom'] as const)('treats %s as movable non-stockable furniture', kind => {
    expect(CATALOG.find(entry => entry.kind === kind)!.stockable).toBe(false)
    const item = createItem(kind)
    const doc = placeItem(createEmptyShop(), item)
    expect(doc.items[0]).toEqual(item)
    expect(updateItem(doc, item.id, { stock: 'books' })).toBe(doc)
    expect(updateItem(doc, item.id, { color: '#123456', x: 2 }).items[0]).toMatchObject({ color: '#123456', x: 2 })
  })

  it('rejects invalid floor indices instead of editing a different floor', () => {
    const doc = createInitialShop()
    expect(getLevelDocument(doc, 0)).toBe(doc)
    expect(getLevelDocument(doc, 1)).toBe(doc.upperFloors![0])
    for (const index of [-1, 0.5, 2, 4, NaN, Infinity]) {
      expect(() => getLevelDocument(doc, index)).toThrow(RangeError)
      expect(replaceLevelDocument(doc, index, createEmptyShop())).toBe(doc)
    }
  })

  it('applies upper-floor furniture and contour edits without changing other floors or architecture', () => {
    const doc = setLevelCount(createInitialShop(), 3)
    const firstUpper = getLevelDocument(doc, 1)
    const painted = paintFloor(firstUpper, [{ x: 10, z: 0 }], 'add')
    const nextFloor = updateItem(painted, firstUpper.items[0].id, { color: '#123456' })
    const next = replaceLevelDocument(doc, 1, nextFloor)
    expect(next.items).toBe(doc.items)
    expect(next.wallItems).toBe(doc.wallItems)
    expect(getLevelDocument(next, 2)).toBe(getLevelDocument(doc, 2))
    expect(getRoof(next)).toEqual(getRoof(doc))
    expect(getExterior(next)).toEqual(getExterior(doc))
    expect(getLevelDocument(next, 1).items[0].color).toBe('#123456')
    expect(getFloorCells(getLevelDocument(next, 1))).toContainEqual({ x: 10, z: 0 })
    expect(getFloorCells(doc)).not.toContainEqual({ x: 10, z: 0 })
    expect(getLevelDocument(doc, 1).items[0].color).not.toBe('#123456')
    expect(parseShop(JSON.stringify(next))).toEqual(next)
  })

  it('keeps building settings and other floors when replacing the ground-floor projection', () => {
    const doc = createInitialShop()
    const changed = updateItem(doc, 'bookshelf', { stock: 'vinyl' })
    const next = replaceLevelDocument(doc, 0, { ...changed, upperFloors: [], roof: { style: 'rooftop', garden: true, color: '#000000' } })
    expect(next.items.find(item => item.id === 'bookshelf')!.stock).toBe('vinyl')
    expect(next.upperFloors).toBe(doc.upperFloors)
    expect(next.roof).toBe(doc.roof)
    expect(next.exterior).toBe(doc.exterior)
    expect(replaceLevelDocument(doc, 0, doc)).toBe(doc)
    expect(replaceLevelDocument(doc, 1, { ...createEmptyShop(), items: [createItem('plant'), createItem('plant')] })).toBe(doc)
  })

  it('strips building metadata from a floor projection before attaching it upstairs', () => {
    const doc = createInitialShop()
    const next = replaceLevelDocument(doc, 1, { ...createEmptyShop(), roof: getRoof(doc), exterior: getExterior(doc), upperFloors: [] })
    expect(getLevelDocument(next, 1)).not.toHaveProperty('roof')
    expect(getLevelDocument(next, 1)).not.toHaveProperty('exterior')
    expect(getLevelDocument(next, 1)).not.toHaveProperty('upperFloors')
    expect(parseShop(next)).toEqual(next)
  })

  it.each([1, 2, 3, 4])('supports exactly %s levels and retains previous snapshots for undo', count => {
    const original = createInitialShop()
    const next = setLevelCount(original, count)
    expect(MAX_LEVELS).toBe(4)
    expect(getLevelCount(next)).toBe(count)
    expect(getLevelCount(original)).toBe(2)
    expect(setLevelCount(next, count)).toBe(next)
    expect(parseShop(next)).toEqual(next)
    if (count === 1) expect(next).not.toHaveProperty('upperFloors')
    for (let index = 0; index < count - 1; index++) expect(getLevelDocument(next, index).items.some(item => item.kind === 'stairs')).toBe(true)
  })

  it('rejects floor counts outside the one-to-four integer range without mutating the design', () => {
    const doc = createInitialShop()
    for (const count of [0, -1, 5, 20, 1.5, NaN, Infinity]) expect(setLevelCount(doc, count)).toBe(doc)
  })

  it('copies the top-floor footprint without sharing editable arrays or rearranging existing objects', () => {
    const custom = paintFloor(createEmptyShop(), [{ x: 7, z: 0 }], 'add')
    const plant = { ...createItem('plant'), x: 6, z: 5 }
    const source = placeItem(custom, plant)
    const next = setLevelCount(source, 4)
    expect(next.items.find(item => item.id === plant.id)).toEqual(plant)
    for (let index = 1; index < 4; index++) {
      expect(getFloorCells(getLevelDocument(next, index))).toEqual(getFloorCells(source))
      expect(getLevelDocument(next, index).floorCells).not.toBe(source.floorCells)
    }
    next.upperFloors![0].floorCells![0].x = -1
    expect(next.upperFloors![1].floorCells![0].x).toBe(0)
    expect(source.items).toEqual([plant])
  })

  it('allows adding levels on a tiny or occupied plot without deleting items to force in stairs', () => {
    const small: ShopDocument = { ...createEmptyShop(), floorCells: [{ x: 0, z: 0 }], items: [createItem('plant')] }
    const next = setLevelCount(small, 2)
    expect(next.items).toEqual(small.items)
    expect(getLevelDocument(next, 1).items).toEqual([])
    expect(parseShop(next)).toEqual(next)
    const blank = setLevelCount(createBlankShop(), 4)
    for (let index = 0; index < 4; index++) expect(getFloorCells(getLevelDocument(blank, index))).toEqual([])
    expect(parseShop(blank)).toEqual(blank)
  })
})

describe('roof, exterior, and building persistence', () => {
  it('keeps legacy version one and two designs single-level without materializing architecture', () => {
    for (const version of [1, 2] as const) {
      const old = { ...createEmptyShop(), version }
      const parsed = parseShop(JSON.stringify(old))!
      expect(parsed).toEqual(old)
      expect(getLevelCount(parsed)).toBe(1)
      expect(getRoof(parsed)).toMatchObject({ style: 'tiles', garden: false })
      expect(getExterior(parsed)).toMatchObject({ awning: true })
      expect(parsed).not.toHaveProperty('roof')
      expect(parsed).not.toHaveProperty('exterior')
      expect(upgradeShop(parsed)).not.toHaveProperty('upperFloors')
    }
  })

  it('renames every floor and matching name sign while retaining custom messages', () => {
    const source = createInitialShop()
    source.upperFloors![0].wallItems = [
      { id: 'upper-name', kind: 'wall-sign', wall: 'back', line: 0, offset: 1.5, height: 2, color: '#123456', text: source.name, lit: false },
      { id: 'upper-message', kind: 'wall-sign', wall: 'back', line: 0, offset: 4, height: 2, color: '#123456', text: 'Khusus staf', lit: false },
    ]
    const renamed = renameShop(source, 'Toko Baru')
    expect(renamed.name).toBe('Toko Baru')
    expect(renamed.upperFloors![0].name).toBe('Toko Baru')
    expect(renamed.upperFloors![0].wallItems!.map(item => item.text)).toEqual(['Toko Baru', 'Khusus staf'])
    expect(source.upperFloors![0].name).toBe('Sudut Cerita')
    expect(renameShop(renamed, 'Toko Baru')).toBe(renamed)
    expect(parseShop(renamed)).toEqual(renamed)
    const typing = renameShop(source, '')
    expect(typing.name).toBe('')
    expect(typing.upperFloors![0].name).toBe('Toko Kecilku')
    expect(parseShop({ ...typing, name: 'Toko Kecilku' })).not.toBeNull()
  })

  it('preserves version-one upper floors and their contents during the existing ground-floor migration', () => {
    const floor = { ...createEmptyShop(), version: 1 as const, name: 'Gudang tersimpan', items: [{ ...createItem('plant'), id: 'legacy-upper' }] }
    const source: ShopDocument = { ...createEmptyShop(), version: 1, upperFloors: [floor], roof: { style: 'rooftop', color: '#ABCDEF', garden: true } }
    const parsed = parseShop(JSON.stringify(source))!
    expect(parsed).toEqual(source)
    const upgraded = upgradeShop(parsed)
    expect(upgraded.version).toBe(2)
    expect(upgraded.upperFloors![0]).toEqual(floor)
    expect(upgraded.upperFloors).toBe(parsed.upperFloors)
    expect(upgraded.roof).toEqual(source.roof)
    expect(upgradeShop(upgraded)).toBe(upgraded)
    expect(parseShop(upgraded)).toEqual(upgraded)
  })

  it('edits both roof styles and exterior independently and returns detached settings', () => {
    const source = createInitialShop()
    const rooftop = setRoof(source, { style: 'rooftop', color: '#D5DAC8', garden: true })
    const exterior = setExterior(rooftop, { wallColor: '#123456', trimColor: '#ABCDEF', awning: false })
    expect(exterior.roof).toEqual({ style: 'rooftop', color: '#D5DAC8', garden: true })
    expect(exterior.exterior).toEqual({ wallColor: '#123456', trimColor: '#ABCDEF', awning: false })
    expect(source.roof!.style).toBe('tiles')
    expect(setRoof(exterior, {})).toBe(exterior)
    expect(setExterior(exterior, {})).toBe(exterior)
    expect(setRoof(exterior, { style: 'tiles' }).roof!.garden).toBe(true)
    getRoof(exterior).color = '#000000'
    getExterior(exterior).wallColor = '#000000'
    expect(exterior.roof!.color).toBe('#D5DAC8')
    expect(exterior.exterior!.wallColor).toBe('#123456')
    const parsed = parseShop(JSON.stringify(exterior))!
    expect(parsed).toEqual(exterior)
    expect(parsed.roof).not.toBe(exterior.roof)
    expect(parsed.exterior).not.toBe(exterior.exterior)
    expect(parsed.upperFloors![0].items[0]).not.toBe(exterior.upperFloors![0].items[0])
  })

  it('rejects malformed roof and exterior changes in both setters and imports', () => {
    const doc = createEmptyShop()
    for (const patch of [{ style: 'metal' }, { color: 'red' }, { garden: 'yes' }, { color: '#fff' }, { extra: true }, { garden: undefined }]) {
      expect(setRoof(doc, patch as Partial<RoofDesign>)).toBe(doc)
      expect(parseShop({ ...doc, roof: { ...getRoof(doc), ...patch } })).toBeNull()
    }
    for (const patch of [{ wallColor: '#fff' }, { trimColor: 'red' }, { awning: 1 }, { extra: true }, { awning: undefined }]) {
      expect(setExterior(doc, patch as Partial<ExteriorDesign>)).toBe(doc)
      expect(parseShop({ ...doc, exterior: { ...getExterior(doc), ...patch } })).toBeNull()
    }
    for (const invalid of [null, [], {}, { style: 'tiles' }]) expect(parseShop({ ...doc, roof: invalid })).toBeNull()
    for (const invalid of [null, [], {}, { awning: true }]) expect(parseShop({ ...doc, exterior: invalid })).toBeNull()
  })

  it('rejects too many, malformed, cyclic, or recursively nested upper floors', () => {
    const doc = createEmptyShop()
    for (const upperFloors of [null, {}, [null], [1], new Array(4).fill(doc), [{ ...doc, upperFloors: [] }], [{ ...doc, roof: getRoof(doc) }], [{ ...doc, exterior: getExterior(doc) }]]) {
      expect(parseShop({ ...doc, upperFloors })).toBeNull()
    }
    const cyclic = createEmptyShop()
    cyclic.upperFloors = [cyclic]
    expect(parseShop(cyclic)).toBeNull()
    expect(parseShop({ ...doc, upperFloors: [{ ...doc, items: [createItem('plant'), createItem('plant')] }] })).toBeNull()
    expect(parseShop({ ...doc, upperFloors: [{ ...doc, floorCells: [{ x: 20, z: 0 }] }] })).toBeNull()
  })

  it('validates IDs per floor so independently authored floors can share an item ID', () => {
    const floor = placeItem(createEmptyShop(), { ...createItem('plant'), id: 'same-id' })
    const building = { ...floor, upperFloors: [floor] }
    expect(parseShop(building)).toEqual(building)
    expect(parseShop(building)!.upperFloors![0].items[0]).not.toBe(floor.items[0])
  })
})
