import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createBlankShop, createInitialShop, type ShopDocument } from '../src/model';

const KEY = 'nemu.store-maker.v1';
const NIGHT_KEY = 'nemu.store-maker.night-mode';
const fixture: ShopDocument = {
  version: 2, name: 'Senja di Sudut Cerita', width: 7, depth: 6, wallHeight: 2.9,
  wallColor: '#F4EEDF', floorColor: '#DCC5A9',
  items: [
    { id: 'night-books', kind: 'shelf', x: 0, z: 0, rotation: 0, color: '#B79FC9', stock: 'books' },
    { id: 'night-table', kind: 'table', x: 2, z: 2, rotation: 0, color: '#BC9870', stock: 'ceramics' },
    { id: 'night-floor-lamp', kind: 'lamp', x: 5, z: 1, rotation: 0, color: '#BC9870', stock: 'none' },
    { id: 'night-counter', kind: 'food-display', x: 4, z: 4, rotation: 0, color: '#8D9E83', stock: 'pastries' },
    { id: 'night-plant', kind: 'plant', x: 0, z: 4, rotation: 0, color: '#8D9E83', stock: 'none' },
  ],
  wallItems: [
    { id: 'night-window', kind: 'window', wall: 'left', line: 0, offset: 1.5, height: 1.6, color: '#D6BEA0', text: '', lit: false, windowStyle: 'arched' },
    { id: 'night-sign', kind: 'wall-sign', wall: 'back', line: 0, offset: 1.6, height: 2.35, color: '#B79FC9', text: 'SUDUT CERITA', lit: false },
    { id: 'night-sconce-on', kind: 'wall-lamp', wall: 'back', line: 0, offset: 4.5, height: 2.1, color: '#BC9870', text: '', lit: true },
    { id: 'night-sconce-off', kind: 'wall-lamp', wall: 'left', line: 0, offset: 4.6, height: 1.8, color: '#BC9870', text: '', lit: false },
  ],
};
const canvasFor = (page: Page) => page.getByTestId('scene').locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
const preference = (page: Page) => page.evaluate(key => localStorage.getItem(key), NIGHT_KEY);
const lightCount = async (page: Page, source: 'shop' | 'city') => Number(await canvasFor(page).getAttribute(`data-active-${source}-lights`) ?? -1);

async function openFixture(page: Page, info: TestInfo) {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Every test owns a disposable context; never seed the night preference, so its
  // first-load default and subsequent real persistence are both exercised.
  await page.addInitScript(({ key, doc }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc));
  }, { key: KEY, doc: fixture });
  await page.goto('/');
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(fixture);
  await expectMode(page, false);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  return errors;
}

async function expectMode(page: Page, night: boolean) {
  await expect(button(page, 'Mode malam')).toHaveAttribute('aria-pressed', String(night));
  await expect(canvasFor(page)).toHaveAttribute('data-lighting-mode', night ? 'night' : 'day');
  await expect.poll(async () => Number(await canvasFor(page).getAttribute('data-night-progress') ?? -1)).toBe(night ? 1 : 0);
  // The endpoint is reported during render; allow its completed canvas frame to
  // be presented before pixel sampling or screenshots.
  await canvasFor(page).evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function setNight(page: Page, night: boolean) {
  if (await button(page, 'Mode malam').getAttribute('aria-pressed') !== String(night)) await button(page, 'Mode malam').click();
  await expectMode(page, night);
  await expect.poll(() => preference(page)).toBe(String(night));
}

async function sampleCanvas(page: Page) {
  return canvasFor(page).evaluate(surface => {
    const sample = document.createElement('canvas');
    sample.width = 48; sample.height = 36;
    const context = sample.getContext('2d')!;
    context.drawImage(surface as HTMLCanvasElement, 0, 0, sample.width, sample.height);
    const pixels = Array.from(context.getImageData(0, 0, sample.width, sample.height).data);
    let luminance = 0;
    for (let i = 0; i < pixels.length; i += 4) luminance += pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
    return { pixels, luminance: luminance / (sample.width * sample.height) };
  });
}

async function expectNoOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test('night is a persistent view preference with visible lighting, independent light visibility, and a real PNG export', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors = await openFixture(page, info);
  const day = await sampleCanvas(page);
  await page.screenshot({ path: `artifacts/night-day-${info.project.name}.png`, fullPage: true });
  await setNight(page, true);
  await expect.poll(() => lightCount(page, 'shop')).toBe(2);
  await expect.poll(() => lightCount(page, 'city')).toBeGreaterThan(0);
  const night = await sampleCanvas(page);
  const meanDifference = day.pixels.reduce((sum, value, index) => sum + (index % 4 === 3 ? 0 : Math.abs(value - night.pixels[index])), 0) / (day.pixels.length / 4 * 3);
  expect(meanDifference).toBeGreaterThan(5);
  expect(night.luminance).toBeLessThan(day.luminance - 5);
  await page.screenshot({ path: `artifacts/night-night-${info.project.name}.png`, fullPage: true });
  await canvasFor(page).screenshot({ path: `artifacts/night-canvas-${info.project.name}.png` });
  expect(await saved(page)).toEqual(fixture);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  await expect(button(page, 'Ulangi')).toBeDisabled();

  await setNight(page, false);
  // The existing floor lamp keeps its subtle daytime light; wall lamps and
  // street lights are the sources that switch off at the daylight endpoint.
  await expect.poll(() => lightCount(page, 'shop')).toBe(1);
  await expect(canvasFor(page)).toHaveAttribute('data-active-floor-lights', '1');
  await expect(canvasFor(page)).toHaveAttribute('data-active-wall-lights', '0');
  await expect.poll(() => lightCount(page, 'city')).toBe(0);
  expect(await saved(page)).toEqual(fixture);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  await setNight(page, true);
  await page.reload();
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  await expectMode(page, true);
  expect(await preference(page)).toBe('true');
  expect(await saved(page)).toEqual(fixture);
  await expect(button(page, 'Urungkan')).toBeDisabled();

  await button(page, 'Tampilkan lingkungan kota').click();
  await expect.poll(() => lightCount(page, 'city')).toBe(0);
  await expect.poll(() => lightCount(page, 'shop')).toBe(2);
  await button(page, 'Tampilkan dinding').click();
  await expect.poll(() => lightCount(page, 'shop')).toBe(1);
  await button(page, 'Tampilkan dinding').click();
  await expect.poll(() => lightCount(page, 'shop')).toBe(2);
  await button(page, 'Tampilkan lingkungan kota').click();
  await expect.poll(() => lightCount(page, 'city')).toBeGreaterThan(0);
  expect(await saved(page)).toEqual(fixture);
  await expect(button(page, 'Urungkan')).toBeDisabled();

  await button(page, 'Menu file desain').click();
  const downloadEvent = page.waitForEvent('download');
  await button(page, 'Unduh foto toko').click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('store-maker.png');
  const png = await readFile((await download.path())!);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.length).toBeGreaterThan(10_000);
  expect(png.readUInt32BE(16)).toBeGreaterThan(250);
  expect(png.readUInt32BE(20)).toBeGreaterThan(250);
  await expectMode(page, true);
  expect(await saved(page)).toEqual(fixture);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});

test('night lighting follows lamp edits and object undo while reset and clear apply their distinct time preferences', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors = await openFixture(page, info);
  await setNight(page, true);
  const inventory = page.getByLabel('Pilih barang di toko', { exact: true });
  await inventory.selectOption({ value: 'wall:night-sconce-on' });
  const lampToggle = button(page, 'Nyalakan lampu dinding');
  await expect(lampToggle).toHaveAttribute('aria-pressed', 'true');
  await lampToggle.click();
  await expect.poll(async () => (await saved(page)).wallItems!.find(item => item.id === 'night-sconce-on')!.lit).toBe(false);
  await expect.poll(() => lightCount(page, 'shop')).toBe(1);
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(fixture);
  await expect.poll(() => lightCount(page, 'shop')).toBe(2);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  await button(page, 'Ulangi').click();
  await expect.poll(() => lightCount(page, 'shop')).toBe(1);
  await lampToggle.click();
  await expect.poll(() => saved(page)).toEqual(fixture);
  await expect.poll(() => lightCount(page, 'shop')).toBe(2);

  await inventory.selectOption({ value: 'night-table' });
  await page.getByLabel('Posisi X', { exact: true }).selectOption({ value: '3' });
  await expect.poll(async () => (await saved(page)).items.find(item => item.id === 'night-table')!.x).toBe(3);
  const moved = await saved(page);
  await button(page, 'Ubah ukuran barang').click();
  await page.getByLabel('Panjang barang', { exact: true }).fill('3');
  await page.getByLabel('Panjang barang', { exact: true }).press('Enter');
  await expect.poll(async () => (await saved(page)).items.find(item => item.id === 'night-table')).toMatchObject({ x: 3, width: 3 });
  await expectMode(page, true);
  await expect.poll(() => lightCount(page, 'shop')).toBe(2);
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(moved);
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(fixture);
  await expectMode(page, true);

  await button(page, 'Reset ke toko contoh').click();
  await expect.poll(() => saved(page)).toEqual(createInitialShop());
  await expectMode(page, false);
  await expect.poll(() => preference(page)).toBe('false');
  await setNight(page, true);
  await button(page, 'Kosongkan semua').click();
  await expect.poll(() => saved(page)).toEqual(createBlankShop());
  await expectMode(page, true);
  await expect.poll(() => lightCount(page, 'shop')).toBe(0);
  expect(await preference(page)).toBe('true');
  await page.reload();
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(createBlankShop());
  await expectMode(page, true);
  await expect.poll(() => lightCount(page, 'shop')).toBe(0);
  await expect(button(page, 'Bangun ruangan')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Urungkan')).toBeDisabled();
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});
