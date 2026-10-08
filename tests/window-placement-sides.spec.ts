import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createEmptyShop, createInitialShop, type ShopDocument, type WallItem, type WallSide } from '../src/model';

test.use({ reducedMotion: 'reduce' });
const KEY = 'nemu.store-maker.v1';
const canvas = (page: Page) => page.locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const toolbar = (page: Page) => page.locator('.wall-mount-toolbar');
const sideLabel: Record<WallSide, string> = { front: 'Depan', right: 'Kanan', back: 'Belakang', left: 'Kiri' };
const fixture = (): ShopDocument => ({ ...createEmptyShop(), name: 'Jendela Empat Sisi', width: 8, depth: 7 });
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
const data = async <T = unknown>(page: Page, key: string): Promise<T> => JSON.parse(await canvas(page).getAttribute(`data-${key}`) || 'null');

async function ready(page: Page) {
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.shop-canvas')).toHaveAttribute('aria-busy', 'false');
}

async function open(page: Page, info: TestInfo) {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1050 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ key, doc }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc));
  }, { key: KEY, doc: fixture() });
  await page.goto('/');
  await ready(page);
  await expect.poll(() => saved(page)).toEqual(fixture());
  return errors;
}

async function chooseSide(page: Page, side: WallSide) {
  const choice = toolbar(page).getByRole('button', { name: `Pasang di sisi ${sideLabel[side]}`, exact: true });
  await choice.click();
  await expect(choice).toHaveAttribute('aria-pressed', 'true');
  const line = side === 'front' ? 7 : side === 'right' ? 8 : 0;
  await expect.poll(() => data(page, 'wall-placement-mount')).toEqual({ wall: side, line });
  await expect.poll(() => data(page, 'wall-mount-guide')).toMatchObject({ wall: side, line });
}

async function wallPoint(page: Page, wall: WallSide, offset = 2.5, height = 1.5) {
  await canvas(page).scrollIntoViewIfNeeded();
  const query = { wall, offset, height };
  await expect.poll(() => canvas(page).evaluate((node, query) =>
    JSON.parse((node as HTMLElement).dataset.wallTargets || '[]').some((point: Record<string, unknown>) =>
      Object.entries(query).every(([key, value]) => point[key] === value)), query)).toBe(true);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return canvas(page).evaluate((node, query) => {
    const point = JSON.parse((node as HTMLElement).dataset.wallTargets!).find((point: Record<string, unknown>) =>
      Object.entries(query).every(([key, value]) => point[key] === value));
    const bounds = node.getBoundingClientRect();
    return { x: bounds.left + point.canvasX, y: bounds.top + point.canvasY };
  }, query);
}

async function clickWall(page: Page, info: TestInfo, side: WallSide, offset = 2.5) {
  const point = await wallPoint(page, side, offset);
  if (info.project.name === 'mobile-chromium') await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

async function previewAtOtherWall(page: Page, info: TestInfo, side: WallSide) {
  const point = await wallPoint(page, side, 4.5, 2.5);
  if (info.project.name === 'mobile-chromium') {
    const session = await page.context().newCDPSession(page);
    try {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x: point.x - 2, y: point.y - 2 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, ...point }] });
      // Cancel prevents committing this deliberately invalid preview.
      await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    } finally { await session.detach(); }
  } else await page.mouse.move(point.x, point.y);
}

test('front and right side buttons place new windows directly on the canvas by mouse or touch', async ({ page }, info) => {
  test.setTimeout(100_000);
  const errors = await open(page, info);
  await button(page, 'Dinding').click();
  for (const [index, side] of (['front', 'right'] as const).entries()) {
    await page.getByTestId('catalog-window').click();
    await chooseSide(page, side);
    await clickWall(page, info, side);
    await expect.poll(async () => (await saved(page)).wallItems).toHaveLength(index + 1);
    expect((await saved(page)).wallItems![index]).toMatchObject({ wall: side, line: side === 'front' ? 7 : 8, offset: 2.5, height: 1.5 });
    await expect.poll(() => data(page, 'wall-placement-mount')).toBeNull();
  }
  const design = await saved(page);
  await page.reload();
  await ready(page);
  expect(await saved(page)).toEqual(design);
  expect(errors).toEqual([]);
});

test('explicit front and right choices stay locked across hover and support manual placement and moving', async ({ page }, info) => {
  test.setTimeout(100_000);
  const errors = await open(page, info);
  await button(page, 'Dinding').click();
  await page.getByTestId('catalog-window').click();
  await chooseSide(page, 'front');
  await previewAtOtherWall(page, info, 'back');
  await expect.poll(() => data<WallItem>(page, 'wall-placement')).toMatchObject({ wall: 'front', line: 7 });
  await expect.poll(() => data(page, 'wall-placement-mount')).toEqual({ wall: 'front', line: 7 });
  await expect(canvas(page)).toHaveAttribute('data-wall-placement-valid', 'false');
  expect((await saved(page)).wallItems).toEqual([]);
  await chooseSide(page, 'front');
  await page.getByLabel('Posisi aksesori di dinding', { exact: true }).selectOption('1.5');
  await page.getByLabel('Ketinggian aksesori', { exact: true }).selectOption('1.5');
  await button(page, 'Pasang di sini').click();
  await expect.poll(async () => (await saved(page)).wallItems).toHaveLength(1);
  const original = (await saved(page)).wallItems![0];
  expect(original).toMatchObject({ wall: 'front', offset: 1.5, height: 1.5 });
  await button(page, 'Pindahkan aksesori').click();
  await chooseSide(page, 'right');
  await previewAtOtherWall(page, info, 'left');
  await expect.poll(() => data<WallItem>(page, 'wall-placement')).toMatchObject({ wall: 'right', line: 8 });
  await expect.poll(() => data(page, 'wall-placement-mount')).toEqual({ wall: 'right', line: 8 });
  expect((await saved(page)).wallItems).toEqual([original]);
  await chooseSide(page, 'right');
  await page.getByLabel('Posisi aksesori di dinding', { exact: true }).selectOption('3.5');
  await page.getByLabel('Ketinggian aksesori', { exact: true }).selectOption('1.5');
  await button(page, 'Pasang di sini').click();
  await expect.poll(async () => (await saved(page)).wallItems).toEqual([expect.objectContaining({ id: original.id, wall: 'right', line: 8, offset: 3.5, height: 1.5 })]);
  await button(page, 'Urungkan').click();
  await expect.poll(async () => (await saved(page)).wallItems).toEqual([original]);
  await page.getByTestId('catalog-window').click();
  await chooseSide(page, 'right');
  await button(page, 'Batalkan penempatan aksesori').click();
  await expect.poll(() => data(page, 'wall-placement-mount')).toBeNull();
  await expect.poll(() => data(page, 'wall-mount-guide')).toBeNull();
  expect(errors).toEqual([]);
});

test('automatic placement still reaches back and left walls, and all side controls fit a 320px viewport', async ({ page }, info) => {
  test.setTimeout(100_000);
  const errors = await open(page, info);
  await button(page, 'Dinding').click();
  await page.getByTestId('catalog-window').click();
  await chooseSide(page, 'front');
  await toolbar(page).getByRole('button', { name: 'Pilih sisi otomatis', exact: true }).click();
  await expect.poll(() => data(page, 'wall-placement-mount')).toBeNull();
  await clickWall(page, info, 'back');
  await expect.poll(async () => (await saved(page)).wallItems?.[0]).toMatchObject({ wall: 'back', offset: 2.5, height: 1.5 });
  await page.getByTestId('catalog-window').click();
  await clickWall(page, info, 'left', 3.5);
  await expect.poll(async () => (await saved(page)).wallItems?.[1]).toMatchObject({ wall: 'left', offset: 3.5, height: 1.5 });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByTestId('catalog-window').click();
  for (const label of Object.values(sideLabel)) {
    const control = toolbar(page).getByRole('button', { name: `Pasang di sisi ${label}`, exact: true });
    await expect(control).toBeVisible();
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await toolbar(page).screenshot({ path: info.outputPath('window-side-controls-320px.png') });
  expect(errors).toEqual([]);
});

type RenderedWindow = { id: string; style: string; position: number[]; quaternion: number[]; scale: number[] };
test('reset adds front and right windows on both example floors with matching interior and exterior geometry', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors = await open(page, info);
  await button(page, 'Menu file desain').click();
  await button(page, 'Gunakan toko contoh').click();
  const example = createInitialShop();
  await expect.poll(() => saved(page)).toEqual(example);
  await ready(page);
  const expected: RenderedWindow[] = [];
  for (const [index, level] of [example, example.upperFloors![0]].entries()) {
    for (const wall of ['front', 'right']) expect(level.wallItems?.some(item => item.kind === 'window' && item.wall === wall)).toBe(true);
    await button(page, `Edit lantai ${index + 1}`).click();
    await expect(canvas(page)).toHaveAttribute('data-active-level', String(index));
    await ready(page);
    await expect.poll(async () => (await data<RenderedWindow[]>(page, 'rendered-windows')).map(window => window.id).sort())
      .toEqual(level.wallItems!.filter(item => item.kind === 'window').map(item => item.id).sort());
    const elevation = await data<number>(page, 'active-floor-y');
    for (const window of await data<RenderedWindow[]>(page, 'rendered-windows')) {
      expected.push({ ...window, position: [window.position[0], window.position[1] + elevation, window.position[2]] });
    }
  }
  await button(page, 'Eksterior').click();
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');
  await ready(page);
  const exterior = await data<RenderedWindow[]>(page, 'rendered-windows');
  expect(exterior.map(window => window.id).sort()).toEqual(expected.map(window => window.id).sort());
  for (const window of expected) {
    const actual = exterior.find(candidate => candidate.id === window.id)!;
    expect(actual.style).toBe(window.style);
    for (const property of ['position', 'quaternion', 'scale'] as const) {
      actual[property].forEach((value, index) => expect(value).toBeCloseTo(window[property][index], 6));
    }
  }
  await canvas(page).screenshot({ path: info.outputPath('example-front-right-windows.png') });
  await page.reload();
  await ready(page);
  expect(await saved(page)).toEqual(example);
  expect(errors).toEqual([]);
});
