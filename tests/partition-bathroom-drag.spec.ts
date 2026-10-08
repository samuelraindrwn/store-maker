import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { canPlaceWallItem, createInitialShop, createWallItem, getWallHeight, type ShopDocument, type WallItem } from '../src/model';

test.use({ reducedMotion: 'reduce' });
const KEY = 'nemu.store-maker.v1';
const ID = 'bathroom-drag-painting';
const canvas = (page: Page) => page.locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const metadata = async <T,>(page: Page, key: string): Promise<T> => JSON.parse(await canvas(page).getAttribute(`data-${key}`) || 'null');
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
const painting = async (page: Page) => (await saved(page)).wallItems!.find(item => item.id === ID)!;
type Projected = { id?: string; partitionId?: string; wall?: string; line?: number; offset?: number; height?: number; canvasX: number; canvasY: number };

async function point(page: Page, key: 'wall-item-centers' | 'wall-targets', query: Partial<Projected>) {
  await canvas(page).evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const matches = (entry: Projected) => Object.entries(query).every(([name, value]) => entry[name as keyof Projected] === value);
  await expect.poll(async () => (await metadata<Projected[]>(page, key)).some(matches)).toBe(true);
  const entry = (await metadata<Projected[]>(page, key)).find(matches)!;
  const rect = (await canvas(page).boundingBox())!;
  return { x: rect.x + entry.canvasX, y: rect.y + entry.canvasY };
}

async function dragToBathroom(page: Page, info: TestInfo, target: { offset: number; height: number; grab?: number; capCenter?: boolean }, valid: boolean, screenshot?: string) {
  const before = await saved(page);
  const center = await point(page, 'wall-item-centers', { id: ID });
  const sourceA = await point(page, 'wall-targets', { wall: 'back', line: 0, offset: 8.5, height: 1.5 });
  const sourceB = await point(page, 'wall-targets', { wall: 'back', line: 0, offset: 9.5, height: 1.5 });
  // Grab the actual mounted object off center, as a person does; a narrow WC
  // shoulder must not require a pixel-perfect initial press on its center.
  const from = { x: center.x + (sourceB.x - sourceA.x) * (target.grab ?? 0), y: center.y + (sourceB.y - sourceA.y) * (target.grab ?? 0) };
  const mount = { partitionId: 'wc-front-wall', wall: 'back', line: 3, offset: target.offset };
  let low = await point(page, 'wall-targets', { ...mount, height: 1.5 });
  let high = await point(page, 'wall-targets', { ...mount, height: 2.5 });
  if (target.capCenter) {
    const oppositeLow = await point(page, 'wall-targets', { ...mount, wall: 'front', height: 1.5 });
    const oppositeHigh = await point(page, 'wall-targets', { ...mount, wall: 'front', height: 2.5 });
    low = { x: (low.x + oppositeLow.x) / 2, y: (low.y + oppositeLow.y) / 2 };
    high = { x: (high.x + oppositeHigh.x) / 2, y: (high.y + oppositeHigh.y) / 2 };
  }
  // Project the visible coping too: it sits just above the mathematical wall
  // face, and must never send the dragged painting to the far perimeter wall.
  const to = { x: low.x + (high.x - low.x) * (target.height - 1.5), y: low.y + (high.y - low.y) * (target.height - 1.5) };
  const touch = info.project.name === 'mobile-chromium' ? await page.context().newCDPSession(page) : null;
  if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, ...from }] });
  else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  try {
    for (let step = 1; step <= 8; step++) {
      const at = { x: from.x + (to.x - from.x) * step / 8, y: from.y + (to.y - from.y) * step / 8 };
      if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, ...at }] });
      else await page.mouse.move(at.x, at.y);
    }
    await expect(canvas(page)).toHaveAttribute('data-interaction', 'wall-item');
    await expect.poll(() => metadata<WallItem & { valid: boolean }>(page, 'preview-wall-item')).toMatchObject({ id: ID, partitionId: 'wc-front-wall', wall: 'back', line: 3, valid });
    expect(await saved(page)).toEqual(before);
    if (screenshot) {
      await expect(page.locator('.shop-canvas')).toHaveAttribute('aria-busy', 'false');
      await page.screenshot({ path: `artifacts/${screenshot}-${info.project.name}.png`, clip: (await canvas(page).boundingBox())!, timeout: 30_000 });
    }
  } finally {
    if (touch) { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach(); }
    else await page.mouse.up();
  }
  await expect(canvas(page)).toHaveAttribute('data-interaction', 'idle');
  if (valid) await expect.poll(() => painting(page)).toMatchObject({ partitionId: 'wc-front-wall', wall: 'back', line: 3, offset: target.offset, height: target.height });
  else {
    await expect.poll(() => saved(page)).toEqual(before);
    await expect(page.getByRole('status')).toContainText('Belum muat di sini. Geser ke bagian tembok yang kosong atau kecilkan ukurannya.');
  }
}

test('direct dragging uses the default bathroom wall, fits narrow shoulders, and rejects its cap without jumping behind it', async ({ page }, info) => {
  test.setTimeout(140_000);
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const initial = createInitialShop();
  const original: WallItem = { ...createWallItem('painting'), id: ID, wall: 'back', line: 0, offset: 8.5, height: 2 };
  expect(canPlaceWallItem(initial, original)).toBe(true);
  initial.wallItems!.push(original);
  await page.addInitScript(({ key, doc }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc));
    localStorage.setItem('nemu.store-maker.time-mode', 'day');
  }, { key: KEY, doc: initial });
  await page.goto('/');
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption(`wall:${ID}`);

  await dragToBathroom(page, info, { offset: 7.5, height: 1.5, grab: -0.2 }, true, 'bathroom-shoulder-drag');
  const mounted = await saved(page);
  expect(canPlaceWallItem(mounted, await painting(page), ID)).toBe(true);
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(initial);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  await expect(button(page, 'Ulangi')).toBeEnabled();

  await dragToBathroom(page, info, { offset: 9.5, height: 2.8 }, false, 'bathroom-cap-rejected');
  await dragToBathroom(page, info, { offset: 9.5, height: getWallHeight(initial) + 0.055, capCenter: true }, false, 'bathroom-cap-center-rejected');
  await dragToBathroom(page, info, { offset: 8.5, height: 2.5 }, false);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  await expect(button(page, 'Ulangi')).toBeEnabled();
  await button(page, 'Ulangi').click();
  await expect.poll(() => saved(page)).toEqual(mounted);
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(initial);

  // The area above the door is usable once the object actually fits there.
  await button(page, 'Ubah ukuran aksesori').click();
  await page.getByLabel('Tinggi aksesori', { exact: true }).fill('0.4');
  await page.getByLabel('Tinggi aksesori', { exact: true }).press('Enter');
  await page.getByLabel('Panjang aksesori', { exact: true }).fill('0.6');
  await page.getByLabel('Panjang aksesori', { exact: true }).press('Enter');
  await expect.poll(() => painting(page)).toMatchObject({ width: 0.6, sizeHeight: 0.4 });
  await button(page, 'Ubah ukuran aksesori').click();
  await dragToBathroom(page, info, { offset: 8.5, height: 2.5 }, true, 'bathroom-above-door');
  const final = await saved(page);
  expect(canPlaceWallItem(final, await painting(page), ID)).toBe(true);
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  expect(await saved(page)).toEqual(final);
  expect(errors).toEqual([]);
});
