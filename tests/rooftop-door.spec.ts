import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createEmptyShop, type ShopDocument, type ShopItem } from '../src/model';

test.use({ reducedMotion: 'reduce' });
const KEY = 'nemu.store-maker.v1';
const FIRST = 'roof-stairs-a', SECOND = 'roof-stairs-b';
const fixture: ShopDocument = {
  ...createEmptyShop(), name: 'Pintu di Rooftop', width: 8, depth: 7,
  items: [FIRST, SECOND].map((id, index): ShopItem => ({ id, kind: 'stairs', x: index ? 5 : 1, z: 1, rotation: 180, color: '#BB9775', stock: 'none' })),
  roof: { style: 'rooftop', color: '#B96B51', garden: false, stairAccess: 'enclosed' },
  rooftop: { items: [], floorColor: '#D9CBB6' },
};
type Door = { id: string; open: boolean; angle: number; canvasX: number; canvasY: number };
type WatchedCanvas = HTMLElement & { doorLoaderEvents?: string[]; doorLoaderObserver?: MutationObserver };
type AnimatedCanvas = HTMLElement & { doorAngles?: number[]; doorAngleObserver?: MutationObserver };
const canvas = (page: Page) => page.locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const control = (page: Page, id: string) => page.getByRole('group', { name: 'Pintu akses rooftop', exact: true }).locator(`button[data-rooftop-door-id="${id}"]`);
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
const doors = async (page: Page): Promise<Door[]> => JSON.parse(await canvas(page).getAttribute('data-rooftop-doors') || '[]');

async function ready(page: Page) {
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.shop-canvas')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('scene-loading')).toHaveCSS('opacity', '0');
}

async function expectDoor(page: Page, id: string, open: boolean) {
  await expect.poll(async () => (await doors(page)).find(door => door.id === id)?.open).toBe(open);
  await expect.poll(async () => (await doors(page)).find(door => door.id === id)?.angle).toBeCloseTo(open ? Math.PI / 2 : 0, 4);
  await expect.poll(async () => (await saved(page)).roof?.stairDoors?.[id] === true).toBe(open);
}

async function tapDoor(page: Page, info: TestInfo, id: string) {
  await canvas(page).evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const door = (await doors(page)).find(candidate => candidate.id === id)!;
  expect(door).toBeDefined();
  const rect = (await canvas(page).boundingBox())!;
  expect(door.canvasX).toBeGreaterThan(0); expect(door.canvasX).toBeLessThan(rect.width);
  expect(door.canvasY).toBeGreaterThan(0); expect(door.canvasY).toBeLessThan(rect.height);
  const point = { x: rect.x + door.canvasX, y: rect.y + door.canvasY };
  if (info.project.name === 'mobile-chromium') await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

async function watchDoorUpdates(page: Page, mode: 'exterior' | 'rooftop') {
  await ready(page);
  const contextAttribute = `data-${mode}-context-id`;
  const context = await canvas(page).getAttribute(contextAttribute);
  expect(context).toBeTruthy();
  await page.locator('.shop-canvas').evaluate(root => {
    const watch = root as WatchedCanvas;
    watch.doorLoaderEvents = [];
    watch.doorLoaderObserver = new MutationObserver(records => {
      for (const record of records) {
        const target = record.target as HTMLElement;
        if (target === root && record.attributeName === 'aria-busy'
          && (record.oldValue === 'true' || target.getAttribute('aria-busy') === 'true')) watch.doorLoaderEvents!.push('busy');
        if (target.dataset.testid === 'scene-loading' && record.attributeName === 'class'
          && (record.oldValue?.split(' ').includes('is-loading') || target.classList.contains('is-loading'))) watch.doorLoaderEvents!.push('veil');
      }
    });
    watch.doorLoaderObserver.observe(root, { attributes: true, subtree: true, attributeOldValue: true, attributeFilter: ['aria-busy', 'class'] });
  });
  return async () => {
    await ready(page);
    const events = await page.locator('.shop-canvas').evaluate(root => {
      const watch = root as WatchedCanvas;
      watch.doorLoaderObserver!.disconnect();
      return watch.doorLoaderEvents;
    });
    expect(events, 'Opening a rooftop door must not trigger the view loader').toEqual([]);
    await expect(canvas(page)).toHaveAttribute(contextAttribute, context!);
  };
}

async function capture(page: Page, info: TestInfo, pose: string) {
  await ready(page);
  await canvas(page).evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.screenshot({ path: `artifacts/rooftop-doors-${pose}-${info.project.name}.png`, clip: (await canvas(page).boundingBox())!, timeout: 30_000 });
}

async function watchAnimation(page: Page, id: string) {
  await canvas(page).evaluate((node, id) => {
    const watch = node as AnimatedCanvas;
    watch.doorAngles = [];
    const sample = (value: string | null) => {
      const door = (JSON.parse(value || '[]') as Door[]).find(door => door.id === id);
      if (door) watch.doorAngles!.push(door.angle);
    };
    watch.doorAngleObserver = new MutationObserver(records => {
      records.forEach(record => sample(record.oldValue));
      sample(node.getAttribute('data-rooftop-doors'));
    });
    watch.doorAngleObserver.observe(node, { attributes: true, attributeFilter: ['data-rooftop-doors'], attributeOldValue: true });
  }, id);
  return () => canvas(page).evaluate(node => {
    const watch = node as AnimatedCanvas;
    watch.doorAngleObserver!.disconnect();
    return watch.doorAngles!;
  });
}

test('rooftop enclosure doors open independently by button and 3D pointer, persist, and reuse the scene', async ({ page }, info) => {
  test.setTimeout(150_000);
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ key, doc }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc));
    localStorage.setItem('nemu.store-maker.time-mode', 'day');
  }, { key: KEY, doc: fixture });
  await page.goto('/');
  await ready(page);
  await button(page, 'Eksterior').click();
  await ready(page);
  await expect.poll(async () => (await doors(page)).map(door => door.id).sort()).toEqual([FIRST, SECOND]);
  await expectDoor(page, FIRST, false);
  await expectDoor(page, SECOND, false);
  expect((await saved(page)).roof).not.toHaveProperty('stairDoors');
  await expect(control(page, FIRST)).toHaveAccessibleName('Buka pintu rooftop 1');
  await capture(page, info, 'closed');

  const exteriorStayedReady = await watchDoorUpdates(page, 'exterior');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const animationAngles = await watchAnimation(page, FIRST);
  await control(page, FIRST).click();
  await expectDoor(page, FIRST, true);
  expect((await animationAngles()).some(angle => angle > 0.01 && angle < Math.PI / 2 - 0.01)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectDoor(page, SECOND, false);
  await expect(control(page, FIRST)).toHaveAccessibleName('Tutup pintu rooftop 1');
  await capture(page, info, 'first-open');
  await tapDoor(page, info, FIRST);
  await expectDoor(page, FIRST, false);
  await tapDoor(page, info, FIRST);
  await expectDoor(page, FIRST, true);
  await control(page, SECOND).click();
  await expectDoor(page, SECOND, true);
  await expectDoor(page, FIRST, true);
  await button(page, 'Urungkan').click();
  await expectDoor(page, SECOND, false);
  await expectDoor(page, FIRST, true);
  await button(page, 'Ulangi').click();
  await expectDoor(page, SECOND, true);
  await exteriorStayedReady();

  await button(page, 'Edit rooftop').click();
  await ready(page);
  await expect(canvas(page)).toHaveAttribute('data-rooftop-only', 'true');
  await expectDoor(page, FIRST, true);
  await expectDoor(page, SECOND, true);
  const rooftopStayedReady = await watchDoorUpdates(page, 'rooftop');
  await tapDoor(page, info, FIRST);
  await expectDoor(page, FIRST, false);
  await expectDoor(page, SECOND, true);
  await rooftopStayedReady();
  const edited = await saved(page);
  expect(edited.roof?.stairDoors).toEqual({ [SECOND]: true });
  await page.reload();
  await ready(page);
  expect(await saved(page)).toEqual(edited);
  await button(page, 'Eksterior').click();
  await ready(page);
  await expectDoor(page, FIRST, false);
  await expectDoor(page, SECOND, true);

  await button(page, 'Lihat tokoku').click();
  await ready(page);
  await tapDoor(page, info, FIRST);
  await expectDoor(page, FIRST, true);
  await tapDoor(page, info, FIRST);
  await expectDoor(page, FIRST, false);
  await button(page, 'Kembali ngatur').click();

  await button(page, 'Edit rooftop').click();
  await ready(page);
  await button(page, 'Terbuka').click();
  await expect.poll(() => doors(page)).toEqual([]);
  await expect(page.getByRole('group', { name: 'Pintu akses rooftop', exact: true })).toHaveCount(0);
  await button(page, 'Berdinding & beratap').click();
  await expectDoor(page, FIRST, false);
  await expectDoor(page, SECOND, true);
  expect(errors).toEqual([]);
});
