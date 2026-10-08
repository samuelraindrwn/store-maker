import { expect, test, type Page } from '@playwright/test';
import { createInitialShop, type ShopDocument } from '../src/model';

const KEY = 'nemu.store-maker.v1';
const SIGN_ID = 'builtin-wall-sign';
type TextPaint = { text: string; width: number; height: number };
type InstrumentedWindow = Window & { __shopNamePaints: TextPaint[] };
const canvasFor = (page: Page) => page.getByTestId('scene').locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
const signText = async (page: Page, id = SIGN_ID) => (await saved(page)).wallItems!.find(item => item.id === id)!.text;
const clearPaints = (page: Page) => page.evaluate(() => { (window as unknown as InstrumentedWindow).__shopNamePaints.length = 0; });

// Its texture aspect differs from the entrance's fixed 4:1 sign, so the test
// proves the wall accessory is painted, rather than merely the entrance text.
const SIGN_WIDTH = 2.8, SIGN_HEIGHT = 0.6;
const WALL_TEXTURE_HEIGHT = Math.round(1024 / ((SIGN_WIDTH - 0.16) / (SIGN_HEIGHT - 0.18)));
async function expectWallPaint(page: Page, text: string, textureHeight = WALL_TEXTURE_HEIGHT) {
  await expect.poll(() => page.evaluate(({ text, textureHeight }) =>
    (window as unknown as InstrumentedWindow).__shopNamePaints.some(paint => paint.text === text && paint.width === 1024 && paint.height === textureHeight),
  { text, textureHeight })).toBe(true);
}

test('shop names repair legacy signs, redraw their textures live, and preserve manually written messages', async ({ page }, info) => {
  test.setTimeout(120_000);
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Observe real Canvas2D drawing without replacing the renderer or writing to
  // localStorage. Playwright's normal context keeps the real profile isolated.
  await page.addInitScript(() => {
    const paints: TextPaint[] = [];
    (window as unknown as InstrumentedWindow).__shopNamePaints = paints;
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof original>) {
      paints.push({ text: String(args[0]), width: this.canvas.width, height: this.canvas.height });
      return Reflect.apply(original, this, args);
    };
  });
  await page.goto('/');
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  const example = createInitialShop();
  const legacy: ShopDocument = {
    ...example, name: 'Toko Cesco',
    wallItems: example.wallItems!.map(item => item.id === SIGN_ID ? { ...item, text: 'Sudut Nemu', width: SIGN_WIDTH, sizeHeight: SIGN_HEIGHT } : item),
  };
  const repaired = { ...legacy, wallItems: legacy.wallItems!.map(item => item.id === SIGN_ID ? { ...item, text: 'Toko Cesco' } : item) };
  await clearPaints(page);
  await page.getByLabel('Buka file desain', { exact: true }).setInputFiles({
    name: 'toko-cesco-lama.store-maker.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)),
  });
  const name = page.getByLabel('Nama toko', { exact: true });
  await expect(name).toHaveValue('Toko Cesco');
  await expect.poll(() => saved(page)).toEqual(repaired);
  await expectWallPaint(page, 'Toko Cesco');
  expect(await page.evaluate(() => (window as unknown as InstrumentedWindow).__shopNamePaints.some(paint => paint.text === 'Sudut Nemu'))).toBe(false);

  await clearPaints(page);
  await name.fill('Cesco & Co.');
  // No blur or reload: typing must update the persisted sign and its texture.
  await expect.poll(() => signText(page)).toBe('Cesco & Co.');
  await expectWallPaint(page, 'Cesco & Co.');
  const renamed = await saved(page);
  expect(renamed).toEqual({ ...repaired, name: 'Cesco & Co.', wallItems: repaired.wallItems.map(item => item.id === SIGN_ID ? { ...item, text: 'Cesco & Co.' } : item) });
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption({ value: `wall:${SIGN_ID}` });
  await expect(page.getByLabel('Tulisan papan', { exact: true })).toHaveValue('Cesco & Co.');
  await page.screenshot({ path: `artifacts/shop-name-${info.project.name}.png`, fullPage: true });

  await clearPaints(page);
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(repaired);
  await expect(name).toHaveValue('Toko Cesco');
  await expectWallPaint(page, 'Toko Cesco');
  await button(page, 'Ulangi').click();
  await expect.poll(() => saved(page)).toEqual(renamed);
  await page.reload();
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(renamed);
  await expectWallPaint(page, 'Cesco & Co.');
  await expect(button(page, 'Urungkan')).toBeDisabled();

  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption({ value: `wall:${SIGN_ID}` });
  await page.getByLabel('Tulisan papan', { exact: true }).fill('Temukan cerita baru');
  await expect.poll(() => signText(page)).toBe('Temukan cerita baru');
  await expectWallPaint(page, 'Temukan cerita baru');
  await name.fill('Cesco Setelah Custom');
  await expect.poll(async () => (await saved(page)).name).toBe('Cesco Setelah Custom');
  expect(await signText(page)).toBe('Temukan cerita baru');

  // A newly added name sign starts with the current shop name; later renaming
  // follows that sign while leaving the manually written original independent.
  await page.getByTestId('catalog-wall-sign').click();
  await expect(button(page, 'Pasang di sini')).toBeEnabled();
  await button(page, 'Pasang di sini').click();
  await expect.poll(async () => (await saved(page)).wallItems!.filter(item => item.kind === 'wall-sign')).toHaveLength(2);
  const newSign = (await saved(page)).wallItems!.find(item => item.kind === 'wall-sign' && item.id !== SIGN_ID)!;
  expect(newSign.text).toBe('Cesco Setelah Custom');
  await name.fill('Cesco Terbaru');
  await expect.poll(() => signText(page, newSign.id)).toBe('Cesco Terbaru');
  expect(await signText(page)).toBe('Temukan cerita baru');
  const final = await saved(page);
  await page.reload();
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(final);
  await expectWallPaint(page, 'Temukan cerita baru');
  const defaultSignTextureHeight = Math.round(1024 / ((1.6 - 0.16) / (0.55 - 0.18)));
  await expectWallPaint(page, 'Cesco Terbaru', defaultSignTextureHeight);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
