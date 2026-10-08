import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createEmptyShop, type ShopDocument, type ShopItem } from '../src/model';

test.use({ reducedMotion: 'reduce' });
const KEY = 'nemu.store-maker.v1';
const canvas = (page: Page) => page.locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
const data = async <T>(page: Page, key: string): Promise<T> => JSON.parse(await canvas(page).getAttribute(`data-${key}`) || 'null');
type Rail = { stairId: string; minX: number; maxX: number; minZ: number; maxZ: number };

function fixture(): ShopDocument {
  const floor = () => ({ ...createEmptyShop(), width: 10, depth: 9 });
  return {
    ...floor(), name: 'Sambungan tangga',
    items: [{ id: 'lower-flight', kind: 'stairs', x: 1, z: 2, rotation: 0, color: '#BB9775', stock: 'none', depth: 4 }],
    upperFloors: [floor(), floor()],
  };
}

async function ready(page: Page) {
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.shop-canvas')).toHaveAttribute('aria-busy', 'false');
  await expect.poll(() => page.locator('.scene-loading').evaluate(node => getComputedStyle(node).opacity)).toBe('0');
}

async function open(page: Page, info: TestInfo) {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1050 });
  await page.addInitScript(({ key, doc }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc));
  }, { key: KEY, doc: fixture() });
  await page.goto('/');
  await ready(page);
  await button(page, 'Edit lantai 2').click();
  await ready(page);
}

async function placeAt(page: Page, x: number, z: number) {
  await page.getByLabel('Petak X', { exact: true }).selectOption({ value: String(x) });
  await page.getByLabel('Petak Y', { exact: true }).selectOption({ value: String(z) });
  await expect(button(page, 'Letakkan di sini')).toBeEnabled();
  await button(page, 'Letakkan di sini').click();
  await ready(page);
}

async function stairs(page: Page): Promise<ShopItem[]> {
  return (await saved(page)).upperFloors![0].items.filter(item => item.kind === 'stairs');
}

async function expectOpenApproach(page: Page) {
  // The lower 4-cell flight creates a hole ending at z=1.1. The upper
  // 3-cell flight begins at z=0.5, so its approach crosses that front edge.
  // Check actual rendered guards, rather than inferring a join from the model.
  await expect.poll(async () => {
    const rails = await data<Rail[]>(page, 'landing-rails');
    if (!rails) return -1;
    return rails.filter(rail => rail.stairId === 'lower-flight'
      && rail.minX < -2.15 && rail.maxX > -3.85
      && rail.minZ < 1.3 && rail.maxZ > 0.5).length;
  }).toBe(0);
  await expect.poll(async () => {
    const bridges = await data<Rail[]>(page, 'stair-bridges');
    return bridges?.some(bridge => bridge.stairId === 'lower-flight'
      && bridge.minX < -3.5 && bridge.maxX > -3.5
      && bridge.minZ < 0.7 && bridge.maxZ > 1.09) ?? false;
  }).toBe(true);
  await expectSideGuards(page);
}

async function expectSideGuards(page: Page) {
  // Sample both ends and the middle of both long edges. The front bridge
  // must not remove either side guard along with the obstructing entry rail.
  await expect.poll(async () => {
    const rails = (await data<Rail[]>(page, 'landing-rails'))?.filter(rail => rail.stairId === 'lower-flight') ?? [];
    return [-3.975, -2.025].every(x => [-2.3, -0.66, 0.98].every(z =>
      rails.some(rail => rail.minX < x && rail.maxX > x && rail.minZ < z && rail.maxZ > z)));
  }).toBe(true);
}

test('stair joins preserve both side guards and clear only the entry after edits', async ({ page }, info) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page, info);
  const baseline = await data<Rail[]>(page, 'landing-rails');
  expect(baseline.length).toBeGreaterThan(0);
  expect(await data<Rail[]>(page, 'stair-bridges')).toEqual([]);

  await page.getByTestId('catalog-stairs').click();
  await placeAt(page, 1, 2);
  await expect.poll(async () => (await stairs(page))[0]).toMatchObject({ x: 1, z: 2 });
  const upper = (await stairs(page))[0];
  await expectOpenApproach(page);
  await canvas(page).evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  if (info.project.name === 'chromium') {
    const box = (await canvas(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -500);
  }
  if (await button(page, 'Mode malam').getAttribute('aria-pressed') !== 'false') await button(page, 'Mode malam').click();
  await expect(canvas(page)).toHaveAttribute('data-night-progress', '0');
  await page.screenshot({ path: info.outputPath('shorter-upper-flight-side-guards-day.png'), clip: (await canvas(page).boundingBox())!, timeout: 30_000 });
  await button(page, 'Mode malam').click();
  await expect(canvas(page)).toHaveAttribute('data-night-progress', '1');
  await expectOpenApproach(page);
  await page.screenshot({ path: info.outputPath('shorter-upper-flight-side-guards-night.png'), clip: (await canvas(page).boundingBox())!, timeout: 30_000 });
  await button(page, 'Mode malam').click();
  await expect(canvas(page)).toHaveAttribute('data-night-progress', '0');
  if (info.project.name === 'chromium') await button(page, 'Kamera perspektif').click();

  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption(upper.id);
  await button(page, 'Pindahkan barang').click();
  await placeAt(page, 5, 2);
  await expect.poll(async () => (await stairs(page))[0].x).toBe(5);
  await expect.poll(() => data<Rail[]>(page, 'landing-rails')).toEqual(baseline);
  expect(await data<Rail[]>(page, 'stair-bridges')).toEqual([]);
  await button(page, 'Urungkan').click();
  await expect.poll(async () => (await stairs(page))[0].x).toBe(1);
  await expectOpenApproach(page);

  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption(upper.id);
  await button(page, 'Ubah ukuran barang').click();
  await page.getByLabel('Kedalaman barang', { exact: true }).fill('4');
  await page.getByLabel('Kedalaman barang', { exact: true }).press('Enter');
  await expect.poll(async () => (await stairs(page))[0].depth).toBe(4);
  await expectSideGuards(page);
  await expect.poll(() => data<Rail[]>(page, 'stair-bridges')).toEqual([]);
  await page.getByLabel('Kedalaman barang', { exact: true }).fill('3');
  await page.getByLabel('Kedalaman barang', { exact: true }).press('Enter');
  await expect.poll(async () => (await stairs(page))[0].depth).toBe(3);
  await expectOpenApproach(page);

  await button(page, 'Hapus barang').click();
  await expect.poll(() => data<Rail[]>(page, 'landing-rails')).toEqual(baseline);
  expect(await data<Rail[]>(page, 'stair-bridges')).toEqual([]);
  await button(page, 'Urungkan').click();
  await expectOpenApproach(page);
  const design = await saved(page);
  await page.reload();
  await ready(page);
  await button(page, 'Edit lantai 2').click();
  await ready(page);
  expect(await saved(page)).toEqual(design);
  await expectOpenApproach(page);
  const joinedRails = await data<Rail[]>(page, 'landing-rails');
  const joinedBridges = await data<Rail[]>(page, 'stair-bridges');
  await button(page, 'Eksterior').click();
  await ready(page);
  await expect(canvas(page)).toHaveAttribute('data-active-level', '1');
  expect(await data<Rail[]>(page, 'landing-rails')).toEqual(joinedRails);
  expect(await data<Rail[]>(page, 'stair-bridges')).toEqual(joinedBridges);
  await button(page, 'Interior').click();
  await ready(page);
  await expectOpenApproach(page);
  expect(errors).toEqual([]);
});
