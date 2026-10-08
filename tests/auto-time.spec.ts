import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { ShopDocument } from '../src/model';

// Software WebGL can need several frames for Playwright's stability checks.
test.use({ actionTimeout: 20_000 });

const DESIGN_KEY = 'nemu.store-maker.v1';
const MODE_KEY = 'nemu.store-maker.time-mode';
const EPOCH_KEY = 'nemu.store-maker.day-night-epoch';
const START = Date.UTC(2026, 9, 8, 12);
const PHASE = 20 * 60_000;
const canvas = (page: Page) => page.getByTestId('scene').locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const clock = (page: Page) => page.getByTestId('game-clock');
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), DESIGN_KEY);
const preference = (page: Page) => page.evaluate(key => localStorage.getItem(key), MODE_KEY);
const clockHands = (page: Page): Promise<{ id: string; hour: number; minute: number }[]> =>
  canvas(page).evaluate(node => JSON.parse((node as HTMLElement).dataset.clockHands!));

async function open(page: Page, info: TestInfo) {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Only Date is fixed: animation frames, music, and lighting transitions still run.
  await page.clock.setFixedTime(new Date(START));
  await page.goto('/');
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.shop-canvas')).toHaveAttribute('aria-busy', 'false');
  await expect.poll(() => saved(page)).not.toBeNull();
  return errors;
}

async function expectLight(page: Page, night: boolean) {
  await expect(button(page, 'Mode malam')).toHaveAttribute('aria-pressed', String(night));
  await expect(canvas(page)).toHaveAttribute('data-lighting-mode', night ? 'night' : 'day');
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-night-progress'))).toBe(night ? 1 : 0);
}

async function chooseMode(page: Page, label: string) {
  await button(page, 'Atur siang dan malam').click();
  await expect(page.getByRole('dialog', { name: 'Waktu toko' })).toBeVisible();
  await button(page, label).click();
  await expect(page.getByRole('dialog', { name: 'Waktu toko' })).toHaveCount(0);
}

test('the forty-minute game cycle updates both clocks and sends the crowd home without changing the design', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors = await open(page, info);
  const originalCanvas = await canvas(page).elementHandle();
  const design = await saved(page);
  const target = await canvas(page).getAttribute('data-camera-target');
  await expect(clock(page)).toHaveText('06:00');
  await expect(canvas(page)).toHaveAttribute('data-game-minutes', '360');
  await expect.poll(() => preference(page)).toBe('auto');
  await expectLight(page, false);
  const handsBefore = await clockHands(page);
  expect(handsBefore.length).toBeGreaterThan(0);
  expect(handsBefore.every(hand => Number.isFinite(hand.hour) && Number.isFinite(hand.minute))).toBe(true);

  await page.clock.setFixedTime(new Date(START + 2000));
  await expect(clock(page)).toHaveText('06:01');
  await expect(canvas(page)).toHaveAttribute('data-game-minutes', '361');
  await expect.poll(async () => (await clockHands(page)).find(hand => hand.id === handsBefore[0].id)?.minute).not.toBe(handsBefore[0].minute);
  await expect.poll(async () => (await clockHands(page)).find(hand => hand.id === handsBefore[0].id)?.hour).not.toBe(handsBefore[0].hour);

  await page.clock.setFixedTime(new Date(START + PHASE));
  await expect(clock(page)).toHaveText('18:00');
  await expectLight(page, true);
  await expect(canvas(page)).toHaveAttribute('data-pedestrian-phase', 'home', { timeout: 30_000 });
  await expect(canvas(page)).toHaveAttribute('data-visible-pedestrians', '0');
  await canvas(page).screenshot({ path: `artifacts/autogame-night-${info.project.name}.png` });
  await page.clock.setFixedTime(new Date(START + PHASE * 2));
  await expect(clock(page)).toHaveText('06:00');
  await expectLight(page, false);
  await expect(canvas(page)).toHaveAttribute('data-pedestrian-phase', 'outside', { timeout: 30_000 });
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-visible-pedestrians'))).toBeGreaterThan(0);
  await canvas(page).screenshot({ path: `artifacts/autogame-day-${info.project.name}.png` });

  expect(await saved(page)).toEqual(design);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  await expect(button(page, 'Ulangi')).toBeDisabled();
  await expect(canvas(page)).toHaveAttribute('data-camera-target', target!);
  expect(await canvas(page).evaluate((node, original) => node === original, originalCanvas)).toBe(true);
  expect(errors).toEqual([]);
});

test('automatic time resumes its saved cycle after manual overrides, view changes and reloads', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors = await open(page, info);
  const design = await saved(page);
  const originalEpoch = await page.evaluate(key => localStorage.getItem(key), EPOCH_KEY);
  await page.clock.setFixedTime(new Date(START + PHASE));
  await expect(clock(page)).toHaveText('18:00');
  await chooseMode(page, 'Selalu siang');
  await expect(clock(page)).toHaveText('12:00');
  await expectLight(page, false);
  await expect.poll(() => preference(page)).toBe('day');
  await button(page, 'Eksterior').click();
  await expect(canvas(page)).toHaveAttribute('data-exterior-only', 'true');
  await expect(clock(page)).toHaveText('12:00');
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(clock(page)).toHaveText('12:00');
  await expectLight(page, false);
  await chooseMode(page, 'Waktu otomatis');
  await expect(clock(page)).toHaveText('18:00');
  await expectLight(page, true);
  await chooseMode(page, 'Selalu malam');
  await expect(clock(page)).toHaveText('22:00');
  await page.clock.setFixedTime(new Date(START + PHASE * 2));
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(clock(page)).toHaveText('22:00');
  await expectLight(page, true);
  await expect.poll(() => preference(page)).toBe('night');
  await chooseMode(page, 'Waktu otomatis');
  await expect(clock(page)).toHaveText('06:00');
  await expectLight(page, false);
  expect(await page.evaluate(key => localStorage.getItem(key), EPOCH_KEY)).toBe(originalEpoch);
  expect(await saved(page)).toEqual(design);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('time controls fit a narrow canvas and the picker supports keyboard dismissal', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors = await open(page, info);
  if (info.project.name === 'mobile-chromium') await page.setViewportSize({ width: 320, height: 844 });
  const scene = page.getByTestId('scene');
  const before = (await scene.boundingBox())!;
  await button(page, 'Mode malam').click();
  await expect(clock(page)).toHaveText('22:00');
  await button(page, 'Atur siang dan malam').click();
  const dialog = page.getByRole('dialog', { name: 'Waktu toko' });
  await expect(button(page, 'Selalu malam')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Selalu malam')).toBeFocused();
  const dialogRect = (await dialog.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(dialogRect.x).toBeGreaterThanOrEqual(0);
  expect(dialogRect.x + dialogRect.width).toBeLessThanOrEqual(viewport.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const after = (await scene.boundingBox())!;
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
  await scene.screenshot({ path: info.outputPath('game-clock-picker.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(button(page, 'Atur siang dan malam')).toBeFocused();
  await chooseMode(page, 'Waktu otomatis');
  await expect(clock(page)).toHaveText('06:00');
  expect(errors).toEqual([]);
});
