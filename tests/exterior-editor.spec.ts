import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createEmptyShop, getEntrance, type ShopDocument, type WallItem } from '../src/model';

test.use({ reducedMotion: 'reduce' });
const KEY = 'nemu.store-maker.v1';
const frontWindow = (id: string): WallItem => ({ id, kind: 'window', wall: 'front', line: 7, offset: 2.4, height: 1.6, width: 2.2, sizeHeight: 1.4, color: '#B08B63', text: '', lit: false });
const floor = (id: string): ShopDocument => ({ ...createEmptyShop(), width: 8, depth: 7, wallHeight: 3.5, wallItems: [frontWindow(id)] });
const fixture: ShopDocument = { ...floor('ground-window'), name: 'Cerita di Jalan', upperFloors: [floor('upper-window')], roof: { style: 'tiles', color: '#B96B51', garden: false } };
const canvas = (page: Page) => page.getByTestId('scene').locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
const metadata = async <T,>(page: Page, name: string): Promise<T> => JSON.parse(await canvas(page).getAttribute(`data-${name}`) || 'null');
async function captureCanvas(page: Page, path: string) {
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.shop-canvas')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('scene-loading')).toHaveCSS('opacity', '0');
  await canvas(page).evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.screenshot({ path, clip: (await canvas(page).boundingBox())!, timeout: 30_000 });
}

type Center = { id: string; canvasX: number; canvasY: number; worldY: number };
type Storey = { name: string; level?: number; y: number };
type LoaderWatch = HTMLElement & { loaderEvents?: string[]; loaderObserver?: MutationObserver };

async function watchLocalEdits(page: Page) {
  await expect(page.locator('.shop-canvas')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('scene-loading')).toHaveCSS('opacity', '0');
  const exteriorContext = await canvas(page).getAttribute('data-exterior-context-id');
  expect(exteriorContext).toBeTruthy();
  await page.locator('.shop-canvas').evaluate(root => {
    const watch = root as LoaderWatch;
    watch.loaderEvents = [];
    watch.loaderObserver = new MutationObserver(records => {
      for (const record of records) {
        const target = record.target as HTMLElement;
        if (target === root && record.attributeName === 'aria-busy'
          && (record.oldValue === 'true' || target.getAttribute('aria-busy') === 'true')) watch.loaderEvents!.push('busy');
        if (target.dataset.testid === 'scene-loading' && record.attributeName === 'class'
          && (record.oldValue?.split(' ').includes('is-loading') || target.classList.contains('is-loading'))) watch.loaderEvents!.push('veil');
      }
    });
    watch.loaderObserver.observe(root, { attributes: true, subtree: true, attributeOldValue: true, attributeFilter: ['aria-busy', 'class'] });
  });
  return async () => {
    await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const events = await page.locator('.shop-canvas').evaluate(root => {
      const watch = root as LoaderWatch;
      watch.loaderObserver!.disconnect();
      return watch.loaderEvents;
    });
    expect(events, 'Local edits must not cover the scene with the view-change loader').toEqual([]);
    await expect(canvas(page)).toHaveAttribute('data-exterior-context-id', exteriorContext!);
  };
}
type Target = { wall: string; offset: number; height: number; canvasX: number; canvasY: number };

async function open(page: Page, info: TestInfo, doc = fixture) {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ key, doc }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc));
    localStorage.setItem('nemu.store-maker.time-mode', 'day');
  }, { key: KEY, doc });
  await page.goto('/');
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await button(page, 'Eksterior').click();
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');
  await expect(page.locator('.shop-canvas')).toHaveAttribute('aria-busy', 'false');
  return errors;
}

async function wallCenter(page: Page, id: string) {
  await canvas(page).scrollIntoViewIfNeeded();
  await expect.poll(async () => (await metadata<Center[]>(page, 'wall-item-centers')).some(center => center.id === id)).toBe(true);
  const center = (await metadata<Center[]>(page, 'wall-item-centers')).find(center => center.id === id)!;
  const rect = (await canvas(page).boundingBox())!;
  return { x: rect.x + center.canvasX, y: rect.y + center.canvasY, center };
}

async function clickWall(page: Page, info: TestInfo, id: string) {
  const point = await wallCenter(page, id);
  if (info.project.name === 'mobile-chromium') await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await expect(button(page, 'Pindahkan aksesori')).toBeVisible();
}

async function dragWindow(page: Page, info: TestInfo, item: WallItem) {
  const start = await wallCenter(page, item.id);
  const targets = await metadata<Target[]>(page, 'wall-targets');
  const a = targets.find(point => point.wall === 'front' && point.offset === 4 && point.height === 1.5)!;
  const b = targets.find(point => point.wall === 'front' && point.offset === 5 && point.height === 2)!;
  expect(a).toBeDefined(); expect(b).toBeDefined();
  const dx = b.canvasX - a.canvasX, dy = b.canvasY - a.canvasY;
  const touch = info.project.name === 'mobile-chromium' ? await page.context().newCDPSession(page) : null;
  if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x: start.x, y: start.y }] });
  else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
  for (let step = 1; step <= 8; step++) {
    const point = { x: start.x + dx * step / 8, y: start.y + dy * step / 8 };
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, ...point }] });
    else await page.mouse.move(point.x, point.y);
  }
  await expect(canvas(page)).toHaveAttribute('data-interaction', 'wall-item');
  // Touch movement and aperture rebuilding are coalesced onto rendered frames.
  await expect.poll(async () => (await metadata<WallItem>(page, 'preview-wall-item')).offset).toBeCloseTo(item.offset + 1, 1);
  await expect.poll(async () => (await metadata<WallItem>(page, 'preview-wall-item')).height).toBeCloseTo(item.height + 0.5, 1);
  const preview = await metadata<WallItem & { valid: boolean }>(page, 'preview-wall-item');
  expect(preview).toMatchObject({ id: item.id, wall: 'front', valid: true });
  expect(preview.offset).toBeCloseTo(item.offset + 1, 1);
  expect(preview.height).toBeCloseTo(item.height + 0.5, 1);
  await expect.poll(async () => (await metadata<WallItem[]>(page, 'window-openings')).find(window => window.id === item.id)?.offset).toBeCloseTo(Math.round(preview.offset * 10) / 10, 1);
  if (touch) { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach(); }
  else await page.mouse.up();
}

async function buildExteriorWall(page: Page, info: TestInfo, level: number) {
  await expect(button(page, 'Atur barang')).toBeVisible();
  await button(page, 'Bangun ruangan').click();
  await expect(button(page, 'Bangun ruangan')).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');
  await expect(canvas(page)).toHaveAttribute('data-edit-mode', 'build');
  await expect(canvas(page)).toHaveAttribute('data-build-tool', 'walls');
  await expect(button(page, 'Tambah lantai')).toHaveCount(0);
  await expect(button(page, 'Hapus lantai')).toHaveCount(0);
  await expect(button(page, 'Tembok dalam')).toHaveCount(0);
  await canvas(page).evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect.poll(async () => (await metadata<Center[]>(page, 'handles')).some(handle => handle.id === 'walltop')).toBe(true);
  const handles = await metadata<Center[]>(page, 'handles');
  expect(handles.every(handle => ['walltop', ...(level ? [] : ['door'])].includes(handle.id))).toBe(true);
  const handle = handles.find(handle => handle.id === 'walltop')!;
  const before = await saved(page);
  const height = level ? before.upperFloors![level - 1].wallHeight! : before.wallHeight!;
  expect(handle.worldY).toBeCloseTo(height + 0.14 + (level ? before.wallHeight! + 0.24 : 0), 2);
  const rect = (await canvas(page).boundingBox())!;
  const start = { x: rect.x + handle.canvasX, y: rect.y + handle.canvasY };
  expect(handle.canvasX).toBeGreaterThan(0); expect(handle.canvasX).toBeLessThan(rect.width);
  expect(handle.canvasY).toBeGreaterThan(40); expect(handle.canvasY).toBeLessThan(rect.height);
  const storeys = await metadata<Storey[]>(page, 'exterior-storeys');
  expect(storeys.some(storey => storey.name === 'tiled-roof')).toBe(true);
  // Cancelling the ground-floor edit must restore both the roof and upstairs.
  for (const cancel of level ? [false] : [true, false]) {
    const touch = info.project.name === 'mobile-chromium' ? await page.context().newCDPSession(page) : null;
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, ...start }] });
    else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
    try {
      for (let step = 1; step <= 8; step++) {
        const point = { x: start.x, y: start.y - 40 * step / 8 };
        if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, ...point }] });
        else await page.mouse.move(point.x, point.y);
      }
      await expect(canvas(page)).toHaveAttribute('data-interaction', 'height');
      await expect.poll(async () => Number(await canvas(page).getAttribute('data-preview-wall-height'))).toBeGreaterThan(height + 0.1);
      const delta = Number(await canvas(page).getAttribute('data-preview-wall-height')) - height;
      await expect.poll(async () => {
        const preview = await metadata<Storey[]>(page, 'exterior-storeys');
        return storeys.every(storey => {
          const moved = preview.find(candidate => candidate.name === storey.name)!;
          const expected = storey.y + ((storey.level ?? -1) > level || storey.name === 'tiled-roof' ? delta : 0);
          return Math.abs(moved.y - expected) < 0.01;
        });
      }).toBe(true);
      expect(await saved(page)).toEqual(before);
      if (cancel) {
        await page.keyboard.press('Escape');
        await expect(canvas(page)).toHaveAttribute('data-interaction', 'idle');
        await expect.poll(() => metadata<Storey[]>(page, 'exterior-storeys')).toEqual(storeys);
        expect(await saved(page)).toEqual(before);
      }
    } finally {
      if (touch) { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach(); }
      else await page.mouse.up();
    }
  }
  await expect.poll(async () => {
    const doc = await saved(page);
    return level ? doc.upperFloors![level - 1].wallHeight : doc.wallHeight;
  }).toBeGreaterThan(height + 0.1);
  const after = await saved(page);
  if (level) expect(after.wallHeight).toBe(before.wallHeight);
  else expect(after.upperFloors).toEqual(before.upperFloors);
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(before);
  await button(page, 'Atur barang').click();
  await expect(button(page, 'Atur barang')).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas(page)).toHaveAttribute('data-edit-mode', 'arrange');
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');
}

test('exterior arrange and build modes edit each floor without switching views, and windows stay consistent inside', async ({ page }, info) => {
  test.setTimeout(150_000);
  const errors = await open(page, info);
  const originalCanvas = await canvas(page).elementHandle();
  await button(page, 'Kamera depan').click();
  await buildExteriorWall(page, info, 0);
  await clickWall(page, info, 'ground-window');
  await expect(page.getByRole('group', { name: 'Variasi jendela', exact: true })).toBeVisible();
  await page.getByRole('group', { name: 'Material fasad', exact: true }).getByRole('button', { name: 'Bata', exact: true }).click();
  await expect.poll(async () => (await saved(page)).exterior?.wallMaterial).toBe('brick');
  expect((await saved(page)).wallItems).toEqual(fixture.wallItems);
  await page.getByLabel('Lantai dekorasi eksterior', { exact: true }).selectOption('1');
  await expect(canvas(page)).toHaveAttribute('data-active-level', '1');
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');
  await expect.poll(async () => (await metadata<{ id: string }[]>(page, 'rendered-windows')).map(window => window.id).sort()).toEqual(['ground-window', 'upper-window']);
  await buildExteriorWall(page, info, 1);
  await clickWall(page, info, 'upper-window');
  expect((await wallCenter(page, 'upper-window')).center.worldY).toBeCloseTo(3.5 + 0.24 + 1.6, 1);
  await button(page, 'Ubah ukuran aksesori').click();
  await page.getByLabel('Panjang aksesori', { exact: true }).fill('2.6');
  await page.getByLabel('Panjang aksesori', { exact: true }).press('Enter');
  await page.getByLabel('Tinggi aksesori', { exact: true }).fill('1.6');
  await page.getByLabel('Tinggi aksesori', { exact: true }).press('Enter');
  await button(page, 'Ubah ukuran aksesori').click();
  await page.getByLabel('Dinding aksesori', { exact: true }).selectOption('right:8:0:7');
  await expect.poll(async () => (await saved(page)).upperFloors![0].wallItems![0].wall).toBe('right');
  await page.getByLabel('Dinding aksesori', { exact: true }).selectOption('front:7:0:8');
  await page.getByLabel('Posisi aksesori di dinding', { exact: true }).selectOption('4');
  await page.getByLabel('Ketinggian aksesori', { exact: true }).selectOption('1.5');
  await button(page, 'Jendela Lengkung').click();
  const beforeDrag = (await saved(page)).upperFloors![0].wallItems![0];
  const verifyNoLoader = await watchLocalEdits(page);
  await dragWindow(page, info, beforeDrag);
  await expect.poll(async () => (await saved(page)).upperFloors![0].wallItems![0]).toMatchObject({ offset: 5, height: 2, width: 2.6, sizeHeight: 1.6, windowStyle: 'arched' });
  await button(page, 'Urungkan').click();
  await expect.poll(async () => (await saved(page)).upperFloors![0].wallItems![0]).toEqual(beforeDrag);
  await button(page, 'Ulangi').click();
  const edited = (await saved(page)).upperFloors![0].wallItems![0];
  await verifyNoLoader();
  await captureCanvas(page, info.outputPath('exterior-brick-upstairs-window.png'));
  await button(page, 'Interior').click();
  await expect.poll(async () => (await metadata<WallItem[]>(page, 'window-openings')).find(window => window.id === 'upper-window')).toMatchObject({ offset: edited.offset, height: edited.height, width: edited.width, sizeHeight: edited.sizeHeight });
  await button(page, 'Bangun ruangan').click();
  await expect(canvas(page)).toHaveAttribute('data-edit-mode', 'build');
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'false');
  await button(page, 'Tambah lantai').click();
  await expect(canvas(page)).toHaveAttribute('data-build-tool', 'add');
  await button(page, 'Atur barang').click();
  await expect(canvas(page)).toHaveAttribute('data-edit-mode', 'arrange');
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'false');
  expect(await canvas(page).evaluate((node, original) => node === original, originalCanvas)).toBe(true);
  expect((await saved(page)).wallItems).toEqual(fixture.wallItems);
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  expect((await saved(page)).upperFloors![0].wallItems![0]).toEqual(edited);
  expect(errors).toEqual([]);
});

test('arrange mode drags a standing exterior sign and preserves the edit indoors and after reload', async ({ page }, info) => {
  test.setTimeout(90_000);
  const doc: ShopDocument = { ...fixture, items: [
    { id: 'sidewalk-board', kind: 'chalkboard', x: 1, z: 7, rotation: 0, color: '#BC8F69', stock: 'none' },
    { id: 'indoor-plant', kind: 'plant', x: 6, z: 2, rotation: 0, color: '#C6B8DE', stock: 'none' },
  ] };
  const errors = await open(page, info, doc);
  await button(page, 'Atur barang').click();
  await expect(canvas(page)).toHaveAttribute('data-edit-mode', 'arrange');
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByTestId('scene-toolbar').screenshot({ path: info.outputPath('exterior-arrange-toolbar.png') });
  await canvas(page).evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect.poll(async () => (await metadata<Center[]>(page, 'item-centers')).map(item => item.id)).toEqual(['sidewalk-board']);
  const board = (await metadata<Center[]>(page, 'item-centers'))[0];
  const cells = await metadata<{ x: number; z: number; canvasX: number; canvasY: number }[]>(page, 'cell-centers');
  const a = cells.find(cell => cell.x === 1 && cell.z === 1)!;
  const b = cells.find(cell => cell.x === 2 && cell.z === 1)!;
  expect(a).toBeDefined(); expect(b).toBeDefined();
  const rect = (await canvas(page).boundingBox())!;
  const start = { x: rect.x + board.canvasX, y: rect.y + board.canvasY };
  const touch = info.project.name === 'mobile-chromium' ? await page.context().newCDPSession(page) : null;
  if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, ...start }] });
  else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
  try {
    for (let step = 1; step <= 8; step++) {
      const point = { x: start.x + (b.canvasX - a.canvasX) * step / 8, y: start.y + (b.canvasY - a.canvasY) * step / 8 };
      if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, ...point }] });
      else await page.mouse.move(point.x, point.y);
    }
    await expect(canvas(page)).toHaveAttribute('data-interaction', 'item');
    await expect.poll(() => metadata<{ id: string; valid: boolean }>(page, 'preview-item')).toMatchObject({ id: 'sidewalk-board', valid: true });
    await expect.poll(async () => (await metadata<{ x: number }>(page, 'preview-item')).x).toBeCloseTo(2, 4);
    await expect.poll(async () => (await metadata<{ z: number }>(page, 'preview-item')).z).toBeCloseTo(7, 4);
    expect(await saved(page)).toEqual(doc);
  } finally {
    if (touch) { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach(); }
    else await page.mouse.up();
  }
  await expect.poll(async () => (await saved(page)).items[0]).toMatchObject({ id: 'sidewalk-board', x: 2, z: 7 });
  await expect(page.getByTestId('inspector').getByRole('button', { name: 'Putar barang', exact: true })).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');
  const edited = await saved(page);
  expect(edited.items[1]).toEqual(doc.items[1]);
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(doc);
  await button(page, 'Ulangi').click();
  await expect.poll(() => saved(page)).toEqual(edited);
  await captureCanvas(page, info.outputPath('exterior-standing-sign-moved.png'));
  await button(page, 'Interior').click();
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'false');
  await expect.poll(async () => (await metadata<Center[]>(page, 'item-centers')).map(item => item.id).sort()).toEqual(['indoor-plant', 'sidewalk-board']);
  expect(await saved(page)).toEqual(edited);
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  expect(await saved(page)).toEqual(edited);
  expect(errors).toEqual([]);
});

test('an empty exterior plot opens floor building before adding its first window', async ({ page }, info) => {
  const errors = await open(page, info, { ...createEmptyShop(), floorCells: [] });
  await button(page, 'Tambah jendela eksterior').click();
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'false');
  await expect(canvas(page)).toHaveAttribute('data-edit-mode', 'build');
  await expect(canvas(page)).toHaveAttribute('data-build-tool', 'add');
  await expect(button(page, 'Tambah lantai')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await metadata<unknown[]>(page, 'paint-cells')).length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('all exterior lamp and signage variants save independently from interior decor and support undo', async ({ page }, info) => {
  test.setTimeout(150_000);
  const errors = await open(page, info);
  let expectedCount = 1;
  const place = async (label: string, wall: string, offset: string, height: string) => {
    await button(page, label).click();
    await page.getByLabel('Dinding aksesori', { exact: true }).selectOption(wall);
    await page.getByLabel('Posisi aksesori di dinding', { exact: true }).selectOption(offset);
    await page.getByLabel('Ketinggian aksesori', { exact: true }).selectOption(height);
    await button(page, 'Pasang di sini').click();
    await expect.poll(async () => (await saved(page)).wallItems!.length).toBe(++expectedCount);
  };
  for (const [label, offset] of [['Kap klasik', '0.6'], ['Lentera', '4.2'], ['Lampu oval', '7.4']]) await place(`Tambah lampu luar ${label}`, 'front:7:0:8', offset, '2.7');
  await place('Tambah signage Papan toko besar', 'back:0:0:8', '4', '2.7');
  await page.getByLabel('Tulisan papan', { exact: true }).fill('CERITA DI JALAN');
  await place('Tambah signage Papan menjorok', 'right:8:0:7', '3.5', '2');
  await place('Tambah signage Papan kayu', 'left:0:0:7', '3.5', '1.7');
  const design = await saved(page), additions = design.wallItems!.slice(1);
  expect(additions.every(item => item.mount === 'exterior')).toBe(true);
  expect(additions.filter(item => item.kind === 'wall-lamp').map(item => item.wallLampStyle).sort()).toEqual(['bulkhead', 'lantern', 'sconce']);
  expect(additions.filter(item => item.kind === 'wall-sign').map(item => item.wallSignStyle).sort()).toEqual(['fascia', 'plaque', 'projecting']);
  expect(additions.find(item => item.wallSignStyle === 'fascia')).toMatchObject({ width: 3.2, sizeHeight: 0.8, lit: true, text: 'CERITA DI JALAN' });
  await button(page, 'Urungkan').click();
  await expect.poll(async () => (await saved(page)).wallItems!.length).toBe(expectedCount - 1);
  await button(page, 'Ulangi').click();
  await expect.poll(() => saved(page)).toEqual(design);
  await button(page, 'Mode malam').click();
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-active-wall-lights'))).toBeGreaterThanOrEqual(3);
  await canvas(page).screenshot({ path: info.outputPath('exterior-night-lamps-signage.png') });
  await button(page, 'Interior').click();
  await expect.poll(async () => (await metadata<Center[]>(page, 'wall-item-centers')).map(item => item.id)).toEqual(['ground-window']);
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  expect(await saved(page)).toEqual(design);
  await button(page, 'Eksterior').click();
  await expect.poll(async () => (await metadata<Center[]>(page, 'wall-item-centers')).length).toBe(expectedCount);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('the entrance can be selected and dragged on front and right exterior walls and stays consistent inside', async ({ page }, info) => {
  test.setTimeout(150_000);
  const errors = await open(page, info);
  const originalCanvas = await canvas(page).elementHandle();
  const verifyNoLoader = await watchLocalEdits(page);
  type Pose = { position: number[]; quaternion: number[]; door: { position: number[] } };
  const doorPoint = async () => {
    await canvas(page).evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
    await expect.poll(() => metadata<{ canvasX: number; canvasY: number } | null>(page, 'door-center')).not.toBeNull();
    const center = await metadata<{ canvasX: number; canvasY: number }>(page, 'door-center');
    const rect = (await canvas(page).boundingBox())!;
    return { x: rect.x + center.canvasX, y: rect.y + center.canvasY };
  };
  const front = await doorPoint();
  if (info.project.name === 'mobile-chromium') await page.touchscreen.tap(front.x, front.y);
  else await page.mouse.click(front.x, front.y);
  await expect(page.getByTestId('door-inspector')).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-door-selected', 'true');
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');

  const dragDoor = async (wall: 'front' | 'right') => {
    const before = getEntrance(await saved(page));
    const start = await doorPoint();
    const targets = await metadata<Target[]>(page, 'wall-targets');
    const a = targets.find(point => point.wall === wall && point.offset === 3 && point.height === 1.5)!;
    const b = targets.find(point => point.wall === wall && point.offset === 4 && point.height === 1.5)!;
    expect(a).toBeDefined(); expect(b).toBeDefined();
    const dx = b.canvasX - a.canvasX, dy = b.canvasY - a.canvasY;
    const beforePose = await metadata<Pose>(page, 'rendered-entrance');
    const touch = info.project.name === 'mobile-chromium' ? await page.context().newCDPSession(page) : null;
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, ...start }] });
    else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
    await expect(canvas(page)).toHaveAttribute('data-interaction', 'door');
    for (let step = 1; step <= 8; step++) {
      const point = { x: start.x + dx * step / 8, y: start.y + dy * step / 8 };
      if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, ...point }] });
      else await page.mouse.move(point.x, point.y);
    }
    await expect.poll(async () => Number(await canvas(page).getAttribute('data-preview-entrance-position'))).toBeGreaterThan(before.position + 0.1);
    const axis = wall === 'front' ? 0 : 2;
    await expect.poll(async () => (await metadata<Pose>(page, 'rendered-entrance')).position[axis]).toBeCloseTo(beforePose.position[axis] + 1, 1);
    if (touch) { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach(); }
    else await page.mouse.up();
    await expect.poll(async () => getEntrance(await saved(page)).position).toBeGreaterThan(before.position + 0.1);
    await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');
    await expect(page.getByTestId('door-inspector')).toBeVisible();
  };

  const initialPosition = getEntrance(await saved(page)).position;
  await dragDoor('front');
  const frontPosition = getEntrance(await saved(page)).position;
  await button(page, 'Urungkan').click();
  await expect.poll(async () => getEntrance(await saved(page)).position).toBe(initialPosition);
  await button(page, 'Ulangi').click();
  await expect.poll(async () => getEntrance(await saved(page)).position).toBe(frontPosition);
  await page.getByLabel('Sisi pintu masuk', { exact: true }).selectOption('right');
  await page.getByLabel('Posisi pintu', { exact: true }).selectOption('0.5');
  await expect.poll(async () => getEntrance(await saved(page))).toMatchObject({ wall: 'right', position: 0.5 });
  await expect(canvas(page)).toHaveAttribute('data-preview-entrance-position', '0.5');
  await expect(canvas(page)).toHaveAttribute('data-entrance-wall', 'right');
  await dragDoor('right');
  await button(page, 'Buka pintu masuk').click();
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-door-angle'))).toBeCloseTo(-Math.PI / 2, 2);
  await button(page, 'Tutup pintu masuk').click();
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-door-angle'))).toBe(0);
  const edited = getEntrance(await saved(page));
  const outsidePose = await metadata<Pose>(page, 'rendered-entrance');
  await verifyNoLoader();
  await button(page, 'Interior').click();
  await expect.poll(() => metadata<Pose>(page, 'rendered-entrance')).toEqual(outsidePose);
  expect(await canvas(page).evaluate((node, original) => node === original, originalCanvas)).toBe(true);
  expect(getEntrance(await saved(page))).toEqual(edited);
  expect((await saved(page)).upperFloors).toEqual(fixture.upperFloors);
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await button(page, 'Eksterior').click();
  await expect.poll(() => metadata<Pose>(page, 'rendered-entrance')).toEqual(outsidePose);
  expect(getEntrance(await saved(page))).toEqual(edited);
  await page.getByLabel('Lantai dekorasi eksterior', { exact: true }).selectOption('1');
  await expect(canvas(page)).toHaveAttribute('data-active-level', '1');
  await expect(canvas(page)).not.toHaveAttribute('data-door-center');
  await expect(canvas(page)).toHaveAttribute('data-door-selected', 'false');
  expect(errors).toEqual([]);
});
