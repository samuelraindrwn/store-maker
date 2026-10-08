import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createInitialShop, type ShopDocument } from '../src/model';

const KEY = 'nemu.store-maker.v1';
const custom: ShopDocument = {
  version: 2, name: 'Kedai Sebelum Reset', width: 9, depth: 8,
  wallColor: '#C6B8DE', floorColor: '#C5CDB7', wallHeight: 3.7,
  entrance: { position: 0.13, rotation: 270, open: true },
  floorCells: Array.from({ length: 7 }, (_, z) => Array.from({ length: z < 4 ? 8 : 5 }, (_, x) => ({ x, z }))).flat(),
  items: [
    { id: 'food-case', kind: 'food-display', x: 1, z: 2, rotation: 90, width: 3, depth: 1, color: '#9E91BA', stock: 'bread' },
    { id: 'drinks-case', kind: 'drinks-fridge', x: 4, z: 2, rotation: 0, color: '#8D9E83', stock: 'drinks' },
  ],
  wallItems: [{ id: 'custom-window', kind: 'window', wall: 'back', line: 0, offset: 4, height: 2, width: 2.4, sizeHeight: 1.8, windowStyle: 'arched', color: '#D6BEA0', text: '', lit: false }],
};
const blank: ShopDocument = {
  version: 2, name: 'Toko Kecilku', width: 7, depth: 6,
  wallColor: '#F4EEDF', floorColor: '#DCC5A9', floorCells: [], items: [], wallItems: [],
};
const canvasFor = (page: Page) => page.getByTestId('scene').locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
const metadata = async (page: Page, name: string) => JSON.parse(await canvasFor(page).getAttribute(`data-${name}`) || 'null');

async function openFixture(page: Page, info: TestInfo) {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1000 });
  const errors: string[] = [], dialogs: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  // Each Playwright test gets a disposable browser context, leaving the real profile alone.
  await page.addInitScript(({ key, doc }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc));
  }, { key: KEY, doc: custom });
  await page.goto('/');
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(custom);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  return { errors, dialogs };
}

async function expectSharedActions(page: Page) {
  for (const name of ['Reset ke toko contoh', 'Kosongkan semua']) {
    const action = page.locator('.library-panel').getByRole('button', { name, exact: true });
    await expect(action).toHaveCount(1);
    await expect(action).toBeVisible();
    expect(await action.evaluate(element => element.closest('.room-settings') === null)).toBe(true);
  }
}

async function expectBlankScene(page: Page) {
  await expect.poll(() => saved(page)).toEqual(blank);
  for (const key of ['floor-cells', 'floor-outline', 'item-centers', 'wall-item-centers', 'window-openings']) {
    await expect.poll(() => metadata(page, key)).toEqual([]);
  }
  await expect.poll(() => metadata(page, 'door-center')).toBeNull();
  await expect(canvasFor(page)).toHaveAttribute('data-resize-mode', 'false');
  await expect(canvasFor(page)).toHaveAttribute('data-build-tool', 'add');
  await expect(button(page, 'Bangun ruangan')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Tambah lantai')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Tampilkan petak')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Buka pintu masuk')).toHaveCount(0);
  await expect(button(page, 'Tutup pintu masuk')).toHaveCount(0);
  await expect(button(page, 'Batalkan penempatan aksesori')).toHaveCount(0);
  await expect(button(page, 'Batalkan penempatan')).toHaveCount(0);
}

async function addFirstTile(page: Page, x: number, z: number) {
  const canvas = canvasFor(page);
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => {
    const cells: { x: number; z: number }[] = await metadata(page, 'paint-cells') || [];
    return cells.some(cell => cell.x === x && cell.z === z);
  }).toBe(true);
  await canvas.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const point = await canvas.evaluate((surface, target) => {
    const cells = JSON.parse((surface as HTMLElement).dataset.paintCells || '[]') as { x: number; z: number; canvasX: number; canvasY: number }[];
    const cell = cells.find(cell => cell.x === target.x && cell.z === target.z)!;
    const rect = surface.getBoundingClientRect();
    return { x: rect.left + cell.canvasX, y: rect.top + cell.canvasY };
  }, { x, z });
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

async function expectNoOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test('reset restores the full example from a custom food shop with one undo and clears resize selection', async ({ page }, info) => {
  test.setTimeout(90_000);
  const observed = await openFixture(page, info);
  await expectSharedActions(page);
  await button(page, 'Ruangan').click();
  await expectSharedActions(page);
  await button(page, 'Isi toko').click();
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption({ value: 'food-case' });
  await button(page, 'Ubah ukuran barang').click();
  await expect(canvasFor(page)).toHaveAttribute('data-resize-mode', 'true');
  await button(page, 'Kamera dari atas').click();
  await expect(canvasFor(page)).toHaveAttribute('data-view', 'top');
  await button(page, 'Tampilkan lingkungan kota').click();
  await button(page, 'Tampilkan dinding').click();
  await expect(button(page, 'Tampilkan lingkungan kota')).toHaveAttribute('aria-pressed', 'false');
  await expect(button(page, 'Tampilkan dinding')).toHaveAttribute('aria-pressed', 'false');
  expect(await saved(page)).toEqual(custom);

  await button(page, 'Reset ke toko contoh').click();
  const example = createInitialShop();
  await expect.poll(() => saved(page)).toEqual(example);
  await expect(button(page, 'Atur barang')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Kamera perspektif')).toHaveAttribute('aria-pressed', 'true');
  await expect(canvasFor(page)).toHaveAttribute('data-view', 'orbit');
  await expect(canvasFor(page)).toHaveAttribute('data-resize-mode', 'false');
  await expect(button(page, 'Tampilkan lingkungan kota')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Tampilkan dinding')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Tampilkan petak')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByLabel('Pilih barang di toko', { exact: true })).toHaveValue('');
  await expect(button(page, 'Ubah ukuran barang')).toHaveCount(0);
  await expect.poll(async () => (await metadata(page, 'item-centers')).map((item: { id: string }) => item.id).sort()).toEqual(example.items.map(item => item.id).sort());
  await page.screenshot({ path: `artifacts/reset-clear-sample-${info.project.name}.png`, fullPage: true });
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(custom);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  await button(page, 'Ulangi').click();
  await expect.poll(() => saved(page)).toEqual(example);
  await page.reload();
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(example);
  await expectSharedActions(page);
  await expectNoOverflow(page);
  expect(observed.errors).toEqual([]);
  expect(observed.dialogs).toEqual([]);
});

test('clear removes the entire room, survives reload, and allows building a first floor tile', async ({ page }, info) => {
  test.setTimeout(90_000);
  const observed = await openFixture(page, info);
  await button(page, 'Dinding').click();
  await page.getByTestId('catalog-window').click();
  await expect(button(page, 'Batalkan penempatan aksesori')).toBeVisible();
  expect(await saved(page)).toEqual(custom);
  await button(page, 'Kamera depan').click();
  await button(page, 'Kosongkan semua').click();
  await expectBlankScene(page);
  await expect(canvasFor(page)).toHaveAttribute('data-view', 'orbit');
  await expect(button(page, 'Kamera perspektif')).toHaveAttribute('aria-pressed', 'true');
  await expectSharedActions(page);
  await page.screenshot({ path: `artifacts/reset-clear-blank-${info.project.name}.png`, fullPage: true });

  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(custom);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  await button(page, 'Ulangi').click();
  await expectBlankScene(page);
  await page.reload();
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  await expectBlankScene(page);
  await expect(button(page, 'Urungkan')).toBeDisabled();

  // The action uses the real transparent grid, including a native tap on mobile.
  await addFirstTile(page, 3, 3);
  await expect.poll(async () => (await saved(page)).floorCells).toEqual([{ x: 3, z: 3 }]);
  const rebuilt = await saved(page);
  expect(rebuilt.items).toEqual([]);
  expect(rebuilt.wallItems).toEqual([]);
  expect(rebuilt.width).toBe(7);
  expect(rebuilt.depth).toBe(6);
  await expect.poll(() => metadata(page, 'floor-outline')).toHaveLength(4);
  await button(page, 'Urungkan').click();
  await expectBlankScene(page);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  await button(page, 'Ulangi').click();
  await expect.poll(() => saved(page)).toEqual(rebuilt);
  await expectNoOverflow(page);
  expect(observed.errors).toEqual([]);
  expect(observed.dialogs).toEqual([]);
});
