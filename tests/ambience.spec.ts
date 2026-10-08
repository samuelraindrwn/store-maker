import { chromium, expect, test, type CDPSession, type Page, type TestInfo } from '@playwright/test';
import type { ShopDocument } from '../src/model';

const SHOP_KEY = 'nemu.store-maker.v1';
const VOLUME_KEY = 'store-maker.ambience-volume';
const TRACK_KEY = 'store-maker.ambience-track';
const SOFTWARE_GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
// Unlike user-gesture-required (cross-origin WebAudio only), this policy also
// blocks a top-level AudioContext until the document receives activation.
// Trace/screenshot hooks evaluate with userGesture:true, which would themselves
// unlock this policy. Explicit screenshots in the allowed case remain enabled.
test.use({ trace: 'off', screenshot: 'off', launchOptions: { args: [...SOFTWARE_GL, '--enable-automation', '--autoplay-policy=document-user-activation-required', '--disable-blink-features=AutoplayIgnoresWebAudio', '--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies'] } });
type SourceProbe = { source: AudioBufferSourceNode; starts: number; stops: number };
type AudioProbe = { contexts: AudioContext[]; meters: AnalyserNode[]; sources: SourceProbe[]; retainedLoop?: SourceProbe };
type ProbeWindow = Window & { __cozyAudioProbe: AudioProbe };
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const canvasFor = (page: Page) => page.getByTestId('scene').locator('canvas[data-renderer="webgl"]');
const sessions = new WeakMap<Page, CDPSession>();
// Playwright's normal evaluate/locator assertions use userGesture:true. Do not
// let observation itself unlock the native autoplay policy being tested.
async function withoutGesture<T, A = undefined>(page: Page, action: (arg: A) => T, arg?: A): Promise<T> {
  let session = sessions.get(page);
  if (!session) { session = await page.context().newCDPSession(page); sessions.set(page, session); }
  const result = await session.send('Runtime.evaluate', {
    expression: `(${action.toString()})(${arg === undefined ? 'undefined' : JSON.stringify(arg)})`,
    userGesture: false, returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value as T;
}
const saved = (page: Page): Promise<ShopDocument> => withoutGesture(page, key => JSON.parse(localStorage.getItem(key)!), SHOP_KEY);

async function audioState(page: Page) {
  return withoutGesture(page, () => {
    const probe = (window as unknown as ProbeWindow).__cozyAudioProbe;
    let rms = 0;
    for (const meter of probe.meters) {
      if (meter.context.state !== 'running') continue;
      const samples = new Float32Array(meter.fftSize);
      meter.getFloatTimeDomainData(samples);
      rms = Math.max(rms, Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length));
    }
    // React StrictMode may dispose its first effect's context. Only live
    // contexts and live signal matter for playback/resource assertions.
    const contexts = probe.contexts.filter(context => context.state !== 'closed');
    return { count: contexts.length, states: contexts.map(context => context.state), rms };
  });
}

async function expectPlaying(page: Page) {
  await expect(button(page, 'Jeda musik cozy')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.ambience-control')).toHaveClass(/is-playing/);
  await expect.poll(async () => (await audioState(page)).states).toEqual(['running']);
  // Inspect real samples downstream of the app's master gain, not a mocked
  // oscillator or a promise that merely reports successful playback.
  await expect.poll(async () => (await audioState(page)).rms).toBeGreaterThan(0.000001);
}

async function openApp(page: Page, info: TestInfo) {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1560, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Disposable Playwright contexts preserve the user's real browser profile.
  // Retain the actual native AudioContext and native output connection. A silent
  // parallel analyser branch makes the existing signal measurable, not audible
  // twice, and never starts or replaces the app's audio.
  await page.addInitScript(() => {
    const probe: AudioProbe = { contexts: [], meters: [], sources: [] };
    (window as unknown as ProbeWindow).__cozyAudioProbe = probe;
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class ObservedAudioContext extends NativeAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        probe.contexts.push(this);
      }
      createBufferSource() {
        const source = super.createBufferSource();
        const observed = { source, starts: 0, stops: 0 };
        probe.sources.push(observed);
        const start = source.start.bind(source), stop = source.stop.bind(source);
        source.start = (...args: [number?, number?, number?]) => { observed.starts++; start(...args); };
        source.stop = (...args: [number?]) => { observed.stops++; stop(...args); };
        return source;
      }
    };
    const originalConnect = AudioNode.prototype.connect;
    const tapped = new WeakSet<AudioNode>();
    AudioNode.prototype.connect = function (...args: unknown[]) {
      const result = Reflect.apply(originalConnect, this, args);
      if (args[0] === this.context.destination && !tapped.has(this)) {
        tapped.add(this);
        const meter = this.context.createAnalyser();
        meter.fftSize = 2048;
        meter.smoothingTimeConstant = 0;
        const silent = this.context.createGain();
        silent.gain.value = 0;
        Reflect.apply(originalConnect, this, [meter]);
        Reflect.apply(originalConnect, meter, [silent]);
        Reflect.apply(originalConnect, silent, [this.context.destination]);
        probe.meters.push(meter);
      }
      return result;
    } as typeof originalConnect;
  });
  await page.goto('/');
  await expect.poll(() => withoutGesture(page, () => document.querySelector<HTMLCanvasElement>('canvas[data-renderer="webgl"]')?.dataset.ready)).toBe('true');
  return errors;
}

async function pointerOn(page: Page, selector: string) {
  const point = await withoutGesture(page, selector => {
    const target = document.querySelector(selector)!;
    target.scrollIntoView({ block: 'nearest' });
    const bounds = target.getBoundingClientRect();
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, touch: navigator.maxTouchPoints > 0 };
  }, selector);
  if (point.touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}
const outsidePointer = (page: Page) => pointerOn(page, '.main-header a');

async function expectWaiting(page: Page) {
  await expect.poll(() => withoutGesture(page, () => ({
    label: document.querySelector('.ambience-play')?.getAttribute('aria-label'),
    enabled: document.querySelector('.ambience-play')?.getAttribute('aria-pressed'),
    playing: document.querySelector('.ambience-control')?.classList.contains('is-playing'),
    bars: document.querySelectorAll('.ambience-bars').length,
  }))).toEqual({ label: 'Matikan musik cozy', enabled: 'true', playing: false, bars: 0 });
  await expect.poll(async () => (await audioState(page)).states).toEqual(['suspended']);
  expect((await audioState(page)).rms).toBe(0);
}

test.describe('allowed autoplay', () => {
test('music autoplays with real audio, preserves volume and editor behavior, and starts again on reload', async ({ baseURL, viewport, deviceScaleFactor, isMobile, hasTouch, userAgent }, info) => {
  test.setTimeout(120_000);
  // Launch policy is a worker-level setting in Playwright. This one isolated
  // native browser covers the allowed policy without changing shared config.
  const browser = await chromium.launch({ args: [...SOFTWARE_GL, '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ baseURL, viewport, deviceScaleFactor, isMobile, hasTouch, userAgent });
  const page = await context.newPage();
  try {
  const errors = await openApp(page, info);
  // No click or key has occurred: browser permission is the only difference
  // between this case and the policy-blocked cases below.
  await expectPlaying(page);
  const original = await saved(page);
  await expect(button(page, 'Urungkan')).toBeDisabled();

  await button(page, 'Atur musik dan volume').click();
  const volume = page.getByRole('slider', { name: 'Volume musik', exact: true });
  const track = page.getByRole('combobox', { name: 'Pilihan musik', exact: true });
  await expect(track).toHaveValue('cheerful');
  await expect(volume).toHaveValue('35');
  for (let step = 0; step < 5; step++) await volume.press('ArrowRight');
  await expect(volume).toHaveValue('40');
  await expect.poll(() => page.evaluate(key => Number(localStorage.getItem(key)), VOLUME_KEY)).toBe(0.4);
  await track.selectOption('calm');
  await expectPlaying(page);
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), TRACK_KEY)).toBe('calm');
  await expect(volume).toHaveValue('40');
  await track.selectOption('cheerful');
  await expectPlaying(page);
  await track.selectOption('calm');
  await expectPlaying(page);
  expect((await audioState(page)).count).toBe(1);
  await volume.press('Escape');
  await expect(volume).toHaveCount(0);
  await button(page, 'Atur musik dan volume').click();
  await expect(volume).toHaveValue('40');
  // On phones the popover legitimately covers the name field below it; the
  // brand link above the popover is an actual, unobstructed outside target.
  await page.getByRole('link', { name: 'Store Maker', exact: true }).click();
  await expect(volume).toHaveCount(0);
  expect((await audioState(page)).count).toBe(1);
  expect(await saved(page)).toEqual(original);
  await expect(button(page, 'Urungkan')).toBeDisabled();

  await expectPlaying(page);
  await button(page, 'Atur musik dan volume').click();
  await page.screenshot({ path: `artifacts/ambience-${info.project.name}.png`, fullPage: true });
  await volume.press('Home');
  await expect(volume).toHaveValue('0');
  await expect.poll(async () => (await audioState(page)).rms).toBeLessThan(0.0000001);
  expect((await audioState(page)).states).toEqual(['running']);
  for (let step = 0; step < 40; step++) await volume.press('ArrowRight');
  await expect(volume).toHaveValue('40');
  await expectPlaying(page);
  await volume.press('Escape');
  expect(await saved(page)).toEqual(original);
  await expect(button(page, 'Urungkan')).toBeDisabled();

  await page.getByLabel('Nama toko', { exact: true }).fill('Cozy Studio');
  await expect.poll(async () => (await saved(page)).name).toBe('Cozy Studio');
  const renamed = await saved(page);
  await button(page, 'Mode malam').click();
  await expect(canvasFor(page)).toHaveAttribute('data-night-progress', '1');
  await button(page, 'Lihat tokoku').click();
  await expect(button(page, 'Kembali ngatur')).toBeVisible();
  await expectPlaying(page);
  expect((await audioState(page)).count).toBe(1);
  expect(await saved(page)).toEqual(renamed);
  await button(page, 'Kembali ngatur').click();
  await button(page, 'Urungkan').click();
  await expect.poll(() => saved(page)).toEqual(original);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  await button(page, 'Ulangi').click();
  await expect.poll(() => saved(page)).toEqual(renamed);
  await expectPlaying(page);

  await button(page, 'Jeda musik cozy').click();
  await expect(button(page, 'Putar musik cozy')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await audioState(page)).states).toEqual(['suspended']);
  expect(await saved(page)).toEqual(renamed);
  await button(page, 'Atur musik dan volume').click();
  await track.selectOption('cheerful');
  await expect(button(page, 'Putar musik cozy')).toHaveAttribute('aria-pressed', 'false');
  expect((await audioState(page)).states).toEqual(['suspended']);
  await track.selectOption('calm');
  await volume.press('Escape');
  await button(page, 'Putar musik cozy').click();
  await expectPlaying(page);
  expect((await audioState(page)).count).toBe(1);
  // Autoplay is attempted on every visit, while the volume remains unchanged.
  await page.reload();
  await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
  await expectPlaying(page);
  expect((await audioState(page)).count).toBe(1);
  await expect.poll(() => saved(page)).toEqual(renamed);
  await button(page, 'Atur musik dan volume').click();
  await expect(volume).toHaveValue('40');
  await expect(track).toHaveValue('calm');
  expect((await audioState(page)).count).toBe(1);
  await expect(button(page, 'Urungkan')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  if (info.project.name === 'mobile-chromium') {
    await page.setViewportSize({ width: 320, height: 844 });
    await expect(volume).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    const bounds = await volume.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  }
  expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
});

test('the same native music loop continues through exterior, interior, and floor changes', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors = await openApp(page, info);
  await outsidePointer(page);
  await expectPlaying(page);
  await expect.poll(() => withoutGesture(page, () => {
    const probe = (window as unknown as ProbeWindow).__cozyAudioProbe;
    const active = probe.sources.find(({ source, starts, stops }) => source.loop && source.buffer?.numberOfChannels === 2 && starts === 1 && stops === 0);
    probe.retainedLoop = active;
    return Boolean(active);
  })).toBe(true);
  const original = await saved(page);
  const start = await withoutGesture(page, () => (window as unknown as ProbeWindow).__cozyAudioProbe.retainedLoop!.source.context.currentTime);
  for (const name of ['Eksterior', 'Interior', 'Edit lantai 2', 'Eksterior', 'Edit lantai 1']) {
    await button(page, name).click();
    await expect(page.locator('.shop-canvas')).toHaveAttribute('aria-busy', 'false');
    await expect(canvasFor(page)).toHaveAttribute('data-ready', 'true');
    await expect(button(page, name)).toHaveAttribute('aria-pressed', 'true');
    await expectPlaying(page);
    const state = await withoutGesture(page, () => {
      const probe = (window as unknown as ProbeWindow).__cozyAudioProbe, retained = probe.retainedLoop!;
      return {
        starts: retained.starts, stops: retained.stops,
        contexts: probe.contexts.filter(context => context.state !== 'closed').length,
        running: retained.source.context.state,
        activeLoops: probe.sources.filter(({ source, starts, stops }) => source.loop && source.buffer?.numberOfChannels === 2 && starts === 1 && stops === 0).length,
        time: retained.source.context.currentTime,
      };
    });
    expect(state).toMatchObject({ starts: 1, stops: 0, contexts: 1, running: 'running', activeLoops: 1 });
    expect(state.time).toBeGreaterThan(start);
  }
  expect(await saved(page)).toEqual(original);
  expect(errors).toEqual([]);
});

test.describe('blocked autoplay', () => {
  // Trace snapshots also evaluate inside the page with userGesture:true.
  // Avoid instrumentation-generated activation before the actual pointer/key.
  test('blocked autoplay waits honestly and starts after the first outside click or touch', async ({ page }, info) => {
    test.setTimeout(60_000);
    const errors = await openApp(page, info);
    const original = await saved(page);
    await expectWaiting(page);
    await outsidePointer(page);
    await expectPlaying(page);
    expect(await saved(page)).toEqual(original);
    await expect(button(page, 'Urungkan')).toBeDisabled();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('canceling waiting autoplay stays silent across interactions, and a reload can unlock with the keyboard', async ({ page }, info) => {
    test.setTimeout(90_000);
    const errors = await openApp(page, info);
    const original = await saved(page);
    await expectWaiting(page);
    await pointerOn(page, '.ambience-play');
    await expect(button(page, 'Putar musik cozy')).toHaveAttribute('aria-pressed', 'false');
    await outsidePointer(page);
    await page.keyboard.press('Enter');
    await button(page, 'Mode malam').click();
    await expect(canvasFor(page)).toHaveAttribute('data-night-progress', '1');
    await expect(button(page, 'Putar musik cozy')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.ambience-control')).not.toHaveClass(/is-playing/);
    await expect.poll(async () => (await audioState(page)).states).toEqual(['suspended']);
    expect((await audioState(page)).rms).toBe(0);
    expect(await saved(page)).toEqual(original);
    await expect(button(page, 'Urungkan')).toBeDisabled();

    // Session cancellation is not persisted: reload requests autoplay again.
    await page.reload();
    await expect.poll(() => withoutGesture(page, () => document.querySelector<HTMLCanvasElement>('canvas[data-renderer="webgl"]')?.dataset.ready)).toBe('true');
    await expectWaiting(page);
    await page.keyboard.press('Enter');
    await expectPlaying(page);
    expect(await saved(page)).toEqual(original);
    await expect(button(page, 'Urungkan')).toBeDisabled();
    expect(errors).toEqual([]);
  });
});
