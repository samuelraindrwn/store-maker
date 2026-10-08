import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createEmptyShop, getFloorCells, getItemFootprint, getWallHeight, type ShopDocument, type ShopItem } from '../src/model';
import { LEVEL_SLAB } from '../src/scene/buildingObjects';

test.use({ reducedMotion: 'reduce' });
const KEY = 'nemu.store-maker.v1';
const canvas = (page: Page) => page.locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
const data = async <T = unknown>(page: Page, key: string): Promise<T> => JSON.parse(await canvas(page).getAttribute(`data-${key}`) || 'null');
const floors = (doc: ShopDocument) => [doc, ...(doc.upperFloors ?? [])];
const roofItems = (doc: ShopDocument) => doc.rooftop?.items ?? [];
const renderedRoofItems = (doc: ShopDocument) => roofItems(doc).map(({ id, x, z, rotation, kind }) => ({ id, x, z, rotation, kind }));

async function ready(page: Page, roof?: boolean) {
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.shop-canvas')).toHaveAttribute('aria-busy', 'false');
  if (roof !== undefined) await expect(canvas(page)).toHaveAttribute('data-rooftop-only', String(roof));
}

async function open(page: Page, info: TestInfo, fixture?: ShopDocument) {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1050 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  if (fixture) await page.addInitScript(({ key, doc }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc));
  }, { key: KEY, doc: fixture });
  await page.goto('/');
  await ready(page);
  return errors;
}

async function editRoof(page: Page) {
  if (!await button(page, 'Edit rooftop').count()) {
    await button(page, 'Eksterior').click();
    await button(page, 'Rooftop').click();
    await ready(page);
  }
  await button(page, 'Edit rooftop').click();
  await ready(page, true);
  await expect(button(page, 'Edit rooftop')).toHaveAttribute('aria-pressed', 'true');
}

// Choose two clear, adjacent cells away from the stairwell and parapet. The test
// then uses normal editor controls and a real mouse/touch gesture to move a plant.
function clearRoofPair(doc: ShopDocument) {
  const top = floors(doc).at(-1)!;
  const cells = getFloorCells(top);
  const cellSet = new Set(cells.map(cell => `${cell.x},${cell.z}`));
  const occupied = [...roofItems(doc), ...top.items.filter(item => item.kind === 'stairs')];
  const clear = (x: number, z: number) => {
    if (!cellSet.has(`${x},${z}`)) return false;
    return occupied.every(item => {
      const size = getItemFootprint(item);
      const margin = item.kind === 'stairs' ? 1 : 0;
      return x + 1 <= item.x - margin || x >= item.x + size.width + margin
        || z + 1 <= item.z - margin || z >= item.z + size.depth + margin;
    });
  };
  for (const cell of cells) {
    if (cell.x < 1 || cell.z < 1 || cell.x + 2 >= top.width || cell.z + 1 >= top.depth) continue;
    if (clear(cell.x, cell.z) && clear(cell.x + 1, cell.z)) return { from: cell, to: { x: cell.x + 1, z: cell.z } };
  }
  throw new Error('The outdoor example needs two clear cells for placement and moving.');
}

async function placeAt(page: Page, x: number, z: number) {
  await page.getByLabel('Petak X', { exact: true }).selectOption({ value: String(x) });
  await page.getByLabel('Petak Y', { exact: true }).selectOption({ value: String(z) });
  await expect(button(page, 'Letakkan di sini')).toBeEnabled();
  await button(page, 'Letakkan di sini').click();
}

async function dragItem(page: Page, info: TestInfo, item: ShopItem, destination: { x: number; z: number }) {
  await expect.poll(async () => (await data<{ id: string }[]>(page, 'item-centers')).some(center => center.id === item.id)).toBe(true);
  await canvas(page).scrollIntoViewIfNeeded();
  const points = await canvas(page).evaluate((surface, { item, destination }) => {
    const meta = (surface as HTMLElement).dataset;
    const rect = surface.getBoundingClientRect();
    const center = JSON.parse(meta.itemCenters!).find((point: { id: string }) => point.id === item.id);
    const cells: { x: number; z: number; canvasX: number; canvasY: number }[] = JSON.parse(meta.cellCenters!);
    const a = cells.find(point => point.x === item.x && point.z === item.z)!;
    const b = cells.find(point => point.x === destination.x && point.z === destination.z)!;
    // The plant's bounding-box center can fall between leaves. Grab its solid
    // planter, a quarter of the way from its floor center to its overall center.
    return { x: rect.x + a.canvasX * 0.75 + center.canvasX * 0.25, y: rect.y + a.canvasY * 0.75 + center.canvasY * 0.25, dx: b.canvasX - a.canvasX, dy: b.canvasY - a.canvasY };
  }, { item, destination });
  const session = info.project.name === 'mobile-chromium' ? await page.context().newCDPSession(page) : null;
  if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x: points.x, y: points.y }] });
  else { await page.mouse.move(points.x, points.y); await page.mouse.down(); }
  for (let step = 1; step <= 8; step++) {
    const point = { x: points.x + points.dx * step / 8, y: points.y + points.dy * step / 8 };
    if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, ...point }] });
    else await page.mouse.move(point.x, point.y);
  }
  await expect(canvas(page)).toHaveAttribute('data-interaction', 'item');
  const preview = await data<{ id: string; x: number; z: number; valid: boolean }>(page, 'preview-item');
  expect(preview).toMatchObject({ id: item.id, valid: true });
  expect(preview.x).toBeCloseTo(destination.x, 4);
  expect(preview.z).toBeCloseTo(destination.z, 4);
  if (session) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else await page.mouse.up();
}

test('rooftop has real stair access and outdoor furniture can be placed, dragged, exported and reloaded', async ({ page }, info) => {
  test.setTimeout(150_000);
  const errors = await open(page, info);
  const original = await saved(page);
  const surface = await canvas(page).elementHandle();
  await button(page, 'Eksterior').click();
  await button(page, 'Rooftop').click();
  await button(page, 'Tata rooftop').click();
  await ready(page, true);
  expect(await surface!.evaluate(node => node.isConnected)).toBe(true);
  const initial = await saved(page);
  expect(initial.roof?.style).toBe('rooftop');
  expect(roofItems(initial).length).toBeGreaterThan(0);
  const top = floors(initial).at(-1)!;
  const stairs = top.items.filter(item => item.kind === 'stairs');
  expect(stairs.length).toBeGreaterThan(0);
  expect((await data<{ stairId: string }[]>(page, 'stair-openings')).map(opening => opening.stairId)).toEqual(stairs.map(item => item.id));
  expect((await data<{ level: number }[]>(page, 'context-levels')).map(level => level.level)).toEqual([0, 1]);
  expect(await data(page, 'active-level')).toBe(2);
  expect(await data<number>(page, 'active-floor-y')).toBeCloseTo(floors(initial).reduce((height, floor) => height + getWallHeight(floor) + LEVEL_SLAB, 0));
  expect(await data(page, 'rooftop-items')).toEqual(renderedRoofItems(initial));
  expect(initial.items).toEqual(original.items);
  await canvas(page).screenshot({ path: info.outputPath('rooftop-stairwell-and-outdoor-example.png') });

  const pair = clearRoofPair(initial);
  await page.getByTestId('catalog-plant').click();
  await page.getByLabel('Petak X', { exact: true }).selectOption({ value: String(stairs[0].x) });
  await page.getByLabel('Petak Y', { exact: true }).selectOption({ value: String(stairs[0].z) });
  await expect(button(page, 'Letakkan di sini')).toBeDisabled();
  await placeAt(page, pair.from.x, pair.from.z);
  await expect.poll(async () => roofItems(await saved(page)).length).toBe(roofItems(initial).length + 1);
  const planted = await saved(page);
  const plant = roofItems(planted).find(item => !roofItems(initial).some(previous => previous.id === item.id))!;
  expect(plant).toMatchObject({ kind: 'plant', ...pair.from });
  await dragItem(page, info, plant, pair.to);
  await expect.poll(async () => roofItems(await saved(page)).find(item => item.id === plant.id)).toMatchObject(pair.to);
  const moved = await saved(page);
  expect(moved.items).toEqual(initial.items);
  expect(moved.upperFloors).toEqual(initial.upperFloors);
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(planted);
  await button(page, 'Ulangi').click();
  await expect.poll(() => saved(page)).toEqual(moved);

  await button(page, 'Eksterior').click();
  await ready(page, false);
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');
  expect(await data(page, 'rooftop-items')).toEqual(renderedRoofItems(moved));
  await canvas(page).screenshot({ path: info.outputPath('exterior-with-authored-rooftop.png') });
  await button(page, 'Menu file desain').click();
  const pending = page.waitForEvent('download');
  await button(page, 'Simpan file desain').click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString('utf8'))).toEqual(moved);
  await page.reload();
  await ready(page);
  expect(await saved(page)).toEqual(moved);
  await editRoof(page);
  expect(await data(page, 'rooftop-items')).toEqual(renderedRoofItems(moved));
  expect(errors).toEqual([]);
});

test('four interior floors keep a separate editable rooftop and roof-style switching preserves furniture', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors = await open(page, info);
  await expect(button(page, 'Edit rooftop')).toHaveCount(0);
  await page.getByLabel('Jumlah lantai', { exact: true }).selectOption('4');
  await editRoof(page);
  const design = await saved(page);
  expect(design.upperFloors).toHaveLength(3);
  expect(await data(page, 'active-level')).toBe(4);
  expect(await data(page, 'level-count')).toBe(4);
  expect((await data<{ level: number }[]>(page, 'context-levels')).map(level => level.level)).toEqual([0, 1, 2, 3]);
  expect((await data<unknown[]>(page, 'stair-openings')).length).toBeGreaterThan(0);
  expect(await page.getByLabel('Jumlah lantai', { exact: true }).locator('option').allTextContents()).toEqual(['1 lantai', '2 lantai', '3 lantai', '4 lantai']);
  await canvas(page).screenshot({ path: info.outputPath('four-storeys-plus-rooftop.png') });
  await button(page, 'Edit lantai 4').click();
  await ready(page, false);
  expect((await data<{ id: string }[]>(page, 'item-centers')).map(item => item.id)).toEqual(design.upperFloors![2].items.map(item => item.id));
  await button(page, 'Eksterior').click();
  await button(page, 'Atap genteng').click();
  await ready(page);
  await expect(button(page, 'Edit rooftop')).toHaveCount(0);
  expect(floors(await saved(page)).at(-1)!.items.some(item => item.roofAccess)).toBe(false);
  expect((await saved(page)).rooftop).toEqual(design.rooftop);
  await button(page, 'Rooftop').click();
  await ready(page);
  await expect(button(page, 'Edit rooftop')).toBeVisible();
  expect((await saved(page)).rooftop).toEqual(design.rooftop);
  await editRoof(page);
  expect(await data(page, 'rooftop-items')).toEqual(renderedRoofItems(design));
  await page.setViewportSize({ width: 320, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(button(page, 'Edit rooftop')).toBeVisible();
  await page.locator('.building-navigation').screenshot({ path: info.outputPath('rooftop-navigation-320px.png') });
  expect(errors).toEqual([]);
});

test('enclosed roof access and resized outdoor covers restore correctly after switching roof styles', async ({ page }, info) => {
  test.setTimeout(150_000);
  const errors = await open(page, info);
  await expect(button(page, 'Edit rooftop')).toHaveCount(0);
  await button(page, 'Eksterior').click();
  await button(page, 'Rooftop').click();
  await button(page, 'Berdinding & beratap').click();
  await expect.poll(async () => (await saved(page)).roof?.stairAccess).toBe('enclosed');
  await editRoof(page);
  await expect(canvas(page)).toHaveAttribute('data-rooftop-stair-access', 'enclosed');
  await expect.poll(() => data<number>(page, 'rooftop-enclosures')).toBeGreaterThan(0);
  const initial = await saved(page);
  expect(roofItems(initial).some(item => item.kind === 'dining-table' && item.x === 6 && item.z === 5)).toBe(true);

  await page.getByTestId('catalog-canopy').click();
  await placeAt(page, 5, 4);
  const canopy = roofItems(await saved(page)).find(item => item.kind === 'canopy')!;
  expect(canopy).toBeDefined();
  await button(page, 'Ubah ukuran barang').click();
  await page.getByLabel('Panjang barang', { exact: true }).fill('4');
  await page.getByLabel('Panjang barang', { exact: true }).press('Enter');
  await page.getByLabel('Kedalaman barang', { exact: true }).fill('4');
  await page.getByLabel('Kedalaman barang', { exact: true }).press('Enter');
  await expect.poll(async () => roofItems(await saved(page)).find(item => item.id === canopy.id)).toMatchObject({ width: 4, depth: 4 });
  await page.getByTestId('catalog-patio-umbrella').click();
  await placeAt(page, 2, 5);
  const decorated = await saved(page);
  expect(roofItems(decorated).filter(item => ['canopy', 'patio-umbrella'].includes(item.kind))).toHaveLength(2);
  expect(roofItems(decorated).filter(item => item.kind === 'dining-table')).toEqual(roofItems(initial).filter(item => item.kind === 'dining-table'));
  await ready(page, true);
  await canvas(page).evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const sceneBox = await canvas(page).boundingBox();
  await page.screenshot({ path: info.outputPath('enclosed-roof-access-and-outdoor-covers.png'), clip: sceneBox! });

  await button(page, 'Edit lantai 2').click();
  await ready(page, false);
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-landing-guardrails'))).toBeGreaterThan(0);
  await button(page, 'Eksterior').click();
  await button(page, 'Atap genteng').click();
  await ready(page, false);
  await expect(button(page, 'Edit rooftop')).toHaveCount(0);
  await expect(canvas(page)).toHaveAttribute('data-rooftop-enclosures', '0');
  const tiled = await saved(page);
  expect(floors(tiled).at(-1)!.items.some(item => item.roofAccess)).toBe(false);
  expect(tiled.items.filter(item => item.kind === 'stairs')).toEqual(initial.items.filter(item => item.kind === 'stairs'));
  expect(tiled.rooftop).toEqual(decorated.rooftop);
  await page.reload();
  await ready(page);
  await expect(button(page, 'Edit rooftop')).toHaveCount(0);
  expect(await saved(page)).toEqual(tiled);
  await editRoof(page);
  await expect(canvas(page)).toHaveAttribute('data-rooftop-stair-access', 'enclosed');
  expect(await data(page, 'rooftop-items')).toEqual(renderedRoofItems(decorated));
  await button(page, 'Eksterior').click();
  await button(page, 'Terbuka').click();
  await expect(canvas(page)).toHaveAttribute('data-rooftop-stair-access', 'open');
  await expect(canvas(page)).toHaveAttribute('data-rooftop-enclosures', '0');
  expect(errors).toEqual([]);
});

test('a full upper floor keeps furniture intact and stair access can be added after freeing space', async ({ page }, info) => {
  test.setTimeout(120_000);
  const fixture: ShopDocument = { ...createEmptyShop(), width: 6, depth: 6, items: [
    { id: 'full-floor-table', kind: 'table', x: 0, z: 0, width: 6, depth: 6, color: '#D3AE87', rotation: 0, stock: 'none' },
  ] };
  const errors = await open(page, info, fixture);
  await editRoof(page);
  const crowded = await saved(page);
  expect(crowded.items).toEqual(fixture.items);
  expect(await data(page, 'stair-openings')).toEqual([]);
  await button(page, 'Tambah tangga ke rooftop').click();
  expect((await saved(page)).items).toEqual(fixture.items);
  await button(page, 'Ke lantai 1').click();
  await ready(page, false);
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption('full-floor-table');
  await button(page, 'Hapus barang').click();
  await expect.poll(async () => (await saved(page)).items).toEqual([]);
  await editRoof(page);
  if ((await saved(page)).items.every(item => item.kind !== 'stairs')) await button(page, 'Tambah tangga ke rooftop').click();
  await expect.poll(async () => (await saved(page)).items.some(item => item.kind === 'stairs')).toBe(true);
  await ready(page, true);
  await expect.poll(async () => (await data<unknown[]>(page, 'stair-openings')).length).toBeGreaterThan(0);
  expect((await saved(page)).rooftop).toEqual(crowded.rooftop);
  expect(errors).toEqual([]);
});
