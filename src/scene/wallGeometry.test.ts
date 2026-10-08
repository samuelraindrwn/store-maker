import { describe, expect, it } from 'vitest';
import { wallPanels, type WallRectangle } from './wallGeometry';

const area = (rectangles: WallRectangle[]) => rectangles.reduce((sum, rectangle) => sum + (rectangle.end - rectangle.start) * (rectangle.top - rectangle.bottom), 0);

describe('wall opening decomposition', () => {
  it('subtracts several windows without solid panels crossing either opening', () => {
    const openings = [
      { start: 0.5, end: 2.5, bottom: 0.7, top: 2.1 },
      { start: 3.5, end: 5.5, bottom: 1, top: 2.4 },
    ];
    const panels = wallPanels(0, 7, 3, openings);
    expect(area(panels)).toBeCloseTo(21 - 5.6);
    for (const panel of panels) for (const opening of openings) {
      const overlapWidth = Math.min(panel.end, opening.end) - Math.max(panel.start, opening.start);
      const overlapHeight = Math.min(panel.top, opening.top) - Math.max(panel.bottom, opening.bottom);
      expect(overlapWidth > 0 && overlapHeight > 0).toBe(false);
    }
  });

  it('subtracts overlapping openings as a union and clips to the wall bounds', () => {
    const panels = wallPanels(-2, 3, 3, [
      { start: -4, end: 0, bottom: -1, top: 2 },
      { start: -1, end: 2, bottom: 1, top: 4 },
      { start: 7, end: 8, bottom: 0, top: 2 },
    ]);
    expect(area(panels)).toBeCloseTo(15 - (4 + 6 - 1));
    expect(panels.every(panel => panel.start >= -2 && panel.end <= 3 && panel.bottom >= 0 && panel.top <= 3)).toBe(true);
  });

  it('closes a removed opening without leaving seams or degenerate meshes', () => {
    expect(wallPanels(0, 5, 2.75, [])).toEqual([{ start: 0, end: 5, bottom: 0, top: 2.75 }]);
    expect(wallPanels(1, 1, 3, [])).toEqual([]);
    expect(wallPanels(0, 5, 3, [{ start: 0, end: 5, bottom: 0, top: 3 }])).toEqual([]);
  });
});
