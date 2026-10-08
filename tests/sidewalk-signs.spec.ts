import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { ShopDocument, ShopItem } from '../src/model';

const KEY = 'nemu.store-maker.v1';
const LEGACY = { version: 1, name: 'Papan dari toko lama', width: 7, depth: 6,
  wallColor: '#F4EEDF', floorColor: '#DCC5A9', items: [], wallItems: [] };
const EMPTY = { ...LEGACY, version: 2, name: 'Tiga papan toko' };
const kinds = ['chalkboard', 'poster-stand', 'direction-sign'] as const;
const canvasFor = (page: Page) => page.getByTestId('scene').locator('canvas[data-renderer="webgl"]');
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
type Point = { x: number; y: number };

async function ready(page: Page) {
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
}

async function projected(page: Page, source: 'itemCenters' | 'cellCenters', query: { id: string } | { x: number; z: number }): Promise<Point> {
  const canvas = canvasFor(page);
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(() => canvas.evaluate((surface, { source, query }) => {
    const entries = JSON.parse((surface as HTMLElement).dataset[source] || '[]');
    return entries.some((entry: Record<string, unknown>) => Object.entries(query).every(([key, value]) => entry[key] === value));
  }, { source, query })).toBe(true);
  await canvas.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return canvas.evaluate((surface, { source, query }) => {
    const entries = JSON.parse((surface as HTMLElement).dataset[source] || '[]');
    const entry = entries.find((entry: Record<string, unknown>) => Object.entries(query).every(([key, value]) => entry[key] === value));
    const rect = surface.getBoundingClientRect();
    return { x: rect.left + entry.canvasX, y: rect.top + entry.canvasY };
  }, { source, query });
}

async function tapItem(page: Page, id: string) {
  const point = await projected(page, 'itemCenters', { id });
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

async function dragItem(page: Page, item: ShopItem, target: { x: number; z: number }) {
  const from = await projected(page, 'itemCenters', { id: item.id });
  const origin = await projected(page, 'cellCenters', { x: 1, z: 1 });
  const unitX = await projected(page, 'cellCenters', { x: 2, z: 1 });
  const unitZ = await projected(page, 'cellCenters', { x: 1, z: 2 });
  const to = { x: from.x + (unitX.x - origin.x) * (target.x - item.x) + (unitZ.x - origin.x) * (target.z - item.z),
    y: from.y + (unitX.y - origin.y) * (target.x - item.x) + (unitZ.y - origin.y) * (target.z - item.z) };
  const mobile = await page.evaluate(() => navigator.maxTouchPoints > 0);
  const session = mobile ? await page.context().newCDPSession(page) : null;
  if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, ...from }] });
  else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  for (let step = 1; step <= 8; step++) {
    const point = { x: from.x + (to.x - from.x) * step / 8, y: from.y + (to.y - from.y) * step / 8 };
    if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, ...point }] });
    else await page.mouse.move(point.x, point.y);
  }
  return async () => {
    if (session) { await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach(); }
    else await page.mouse.up();
  };
}

test('the legacy sidewalk chalkboard becomes one editable item and stays deleted after reload', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  if (testInfo.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1000 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await ready(page);
  await page.evaluate(({ key, doc }) => localStorage.setItem(key, JSON.stringify(doc)), { key: KEY, doc: LEGACY });
  await page.reload(); await ready(page);
  await expect.poll(async () => (await saved(page)).version).toBe(2);
  await expect.poll(async () => (await saved(page)).items.filter(item => item.kind === 'chalkboard').length).toBe(1);
  const migrated = await saved(page);
  expect(migrated.items).toHaveLength(1);
  const board = migrated.items[0];
  expect(board.stock).toBe('none');
  await expect.poll(async () => JSON.parse(await canvasFor(page).getAttribute('data-item-centers') || '[]').filter((item: { id: string }) => item.id === board.id).length).toBe(1);
  await tapItem(page, board.id);
  await expect(page.getByTestId('inspector').getByRole('button', { name: 'Putar barang', exact: true })).toBeVisible();
  expect(await saved(page)).toEqual(migrated);
  await expect(page.getByRole('button', { name: 'Urungkan', exact: true })).toBeDisabled();

  for (const target of [{ x: 2, z: 6 }, { x: 1, z: 4 }]) {
    const before = await saved(page), item = before.items.find(item => item.id === board.id)!;
    const release = await dragItem(page, item, target);
    try {
      await expect(canvasFor(page)).toHaveAttribute('data-interaction', 'item');
      await expect.poll(async () => JSON.parse(await canvasFor(page).getAttribute('data-preview-item') || 'null')?.valid).toBe(true);
      expect(await saved(page)).toEqual(before);
    } finally { await release(); }
    await expect.poll(async () => (await saved(page)).items.find(item => item.id === board.id)).toMatchObject(target);
    const moved = await saved(page);
    await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
    await expect.poll(() => saved(page)).toEqual(before);
    await page.getByRole('button', { name: 'Ulangi', exact: true }).click();
    await expect.poll(() => saved(page)).toEqual(moved);
  }
  const inside = await saved(page);
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption({ value: board.id });
  await page.getByRole('button', { name: 'Putar barang', exact: true }).click();
  await expect.poll(async () => (await saved(page)).items[0].rotation).toBe(90);
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect.poll(() => saved(page)).toEqual(inside);
  await page.getByRole('button', { name: 'Ulangi', exact: true }).click();
  await expect.poll(async () => (await saved(page)).items[0].rotation).toBe(90);
  await canvasFor(page).screenshot({ path: testInfo.outputPath('chalkboard-moved-inside.png') });
  await page.getByRole('button', { name: 'Hapus barang', exact: true }).click();
  await expect.poll(async () => (await saved(page)).items).toEqual([]);
  await page.reload(); await ready(page);
  expect((await saved(page)).version).toBe(2);
  expect((await saved(page)).items).toEqual([]);
  await expect.poll(async () => JSON.parse(await canvasFor(page).getAttribute('data-item-centers') || '[]')).toEqual([]);
  await canvasFor(page).screenshot({ path: testInfo.outputPath('chalkboard-deleted-after-reload.png') });
  expect(errors).toEqual([]);
});

test('all three standing sign variants can be placed and survive export import and reload', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  if (testInfo.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1000 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await ready(page);
  const input = page.getByLabel('Buka file desain', { exact: true });
  await input.setInputFiles({ name: 'empty.store-maker.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(EMPTY)) });
  await expect.poll(() => saved(page)).toEqual(EMPTY);
  await page.getByRole('button', { name: 'Papan', exact: true }).click();
  const positions = [{ x: 0, z: 6 }, { x: 5, z: 2 }, { x: 2, z: 6 }];
  for (let index = 0; index < kinds.length; index++) {
    await page.getByTestId(`catalog-${kinds[index]}`).click();
    await page.getByLabel('Petak X', { exact: true }).selectOption({ value: String(positions[index].x) });
    await page.getByLabel('Petak Y', { exact: true }).selectOption({ value: String(positions[index].z) });
    await page.getByRole('button', { name: 'Letakkan di sini', exact: true }).click();
    await expect.poll(async () => (await saved(page)).items.find(item => item.kind === kinds[index])).toMatchObject(positions[index]);
  }
  const beforeStyle = await saved(page);
  const original = beforeStyle.items.find(item => item.kind === 'chalkboard')!;
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption({ value: original.id });
  await page.getByRole('button', { name: 'Ganti ke Poster berdiri', exact: true }).click();
  await expect.poll(async () => (await saved(page)).items.find(item => item.id === original.id)).toEqual({ ...original, kind: 'poster-stand' });
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect.poll(() => saved(page)).toEqual(beforeStyle);
  await page.getByRole('button', { name: 'Ulangi', exact: true }).click();
  await expect.poll(async () => (await saved(page)).items.find(item => item.id === original.id)).toEqual({ ...original, kind: 'poster-stand' });
  await page.getByRole('button', { name: 'Ganti ke Papan kapur', exact: true }).click();
  await expect.poll(() => saved(page)).toEqual(beforeStyle);
  const complete = await saved(page);
  expect(complete).toEqual(beforeStyle);
  expect(complete.items).toHaveLength(3);
  expect(new Set(complete.items.map(item => item.id)).size).toBe(3);
  expect(complete.items.map(item => item.kind).sort()).toEqual([...kinds].sort());
  await expect.poll(async () => JSON.parse(await canvasFor(page).getAttribute('data-item-centers') || '[]').length).toBe(3);
  await canvasFor(page).screenshot({ path: testInfo.outputPath('standing-sign-variants.png') });
  await page.evaluate(() => scrollTo(0, 0));
  const toolbar = page.getByTestId('scene-toolbar');
  const pill = toolbar.locator('.edit-mode-switch');
  await page.locator('.library-panel').evaluate(element => { element.scrollTop = 0; });
  expect(await toolbar.evaluate(element => element.closest('[data-testid="scene"]') === null)).toBe(true);
  expect(await toolbar.evaluate(element => element.parentElement?.classList.contains('library-panel'))).toBe(true);
  const pillBox = (await pill.boundingBox())!, sceneBox = (await page.getByTestId('scene').boundingBox())!;
  const library = (await page.locator('.library-panel').boundingBox())!;
  const tabs = (await page.locator('.panel-tabs').boundingBox())!;
  const actions = (await page.locator('.workspace-actions').boundingBox())!;
  expect(pillBox.y).toBeGreaterThanOrEqual(tabs.y + tabs.height);
  expect(pillBox.x).toBeGreaterThanOrEqual(library.x);
  expect(pillBox.x + pillBox.width).toBeLessThanOrEqual(library.x + library.width);
  expect(pillBox.x + pillBox.width <= actions.x || actions.x + actions.width <= pillBox.x
    || pillBox.y + pillBox.height <= actions.y || actions.y + actions.height <= pillBox.y).toBe(true);
  if (testInfo.project.name === 'chromium') {
    expect(pillBox.x + pillBox.width).toBeLessThan(sceneBox.x);
    expect(Math.abs(sceneBox.y - library.y)).toBeLessThan(1);
    expect(sceneBox.height).toBeGreaterThanOrEqual(650);
  }
  await page.screenshot({ path: `artifacts/sign-toolbar-${testInfo.project.name === 'chromium' ? 'desktop' : 'mobile'}.png`, fullPage: testInfo.project.name !== 'chromium' });
  await page.getByRole('button', { name: 'Menu file desain', exact: true }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Simpan file desain', exact: true }).click();
  const download = await event;
  expect(download.suggestedFilename()).toMatch(/\.store-maker\.json$/);
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported).toEqual(complete);
  await input.setInputFiles({ name: 'empty.store-maker.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(EMPTY)) });
  await expect.poll(async () => (await saved(page)).items).toEqual([]);
  await input.setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect.poll(() => saved(page)).toEqual(complete);
  await page.reload(); await ready(page);
  expect(await saved(page)).toEqual(complete);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
