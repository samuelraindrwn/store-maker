import { describe, expect, it } from 'vitest'
import {
  canPlaceWallItem, createInitialShop, getEntranceAnchor, getInteriorDoors, getPartitions,
  getWallItemSize, getWallItems, parseShop, wallItemPosition,
} from './model'

describe('starter shop windows', () => {
  it('saves front and right windows on both floors without replacing the existing decorations', () => {
    const shop = createInitialShop()
    const levels = [shop, ...shop.upperFloors!]
    for (const level of levels) {
      const windows = getWallItems(level).filter(item => item.kind === 'window')
      expect(windows.some(item => item.wall === 'front')).toBe(true)
      expect(windows.some(item => item.wall === 'right')).toBe(true)
      for (const item of getWallItems(level)) expect(canPlaceWallItem(level, item, item.id)).toBe(true)
    }
    expect(getWallItems(shop)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'builtin-window', kind: 'window', wall: 'left' }),
      expect.objectContaining({ id: 'builtin-wall-sign', kind: 'wall-sign', text: shop.name }),
    ]))
    const ids = levels.flatMap(level => [
      ...level.items, ...getWallItems(level), ...getPartitions(level), ...getInteriorDoors(level),
    ].map(item => item.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(parseShop(JSON.stringify(shop))).toEqual(shop)
  })

  it('keeps the front window clear of the entrance and the right window outside the bathroom', () => {
    const shop = createInitialShop()
    const front = getWallItems(shop).find(item => item.id === 'ground-front-window')!
    const right = getWallItems(shop).find(item => item.id === 'ground-right-window')!
    const entrance = getEntranceAnchor(shop)
    const frontPosition = wallItemPosition(shop, front)
    // The full entrance assembly, including jambs, spans 1.84 units at this size.
    expect(frontPosition.x + getWallItemSize(front).width / 2).toBeLessThan(entrance.x - 1.84 / 2)
    expect(front.line).toBe(shop.depth)
    expect(right.line).toBe(shop.width)
    expect(right.offset - getWallItemSize(right).width / 2).toBeGreaterThan(3)
    expect(right.offset + getWallItemSize(right).width / 2).toBeLessThan(6)
  })
})
