import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createEmptyShop, createInitialShop, type ShopDocument } from '../src/model';

test.use({ reducedMotion: 'reduce' });

const KEY = 'nemu.store-maker.v1';
const canvas = (page: Page) => page.locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
async function open(page: Page, info: TestInfo, fixture?: ShopDocument) {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1050 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  if (fixture) await page.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: KEY, doc: fixture });
  await page.goto('/');
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  return errors;
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}
async function photo(page: Page, info: TestInfo, name: string) {
  await page.getByTestId('scene').scrollIntoViewIfNeeded();
  await page.getByTestId('scene').screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled', timeout: 30_000 });
  if (name === 'exterior-tiles-two') await page.screenshot({ path: info.outputPath('exterior-editor-full.png'), fullPage: true, animations: 'disabled' });
}

test('two-storey example keeps floor edits isolated and exports the entire building from upstairs', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors = await open(page, info);
  const initial = createInitialShop();
  await expect.poll(() => saved(page)).toEqual(initial);
  expect(initial.items.map(item => item.kind)).toEqual(expect.arrayContaining(['stairs', 'toilet', 'washbasin', 'shower']));
  expect(initial.partitions).toHaveLength(2);
  expect(initial.interiorDoors).toHaveLength(1);
  expect(initial.upperFloors?.[0].items.some(item => item.kind === 'warehouse-rack')).toBe(true);
  await expect(page.getByLabel('Jumlah lantai', { exact: true })).toHaveValue('2');
  await photo(page, info, 'ground-bathroom-stairs');
  await button(page, 'Edit lantai 2').click();
  const rack = initial.upperFloors![0].items.find(item => item.kind === 'warehouse-rack')!;
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption(rack.id);
  await button(page, 'Warna perabot 3').click();
  await expect.poll(async () => (await saved(page)).upperFloors![0].items.find(item => item.id === rack.id)!.color).toBe('#9e91ba');
  expect((await saved(page)).items).toEqual(initial.items);
  await photo(page, info, 'upstairs-warehouse');
  await noOverflow(page);
  await page.getByLabel('Nama toko', { exact: true }).fill('Toko Dua Cerita');
  const design = await saved(page);
  expect(design.name).toBe('Toko Dua Cerita');
  await button(page, 'Menu file desain').click();
  const downloadWait = page.waitForEvent('download');
  await button(page, 'Simpan file desain').click();
  const download = await downloadWait;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(exported).toEqual(design);
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(design);
  await button(page, 'Edit lantai 2').click();
  exported.name = 'Impor seluruh gedung';
  await page.locator('input[type=file]').setInputFiles({ name: 'whole-building.store-maker.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect.poll(() => saved(page)).toEqual(exported);
  await expect(button(page, 'Edit lantai 1')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('one to four floors supports undo after reducing and rejects fifth-floor imports', async ({ page }, info) => {
  test.setTimeout(100_000);
  const errors = await open(page, info);
  const count = page.getByLabel('Jumlah lantai', { exact: true });
  expect(await count.locator('option').allTextContents()).toEqual(['1 lantai', '2 lantai', '3 lantai', '4 lantai']);
  await count.selectOption('4');
  await expect(button(page, 'Edit lantai 4')).toBeVisible();
  await button(page, 'Edit lantai 4').click();
  const four = await saved(page);
  expect(four.upperFloors).toHaveLength(3);
  await count.selectOption('1');
  await expect(button(page, 'Edit lantai 4')).toHaveCount(0);
  await expect(button(page, 'Edit lantai 1')).toHaveAttribute('aria-pressed', 'true');
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(four);
  await button(page, 'Ulangi').click();
  await expect(count).toHaveValue('1');
  await button(page, 'Urungkan').click();
  const invalid = { ...four, upperFloors: [...four.upperFloors!, createEmptyShop()] };
  await page.locator('input[type=file]').setInputFiles({ name: 'five.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(page.getByRole('status')).toContainText('File tidak valid');
  expect(await saved(page)).toEqual(four);
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('exterior facade and both roof styles persist with four-storey camera and view-only preview', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors = await open(page, info);
  await button(page, 'Eksterior').click();
  await expect(page.getByTestId('exterior-settings')).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');
  await photo(page, info, 'exterior-tiles-two');
  await button(page, 'Warna fasad 2').click();
  await button(page, 'Warna lis fasad 3').click();
  await page.getByLabel('Kanopi toko', { exact: true }).uncheck();
  await button(page, 'Rooftop').click();
  await button(page, 'Tata rooftop').click();
  await expect(canvas(page)).toHaveAttribute('data-rooftop-only', 'true');
  expect((await saved(page)).rooftop?.items.length).toBeGreaterThan(0);
  await button(page, 'Eksterior').click();
  await button(page, 'Warna lantai rooftop 4').click();
  await expect.poll(async () => (await saved(page)).rooftop?.floorColor).toBe('#74798A');
  await photo(page, info, 'exterior-rooftop-two');
  await page.getByLabel('Jumlah lantai', { exact: true }).selectOption('4');
  await photo(page, info, 'exterior-rooftop-four');
  const design = await saved(page);
  await button(page, 'Lihat tokoku').click();
  await expect(page.getByTestId('exterior-settings')).toHaveCount(0);
  await expect(button(page, 'Tampilkan petak')).toBeDisabled();
  await canvas(page).click({ position: { x: 150, y: 160 } });
  expect(await saved(page)).toEqual(design);
  await button(page, 'Mode malam').click();
  await photo(page, info, 'exterior-four-night');
  await button(page, 'Kembali ngatur').click();
  await button(page, 'Atap genteng').click();
  await expect.poll(async () => (await saved(page)).roof?.style).toBe('tiles');
  await button(page, 'Urungkan').click();
  await expect.poll(async () => (await saved(page)).roof?.style).toBe('rooftop');
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(design);
  await button(page, 'Eksterior').click();
  await expect(button(page, 'Rooftop')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Tata rooftop')).toBeVisible();
  if (info.project.name === 'mobile-chromium') await page.setViewportSize({ width: 320, height: 844 });
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('legacy single-floor design is preserved and utility catalog places on the chosen floor', async ({ page }, info) => {
  test.setTimeout(100_000);
  const legacy = { ...createEmptyShop(), width: 10, depth: 10, name: 'Desain lama' };
  const errors = await open(page, info, legacy);
  await expect.poll(() => saved(page)).toEqual(legacy);
  await page.getByLabel('Jumlah lantai', { exact: true }).selectOption('2');
  await button(page, 'Edit lantai 2').click();
  await button(page, 'Gudang & utilitas').click();
  expect(await page.locator('.catalog-card').count()).toBe(5);
  for (const [kind, x, z] of [['warehouse-rack', 4, 1], ['toilet', 6, 4], ['washbasin', 7, 4], ['shower', 8, 4], ['stairs', 1, 5]] as const) {
    await page.getByTestId(`catalog-${kind}`).click();
    await page.getByLabel('Petak X', { exact: true }).selectOption(String(x));
    await page.getByLabel('Petak Y', { exact: true }).selectOption(String(z));
    await button(page, 'Letakkan di sini').click();
  }
  const design = await saved(page);
  expect(design.upperFloors![0].items.map(item => item.kind)).toEqual(expect.arrayContaining(['warehouse-rack', 'toilet', 'washbasin', 'shower', 'stairs']));
  expect(design.items.some(item => ['toilet', 'washbasin', 'shower'].includes(item.kind))).toBe(false);
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('legacy one-floor exterior reuses the canvas, repaints, and can refresh by reselecting the mode', async ({ page }, info) => {
  test.setTimeout(90_000);
  // Keep a genuinely historical 7x6 layout independent of the evolving example.
  const positions: Record<string, [number, number]> = {
    'welcome-rug': [2, 3], bookshelf: [0, 0], 'ceramic-shelf': [2, 0], 'warm-lamp': [4, 0],
    'fashion-rack': [5, 0], 'display-table': [3, 2], checkout: [0, 4], 'little-seat': [2, 4],
    'green-corner': [0, 2], 'front-plant': [6, 5], 'sidewalk-chalkboard': [0, 6],
  };
  const legacy: ShopDocument = { ...createEmptyShop(), name: 'Sudut Cerita', items: createInitialShop().items
    .filter(item => positions[item.id]).map(item => ({ ...item, x: positions[item.id][0], z: positions[item.id][1] })) };
  delete legacy.wallItems;
  const errors = await open(page, info, legacy);
  const first = await canvas(page).elementHandle();
  const interior = await canvas(page).screenshot();
  await button(page, 'Eksterior').click();
  expect(await first!.evaluate(node => node.isConnected)).toBe(true);
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');
  await expect(canvas(page)).toHaveAttribute('data-item-centers', '[]');
  const exterior = await canvas(page).screenshot({ path: info.outputPath('legacy-exterior.png') });
  expect(exterior.equals(interior)).toBe(false);
  expect(await saved(page)).toEqual(legacy);
  const second = await canvas(page).elementHandle();
  await button(page, 'Eksterior').click();
  expect(await second!.evaluate(node => node.isConnected)).toBe(true);
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');
  await button(page, 'Interior').click();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'false');
  await expect.poll(async () => JSON.parse(await canvas(page).getAttribute('data-item-centers') || '[]').length).toBe(11);
  expect(await saved(page)).toEqual(legacy);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  expect(errors).toEqual([]);
});
