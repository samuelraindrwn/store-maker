import { describe, expect, it } from 'vitest'
import {
  CATALOG, FOOD_ITEM_KINDS, FOOD_PRODUCTS, canPlace, createEmptyShop, createInitialShop, createItem, createWallItem,
  getAllowedStocks, getItemFootprint, getItemSize, paintFloor, parseShop, placeItem, removeItem, updateItem,
  type ItemKind, type ProductKind, type ShopDocument, type ShopItem,
} from './model'

const additions = [
  ['glass-cabinet', 'Vitrin kaca', 2, 1, true, 'books'],
  ['display-plinth', 'Podium pajang', 1, 1, true, 'ceramics'],
  ['pegboard', 'Rak aksesori', 2, 1, true, 'bags'],
  ['food-display', 'Etalase makanan', 2, 1, true, 'pastries'],
  ['drinks-fridge', 'Kulkas minuman', 1, 1, true, 'drinks'],
  ['coffee-station', 'Bar kopi', 2, 1, false, 'none'],
  ['prep-counter', 'Meja persiapan', 2, 1, false, 'none'],
  ['stove', 'Kompor & oven', 2, 1, false, 'none'],
  ['sink', 'Bak cuci', 2, 1, false, 'none'],
  ['dining-table', 'Meja makan', 2, 2, false, 'none'],
  ['service-cart', 'Troli saji', 1, 1, true, 'meals'],
] as const
const allProducts: ProductKind[] = ['books', 'ceramics', 'plants', 'fashion', 'vinyl', 'shoes', 'bags', 'skincare', 'toys', 'bread', 'pastries', 'drinks', 'fruit', 'meals', 'snacks', 'none']

describe('retail and food catalog', () => {
  it('adds eleven distinct kinds with the requested dimensions, names, and initial stock', () => {
    expect(new Set(CATALOG.map(entry => entry.kind)).size).toBe(22)
    for (const [kind, name, width, depth, stockable, stock] of additions) {
      const entry = CATALOG.find(entry => entry.kind === kind)!
      expect(entry).toMatchObject({ kind, name, width, depth, stockable })
      const item = createItem(kind)
      expect(item).toMatchObject({ kind, color: entry.color, x: 0, z: 0, rotation: 0, stock })
      expect(getItemSize(item)).toEqual({ width, depth })
      expect(getAllowedStocks(kind)).toContain(stock)
      expect(canPlace(createEmptyShop(), item)).toBe(true)
    }
  })

  it('exports the complete food setup and six food products as immutable choices', () => {
    expect(FOOD_ITEM_KINDS).toEqual(['food-display', 'drinks-fridge', 'coffee-station', 'prep-counter', 'stove', 'sink', 'dining-table', 'service-cart', 'counter', 'stool'])
    expect(FOOD_PRODUCTS).toEqual(['bread', 'pastries', 'drinks', 'fruit', 'meals', 'snacks'])
    expect(Object.isFrozen(FOOD_ITEM_KINDS)).toBe(true)
    expect(Object.isFrozen(FOOD_PRODUCTS)).toBe(true)
    expect(FOOD_ITEM_KINDS.every(kind => CATALOG.some(entry => entry.kind === kind))).toBe(true)
  })

  it('keeps old defaults and the existing starter example unchanged', () => {
    expect(createItem('shelf').stock).toBe('books')
    expect(createItem('table').stock).toBe('ceramics')
    expect(createItem('rack').stock).toBe('fashion')
    expect(createItem('counter').stock).toBe('none')
    const initial = createInitialShop()
    expect(initial.items.map(item => [item.id, item.kind, item.stock])).toEqual([
      ['welcome-rug', 'rug', 'none'], ['bookshelf', 'shelf', 'books'], ['ceramic-shelf', 'shelf', 'ceramics'],
      ['warm-lamp', 'lamp', 'none'], ['fashion-rack', 'rack', 'fashion'], ['display-table', 'table', 'ceramics'],
      ['checkout', 'counter', 'none'], ['little-seat', 'stool', 'none'], ['green-corner', 'plant', 'none'],
      ['front-plant', 'plant', 'none'], ['sidewalk-chalkboard', 'chalkboard', 'none'],
    ])
    expect(parseShop(initial)).toEqual(initial)
    expect(createEmptyShop().items).toEqual([])
  })
})

describe('stock compatibility', () => {
  it.each<ItemKind>(['shelf', 'table', 'rack', 'glass-cabinet', 'display-plinth', 'pegboard'])('allows every product on generic display %s', kind => {
    expect(getAllowedStocks(kind)).toEqual(allProducts)
    const item = createItem(kind)
    for (const stock of allProducts) {
      expect(canPlace(createEmptyShop(), { ...item, stock })).toBe(true)
      expect(parseShop({ ...createEmptyShop(), items: [{ ...item, stock }] })?.items[0].stock).toBe(stock)
    }
  })

  it.each<ItemKind>(['food-display', 'service-cart'])('restricts %s to food products or an empty display', kind => {
    expect(getAllowedStocks(kind)).toEqual([...FOOD_PRODUCTS, 'none'])
    const item = createItem(kind)
    const doc = placeItem(createEmptyShop(), item)
    for (const stock of allProducts) {
      const allowed = FOOD_PRODUCTS.includes(stock) || stock === 'none'
      expect(canPlace(createEmptyShop(), { ...item, stock })).toBe(allowed)
      expect(parseShop({ ...doc, items: [{ ...item, stock }] }) !== null).toBe(allowed)
      const changed = updateItem(doc, item.id, { stock })
      if (allowed) expect(changed.items[0].stock).toBe(stock)
      else expect(changed).toBe(doc)
    }
  })

  it('restricts the fridge to its four supported food groups or none', () => {
    expect(getAllowedStocks('drinks-fridge')).toEqual(['drinks', 'fruit', 'meals', 'snacks', 'none'])
    const item = createItem('drinks-fridge')
    const doc = placeItem(createEmptyShop(), item)
    for (const stock of allProducts) {
      const allowed = ['drinks', 'fruit', 'meals', 'snacks', 'none'].includes(stock)
      expect(parseShop({ ...doc, items: [{ ...item, stock }] }) !== null).toBe(allowed)
      if (!allowed) expect(updateItem(doc, item.id, { stock })).toBe(doc)
    }
  })

  it('keeps every non-stockable item empty and prevents mutation of shared stock rules', () => {
    for (const entry of CATALOG.filter(entry => !entry.stockable)) {
      expect(getAllowedStocks(entry.kind)).toEqual(['none'])
      const item = createItem(entry.kind)
      const doc = placeItem(createEmptyShop(), item)
      for (const stock of allProducts.filter(stock => stock !== 'none')) {
        expect(canPlace(createEmptyShop(), { ...item, stock })).toBe(false)
        expect(updateItem(doc, item.id, { stock })).toBe(doc)
      }
    }
    for (const kind of ['shelf', 'food-display', 'drinks-fridge', 'counter'] as const) expect(Object.isFrozen(getAllowedStocks(kind))).toBe(true)
    expect(() => (getAllowedStocks('counter') as ProductKind[]).push('bread')).toThrow(TypeError)
    expect(getAllowedStocks('counter')).toEqual(['none'])
  })

  it('requires a compatible stock choice when changing the furniture kind', () => {
    const source = { ...createItem('shelf'), stock: 'bags' as const }
    const doc = placeItem(createEmptyShop(), source)
    expect(updateItem(doc, source.id, { kind: 'food-display' })).toBe(doc)
    const food = updateItem(doc, source.id, { kind: 'food-display', stock: 'pastries' })
    expect(food.items[0]).toMatchObject({ kind: 'food-display', stock: 'pastries' })
    expect(updateItem(food, source.id, { kind: 'drinks-fridge' })).toBe(food)
    const fridge = updateItem(food, source.id, { kind: 'drinks-fridge', stock: 'drinks' })
    expect(fridge.items[0]).toMatchObject({ kind: 'drinks-fridge', stock: 'drinks' })
    expect(doc.items[0]).toEqual(source)
  })
})

describe('new item lifecycle and persistence', () => {
  it.each(additions)('supports resize, rotation, collision, copy and removal for %s', (kind) => {
    const source = createItem(kind)
    const original = placeItem(createEmptyShop(), source)
    const resized = updateItem(original, source.id, { width: 3, depth: 1, rotation: 90, color: '#123456' })
    expect(getItemFootprint(resized.items[0])).toEqual({ width: 1, depth: 3 })
    expect(canPlace(resized, { ...createItem('plant'), x: 0, z: 2 })).toBe(false)
    expect(canPlace(createEmptyShop(), { ...resized.items[0], z: 6 })).toBe(false)
    const copy: ShopItem = { ...resized.items[0], id: `${kind}-copy`, x: 3 }
    const copied = placeItem(resized, copy)
    expect(copied.items).toHaveLength(2)
    expect(copied.items[1]).toEqual(copy)
    expect(copied.items[1]).not.toBe(copy)
    const parsed = parseShop(JSON.stringify(copied))!
    expect(parsed).toEqual(copied)
    expect(parsed.items[1]).not.toBe(copied.items[1])
    const protectedFloor = paintFloor(copied, [{ x: 0, z: 2 }], 'erase')
    expect(protectedFloor).toBe(copied)
    expect(removeItem(parsed, source.id).items).toEqual([copy])
    expect(original.items[0]).toEqual(source)
  })

  it('round-trips new products while preserving resized windows, entrance rotation and legacy version', () => {
    for (const version of [1, 2] as const) {
      const doc: ShopDocument = {
        ...createEmptyShop(), version, name: 'Kedai Cerita', entrance: { position: 0.3, open: true, rotation: 270 },
        items: [{ ...createItem('service-cart'), width: 2, depth: 1, rotation: 90, stock: 'snacks' }],
        wallItems: [{ ...createWallItem('window'), offset: 2, width: 3, sizeHeight: 1.2, windowStyle: 'arched' }],
      }
      const parsed = parseShop(JSON.stringify(doc))!
      expect(parsed).toEqual(doc)
      expect(parsed.entrance).not.toBe(doc.entrance)
      expect(parsed.wallItems![0]).not.toBe(doc.wallItems![0])
      expect(parsed.items[0]).not.toBe(doc.items[0])
    }
  })

  it('rejects unknown stocks and malformed new items without accepting partial edits', () => {
    const item = createItem('glass-cabinet')
    const doc = placeItem(createEmptyShop(), item)
    for (const stock of ['unknown', '__proto__', 'Bread', '', null, undefined, 3, {}, ['bread']]) {
      expect(parseShop({ ...doc, items: [{ ...item, stock }] })).toBeNull()
      expect(updateItem(doc, item.id, { color: '#000000', stock } as Partial<ShopItem>)).toBe(doc)
    }
    expect(parseShop({ ...doc, items: [{ ...item, stock: 'bread', extra: true }] })).toBeNull()
    expect(parseShop({ ...doc, items: [{ ...item, kind: 'food-truck' }] })).toBeNull()
  })
})
