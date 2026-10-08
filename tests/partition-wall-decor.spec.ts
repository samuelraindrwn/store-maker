import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createEmptyShop, getWallItemSize, type ShopDocument, type WallItem, type WallSide } from '../src/model';

test.use({ reducedMotion: 'reduce' });
const KEY = 'nemu.store-maker.v1';
const PARTITION = 'gallery-wall';
const base: ShopDocument = { ...createEmptyShop(), name: 'Galeri di Dalam', width: 8, depth: 7 };
const horizontal: ShopDocument = {
  ...base, partitions: [{ id: PARTITION, axis: 'x', line: 3, start: 1, end: 7, color: '#EFE5D6' }],
  interiorDoors: [{ id: 'gallery-door', wallId: PARTITION, offset: 5.5, width: 1, color: '#B498C4', open: false }],
};
type Projected = { id?: string; edge?: string; partitionId?: string; wall?: WallSide; line?: number; offset?: number; height?: number; canvasX: number; canvasY: number; worldX?: number; worldZ?: number };
const canvas = (page: Page) => page.locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
const metadata = async <T,>(page: Page, key: string): Promise<T> => JSON.parse(await canvas(page).getAttribute(`data-${key}`) || 'null');

async function open(page: Page, info: TestInfo, doc: ShopDocument) {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ key, doc }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc));
    localStorage.setItem('nemu.store-maker.time-mode', 'day');
  }, { key: KEY, doc });
  await page.goto('/');
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(doc);
  return errors;
}

async function point(page: Page, key: 'wall-item-centers' | 'wall-targets' | 'resize-handles', query: Partial<Projected>) {
  await canvas(page).evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const matches = (entry: Projected) => Object.entries(query).every(([name, value]) => entry[name as keyof Projected] === value);
  await expect.poll(async () => (await metadata<Projected[]>(page, key)).some(matches)).toBe(true);
  const entry = (await metadata<Projected[]>(page, key)).find(matches)!;
  const rect = (await canvas(page).boundingBox())!;
  return { x: rect.x + entry.canvasX, y: rect.y + entry.canvasY, entry };
}

async function tap(page: Page, info: TestInfo, at: { x: number; y: number }) {
  if (info.project.name === 'mobile-chromium') await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
}

async function dragPainting(page: Page, info: TestInfo, item: WallItem, target: { offset: number; height: number }, valid: boolean) {
  const from = await point(page, 'wall-item-centers', { id: item.id });
  const plane = { partitionId: item.partitionId, wall: item.wall, line: item.line };
  const a = await point(page, 'wall-targets', { ...plane, offset: 2.5, height: 1.5 });
  const offsetUnit = await point(page, 'wall-targets', { ...plane, offset: 3.5, height: 1.5 });
  const heightUnit = await point(page, 'wall-targets', { ...plane, offset: 2.5, height: 2.5 });
  const dx = (offsetUnit.x - a.x) * (target.offset - item.offset) + (heightUnit.x - a.x) * (target.height - item.height);
  const dy = (offsetUnit.y - a.y) * (target.offset - item.offset) + (heightUnit.y - a.y) * (target.height - item.height);
  const before = await saved(page);
  const touch = info.project.name === 'mobile-chromium' ? await page.context().newCDPSession(page) : null;
  if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x: from.x, y: from.y }] });
  else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  try {
    for (let step = 1; step <= 8; step++) {
      const position = { x: from.x + dx * step / 8, y: from.y + dy * step / 8 };
      if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, ...position }] });
      else await page.mouse.move(position.x, position.y);
    }
    await expect(canvas(page)).toHaveAttribute('data-interaction', 'wall-item');
    await expect.poll(() => metadata<WallItem & { valid: boolean }>(page, 'preview-wall-item')).toMatchObject({ id: item.id, partitionId: PARTITION, wall: item.wall, valid });
    await expect.poll(async () => (await metadata<WallItem>(page, 'preview-wall-item')).offset).toBeCloseTo(target.offset, 2);
    await expect.poll(async () => (await metadata<WallItem>(page, 'preview-wall-item')).height).toBeCloseTo(target.height, 2);
    expect(await saved(page)).toEqual(before);
  } finally {
    if (touch) { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach(); }
    else await page.mouse.up();
  }
  if (valid) await expect.poll(async () => (await saved(page)).wallItems?.find(candidate => candidate.id === item.id)).toMatchObject(target);
  else await expect.poll(() => saved(page)).toEqual(before);
}

async function selectFace(page: Page, wall: WallSide) {
  const sides = { back: 'belakang', front: 'depan', left: 'kiri', right: 'kanan' };
  await page.getByLabel('Dinding aksesori', { exact: true }).selectOption({ label: `Tembok dalam 1 · Sisi ${sides[wall]}` });
  await expect.poll(async () => (await saved(page)).wallItems?.[0]).toMatchObject({ partitionId: PARTITION, wall });
}

async function widenPainting(page: Page, info: TestInfo, item: WallItem) {
  const before = await saved(page), width = getWallItemSize(item).width;
  await button(page, 'Ubah ukuran aksesori').click();
  await expect(canvas(page)).toHaveAttribute('data-resize-mode', 'true');
  const start = await point(page, 'resize-handles', { edge: 'max-x' });
  const plane = { partitionId: PARTITION, wall: item.wall, line: item.line, height: 1.5 };
  const a = await point(page, 'wall-targets', { ...plane, offset: 2.5 });
  const b = await point(page, 'wall-targets', { ...plane, offset: 3.5 });
  const touch = info.project.name === 'mobile-chromium' ? await page.context().newCDPSession(page) : null;
  if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x: start.x, y: start.y }] });
  else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
  try {
    for (let step = 1; step <= 8; step++) {
      const position = { x: start.x + (b.x - a.x) * 0.5 * step / 8, y: start.y + (b.y - a.y) * 0.5 * step / 8 };
      if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, ...position }] });
      else await page.mouse.move(position.x, position.y);
    }
    await expect(canvas(page)).toHaveAttribute('data-interaction', 'object-resize');
    await expect.poll(() => metadata<WallItem & { valid: boolean }>(page, 'preview-wall-item')).toMatchObject({ id: item.id, partitionId: PARTITION, valid: true });
    await expect.poll(async () => (await metadata<WallItem>(page, 'preview-wall-item')).width).toBeGreaterThan(width + 0.3);
    expect(await saved(page)).toEqual(before);
  } finally {
    if (touch) { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach(); }
    else await page.mouse.up();
  }
  await expect.poll(async () => getWallItemSize((await saved(page)).wallItems![0]).width).toBeGreaterThan(width + 0.3);
  const finish = await point(page, 'resize-handles', { edge: 'max-x' });
  expect(Math.hypot(finish.x - start.x, finish.y - start.y)).toBeGreaterThan(Math.hypot(b.x - a.x, b.y - a.y) * 0.3);
  await button(page, 'Ubah ukuran aksesori').click();
  await expect(canvas(page)).toHaveAttribute('data-resize-mode', 'false');
}

async function selectPartition(page: Page) {
  await button(page, 'Ruangan').click();
  await button(page, 'Atur tembok dalam').click();
  await button(page, 'Pilih tembok dalam 1').click();
}

test('paintings attach to authored walls by pointer, avoid doors, and follow wall edits and undo', async ({ page }, info) => {
  test.setTimeout(150_000);
  const errors = await open(page, info, horizontal);
  await selectPartition(page);
  await button(page, 'Pasang dekorasi di tembok dalam').click();
  await page.getByTestId('catalog-painting').click();
  await expect.poll(() => metadata<WallItem>(page, 'wall-placement')).toMatchObject({ partitionId: PARTITION, wall: 'back', line: 3 });
  await tap(page, info, await point(page, 'wall-targets', { partitionId: PARTITION, wall: 'back', line: 3, offset: 2.5, height: 1.5 }));
  await expect.poll(async () => (await saved(page)).wallItems).toEqual([expect.objectContaining({ kind: 'painting', partitionId: PARTITION, wall: 'back', line: 3, offset: 2.5, height: 1.5 })]);
  const painting = (await saved(page)).wallItems![0];

  await button(page, 'Atur barang').click();
  await tap(page, info, await point(page, 'wall-item-centers', { id: painting.id }));
  await expect(page.getByTestId('inspector').getByRole('heading', { name: 'Lukisan', exact: true })).toBeVisible();
  await expect(page.getByTestId('partition-panel')).toHaveCount(0);
  await dragPainting(page, info, painting, { offset: 3.5, height: 2 }, true);
  await widenPainting(page, info, (await saved(page)).wallItems![0]);
  const backCenter = (await point(page, 'wall-item-centers', { id: painting.id })).entry;
  await selectFace(page, 'front');
  const frontCenter = (await point(page, 'wall-item-centers', { id: painting.id, wall: 'front' })).entry;
  expect(frontCenter.worldZ!).toBeLessThan(backCenter.worldZ!);
  await selectFace(page, 'back');
  await dragPainting(page, info, (await saved(page)).wallItems![0], { offset: 5.5, height: 1.5 }, false);

  const beforeMove = await saved(page);
  const beforeCenter = (await point(page, 'wall-item-centers', { id: painting.id })).entry;
  await selectPartition(page);
  await page.getByLabel('Garis tembok dalam', { exact: true }).fill('4');
  await page.getByLabel('Garis tembok dalam', { exact: true }).press('Enter');
  await expect.poll(async () => (await saved(page)).wallItems?.[0]).toEqual({ ...beforeMove.wallItems![0], line: 4 });
  const moved = await saved(page);
  await expect.poll(async () => (await point(page, 'wall-item-centers', { id: painting.id })).entry.worldZ).toBeCloseTo(beforeCenter.worldZ! + 1, 4);
  await expect(page.locator('.shop-canvas')).toHaveAttribute('aria-busy', 'false');
  await canvas(page).evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.screenshot({ path: `artifacts/partition-painting-${info.project.name}.png`, clip: (await canvas(page).boundingBox())!, timeout: 30_000 });
  await button(page, 'Hapus tembok dalam').click();
  await expect.poll(async () => (await saved(page)).partitions).toEqual([]);
  expect((await saved(page)).wallItems).toEqual([]);
  expect((await saved(page)).interiorDoors).toEqual([]);
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(moved);
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  expect(await saved(page)).toEqual(moved);
  await tap(page, info, await point(page, 'wall-item-centers', { id: painting.id, partitionId: PARTITION }));
  await expect(page.getByTestId('inspector').getByRole('heading', { name: 'Lukisan', exact: true })).toBeVisible();
  await button(page, 'Dinding').click();
  await page.getByTestId('catalog-window').click();
  expect(await page.getByLabel('Dinding aksesori', { exact: true }).locator('option').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringContaining('Tembok dalam')]));
  await button(page, 'Batalkan penempatan aksesori').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('a boundary painting can move onto either face of a vertical partition and back without retaining its mount id', async ({ page }, info) => {
  test.setTimeout(100_000);
  const painting: WallItem = { id: 'existing-painting', kind: 'painting', wall: 'left', line: 0, offset: 2.5, height: 1.5, color: '#B498C4', text: '', lit: false };
  const errors = await open(page, info, { ...base, partitions: [{ id: PARTITION, axis: 'z', line: 4, start: 1, end: 6, color: '#EFE5D6' }], wallItems: [painting] });
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption(`wall:${painting.id}`);
  await button(page, 'Pindahkan aksesori').click();
  await tap(page, info, await point(page, 'wall-targets', { partitionId: PARTITION, wall: 'left', line: 4, offset: 2.5, height: 1.5 }));
  await expect.poll(async () => (await saved(page)).wallItems).toEqual([{ ...painting, partitionId: PARTITION, line: 4 }]);
  await button(page, 'Atur barang').click();
  await tap(page, info, await point(page, 'wall-item-centers', { id: painting.id }));
  await expect(page.getByTestId('inspector').getByRole('heading', { name: 'Lukisan', exact: true })).toBeVisible();
  const leftCenter = (await point(page, 'wall-item-centers', { id: painting.id })).entry;
  await selectFace(page, 'right');
  const rightCenter = (await point(page, 'wall-item-centers', { id: painting.id, wall: 'right' })).entry;
  expect(rightCenter.worldX!).toBeLessThan(leftCenter.worldX!);
  const partitionDesign = await saved(page);
  await page.getByLabel('Dinding aksesori', { exact: true }).selectOption('left:0:0:7');
  await expect.poll(async () => (await saved(page)).wallItems?.[0]).toMatchObject({ id: painting.id, wall: 'left', line: 0 });
  expect((await saved(page)).wallItems![0]).not.toHaveProperty('partitionId');
  const boundaryDesign = await saved(page);
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(partitionDesign);
  await button(page, 'Ulangi').click();
  await expect.poll(() => saved(page)).toEqual(boundaryDesign);
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  expect(await saved(page)).toEqual(boundaryDesign);
  expect(errors).toEqual([]);
});
