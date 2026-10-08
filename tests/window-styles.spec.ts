import { expect, test, type Page } from '@playwright/test';
import type { ShopDocument } from '../src/model';

const KEY = 'nemu.store-maker.v1';
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
const styles = [
  ['classic', 'Klasik'], ['picture', 'Panoramik'], ['grid', 'Kisi-kisi'], ['sliding', 'Geser'], ['arched', 'Lengkung'],
] as const;
const fixture: ShopDocument = {
  version: 2, name: 'Studio Jendela', width: 8, depth: 7, wallHeight: 3.5,
  wallColor: '#F4EEDF', floorColor: '#DCC5A9', items: [],
  wallItems: [{ id: 'window-a', kind: 'window', wall: 'back', line: 0, offset: 3.5, height: 1.6, color: '#b89470', text: '', lit: false, width: 2.4, sizeHeight: 1.8 }],
};

test('window variations preserve the layout and survive resizing, copying, undo and reload', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  if (testInfo.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: KEY, doc: fixture });
  await page.goto('/');
  const canvas = page.getByTestId('scene').locator('canvas[data-renderer="webgl"]');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Pilih barang di toko', { exact: true }).selectOption('wall:window-a');
  await expect(page.getByRole('group', { name: 'Variasi jendela', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jendela Klasik', exact: true })).toHaveAttribute('aria-pressed', 'true');

  for (const [style, label] of styles.slice(1)) {
    await page.getByRole('button', { name: `Jendela ${label}`, exact: true }).click();
    await expect(page.getByRole('button', { name: `Jendela ${label}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await saved(page)).wallItems?.[0]).toEqual({ ...fixture.wallItems![0], windowStyle: style });
    await expect.poll(async () => JSON.parse(await canvas.getAttribute('data-window-openings') || '[]')[0]?.windowStyle).toBe(style);
  }
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect.poll(async () => (await saved(page)).wallItems?.[0].windowStyle).toBe('sliding');
  await page.getByRole('button', { name: 'Ulangi', exact: true }).click();
  await page.getByRole('button', { name: 'Ubah ukuran aksesori', exact: true }).click();
  await page.getByLabel('Panjang aksesori', { exact: true }).fill('3.2');
  await page.getByLabel('Panjang aksesori', { exact: true }).press('Enter');
  await page.getByLabel('Tinggi aksesori', { exact: true }).fill('2.2');
  await page.getByLabel('Tinggi aksesori', { exact: true }).press('Enter');
  await expect.poll(async () => (await saved(page)).wallItems?.[0]).toMatchObject({ width: 3.2, sizeHeight: 2.2, windowStyle: 'arched' });
  await page.getByLabel('Dinding aksesori', { exact: true }).selectOption('left:0:0:7');
  await expect.poll(async () => (await saved(page)).wallItems?.[0]).toMatchObject({ wall: 'left', windowStyle: 'arched', width: 3.2 });

  await page.screenshot({ path: `artifacts/window-styles-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Duplikat aksesori', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Jendela Lengkung', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Jendela Geser', exact: true }).click();
  await expect.poll(async () => (await saved(page)).wallItems?.length).toBe(1);
  await page.getByRole('button', { name: 'Pasang di sini', exact: true }).click();
  await expect.poll(async () => (await saved(page)).wallItems?.length).toBe(2);
  const after = (await saved(page)).wallItems!;
  expect(after[0]).toMatchObject({ id: 'window-a', windowStyle: 'arched', width: 3.2, sizeHeight: 2.2 });
  expect(after[1]).toMatchObject({ windowStyle: 'sliding', width: 3.2, sizeHeight: 2.2 });
  await page.reload();
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect.poll(async () => (await saved(page)).wallItems).toEqual(after);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
