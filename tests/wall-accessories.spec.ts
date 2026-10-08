import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { ShopDocument, WallItem } from '../src/model';

const KEY = 'nemu.store-maker.v1';
const EMPTY: ShopDocument = { version: 2, name: 'Studio Dinding', width: 7, depth: 6, wallColor: '#F4EEDF', floorColor: '#DCC5A9', items: [], wallItems: [] };
const WINDOW: WallItem = { id: 'moving-window', kind: 'window', wall: 'left', line: 0, offset: 3.8, height: 1.3, color: '#F5EAD6', text: '', lit: false };
const canvasFor = (page: Page) => page.getByTestId('scene').locator('canvas[data-renderer="webgl"]');
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);

async function openFixture(page: Page, doc = EMPTY) {
  await page.goto('/');
  await page.getByLabel('Buka file desain', { exact: true }).setInputFiles({ name: 'wall.store-maker.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect.poll(() => saved(page)).toEqual(doc);
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
}

async function wallPoint(page: Page, query: { id: string } | { wall: string; line: number; offset: number; height: number }) {
  const canvas = canvasFor(page);
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(() => canvas.evaluate((surface, query) => {
    const items = JSON.parse((surface as HTMLElement).dataset['id' in query ? 'wallItemCenters' : 'wallTargets'] || '[]');
    return items.some((item: Record<string, unknown>) => Object.entries(query).every(([key, value]) => item[key] === value));
  }, query)).toBe(true);
  return canvas.evaluate((surface, query) => {
    const items = JSON.parse((surface as HTMLElement).dataset['id' in query ? 'wallItemCenters' : 'wallTargets'] || '[]');
    const item = items.find((item: Record<string, unknown>) => Object.entries(query).every(([key, value]) => item[key] === value));
    const rect = surface.getBoundingClientRect();
    return { x: rect.left + item.canvasX, y: rect.top + item.canvasY };
  }, query);
}

async function dragWall(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const mobile = await page.evaluate(() => navigator.maxTouchPoints > 0);
  const session = mobile ? await page.context().newCDPSession(page) : null;
  if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, ...from }] });
  else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  for (let i = 1; i <= 6; i++) {
    const point = { x: from.x + (to.x - from.x) * i / 6, y: from.y + (to.y - from.y) * i / 6 };
    if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, ...point }] });
    else await page.mouse.move(point.x, point.y);
  }
  return {
    async release() { if (session) { await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach(); } else await page.mouse.up(); },
    async cancel() { if (session) { await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await session.detach(); } else { await page.keyboard.press('Escape'); await page.mouse.up(); } },
  };
}

test('all wall accessories can be customized, duplicated, deleted, saved and reopened', async ({ page }) => {
  test.setTimeout(60_000);
  await openFixture(page);
  await page.getByRole('button', { name: 'Dinding', exact: true }).click();
  for (const kind of ['window', 'wall-lamp', 'wall-shelf', 'painting', 'wall-sign']) {
    await page.getByTestId(`catalog-${kind}`).click();
    await page.getByRole('button', { name: 'Pasang di sini', exact: true }).click();
  }
  await expect.poll(async () => (await saved(page)).wallItems?.length).toBe(5);
  const items = (await saved(page)).wallItems!;
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption({ value: `wall:${items.find(item => item.kind === 'wall-sign')!.id}` });
  await page.getByLabel('Tulisan papan', { exact: true }).fill('Sudut Sore');
  await expect.poll(async () => (await saved(page)).wallItems!.find(item => item.kind === 'wall-sign')?.text).toBe('Sudut Sore');
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption({ value: `wall:${items.find(item => item.kind === 'wall-lamp')!.id}` });
  await page.getByRole('button', { name: 'Nyalakan lampu dinding', exact: true }).click();
  await expect.poll(async () => (await saved(page)).wallItems!.find(item => item.kind === 'wall-lamp')?.lit).toBe(false);
  await page.getByRole('button', { name: 'Warna aksesori 4', exact: true }).click();
  await expect.poll(async () => (await saved(page)).wallItems!.find(item => item.kind === 'wall-lamp')?.color).toBe('#8d9e83');
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption({ value: `wall:${items.find(item => item.kind === 'painting')!.id}` });
  await page.getByRole('button', { name: 'Duplikat aksesori', exact: true }).click();
  await page.getByRole('button', { name: 'Pasang di sini', exact: true }).click();
  await expect.poll(async () => (await saved(page)).wallItems?.length).toBe(6);
  await page.getByRole('button', { name: 'Hapus aksesori', exact: true }).click();
  await expect.poll(async () => (await saved(page)).wallItems?.length).toBe(5);
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect.poll(async () => (await saved(page)).wallItems?.length).toBe(6);
  const complete = await saved(page);
  await page.getByRole('button', { name: 'Menu file desain', exact: true }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Simpan file desain', exact: true }).click();
  const download = await event;
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported).toEqual(complete);
  await page.reload();
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  expect(await saved(page)).toEqual(complete);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('a window drags along its wall, commits once, and cancellation restores its opening', async ({ page }, testInfo) => {
  const initial = { ...EMPTY, wallItems: [WINDOW] };
  await openFixture(page, initial);
  const from = await wallPoint(page, { id: WINDOW.id });
  const to = await wallPoint(page, { wall: 'left', line: 0, offset: 2.5, height: 1.5 });
  const drag = await dragWall(page, from, to);
  try {
    await expect.poll(async () => JSON.parse(await canvasFor(page).getAttribute('data-preview-wall-item') || 'null')?.valid).toBe(true);
    expect(await saved(page)).toEqual(initial);
  } finally { await drag.release(); }
  await expect.poll(async () => (await saved(page)).wallItems![0].offset).not.toBe(WINDOW.offset);
  const moved = (await saved(page)).wallItems![0];
  expect(moved.wall).toBe('left');
  expect(moved.height).toBeGreaterThan(WINDOW.height);
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect.poll(() => saved(page)).toEqual(initial);
  const cancelled = await dragWall(page, await wallPoint(page, { id: WINDOW.id }), to);
  await cancelled.cancel();
  expect(await saved(page)).toEqual(initial);
  await canvasFor(page).screenshot({ path: testInfo.outputPath('movable-window.png') });
});

test('legacy windows are editable and accessories can move between wall faces', async ({ page }) => {
  const legacy: ShopDocument = { ...EMPTY };
  delete legacy.wallItems;
  await openFixture(page, legacy);
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption({ value: 'wall:builtin-window' });
  await expect(page.getByTestId('inspector').getByRole('heading', { name: 'Jendela', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pindahkan aksesori', exact: true }).click();
  const back = await page.getByLabel('Dinding aksesori', { exact: true }).locator('option').evaluateAll(options => options.find(option => option.textContent?.startsWith('Belakang'))?.getAttribute('value'));
  expect(back).toBeTruthy();
  await page.getByLabel('Dinding aksesori', { exact: true }).selectOption({ value: back! });
  await page.getByRole('button', { name: 'Pasang di sini', exact: true }).click();
  await expect.poll(async () => (await saved(page)).wallItems?.find(item => item.id === 'builtin-window')?.wall).toBe('back');
  expect((await saved(page)).wallItems!.map(item => item.id).sort()).toEqual(['builtin-wall-sign', 'builtin-window']);
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect.poll(() => saved(page)).toEqual(legacy);
});
