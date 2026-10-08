import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createEmptyShop, createInitialShop, setRoof, type ShopDocument } from '../src/model';

test.use({ reducedMotion: 'reduce' });
const KEY = 'nemu.store-maker.v1';
const canvas = (page: Page) => page.getByTestId('scene').locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
const cutaway = { back: true, left: true, front: false, right: false };
const full = { back: true, left: true, front: true, right: true };
const hidden = { back: false, left: false, front: false, right: false };
const walls = (page: Page) => canvas(page).evaluate(node => JSON.parse((node as HTMLElement).dataset.wallVisibility!));

async function open(page: Page, info: TestInfo, fixture?: ShopDocument) {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  if (fixture) await page.addInitScript(({ key, doc }) => localStorage.setItem(key, JSON.stringify(doc)), { key: KEY, doc: fixture });
  await page.goto('/');
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.shop-canvas')).toHaveAttribute('aria-busy', 'false');
  return errors;
}

test('all-wall and hide-wall controls preserve the design, camera and renderer', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors = await open(page, info);
  const design = await saved(page), originalCanvas = await canvas(page).elementHandle();
  const target = await canvas(page).getAttribute('data-camera-target');
  await expect.poll(() => walls(page)).toEqual(cutaway);
  const all = button(page, 'Tampilkan seluruh tembok'), visible = button(page, 'Tampilkan dinding');
  await all.click();
  await expect.poll(() => walls(page)).toEqual(full);
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas(page)).toHaveAttribute('data-show-all-walls', 'true');
  await canvas(page).screenshot({ path: info.outputPath('all-four-walls.png') });
  await visible.click();
  await expect.poll(() => walls(page)).toEqual(hidden);
  await expect(all).toHaveAttribute('aria-pressed', 'false');
  await visible.click();
  await expect.poll(() => walls(page)).toEqual(full);
  await all.click();
  await expect.poll(() => walls(page)).toEqual(cutaway);
  await visible.click();
  await expect.poll(() => walls(page)).toEqual(hidden);
  await all.click();
  await expect.poll(() => walls(page)).toEqual(full);
  await expect(visible).toHaveAttribute('aria-pressed', 'true');
  expect(await saved(page)).toEqual(design);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  await expect(canvas(page)).toHaveAttribute('data-camera-target', target!);
  expect(await canvas(page).evaluate((node, original) => node === original, originalCanvas)).toBe(true);
  expect(errors).toEqual([]);
});

test('all walls remain enabled after rebuilding a room and switching floors or views', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors = await open(page, info, setRoof(createInitialShop(), { style: 'rooftop' }));
  await button(page, 'Tampilkan seluruh tembok').click();
  await button(page, 'Bangun ruangan').click();
  await button(page, 'Warna dinding 2').click();
  await expect.poll(async () => (await saved(page)).wallColor).toBe('#d6dcca');
  await expect.poll(() => walls(page)).toEqual(full);
  await button(page, 'Edit lantai 2').click();
  await expect(canvas(page)).toHaveAttribute('data-active-level', '1');
  await expect.poll(() => walls(page)).toEqual(full);
  const design = await saved(page);
  await button(page, 'Eksterior').click();
  await expect(button(page, 'Tampilkan seluruh tembok')).toBeDisabled();
  await expect(button(page, 'Tampilkan dinding')).toBeDisabled();
  await expect(page.getByTestId('scene-toolbar')).toBeVisible();
  await expect(button(page, 'Atur barang')).toHaveAttribute('aria-pressed', 'true');
  await button(page, 'Interior').click();
  await expect.poll(() => walls(page)).toEqual(full);
  expect(await saved(page)).toEqual(design);
  await button(page, 'Edit rooftop').click();
  await expect(canvas(page)).toHaveAttribute('data-rooftop-only', 'true');
  await expect(button(page, 'Tampilkan seluruh tembok')).toBeDisabled();
  await expect(button(page, 'Tampilkan dinding')).toBeDisabled();
  await button(page, 'Edit lantai 1').click();
  await expect.poll(() => walls(page)).toEqual(full);
  expect(errors).toEqual([]);
});

test('sidebar editor controls leave canvas height unchanged and wrap safely on narrow screens', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors = await open(page, info);
  if (info.project.name === 'mobile-chromium') await page.setViewportSize({ width: 320, height: 844 });
  const scene = page.getByTestId('scene'), toolbar = page.getByTestId('scene-toolbar');
  const original = (await scene.boundingBox())!;
  const check = async () => {
    expect(await toolbar.evaluate(node => node.parentElement?.classList.contains('library-panel'))).toBe(true);
    expect(await toolbar.evaluate(node => node.closest('[data-testid="scene"]') === null)).toBe(true);
    const rect = (await scene.boundingBox())!, library = (await page.locator('.library-panel').boundingBox())!;
    expect(rect.height).toBe(original.height);
    expect(rect.width).toBe(original.width);
    if (info.project.name === 'chromium') {
      expect(Math.abs(rect.y - library.y)).toBeLessThan(1);
      expect(Math.abs(rect.height - library.height)).toBeLessThan(1);
      expect(rect.height).toBeGreaterThanOrEqual(650);
      const work = (await page.locator('.scene-workspace').boundingBox())!;
      expect(Math.abs(rect.y - work.y)).toBeLessThan(1);
      expect(Math.abs(rect.height - work.height)).toBeLessThan(1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    const groups = await page.locator('.camera-group, .view-controls').evaluateAll(nodes => nodes.map(node => {
      const { left, top, right, bottom } = node.getBoundingClientRect(); return { left, top, right, bottom };
    }));
    for (const group of groups) {
      expect(group.left).toBeGreaterThanOrEqual(rect.x);
      expect(group.right).toBeLessThanOrEqual(rect.x + rect.width);
      expect(group.top).toBeGreaterThanOrEqual(rect.y);
      expect(group.bottom).toBeLessThanOrEqual(rect.y + rect.height);
    }
    const [a, b] = groups;
    expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
  };
  await check();
  await button(page, 'Bangun ruangan').click();
  await expect(button(page, 'Tembok dalam')).toBeVisible();
  await check();
  await button(page, 'Atur barang').click();
  await page.getByTestId('catalog-plant').click();
  await expect(toolbar.locator('.placement-banner')).toBeVisible();
  await check();
  await button(page, 'Batalkan penempatan').click();
  await check();
  await page.screenshot({ path: info.outputPath('sidebar-editor-controls.png'), fullPage: info.project.name !== 'chromium' });
  await scene.screenshot({ path: info.outputPath('canvas-controls.png') });
  expect(errors).toEqual([]);
});

test('cancelled floor painting restores all four visible walls without saving', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors = await open(page, info, { ...createEmptyShop(), items: [], wallItems: [] });
  await button(page, 'Tampilkan seluruh tembok').click();
  await button(page, 'Bangun ruangan').click();
  await button(page, 'Kamera dari atas').click();
  await canvas(page).scrollIntoViewIfNeeded();
  await expect(canvas(page)).toHaveAttribute('data-paint-cells', /canvasX/);
  const before = await saved(page);
  const point = await canvas(page).evaluate(node => {
    const cell = JSON.parse((node as HTMLElement).dataset.paintCells!).find((cell: { x: number; z: number }) => cell.x === 3 && cell.z === 3);
    const rect = node.getBoundingClientRect(); return { x: rect.left + cell.canvasX, y: rect.top + cell.canvasY };
  });
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  const session = touch ? await page.context().newCDPSession(page) : null;
  if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, ...point }] });
  else { await page.mouse.move(point.x, point.y); await page.mouse.down(); }
  try {
    await expect(canvas(page)).toHaveAttribute('data-interaction', 'paint');
    expect(await saved(page)).toEqual(before);
  } finally {
    if (session) { await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await session.detach(); }
    else { await page.keyboard.press('Escape'); await page.mouse.up(); }
  }
  await expect(canvas(page)).toHaveAttribute('data-interaction', 'idle');
  await expect.poll(() => walls(page)).toEqual(full);
  expect(await saved(page)).toEqual(before);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  expect(errors).toEqual([]);
});
