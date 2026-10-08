import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createInitialShop, type ShopDocument } from '../src/model';

test.use({ reducedMotion: 'reduce' });
const KEY = 'nemu.store-maker.v1';
const canvas = (page: Page) => page.locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const rendered = async (page: Page, attribute: string) => JSON.parse(await canvas(page).getAttribute(`data-rendered-${attribute}`) || 'null');
async function open(page: Page, info: TestInfo, doc: ShopDocument) {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1050 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: KEY, doc });
  await page.goto('/');
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  return errors;
}
async function mode(page: Page, exterior: boolean) {
  await button(page, exterior ? 'Eksterior' : 'Interior').click();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', String(exterior));
}

test('the original doorway survives exterior view without invented windows, including after moving and hiding its canopy', async ({ page }, info) => {
  test.setTimeout(120_000);
  const doc = createInitialShop();
  delete doc.upperFloors;
  doc.items = doc.items.filter(item => item.kind !== 'stairs' && item.kind !== 'bathroom');
  doc.wallItems = [];
  const errors = await open(page, info, doc);
  const entrance = await rendered(page, 'entrance');
  expect(entrance.canopy).toBe(true);
  await canvas(page).screenshot({ path: info.outputPath('original-interior.png') });
  await mode(page, true);
  expect(await rendered(page, 'entrance')).toEqual(entrance);
  expect(await rendered(page, 'windows')).toEqual([]);
  await canvas(page).screenshot({ path: info.outputPath('same-door-no-extra-windows.png') });
  await button(page, 'Warna fasad 2').click();
  await button(page, 'Warna lis fasad 3').click();
  expect(await rendered(page, 'entrance')).toEqual(entrance);
  await page.getByLabel('Kanopi toko', { exact: true }).uncheck();
  await expect.poll(() => rendered(page, 'entrance')).toEqual({ ...entrance, canopy: false });
  await mode(page, false);
  expect(await rendered(page, 'entrance')).toEqual({ ...entrance, canopy: false });
  await button(page, 'Bangun ruangan').click();
  await button(page, 'Atur dinding dan pintu').click();
  await page.getByLabel('Posisi pintu', { exact: true }).selectOption('0.25');
  const moved = await rendered(page, 'entrance');
  expect(moved.position).not.toEqual(entrance.position);
  await mode(page, true);
  expect(await rendered(page, 'entrance')).toEqual(moved);
  expect(await rendered(page, 'windows')).toEqual([]);
  await canvas(page).screenshot({ path: info.outputPath('moved-door-without-canopy.png') });
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await mode(page, true);
  expect(await rendered(page, 'entrance')).toEqual(moved);
  expect(errors).toEqual([]);
});

test('saved windows keep their rendered size, style and position outside, and deletion removes the exterior window', async ({ page }, info) => {
  test.setTimeout(120_000);
  const doc: ShopDocument = {
    version: 2, name: 'Toko Jendela', width: 8, depth: 7, wallHeight: 3.5,
    wallColor: '#F4EEDF', floorColor: '#DCC5A9', items: [],
    wallItems: [{ id: 'window-a', kind: 'window', wall: 'back', line: 0, offset: 3.5, height: 1.6, color: '#b89470', text: '', lit: false, width: 2.4, sizeHeight: 1.8 }],
  };
  const errors = await open(page, info, doc);
  const original = await rendered(page, 'windows');
  expect(original).toHaveLength(1);
  await mode(page, true);
  expect(await rendered(page, 'windows')).toEqual(original);
  await mode(page, false);
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption('wall:window-a');
  await button(page, 'Jendela Lengkung').click();
  await button(page, 'Ubah ukuran aksesori').click();
  await page.getByLabel('Panjang aksesori', { exact: true }).fill('3.2');
  await page.getByLabel('Panjang aksesori', { exact: true }).press('Enter');
  await page.getByLabel('Dinding aksesori', { exact: true }).selectOption('left:0:0:7');
  await expect.poll(async () => (await rendered(page, 'windows'))[0].position).not.toEqual(original[0].position);
  const edited = await rendered(page, 'windows');
  expect(edited[0].style).toBe('arched');
  expect(edited[0].position).not.toEqual(original[0].position);
  await mode(page, true);
  expect(await rendered(page, 'windows')).toEqual(edited);
  await mode(page, false);
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption('wall:window-a');
  await button(page, 'Hapus aksesori').click();
  await mode(page, true);
  expect(await rendered(page, 'windows')).toEqual([]);
  await mode(page, false);
  await button(page, 'Urungkan').click();
  await mode(page, true);
  expect(await rendered(page, 'windows')).toEqual(edited);
  expect(errors).toEqual([]);
});
