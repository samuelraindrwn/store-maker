import { expect, test, type Page } from '@playwright/test';
import type { ShopDocument, ShopItem, WallItem } from '../src/model';

const KEY = 'nemu.store-maker.v1';
const EMPTY: ShopDocument = { version: 2, name: 'Studio Ukuran', width: 10, depth: 8, wallHeight: 4.5, wallColor: '#F4EEDF', floorColor: '#DCC5A9', items: [], wallItems: [] };
const canvasFor = (page: Page) => page.getByTestId('scene').locator('canvas[data-renderer="webgl"]');
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const errors = new WeakMap<Page, string[]>();
type Point = { x: number; y: number };
type Projected = Record<string, string | number> & { canvasX: number; canvasY: number };

test.beforeEach(async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  if (testInfo.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1000 });
  errors.set(page, []);
  page.on('pageerror', error => errors.get(page)!.push(error.message));
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

async function openFixture(page: Page, doc: ShopDocument) {
  await page.addInitScript(({ key, doc }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc));
  }, { key: KEY, doc });
  await page.goto('/');
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(doc);
}

async function selectResize(page: Page, id: string, wall = false) {
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption({ value: wall ? `wall:${id}` : id });
  await button(page, wall ? 'Ubah ukuran aksesori' : 'Ubah ukuran barang').click();
  await expect(canvasFor(page)).toHaveAttribute('data-resize-mode', 'true');
}

async function point(page: Page, source: 'resizeHandles' | 'resizeTiles', query: Record<string, string | number>): Promise<Point> {
  const canvas = canvasFor(page);
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(() => canvas.evaluate((el, { source, query }) => {
    const values = JSON.parse((el as HTMLElement).dataset[source] || '[]') as Projected[];
    return values.some(value => Object.entries(query).every(([key, expected]) => value[key] === expected));
  }, { source, query })).toBe(true);
  return canvas.evaluate((el, { source, query }) => {
    const values = JSON.parse((el as HTMLElement).dataset[source] || '[]') as Projected[];
    const value = values.find(value => Object.entries(query).every(([key, expected]) => value[key] === expected))!;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + value.canvasX, y: rect.top + value.canvasY };
  }, { source, query });
}

async function floorDelta(page: Page, x: number, z: number): Promise<Point> {
  const origin = await point(page, 'resizeTiles', { x: 1, z: 1 });
  const along = await point(page, 'resizeTiles', { x: 2, z: 1 });
  const depth = await point(page, 'resizeTiles', { x: 1, z: 2 });
  return { x: (along.x - origin.x) * x + (depth.x - origin.x) * z, y: (along.y - origin.y) * x + (depth.y - origin.y) * z };
}

async function wallDelta(page: Page, along: number, height: number): Promise<Point> {
  const origin = await point(page, 'resizeTiles', { x: 2.25, height: 1.25 });
  const horizontal = await point(page, 'resizeTiles', { x: 3.25, height: 1.25 });
  const vertical = await point(page, 'resizeTiles', { x: 2.25, height: 2.25 });
  return { x: (horizontal.x - origin.x) * along + (vertical.x - origin.x) * height, y: (horizontal.y - origin.y) * along + (vertical.y - origin.y) * height };
}

async function tap(page: Page, p: Point) {
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

async function drag(page: Page, edge: string, delta: Point) {
  const from = await point(page, 'resizeHandles', { edge });
  const session = await page.evaluate(() => navigator.maxTouchPoints > 0) ? await page.context().newCDPSession(page) : null;
  if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, ...from }] });
  else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  for (let index = 1; index <= 6; index++) {
    const p = { x: from.x + delta.x * index / 6, y: from.y + delta.y * index / 6 };
    if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, ...p }] });
    else await page.mouse.move(p.x, p.y);
  }
  return {
    async release() {
      if (session) { await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach(); }
      else await page.mouse.up();
    },
    async cancel() {
      if (session) { await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await session.detach(); }
      else { await canvasFor(page).dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true }); await page.mouse.up(); }
    },
  };
}

async function preview(page: Page, wall = false) {
  return JSON.parse(await canvasFor(page).getAttribute(wall ? 'data-preview-wall-item' : 'data-preview-item') || 'null');
}

test('floor size handles and tiles preserve history, rotation, copied dimensions and reload', async ({ page }, testInfo) => {
  const shelf: ShopItem = { id: 'resize-shelf', kind: 'shelf', x: 2, z: 2, rotation: 0, color: '#BC8F69', stock: 'books' };
  const initial: ShopDocument = { ...EMPTY, items: [shelf,
    { id: 'blocker', kind: 'stool', x: 7, z: 2, rotation: 0, color: '#BC8F69', stock: 'none' },
    { id: 'display', kind: 'table', x: 5, z: 5, rotation: 0, color: '#BC8F69', stock: 'ceramics' },
  ] };
  await openFixture(page, initial); await selectResize(page, shelf.id);
  const growing = await drag(page, 'max-x', await floorDelta(page, 2, 0));
  try {
    await expect.poll(() => preview(page)).toMatchObject({ id: shelf.id, width: 4, depth: 1, valid: true });
    expect(await saved(page)).toEqual(initial);
  } finally { await growing.release(); }
  await expect.poll(async () => (await saved(page)).items[0]).toMatchObject({ width: 4, depth: 1 });
  const grown = await saved(page);
  await button(page, 'Urungkan').click(); await expect.poll(() => saved(page)).toEqual(initial);
  await button(page, 'Ulangi').click(); await expect.poll(() => saved(page)).toEqual(grown);
  await tap(page, await point(page, 'resizeHandles', { edge: 'max-x' }));
  expect(await saved(page)).toEqual(grown);

  await tap(page, await point(page, 'resizeTiles', { x: 5, z: 4 }));
  await expect.poll(async () => (await saved(page)).items[0]).toMatchObject({ x: 2, z: 2, width: 4, depth: 3 });
  const tiled = await saved(page);
  const cancelled = await drag(page, 'min-z', await floorDelta(page, 0, -1));
  await expect.poll(() => preview(page)).toMatchObject({ z: 1, depth: 4, valid: true });
  expect(await saved(page)).toEqual(tiled);
  await page.keyboard.press('Escape'); await cancelled.release();
  await expect.poll(() => saved(page)).toEqual(tiled);
  const invalid = await drag(page, 'max-x', await floorDelta(page, 2, 0));
  await expect.poll(() => preview(page)).toMatchObject({ width: 6, valid: false });
  await invalid.release(); await expect.poll(() => saved(page)).toEqual(tiled);
  await button(page, 'Urungkan').click(); await expect.poll(() => saved(page)).toEqual(grown);
  await button(page, 'Ulangi').click(); await expect.poll(() => saved(page)).toEqual(tiled);
  await canvasFor(page).screenshot({ path: `artifacts/resize-floor-${testInfo.project.name}.png` });
  await button(page, 'Putar barang').click();
  await expect.poll(async () => (await saved(page)).items[0]).toMatchObject({ width: 4, depth: 3, rotation: 90 });
  await button(page, 'Duplikat barang').click(); await button(page, 'Letakkan di sini').click();
  await expect.poll(async () => (await saved(page)).items.length).toBe(4);
  const completed = await saved(page);
  expect(completed.items.at(-1)).toMatchObject({ kind: 'shelf', width: 4, depth: 3, rotation: 90 });
  await page.reload(); await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  expect(await saved(page)).toEqual(completed);
});

for (const wall of ['back', 'left'] as const) test(`${wall} wall window handles and tiles resize the real opening with cancellation and persistence`, async ({ page }, testInfo) => {
  const window: WallItem = { id: 'resize-window', kind: 'window', wall, line: 0, offset: 3, height: 1.5, color: '#F5EAD6', text: '', lit: false };
  const blocker: WallItem = { ...window, id: 'wall-blocker', kind: 'painting', offset: 7 };
  const initial = { ...EMPTY, wallItems: [window, blocker] };
  await openFixture(page, initial); await selectResize(page, window.id, true);
  const growing = await drag(page, 'max-x', await wallDelta(page, 1, 0));
  try {
    await expect.poll(() => preview(page, true)).toMatchObject({ id: window.id, width: 3.2, offset: 3.5, valid: true });
    await expect.poll(async () => JSON.parse(await canvasFor(page).getAttribute('data-window-openings') || '[]')[0]).toMatchObject({ width: 3.2, offset: 3.5 });
    expect(await saved(page)).toEqual(initial);
    await canvasFor(page).screenshot({ path: `artifacts/resize-window-${wall}-live-${testInfo.project.name}.png` });
  } finally { await growing.release(); }
  await expect.poll(async () => (await saved(page)).wallItems![0]).toMatchObject({ width: 3.2, offset: 3.5 });
  const grown = await saved(page);
  await button(page, 'Urungkan').click(); await expect.poll(() => saved(page)).toEqual(initial);
  await button(page, 'Ulangi').click(); await expect.poll(() => saved(page)).toEqual(grown);
  await tap(page, await point(page, 'resizeHandles', { edge: 'max-x' }));
  expect(await saved(page)).toEqual(grown);
  await tap(page, await point(page, 'resizeTiles', { x: 5.25, height: 2.25 }));
  await expect.poll(async () => (await saved(page)).wallItems![0]).toMatchObject({ width: 3.6, sizeHeight: 1.7 });
  const tiled = await saved(page);
  const openings = await canvasFor(page).getAttribute('data-window-openings');
  const cancelled = await drag(page, 'max-y', await wallDelta(page, 0, 0.5));
  await expect.poll(() => preview(page, true)).toMatchObject({ sizeHeight: 2.2, valid: true });
  expect(await saved(page)).toEqual(tiled);
  await cancelled.cancel(); await expect.poll(() => saved(page)).toEqual(tiled);
  await expect(canvasFor(page)).toHaveAttribute('data-window-openings', openings!);
  const invalid = await drag(page, 'max-x', await wallDelta(page, 3, 0));
  await expect.poll(() => preview(page, true)).toMatchObject({ valid: false });
  await invalid.release(); await expect.poll(() => saved(page)).toEqual(tiled);
  await expect(canvasFor(page)).toHaveAttribute('data-window-openings', openings!);
  await button(page, 'Urungkan').click(); await expect.poll(() => saved(page)).toEqual(grown);
  await button(page, 'Ulangi').click(); await expect.poll(() => saved(page)).toEqual(tiled);
  await canvasFor(page).screenshot({ path: `artifacts/resize-window-${wall}-${testInfo.project.name}.png` });
  await button(page, 'Duplikat aksesori').click(); await button(page, 'Pasang di sini').click();
  await expect.poll(async () => (await saved(page)).wallItems!.length).toBe(3);
  const completed = await saved(page);
  expect(completed.wallItems!.at(-1)).toMatchObject({ kind: 'window', width: 3.6, sizeHeight: 1.7 });
  await page.reload(); await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  expect(await saved(page)).toEqual(completed);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});
