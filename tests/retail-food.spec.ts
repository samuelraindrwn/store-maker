import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { ShopDocument, ShopItem } from '../src/model';

const KEY = 'nemu.store-maker.v1';
const fixture: ShopDocument = {
  version: 2, name: 'Kedai dan Koleksi', width: 10, depth: 10, wallHeight: 3.2,
  wallColor: '#F4EEDF', floorColor: '#DCC5A9', items: [], wallItems: [],
};
const displayKinds = ['glass-cabinet', 'display-plinth', 'pegboard'] as const;
const foodKinds = ['food-display', 'drinks-fridge', 'coffee-station', 'prep-counter', 'stove', 'sink', 'dining-table', 'service-cart'] as const;
const foodLabels = ['roti', 'pastri', 'minuman', 'buah', 'hidangan', 'camilan'];
const canvasFor = (page: Page) => page.getByTestId('scene').locator('canvas[data-renderer="webgl"]');
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);

async function openFixture(page: Page, testInfo: TestInfo, doc = fixture) {
  if (testInfo.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Playwright's per-test browser context is isolated from the real user profile.
  // Seed only once, so a reload genuinely exercises the app's saved document.
  await page.addInitScript(({ key, initial }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
  }, { key: KEY, initial: doc });
  await page.goto('/');
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(doc);
  return errors;
}

async function placeAt(page: Page, x: number, z: number) {
  await page.getByLabel('Petak X', { exact: true }).selectOption({ value: String(x) });
  await page.getByLabel('Petak Y', { exact: true }).selectOption({ value: String(z) });
  const place = page.getByRole('button', { name: 'Letakkan di sini', exact: true });
  await expect(place).toBeEnabled();
  await place.click();
}

async function expectRenderedItems(page: Page, ids: string[]) {
  await expect.poll(async () => {
    const entries: { id: string }[] = JSON.parse(await canvasFor(page).getAttribute('data-item-centers') || '[]');
    return entries.map(entry => entry.id).sort();
  }).toEqual([...ids].sort());
}

async function expectNoOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test('food catalog placement retains its stock and size through rotation, copying, undo and reload', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = await openFixture(page, testInfo);
  for (const kind of [...displayKinds, ...foodKinds]) await expect(page.getByTestId(`catalog-${kind}`)).toHaveCount(1);

  await page.getByRole('button', { name: 'Pajangan', exact: true }).click();
  for (const kind of displayKinds) await expect(page.getByTestId(`catalog-${kind}`)).toHaveCount(1);
  for (const kind of foodKinds) await expect(page.getByTestId(`catalog-${kind}`)).toHaveCount(0);
  await page.getByRole('button', { name: 'Dekor', exact: true }).click();
  for (const kind of [...displayKinds, ...foodKinds]) await expect(page.getByTestId(`catalog-${kind}`)).toHaveCount(0);

  await page.getByRole('button', { name: 'Toko makanan', exact: true }).click();
  await expect(page.locator('.catalog-card')).toHaveCount(10);
  for (const kind of [...foodKinds, 'counter', 'stool']) await expect(page.getByTestId(`catalog-${kind}`)).toHaveCount(1);
  for (const kind of [...displayKinds, 'shelf', 'rack', 'plant']) await expect(page.getByTestId(`catalog-${kind}`)).toHaveCount(0);
  await expectNoOverflow(page);

  await page.getByTestId('catalog-food-display').click();
  await placeAt(page, 1, 2);
  await expect.poll(async () => (await saved(page)).items).toHaveLength(1);
  const initial = (await saved(page)).items[0];
  expect(initial).toMatchObject({ kind: 'food-display', x: 1, z: 2, rotation: 0, stock: 'pastries' });
  await expectRenderedItems(page, [initial.id]);
  await expect(page.getByRole('button', { name: 'Isi dengan pastri', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const label of foodLabels) await expect(page.getByRole('button', { name: `Isi dengan ${label}`, exact: true })).toHaveCount(1);
  await expect(page.getByRole('group', { name: 'Kelompok isi pajangan', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Isi dengan buku', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Isi dengan sepatu', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Isi dengan tanpa barang', exact: true }).click();
  await expect.poll(async () => (await saved(page)).items[0].stock).toBe('none');
  await page.getByRole('button', { name: 'Isi dengan roti', exact: true }).click();
  await expect.poll(async () => (await saved(page)).items[0].stock).toBe('bread');

  await page.getByRole('button', { name: 'Ubah ukuran barang', exact: true }).click();
  await page.getByLabel('Panjang barang', { exact: true }).fill('3');
  await page.getByLabel('Panjang barang', { exact: true }).press('Enter');
  await expect.poll(async () => (await saved(page)).items[0]).toMatchObject({ width: 3, stock: 'bread' });
  await expect(page.getByRole('button', { name: 'Ubah ukuran barang', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Putar barang', exact: true }).click();
  await expect.poll(async () => (await saved(page)).items[0]).toMatchObject({ width: 3, rotation: 90, stock: 'bread' });
  await expect(page.getByLabel('Ukuran barang', { exact: true })).toHaveText('Jejak lantai 1 × 3 petak');

  const beforeCopy = await saved(page);
  await page.getByRole('button', { name: 'Duplikat barang', exact: true }).click();
  await expect(page.getByLabel('Ukuran barang yang diletakkan', { exact: true })).toHaveText('Jejak lantai 1 × 3 petak');
  expect(await saved(page)).toEqual(beforeCopy);
  await placeAt(page, 6, 2);
  await expect.poll(async () => (await saved(page)).items).toHaveLength(2);
  const afterCopy = await saved(page);
  expect(afterCopy.items[0]).toEqual(beforeCopy.items[0]);
  expect(afterCopy.items[1]).toEqual({ ...beforeCopy.items[0], id: afterCopy.items[1].id, x: 6, z: 2 });
  expect(afterCopy.items[1].id).not.toBe(initial.id);
  await expectRenderedItems(page, afterCopy.items.map(item => item.id));
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect.poll(() => saved(page)).toEqual(beforeCopy);
  await page.getByRole('button', { name: 'Ulangi', exact: true }).click();
  await expect.poll(() => saved(page)).toEqual(afterCopy);
  await page.reload();
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(afterCopy);
  await expectRenderedItems(page, afterCopy.items.map(item => item.id));
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});

test('generic displays switch between goods and food while fridges expose only compatible contents', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const glass: ShopItem = { id: 'glass-display', kind: 'glass-cabinet', x: 1, z: 1, rotation: 0, color: '#B79FC9', stock: 'books' };
  const fridge: ShopItem = { id: 'cold-display', kind: 'drinks-fridge', x: 6, z: 1, rotation: 0, color: '#A8BDB9', stock: 'drinks' };
  const errors = await openFixture(page, testInfo, { ...fixture, items: [glass, fridge] });
  await expectRenderedItems(page, [glass.id, fridge.id]);
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption(glass.id);
  const groups = page.getByRole('group', { name: 'Kelompok isi pajangan', exact: true });
  await expect(groups.getByRole('button', { name: 'Barang', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const label of ['sepatu', 'tas', 'skincare', 'mainan']) await expect(page.getByRole('button', { name: `Isi dengan ${label}`, exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Isi dengan minuman', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Isi dengan sepatu', exact: true }).click();
  await expect.poll(async () => (await saved(page)).items[0]).toEqual({ ...glass, stock: 'shoes' });
  const beforeGroupSwitch = await saved(page);
  await groups.getByRole('button', { name: 'Makanan', exact: true }).click();
  await expect(groups.getByRole('button', { name: 'Makanan', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await saved(page)).toEqual(beforeGroupSwitch);
  for (const label of foodLabels) await expect(page.getByRole('button', { name: `Isi dengan ${label}`, exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Isi dengan sepatu', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Isi dengan tanpa barang', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Isi dengan minuman', exact: true }).click();
  await expect.poll(async () => (await saved(page)).items[0]).toEqual({ ...glass, stock: 'drinks' });

  await page.reload();
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption(glass.id);
  await expect(groups.getByRole('button', { name: 'Makanan', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Isi dengan minuman', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Isi dengan tanpa barang', exact: true }).click();
  await expect.poll(async () => (await saved(page)).items[0]).toEqual({ ...glass, stock: 'none' });
  await expect(groups.getByRole('button', { name: 'Makanan', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption(fridge.id);
  await expect(groups).toHaveCount(0);
  for (const label of ['minuman', 'buah', 'hidangan', 'camilan', 'tanpa barang']) await expect(page.getByRole('button', { name: `Isi dengan ${label}`, exact: true })).toHaveCount(1);
  for (const label of ['roti', 'pastri', 'buku', 'sepatu', 'tas', 'skincare', 'mainan']) await expect(page.getByRole('button', { name: `Isi dengan ${label}`, exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Isi dengan minuman', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Isi dengan buah', exact: true }).click();
  await expect.poll(async () => (await saved(page)).items[1]).toEqual({ ...fridge, stock: 'fruit' });
  await page.getByRole('button', { name: 'Isi dengan tanpa barang', exact: true }).click();
  await expect.poll(async () => (await saved(page)).items[1]).toEqual({ ...fridge, stock: 'none' });
  const final = await saved(page);
  await page.reload();
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(final);
  await expectRenderedItems(page, [glass.id, fridge.id]);
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});
