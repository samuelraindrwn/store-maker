import { expect, test, type Page } from '@playwright/test';
import type { ShopDocument } from '../src/model';

const STORAGE_KEY = 'nemu.store-maker.v1';
const EMPTY: ShopDocument = {
  version: 2, name: 'Studio Drag E2E', width: 7, depth: 6,
  wallColor: '#F4EEDF', floorColor: '#DCC5A9', items: [],
};
type Point = { x: number; y: number };
type Cell = { x: number; z: number };
type Projected = { id?: string; x?: number; z?: number; canvasX: number; canvasY: number };
const RECTANGLE = Array.from({ length: 3 }, (_, z) => Array.from({ length: 3 }, (_, x) => ({ x, z }))).flat();
const cellKeys = (cells: Cell[]) => cells.map(cell => `${cell.x},${cell.z}`).sort();

const canvasFor = (page: Page) => page.getByTestId('scene').locator('canvas[data-renderer="webgl"]');
const saved = (page: Page): Promise<ShopDocument> =>
  page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);

async function openFixture(page: Page, doc = EMPTY) {
  await page.goto('/');
  await page.getByLabel('Buka file desain', { exact: true }).setInputFiles({
    name: 'gesture.nemu.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)),
  });
  await expect.poll(() => saved(page)).toEqual(doc);
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
}

async function projectedPoint(page: Page, source: 'handles' | 'itemCenters' | 'cellCenters' | 'paintCells', key: string | Cell): Promise<Point> {
  const canvas = canvasFor(page);
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(() => canvas.evaluate((surface, args) => {
    const values = JSON.parse((surface as HTMLElement).dataset[args.source] || '[]') as Projected[];
    return values.some(candidate => typeof args.key === 'string'
      ? candidate.id === args.key : candidate.x === args.key.x && candidate.z === args.key.z);
  }, { source, key })).toBe(true);
  await canvas.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return canvas.evaluate((surface, args) => {
    const values = JSON.parse((surface as HTMLElement).dataset[args.source] || '[]') as Projected[];
    const point = values.find(candidate => typeof args.key === 'string'
      ? candidate.id === args.key : candidate.x === args.key.x && candidate.z === args.key.z);
    if (!point) throw new Error(`Missing projected ${args.source}: ${JSON.stringify(args.key)}`);
    const box = surface.getBoundingClientRect();
    return { x: box.left + point.canvasX, y: box.top + point.canvasY };
  }, { source, key });
}

async function painting(page: Page, operation: 'add' | 'erase') {
  await page.getByRole('button', { name: 'Bangun ruangan', exact: true }).click();
  await page.getByRole('button', { name: operation === 'add' ? 'Tambah lantai' : 'Hapus lantai', exact: true }).click();
  await expect(canvasFor(page)).toHaveAttribute('data-build-tool', operation);
}

async function paintStroke(page: Page, from: Cell, to: Cell, forceTouch = false) {
  const start = await projectedPoint(page, 'paintCells', from);
  const end = await projectedPoint(page, 'paintCells', to);
  return startDrag(page, start, { x: end.x - start.x, y: end.y - start.y }, forceTouch);
}

async function tapProjected(page: Page, point: Point) {
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

async function openDoorFixture(page: Page, open = false) {
  const doc: ShopDocument = { ...EMPTY, wallItems: [], entrance: { position: 0.72, open } };
  await page.addInitScript(({ key, doc }) => localStorage.setItem(key, JSON.stringify(doc)), { key: STORAGE_KEY, doc });
  await page.goto('/');
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(doc);
  await expect(page.getByRole('button', { name: 'Urungkan', exact: true })).toBeDisabled();
  return doc;
}

async function doorPoint(page: Page): Promise<Point> {
  const canvas = canvasFor(page);
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute('data-door-center', /canvasX/);
  await canvas.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return canvas.evaluate(surface => {
    const center = JSON.parse((surface as HTMLElement).dataset.doorCenter!);
    const box = surface.getBoundingClientRect();
    return { x: box.left + center.canvasX, y: box.top + center.canvasY };
  });
}

async function expectDoorAngle(page: Page, open: boolean) {
  await expect.poll(async () => Number(await canvasFor(page).getAttribute('data-door-angle'))).toBeCloseTo(open ? -Math.PI / 2 : 0, 2);
}

async function liveFloor(page: Page): Promise<Cell[]> {
  return JSON.parse(await canvasFor(page).getAttribute('data-floor-cells') || '[]');
}

async function axisDelta(page: Page, xUnits: number, zUnits: number): Promise<Point> {
  const origin = await projectedPoint(page, 'cellCenters', { x: 1, z: 1 });
  const x = await projectedPoint(page, 'cellCenters', { x: 2, z: 1 });
  const z = await projectedPoint(page, 'cellCenters', { x: 1, z: 2 });
  return { x: (x.x - origin.x) * xUnits + (z.x - origin.x) * zUnits,
    y: (x.y - origin.y) * xUnits + (z.y - origin.y) * zUnits };
}

async function startDrag(page: Page, from: Point, delta: Point, forceTouch = false) {
  const touch = forceTouch || await page.evaluate(() => navigator.maxTouchPoints > 0);
  const session = touch ? await page.context().newCDPSession(page) : null;
  if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x: from.x, y: from.y }] });
  else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  for (let step = 1; step <= 6; step++) {
    const point = { x: from.x + delta.x * step / 6, y: from.y + delta.y * step / 6 };
    if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, ...point }] });
    else await page.mouse.move(point.x, point.y);
  }
  return {
    async release() {
      if (session) { await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach(); }
      else await page.mouse.up();
    },
    async cancel() {
      if (session) { await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await session.detach(); }
      else {
        await canvasFor(page).dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true });
        await page.mouse.up();
      }
    },
    async interruptWithPinch() {
      if (!session) throw new Error('Pinch requires a touch drag.');
      const end = { x: from.x + delta.x, y: from.y + delta.y };
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
        { id: 0, ...end }, { id: 1, x: end.x - 35, y: end.y },
      ] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
        { id: 0, x: end.x + 10, y: end.y }, { id: 1, x: end.x - 55, y: end.y },
      ] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await session.detach();
    },
  };
}

test('painting an L shaped floor previews before release and creates its matching wall contour', async ({ page }, testInfo) => {
  const initial: ShopDocument = { ...EMPTY, floorCells: [{ x: 0, z: 0 }] };
  await openFixture(page, initial);
  await painting(page, 'add');
  const row = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }];
  const horizontal = await paintStroke(page, { x: 0, z: 0 }, { x: 2, z: 0 });
  try {
    await expect(canvasFor(page)).toHaveAttribute('data-interaction', 'paint');
    await expect.poll(async () => cellKeys(await liveFloor(page))).toEqual(cellKeys(row));
    expect(await saved(page)).toEqual(initial);
  } finally { await horizontal.release(); }
  await expect.poll(async () => cellKeys((await saved(page)).floorCells!)).toEqual(cellKeys(row));
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect.poll(() => saved(page)).toEqual(initial);
  await page.getByRole('button', { name: 'Ulangi', exact: true }).click();
  await expect.poll(async () => cellKeys((await saved(page)).floorCells!)).toEqual(cellKeys(row));
  const vertical = await paintStroke(page, { x: 0, z: 0 }, { x: 0, z: 2 });
  await vertical.release();
  const lShape = [...row, { x: 0, z: 1 }, { x: 0, z: 2 }];
  await expect.poll(async () => cellKeys((await saved(page)).floorCells!)).toEqual(cellKeys(lShape));
  const outline = JSON.parse(await canvasFor(page).getAttribute('data-floor-outline') || '[]') as { x1: number; z1: number; x2: number; z2: number }[];
  const edgeKey = (edge: { x1: number; z1: number; x2: number; z2: number }) =>
    [`${edge.x1},${edge.z1}`, `${edge.x2},${edge.z2}`].sort().join('|');
  expect(new Set(outline.map(edgeKey)).size).toBe(12);
  expect(outline.map(edgeKey)).toEqual(expect.arrayContaining(['1,1|1,2', '1,1|2,1']));
  const completed = await saved(page);
  expect(completed.width).toBe(initial.width);
  expect(completed.depth).toBe(initial.depth);
  await expect(page.getByLabel('Lebar toko', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Panjang toko', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Atur barang', exact: true }).click();
  const city = page.getByRole('button', { name: 'Tampilkan lingkungan kota', exact: true });
  if (await city.getAttribute('aria-pressed') === 'true') await city.click();
  await page.getByRole('button', { name: 'Kamera dari atas', exact: true }).click();
  const origin = await projectedPoint(page, 'cellCenters', { x: 0, z: 0 });
  const xAxis = await projectedPoint(page, 'cellCenters', { x: 1, z: 0 });
  const zAxis = await projectedPoint(page, 'cellCenters', { x: 0, z: 1 });
  const inside = await projectedPoint(page, 'cellCenters', { x: 0, z: 2 });
  const hole = { x: xAxis.x + zAxis.x - origin.x, y: xAxis.y + zAxis.y - origin.y };
  await expect.poll(() => canvasFor(page).evaluate((surface, points) => {
    const canvas = surface as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2')!;
    const box = canvas.getBoundingClientRect();
    const sample = (point: Point) => {
      const pixel = new Uint8Array(4);
      const x = Math.floor((point.x - box.left) / box.width * gl.drawingBufferWidth);
      const y = Math.floor((1 - (point.y - box.top) / box.height) * gl.drawingBufferHeight);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return pixel;
    };
    const a = sample(points.inside), b = sample(points.hole);
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  }, { inside, hole })).toBeGreaterThan(30);
  await canvasFor(page).screenshot({ path: testInfo.outputPath('l-shaped-floor.png') });
  await page.reload();
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  expect(await saved(page)).toEqual(completed);
});

test('wall height previews before release and returns to the legacy document with one undo', async ({ page }) => {
  await openFixture(page);
  await page.getByRole('button', { name: 'Bangun ruangan', exact: true }).click();
  await page.getByRole('button', { name: 'Atur dinding dan pintu', exact: true }).click();
  const before = await saved(page);
  expect(before).not.toHaveProperty('wallHeight');
  const from = await projectedPoint(page, 'handles', 'walltop');
  const drag = await startDrag(page, from, { x: 0, y: -65 });
  try {
    await expect(canvasFor(page)).toHaveAttribute('data-interaction', 'height');
    await expect.poll(async () => Number(await canvasFor(page).getAttribute('data-preview-wall-height'))).toBeGreaterThan(2.75);
    expect(await saved(page)).toEqual(before);
  } finally { await drag.release(); }
  await expect.poll(async () => (await saved(page)).wallHeight).toBeGreaterThan(2.75);
  const height = (await saved(page)).wallHeight!;
  expect(height).toBeGreaterThanOrEqual(2.3);
  expect(height).toBeLessThanOrEqual(4.5);
  expect(height * 10).toBeCloseTo(Math.round(height * 10));
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect.poll(() => saved(page)).toEqual(before);
});

test('cancelled floor strokes never autosave or consume an undo step', async ({ page }) => {
  await openFixture(page, { ...EMPTY, floorCells: [{ x: 0, z: 0 }] });
  await painting(page, 'add');
  const before = await saved(page);
  for (const cancellation of ['escape', 'pointercancel']) {
    const drag = await paintStroke(page, { x: 0, z: 0 }, { x: 2, z: 0 });
    await expect(canvasFor(page)).toHaveAttribute('data-interaction', 'paint');
    await expect.poll(async () => (await liveFloor(page)).length).toBeGreaterThan(1);
    if (cancellation === 'escape') { await page.keyboard.press('Escape'); await drag.release(); }
    else await drag.cancel();
    await expect(canvasFor(page)).toHaveAttribute('data-interaction', 'idle');
    await expect.poll(() => liveFloor(page)).toEqual(before.floorCells);
    expect(await saved(page)).toEqual(before);
  }
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect(page.getByLabel('Nama toko', { exact: true })).toHaveValue('Sudut Cerita');
});

test('erasing creates usable floor holes, protects furniture, and can clear the last empty cell', async ({ page }) => {
  const doc: ShopDocument = { ...EMPTY, floorCells: RECTANGLE, items: [
    { id: 'protected-plant', kind: 'plant', x: 0, z: 0, rotation: 0, color: '#B797C8', stock: 'none' },
  ] };
  await openFixture(page, doc);
  await painting(page, 'erase');
  await tapProjected(page, await projectedPoint(page, 'paintCells', { x: 0, z: 0 }));
  await expect(canvasFor(page)).toHaveAttribute('data-interaction', 'idle');
  expect(await saved(page)).toEqual(doc);
  await tapProjected(page, await projectedPoint(page, 'paintCells', { x: 1, z: 1 }));
  await expect.poll(async () => (await saved(page)).floorCells!.length).toBe(8);
  expect((await saved(page)).items).toEqual(doc.items);
  const contour = JSON.parse(await canvasFor(page).getAttribute('data-floor-outline') || '[]');
  expect(contour).toHaveLength(16); // outer square plus four edges around the hole
  await page.getByRole('button', { name: 'Atur barang', exact: true }).click();
  await page.getByTestId('catalog-plant').click();
  await page.getByLabel('Petak X', { exact: true }).selectOption({ value: '1' });
  await page.getByLabel('Petak Y', { exact: true }).selectOption({ value: '1' });
  await expect(page.getByRole('button', { name: 'Letakkan di sini', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Batalkan penempatan', exact: true }).click();
  await openFixture(page, { ...EMPTY, floorCells: [{ x: -1, z: 0 }] });
  await painting(page, 'erase');
  await tapProjected(page, await projectedPoint(page, 'paintCells', { x: -1, z: 0 }));
  await expect.poll(async () => (await saved(page)).floorCells).toEqual([]);
});

test('painting negative cells keeps furniture anchored and rugs protect the floor beneath them', async ({ page }) => {
  const doc: ShopDocument = { ...EMPTY, floorCells: RECTANGLE, items: [
    { id: 'protected-rug', kind: 'rug', x: 0, z: 0, rotation: 0, color: '#C7B4DF', stock: 'none' },
    { id: 'anchored-stool', kind: 'stool', x: 1, z: 1, rotation: 0, color: '#B58C65', stock: 'none' },
  ] };
  await openFixture(page, doc);
  await painting(page, 'erase');
  await tapProjected(page, await projectedPoint(page, 'paintCells', { x: 0, z: 0 }));
  expect(await saved(page)).toEqual(doc);
  await painting(page, 'add');
  const before = await projectedPoint(page, 'itemCenters', 'anchored-stool');
  const stroke = await paintStroke(page, { x: 0, z: 0 }, { x: -2, z: 0 });
  await stroke.release();
  await expect.poll(async () => (await saved(page)).floorCells!.length).toBe(11);
  expect((await saved(page)).items).toEqual(doc.items);
  const after = await projectedPoint(page, 'itemCenters', 'anchored-stool');
  expect(after.x).toBeCloseTo(before.x, 1);
  expect(after.y).toBeCloseTo(before.y, 1);
  await page.getByRole('button', { name: 'Atur barang', exact: true }).click();
  await tapProjected(page, await projectedPoint(page, 'itemCenters', 'anchored-stool'));
  await expect(page.getByRole('button', { name: 'Pindahkan barang', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pindahkan barang', exact: true }).click();
  await page.getByLabel('Petak X', { exact: true }).selectOption({ value: '-1' });
  await page.getByLabel('Petak Y', { exact: true }).selectOption({ value: '0' });
  await expect(page.getByLabel('Petak X', { exact: true })).toHaveValue('-1');
  await expect(page.getByLabel('Petak Y', { exact: true })).toHaveValue('0');
  await page.getByRole('button', { name: 'Letakkan di sini', exact: true }).click();
  await expect.poll(async () => (await saved(page)).items.find(item => item.id === 'anchored-stool')).toMatchObject({ x: -1, z: 0 });
});

test('furniture drags preview without saving, snap on release and revert blocked drops', async ({ page }) => {
  const doc: ShopDocument = { ...EMPTY, items: [
    { id: 'drag-stool', kind: 'stool', x: 1, z: 1, rotation: 0, color: '#B58C65', stock: 'none' },
    { id: 'blocked-plant', kind: 'plant', x: 4, z: 3, rotation: 0, color: '#B797C8', stock: 'none' },
  ] };
  await openFixture(page, doc);
  await page.getByRole('button', { name: 'Atur barang', exact: true }).click();
  await page.getByRole('button', { name: 'Kamera dari atas', exact: true }).click();
  const from = await projectedPoint(page, 'itemCenters', 'drag-stool');
  const drag = await startDrag(page, from, await axisDelta(page, 2, 1));
  try {
    await expect(canvasFor(page)).toHaveAttribute('data-interaction', 'item');
    await expect.poll(async () => JSON.parse(await canvasFor(page).getAttribute('data-preview-item') || 'null')?.x).toBeCloseTo(3, 1);
    await expect.poll(async () => JSON.parse(await canvasFor(page).getAttribute('data-preview-item') || 'null')?.z).toBeCloseTo(2, 1);
    const preview = JSON.parse(await canvasFor(page).getAttribute('data-preview-item') || 'null');
    expect(preview).toMatchObject({ id: 'drag-stool', valid: true });
    expect(preview.x).toBeCloseTo(3, 1);
    expect(preview.z).toBeCloseTo(2, 1);
    expect(await saved(page)).toEqual(doc);
  } finally { await drag.release(); }
  await expect.poll(async () => (await saved(page)).items[0]).toMatchObject({ id: 'drag-stool', x: 3, z: 2 });
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect.poll(() => saved(page)).toEqual(doc);
  const blocked = await startDrag(page, await projectedPoint(page, 'itemCenters', 'drag-stool'), await axisDelta(page, 3, 2));
  try {
    await expect.poll(async () => JSON.parse(await canvasFor(page).getAttribute('data-preview-item') || 'null')?.x).toBeCloseTo(4, 1);
    await expect.poll(async () => JSON.parse(await canvasFor(page).getAttribute('data-preview-item') || 'null')?.z).toBeCloseTo(3, 1);
    const preview = JSON.parse(await canvasFor(page).getAttribute('data-preview-item') || 'null');
    expect(preview).toMatchObject({ id: 'drag-stool', valid: false });
    expect(preview.x).toBeCloseTo(4, 1);
    expect(preview.z).toBeCloseTo(3, 1);
  } finally { await blocked.release(); }
  await expect(canvasFor(page)).toHaveAttribute('data-interaction', 'idle');
  expect(await saved(page)).toEqual(doc);
});

test('door clicks only select while explicit buttons animate opening and closing', async ({ page }) => {
  const initial = await openDoorFixture(page);
  const canvas = canvasFor(page);
  await tapProjected(page, await doorPoint(page));
  const inspector = page.getByTestId('door-inspector');
  await expect(inspector.getByRole('heading', { name: 'Pintu masuk', exact: true })).toBeVisible();
  expect(await saved(page)).toEqual(initial);
  await expectDoorAngle(page, false);
  await expect(page.getByRole('button', { name: 'Urungkan', exact: true })).toBeDisabled();
  await inspector.getByRole('button', { name: 'Buka pintu masuk', exact: true }).click();
  await expect.poll(async () => (await saved(page)).entrance).toMatchObject({ open: true });
  await expectDoorAngle(page, true);
  const opened = await saved(page);
  await tapProjected(page, await doorPoint(page));
  await expect(inspector).toBeVisible();
  expect(await saved(page)).toEqual(opened);
  await expectDoorAngle(page, true);
  // Both selecting the closed door and selecting the open leaf consume no history.
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect.poll(() => saved(page)).toEqual(initial);
  await expect(page.getByRole('button', { name: 'Urungkan', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Ulangi', exact: true }).click();
  await expect.poll(() => saved(page)).toEqual(opened);
  await inspector.getByRole('button', { name: 'Tutup pintu masuk', exact: true }).click();
  await expect.poll(() => saved(page)).toEqual(initial);
  await expectDoorAngle(page, false);

  await page.getByRole('button', { name: 'Lihat tokoku', exact: true }).click();
  await tapProjected(page, await doorPoint(page));
  expect(await saved(page)).toEqual(initial);
  await expect(inspector).toHaveCount(0);
  await page.getByRole('button', { name: 'Buka pintu masuk', exact: true }).click();
  await expect.poll(async () => (await saved(page)).entrance?.open).toBe(true);
  await expectDoorAngle(page, true);
  await expect(canvas).toHaveAttribute('data-interaction', 'idle');
});

for (const open of [false, true]) test(`door body drag preserves its ${open ? 'open' : 'closed'} state and commits one undo step`, async ({ page }) => {
  const initial = await openDoorFixture(page, open);
  const canvas = canvasFor(page);
  await expectDoorAngle(page, open);
  const from = await doorPoint(page);
  const drag = await startDrag(page, from, await axisDelta(page, -2, 0));
  try {
    await expect(canvas).toHaveAttribute('data-interaction', 'door');
    await expect.poll(async () => Number(await canvas.getAttribute('data-preview-entrance-position'))).toBeLessThan(initial.entrance!.position);
    expect(await saved(page)).toEqual(initial);
  } finally { await drag.release(); }
  await expect.poll(async () => (await saved(page)).entrance!.position).toBeLessThan(initial.entrance!.position);
  const moved = await saved(page);
  expect(moved.entrance!.open).toBe(open);
  await expectDoorAngle(page, open);
  await expect(page.getByTestId('door-inspector')).toBeVisible();
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect.poll(() => saved(page)).toEqual(initial);
  await expect(page.getByRole('button', { name: 'Urungkan', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Ulangi', exact: true }).click();
  await expect.poll(() => saved(page)).toEqual(moved);
});

test('door handle taps tiny jitter and cancelled drags never toggle or autosave', async ({ page }) => {
  const initial = await openDoorFixture(page, true);
  const canvas = canvasFor(page);
  await page.getByRole('button', { name: 'Bangun ruangan', exact: true }).click();
  await page.getByRole('button', { name: 'Atur dinding dan pintu', exact: true }).click();
  await tapProjected(page, await projectedPoint(page, 'handles', 'door'));
  expect(await saved(page)).toEqual(initial);
  const jitter = await startDrag(page, await projectedPoint(page, 'handles', 'door'), { x: 2, y: -2 });
  await jitter.release();
  expect(await saved(page)).toEqual(initial);
  await expect(page.getByRole('button', { name: 'Urungkan', exact: true })).toBeDisabled();

  const cancelled = await startDrag(page, await projectedPoint(page, 'handles', 'door'), await axisDelta(page, -2, 0));
  await expect(canvas).toHaveAttribute('data-interaction', 'door');
  await expect.poll(async () => Number(await canvas.getAttribute('data-preview-entrance-position'))).toBeLessThan(initial.entrance!.position);
  expect(await saved(page)).toEqual(initial);
  await cancelled.cancel();
  await expect(canvas).toHaveAttribute('data-interaction', 'idle');
  expect(await saved(page)).toEqual(initial);

  const escaped = await startDrag(page, await projectedPoint(page, 'handles', 'door'), await axisDelta(page, -2, 0));
  await expect(canvas).toHaveAttribute('data-interaction', 'door');
  await page.keyboard.press('Escape');
  await escaped.release();
  await expect(canvas).toHaveAttribute('data-interaction', 'idle');
  expect(await saved(page)).toEqual(initial);
  await expectDoorAngle(page, true);
  await expect(page.getByRole('button', { name: 'Urungkan', exact: true })).toBeDisabled();
});

test('the city changes the visible scene and a second finger cancels a pending floor stroke without saving', async ({ page }) => {
  await openFixture(page);
  const before = await saved(page);
  const canvas = canvasFor(page);
  const sceneImage = await canvas.evaluate(surface => (surface as HTMLCanvasElement).toDataURL());
  const city = page.getByRole('button', { name: 'Tampilkan lingkungan kota', exact: true });
  const cityWasPressed = await city.getAttribute('aria-pressed');
  await city.click();
  await expect(city).toHaveAttribute('aria-pressed', cityWasPressed === 'true' ? 'false' : 'true');
  await expect.poll(() => canvas.evaluate((surface, image) => (surface as HTMLCanvasElement).toDataURL() !== image, sceneImage)).toBe(true);
  expect(await saved(page)).toEqual(before);
  await painting(page, 'add');
  const drag = await paintStroke(page, { x: 6, z: 3 }, { x: 8, z: 3 }, true);
  await expect(canvas).toHaveAttribute('data-interaction', 'paint');
  await expect.poll(async () => (await liveFloor(page)).length).toBeGreaterThan(42);
  await drag.interruptWithPinch();
  await expect(canvas).toHaveAttribute('data-interaction', 'idle');
  expect(await saved(page)).toEqual(before);
  await page.reload();
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  expect(await saved(page)).toEqual(before);
});
