import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createEmptyShop, createInitialShop, type ShopDocument } from '../src/model';

test.use({ reducedMotion: 'reduce' });
const KEY = 'nemu.store-maker.v1';
const canvas = (page: Page) => page.locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
const empty = (): ShopDocument => ({ ...createEmptyShop(), name: 'Studio Ruang', width: 8, depth: 7, items: [], wallItems: [] });

async function open(page: Page, info: TestInfo, fixture?: ShopDocument) {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1050 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  if (fixture) await page.addInitScript(({ key, doc }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc));
  }, { key: KEY, doc: fixture });
  await page.goto('/');
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.shop-canvas')).toHaveAttribute('aria-busy', 'false');
  return errors;
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

async function vertex(page: Page, x: number, z: number) {
  await canvas(page).scrollIntoViewIfNeeded();
  await expect.poll(() => canvas(page).evaluate((node, wanted) =>
    JSON.parse((node as HTMLElement).dataset.partitionPoints || '[]').some((point: { x: number; z: number }) => point.x === wanted.x && point.z === wanted.z), { x, z })).toBe(true);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return canvas(page).evaluate((node, wanted) => {
    const point = JSON.parse((node as HTMLElement).dataset.partitionPoints!).find((point: { x: number; z: number }) => point.x === wanted.x && point.z === wanted.z);
    const bounds = node.getBoundingClientRect();
    return { x: bounds.left + point.canvasX, y: bounds.top + point.canvasY };
  }, { x, z });
}

async function drawWall(page: Page, from: { x: number; z: number }, to: { x: number; z: number }) {
  const start = await vertex(page, from.x, from.z), end = await vertex(page, to.x, to.z);
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  const session = touch ? await page.context().newCDPSession(page) : null;
  if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, ...start }] });
  else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
  try {
    for (let step = 1; step <= 8; step++) {
      const point = { x: start.x + (end.x - start.x) * step / 8, y: start.y + (end.y - start.y) * step / 8 };
      if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, ...point }] });
      else await page.mouse.move(point.x, point.y);
    }
  } finally {
    if (session) { await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach(); }
    else await page.mouse.up();
  }
}

test('the spacious example has separate bathroom fixtures and a room-panel entrance to internal walls', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors = await open(page, info), original = createInitialShop();
  await expect.poll(() => saved(page)).toEqual(original);
  expect(original).toMatchObject({ width: 10, depth: 9 });
  expect(original.items.some(item => item.kind === 'bathroom')).toBe(false);
  expect(original.partitions).toHaveLength(2); expect(original.interiorDoors).toHaveLength(1);
  await button(page, 'Gudang & utilitas').click();
  await expect(page.locator('.catalog-card')).toHaveCount(5);
  await expect(page.getByTestId('catalog-bathroom')).toHaveCount(0);
  for (const [kind, name] of [['toilet', 'Toilet'], ['washbasin', 'Wastafel'], ['shower', 'Shower']]) {
    await expect(page.getByTestId(`catalog-${kind}`)).toBeVisible();
    const item = original.items.find(item => item.kind === kind)!;
    await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption(item.id);
    await expect(page.getByTestId('inspector').getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await button(page, 'Ruangan').click();
  await button(page, 'Atur tembok dalam').click();
  await expect(page.getByTestId('partition-panel')).toBeVisible();
  await button(page, 'Pilih tembok dalam 2').click();
  await expect(button(page, 'Buka pintu dalam 1')).toBeVisible();
  if (info.project.name === 'mobile-chromium') await page.setViewportSize({ width: 320, height: 844 });
  await noOverflow(page);
  const tools = page.getByRole('button', { name: /^(Tambah lantai|Hapus lantai|Atur dinding dan pintu|Tembok dalam)$/ });
  await expect(tools).toHaveCount(4);
  for (const tool of await tools.all()) {
    const bounds = await tool.boundingBox();
    expect(bounds).not.toBeNull(); expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  expect(await saved(page)).toEqual(original);
  await page.getByTestId('partition-panel').screenshot({ path: info.outputPath('bathroom-wall-controls.png') });
  expect(errors).toEqual([]);
});

test('windows on every wall and a right-side entrance keep their saved pose in both views and after reload', async ({ page }, info) => {
  test.setTimeout(100_000);
  const errors = await open(page, info, empty());
  await button(page, 'Dinding').click();
  for (const [side, offset] of [['front', '1.5'], ['right', '2.5'], ['back', '1.5'], ['left', '2.5']] as const) {
    await page.getByTestId('catalog-window').click();
    const field = page.getByLabel('Dinding aksesori', { exact: true });
    const options = await field.locator('option').allTextContents();
    for (const label of ['Belakang', 'Kiri', 'Depan', 'Kanan']) expect(options.some(value => value.startsWith(label))).toBe(true);
    const value = await field.locator('option').evaluateAll((options, side) => (options.find(option => (option as HTMLOptionElement).value.startsWith(`${side}:`)) as HTMLOptionElement).value, side);
    await field.selectOption(value);
    await page.getByLabel('Posisi aksesori di dinding', { exact: true }).selectOption(offset);
    await button(page, 'Pasang di sini').click();
    await expect.poll(async () => (await saved(page)).wallItems?.some(item => item.wall === side)).toBe(true);
  }
  await button(page, 'Ruangan').click();
  await button(page, 'Atur dinding dan pintu').click();
  await page.getByLabel('Sisi pintu masuk', { exact: true }).selectOption('right');
  await page.getByLabel('Posisi pintu', { exact: true }).selectOption('0.75');
  await button(page, 'Putar pintu kanan').click();
  await expect.poll(async () => (await saved(page)).entrance).toMatchObject({ wall: 'right', position: 0.75, rotation: 90 });
  await expect(canvas(page)).toHaveAttribute('data-entrance-wall', 'right');
  await expect(canvas(page)).toHaveAttribute('data-door-rotation', '0');
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const pose = await canvas(page).getAttribute('data-rendered-entrance');
  const windows = JSON.parse(await canvas(page).getAttribute('data-rendered-windows') || '[]');
  expect(windows).toHaveLength(4);
  const design = await saved(page);
  await button(page, 'Eksterior').click();
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');
  await expect(page.locator('.shop-canvas')).toHaveAttribute('aria-busy', 'false');
  await expect(canvas(page)).toHaveAttribute('data-rendered-entrance', pose!);
  expect(JSON.parse(await canvas(page).getAttribute('data-rendered-windows') || '[]')).toEqual(windows);
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(design);
  await expect(canvas(page)).toHaveAttribute('data-entrance-wall', 'right');
  expect(errors).toEqual([]);
});

test('drawn internal walls support editable doors, invalid-input feedback, undo, and persistence', async ({ page }, info) => {
  test.setTimeout(100_000);
  const errors = await open(page, info, empty());
  await button(page, 'Ruangan').click();
  await button(page, 'Atur tembok dalam').click();
  await button(page, 'Gambar tembok dalam').click();
  await button(page, 'Kamera dari atas').click();
  await expect(canvas(page)).toHaveAttribute('data-build-tool', 'partition');
  await drawWall(page, { x: 2, z: 3 }, { x: 6, z: 3 });
  await expect.poll(async () => (await saved(page)).partitions).toEqual([expect.objectContaining({ axis: 'x', line: 3, start: 2, end: 6 })]);
  await button(page, 'Pilih tembok dalam 1').click();
  await button(page, 'Tambah pintu dalam').click();
  await expect.poll(async () => (await saved(page)).interiorDoors).toHaveLength(1);
  await button(page, 'Buka pintu dalam 1').click();
  const width = page.getByLabel('Lebar pintu dalam 1', { exact: true });
  await width.fill('1.4'); await width.press('Enter');
  const offset = page.getByLabel('Posisi pintu dalam 1', { exact: true });
  await offset.fill('4.5'); await offset.press('Enter');
  await expect.poll(async () => (await saved(page)).interiorDoors?.[0]).toMatchObject({ open: true, width: 1.4, offset: 4.5 });
  await width.fill('9'); await width.press('Enter');
  await expect(width).toHaveValue('1.4');
  await expect(page.locator('.toast')).toContainText('Pintu belum muat');
  const line = page.getByLabel('Garis tembok dalam', { exact: true });
  await line.fill('100'); await line.press('Enter');
  await expect(line).toHaveValue('3');
  await expect(page.locator('.toast')).toContainText('Tembok belum pas');
  await line.fill('4'); await line.press('Enter');
  await button(page, 'Warna tembok dalam 3').click();
  await expect.poll(async () => (await saved(page)).partitions?.[0]).toMatchObject({ line: 4, color: '#e8d7df' });
  const design = await saved(page);
  await button(page, 'Hapus pintu dalam 1').click();
  await expect.poll(async () => (await saved(page)).interiorDoors).toHaveLength(0);
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(design);
  await button(page, 'Hapus tembok dalam').click();
  await expect.poll(async () => (await saved(page)).partitions).toHaveLength(0);
  expect((await saved(page)).interiorDoors).toHaveLength(0);
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(design);
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => saved(page)).toEqual(design);
  await expect.poll(async () => JSON.parse(await canvas(page).getAttribute('data-partitions') || '[]')).toEqual(design.partitions);
  await expect.poll(async () => JSON.parse(await canvas(page).getAttribute('data-interior-doors') || '[]')).toEqual(design.interiorDoors);
  expect(errors).toEqual([]);
});

test('toilet, washbasin, and shower can be placed and edited separately without adding a bathroom module', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors = await open(page, info, empty());
  await button(page, 'Gudang & utilitas').click();
  for (const [kind, x] of [['toilet', 1], ['washbasin', 3], ['shower', 5]] as const) {
    await page.getByTestId(`catalog-${kind}`).click();
    await page.getByLabel('Petak X', { exact: true }).selectOption({ value: String(x) });
    await page.getByLabel('Petak Y', { exact: true }).selectOption({ value: '1' });
    await button(page, 'Letakkan di sini').click();
    await expect.poll(async () => (await saved(page)).items.some(item => item.kind === kind && item.x === x)).toBe(true);
  }
  const design = await saved(page);
  expect(design.items.map(item => item.kind)).toEqual(['toilet', 'washbasin', 'shower']);
  expect(design.partitions ?? []).toHaveLength(0);
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption(design.items[1].id);
  await button(page, 'Putar barang').click();
  await expect.poll(async () => (await saved(page)).items[1].rotation).toBe(90);
  expect((await saved(page)).items.filter(item => item.kind !== 'washbasin')).toEqual(design.items.filter(item => item.kind !== 'washbasin'));
  await button(page, 'Hapus barang').click();
  await expect.poll(async () => (await saved(page)).items.map(item => item.kind)).toEqual(['toilet', 'shower']);
  await button(page, 'Urungkan').click();
  await expect.poll(async () => (await saved(page)).items).toHaveLength(3);
  await noOverflow(page);
  expect(errors).toEqual([]);
});
