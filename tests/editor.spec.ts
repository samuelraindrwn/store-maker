import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { ShopDocument } from '../src/model';

const STORAGE_KEY = 'nemu.store-maker.v1';
const EMPTY_SHOP: ShopDocument = {
  version: 2, name: 'Toko Pengujian', width: 7, depth: 6,
  wallColor: '#F4EEDF', floorColor: '#DCC5A9', items: [],
};

async function clickCell(page: Page, x: number, z: number) {
  const canvas = page.getByTestId('scene').locator('canvas[data-renderer="webgl"]');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await canvas.scrollIntoViewIfNeeded();
  const point = await canvas.evaluate((surface, cell) => {
    const centers = JSON.parse((surface as HTMLElement).dataset.cellCenters || '[]') as {
      x: number; z: number; clientX: number; clientY: number; canvasX?: number; canvasY?: number;
    }[];
    const center = centers.find(item => item.x === cell.x && item.z === cell.z);
    if (!center) throw new Error(`Missing ground cell ${cell.x},${cell.z}`);
    const box = surface.getBoundingClientRect();
    return {
      x: center.canvasX === undefined ? center.clientX : box.left + center.canvasX,
      y: center.canvasY === undefined ? center.clientY : box.top + center.canvasY,
    };
  }, { x, z });
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

async function savedShop(page: Page): Promise<ShopDocument | null> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
}

async function importShop(page: Page, shop: ShopDocument) {
  await page.getByLabel('Buka file desain', { exact: true }).setInputFiles({
    name: 'desain-toko.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(shop)),
  });
  await expect(page.getByLabel('Nama toko', { exact: true })).toHaveValue(shop.name);
  await expect.poll(() => savedShop(page)).toEqual(shop);
}

async function noHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1);
}

test('the editor renders a real WebGL scene and fits the viewport', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const canvas = page.getByTestId('scene').locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => canvas.evaluate(element => new Promise<boolean>(resolve => {
    requestAnimationFrame(() => {
      const surface = element as HTMLCanvasElement;
      const gl = surface.getContext('webgl2') ?? surface.getContext('webgl');
      if (!gl || gl.isContextLost() || gl.drawingBufferWidth < 200 || gl.drawingBufferHeight < 150) {
        resolve(false);
        return;
      }
      const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const colors = new Set<string>();
      for (let y = 1; y < 20; y++) {
        for (let x = 1; x < 20; x++) {
          const offset = (Math.floor(y / 20 * gl.drawingBufferHeight) * gl.drawingBufferWidth +
            Math.floor(x / 20 * gl.drawingBufferWidth)) * 4;
          if (pixels[offset + 3] > 0) colors.add(`${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]}`);
        }
      }
      resolve(colors.size > 12);
    });
  }))).toBe(true);
  await expect(page.getByLabel('Nama toko', { exact: true })).toBeVisible();
  await noHorizontalOverflow(page);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('store-webgl.png'), fullPage: true });
});

test('the shop name autosaves locally and survives reloading the editor', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Nama toko', { exact: true }).fill('Sudut Cerita E2E');
  await expect.poll(async () => JSON.stringify(await savedShop(page))).toContain('Sudut Cerita E2E');
  const before = await savedShop(page);
  await page.reload();
  await expect(page.getByLabel('Nama toko', { exact: true })).toHaveValue('Sudut Cerita E2E');
  expect(await savedShop(page)).toEqual(before);
});

test('reloading while a shop name is temporarily blank preserves the saved design', async ({ page }) => {
  await page.goto('/');
  const fixture = { ...EMPTY_SHOP, name: 'Desain tetap utuh', width: 8 };
  await importShop(page, fixture);
  await page.getByLabel('Nama toko', { exact: true }).fill('');
  await page.reload();
  await expect(page.getByLabel('Nama toko', { exact: true })).not.toHaveValue('');
  await expect.poll(() => savedShop(page)).toMatchObject({ width: fixture.width, items: fixture.items });
});

test('a downloaded design can be imported again without losing its furniture or room settings', async ({ page }) => {
  await page.goto('/');
  const fixture: ShopDocument = {
    version: 2, name: 'Toko Impor E2E', width: 8, depth: 7,
    wallColor: '#DECCE8', floorColor: '#C7B197',
    items: [
      { id: 'imported-shelf', kind: 'shelf', x: 1, z: 1, rotation: 90, color: '#AA8866', stock: 'vinyl' },
      { id: 'imported-plant', kind: 'plant', x: 5, z: 4, rotation: 0, color: '#BB9977', stock: 'none' },
    ],
  };
  await importShop(page, fixture);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Menu file desain', exact: true }).click();
  await page.getByRole('button', { name: 'Simpan file desain', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const filePath = await download.path();
  expect(filePath).not.toBeNull();
  const exported = JSON.parse(await readFile(filePath!, 'utf8'));
  expect(exported).toEqual(fixture);
  await page.getByLabel('Nama toko', { exact: true }).fill('Nama sementara');
  await importShop(page, exported);
  await page.reload();
  await expect(page.getByLabel('Nama toko', { exact: true })).toHaveValue(fixture.name);
  expect(await savedShop(page)).toEqual(fixture);
});

test('furniture can be placed, rotated, stocked, moved and removed with working undo and redo', async ({ page }) => {
  await page.goto('/');
  await importShop(page, EMPTY_SHOP);
  await page.getByTestId('catalog-shelf').click();
  await clickCell(page, 1, 1);
  await expect.poll(async () => (await savedShop(page))?.items.length).toBe(1);
  const itemId = (await savedShop(page))!.items[0].id;
  const currentItem = async () => (await savedShop(page))?.items.find(item => item.id === itemId);
  expect(await currentItem()).toMatchObject({ kind: 'shelf', x: 1, z: 1, rotation: 0 });
  await expect(page.getByTestId('inspector')).toBeVisible();
  await page.getByRole('button', { name: 'Putar barang', exact: true }).click();
  await expect.poll(currentItem).toMatchObject({ rotation: 90 });
  const canvas = page.getByTestId('scene').locator('canvas');
  const previousStockImage = await canvas.evaluate(surface => new Promise<string>(resolve =>
    requestAnimationFrame(() => resolve((surface as HTMLCanvasElement).toDataURL())),
  ));
  await page.getByRole('button', { name: 'Isi dengan keramik', exact: true }).click();
  await expect.poll(currentItem).toMatchObject({ stock: 'ceramics' });
  await expect.poll(() => canvas.evaluate((surface, previous) =>
    (surface as HTMLCanvasElement).toDataURL() !== previous, previousStockImage,
  )).toBe(true);
  await page.getByRole('button', { name: 'Pindahkan barang', exact: true }).click();
  await clickCell(page, 4, 2);
  await expect.poll(currentItem).toMatchObject({ x: 4, z: 2, rotation: 90, stock: 'ceramics' });
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect.poll(currentItem).toMatchObject({ x: 1, z: 1, rotation: 90, stock: 'ceramics' });
  await page.getByRole('button', { name: 'Ulangi', exact: true }).click();
  await expect.poll(currentItem).toMatchObject({ x: 4, z: 2, rotation: 90, stock: 'ceramics' });
  await page.getByRole('button', { name: 'Hapus barang', exact: true }).click();
  await expect.poll(async () => (await savedShop(page))?.items).toEqual([]);
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect.poll(currentItem).toMatchObject({ x: 4, z: 2, rotation: 90, stock: 'ceramics' });
  await page.getByRole('button', { name: 'Ulangi', exact: true }).click();
  await expect.poll(async () => (await savedShop(page))?.items).toEqual([]);
  await noHorizontalOverflow(page);
});

test('occupied cells cannot silently overlap furniture', async ({ page }) => {
  await page.goto('/');
  await importShop(page, EMPTY_SHOP);
  await page.getByTestId('catalog-table').click();
  await page.getByLabel('Petak X', { exact: true }).selectOption({ value: '2' });
  await page.getByLabel('Petak Y', { exact: true }).selectOption({ value: '2' });
  await page.getByRole('button', { name: 'Letakkan di sini', exact: true }).click();
  await expect.poll(async () => (await savedShop(page))?.items.length).toBe(1);
  await page.getByTestId('catalog-plant').click();
  await page.getByLabel('Petak X', { exact: true }).selectOption({ value: '2' });
  await page.getByLabel('Petak Y', { exact: true }).selectOption({ value: '2' });
  await expect(page.getByRole('button', { name: 'Letakkan di sini', exact: true })).toBeDisabled();
  await clickCell(page, 2, 2);
  await expect(page.getByRole('status')).toContainText('Ada barang lain atau melewati lantai');
  expect((await savedShop(page))?.items).toHaveLength(1);
  await page.getByLabel('Petak X', { exact: true }).selectOption({ value: '6' });
  await page.getByLabel('Petak Y', { exact: true }).selectOption({ value: '5' });
  await page.getByRole('button', { name: 'Letakkan di sini', exact: true }).click();
  await expect.poll(async () => (await savedShop(page))?.items.length).toBe(2);
});

test('invalid design files leave the existing shop unchanged and remain retryable', async ({ page }) => {
  await page.goto('/');
  await importShop(page, { ...EMPTY_SHOP, name: 'Desain yang harus tetap ada' });
  const before = await savedShop(page);
  const input = page.getByLabel('Buka file desain', { exact: true });
  for (const contents of ['{broken-json', JSON.stringify({ ...EMPTY_SHOP, version: 999 }), JSON.stringify({
    ...EMPTY_SHOP,
    items: [
      { id: 'one', kind: 'plant', x: 1, z: 1, rotation: 0, color: '#AA8866', stock: 'none' },
      { id: 'two', kind: 'plant', x: 1, z: 1, rotation: 0, color: '#AA8866', stock: 'none' },
    ],
  })]) {
    await input.setInputFiles({ name: 'invalid.nemu.json', mimeType: 'application/json', buffer: Buffer.from(contents) });
    await expect(page.getByRole('status')).toContainText('File tidak valid');
    await expect(input).toHaveValue('');
    expect(await savedShop(page)).toEqual(before);
  }
  await importShop(page, { ...EMPTY_SHOP, name: 'File valid setelah ditolak' });
});

test('a corrupt local save recovers to a usable editor', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{broken-json'), STORAGE_KEY);
  await page.goto('/');
  await expect(page.getByLabel('Nama toko', { exact: true })).toHaveValue('Sudut Cerita');
  await expect(page.getByTestId('catalog-plant')).toBeEnabled();
  await expect.poll(async () => (await savedShop(page))?.items.length).toBe(10);
  await expect(page.getByTestId('scene').locator('canvas')).toHaveAttribute('data-ready', 'true');
});

test('camera controls and preview work while a real PNG can be downloaded', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByTestId('scene').locator('canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  const before = await savedShop(page);
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    const initial = await canvas.getAttribute('data-cell-centers');
    const session = await page.context().newCDPSession(page);
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    try {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
        { id: 0, x: centerX - 25, y: centerY }, { id: 1, x: centerX + 25, y: centerY },
      ] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
        { id: 0, x: centerX - 45, y: centerY }, { id: 1, x: centerX + 45, y: centerY },
      ] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(() => canvas.getAttribute('data-cell-centers')).not.toBe(initial);
      expect(await savedShop(page)).toEqual(before);
    } finally {
      await session.detach();
    }
  }
  const orbitCells = await canvas.getAttribute('data-cell-centers');
  await page.getByRole('button', { name: 'Kamera dari atas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kamera dari atas', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => canvas.getAttribute('data-cell-centers')).not.toBe(orbitCells);
  await page.getByRole('button', { name: 'Reset kamera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kamera perspektif', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Lihat tokoku', exact: true }).click();
  await expect(page.getByTestId('inspector')).toHaveCount(0);
  await expect(page.getByTestId('catalog-plant')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tampilkan petak', exact: true })).toBeDisabled();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ambil foto toko', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('store-maker.png');
  const png = await readFile((await download.path())!);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.length).toBeGreaterThan(10_000);
  expect(await savedShop(page)).toEqual(before);
  await noHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Kembali ngatur', exact: true }).click();
  await expect(page.getByTestId('catalog-plant')).toBeVisible();
});
