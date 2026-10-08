export interface WallRectangle { start: number; end: number; bottom: number; top: number }

/** Decompose a wall into solid rectangles around the union of its openings. */
export function wallPanels(start: number, end: number, height: number, openings: readonly WallRectangle[]): WallRectangle[] {
  if (end <= start || height <= 0) return [];
  const holes = openings.map(hole => ({
    start: Math.max(start, hole.start), end: Math.min(end, hole.end),
    bottom: Math.max(0, hole.bottom), top: Math.min(height, hole.top),
  })).filter(hole => hole.end > hole.start && hole.top > hole.bottom);
  const cuts = [...new Set([start, end, ...holes.flatMap(hole => [hole.start, hole.end])])].sort((a, b) => a - b);
  const panels: WallRectangle[] = [];
  let previous = new Map<string, WallRectangle>();
  for (let index = 0; index < cuts.length - 1; index++) {
    const left = cuts[index], right = cuts[index + 1], midpoint = (left + right) / 2;
    const covered = holes.filter(hole => midpoint > hole.start && midpoint < hole.end)
      .sort((a, b) => a.bottom - b.bottom);
    const free: { bottom: number; top: number }[] = [];
    let cursor = 0;
    for (const hole of covered) {
      if (hole.bottom > cursor) free.push({ bottom: cursor, top: hole.bottom });
      cursor = Math.max(cursor, hole.top);
    }
    if (cursor < height) free.push({ bottom: cursor, top: height });
    const next = new Map<string, WallRectangle>();
    for (const interval of free) {
      const key = `${interval.bottom}:${interval.top}`;
      const prior = previous.get(key);
      if (prior && prior.end === left) { prior.end = right; next.set(key, prior); }
      else { const panel = { start: left, end: right, ...interval }; panels.push(panel); next.set(key, panel); }
    }
    previous = next;
  }
  return panels;
}
