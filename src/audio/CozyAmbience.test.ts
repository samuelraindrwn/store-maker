import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CozyAmbience, supported } from './CozyAmbience';

class Parameter {
  value = 0;
  events: { method: string; value?: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) { this.value = value; this.events.push({ method: 'set', value, time }); return this; }
  linearRampToValueAtTime(value: number, time: number) { this.value = value; this.events.push({ method: 'linear', value, time }); return this; }
  exponentialRampToValueAtTime(value: number, time: number) { this.value = value; this.events.push({ method: 'exponential', value, time }); return this; }
  cancelAndHoldAtTime(time: number) { this.events.push({ method: 'hold', time }); return this; }
}

class Node {
  connections = new Set<Node>();
  disconnected = false;
  type = '';
  gain = new Parameter(); frequency = new Parameter(); Q = new Parameter(); detune = new Parameter();
  threshold = new Parameter(); knee = new Parameter(); ratio = new Parameter(); attack = new Parameter(); release = new Parameter();
  buffer: Buffer | null = null;
  constructor(readonly kind: string) {}
  connect(node: Node) { this.connections.add(node); return node; }
  disconnect() { this.connections.clear(); this.disconnected = true; }
}

class Source extends Node {
  loop = false;
  starts: number[] = [];
  stopAt: number | null = null;
  ended = false;
  onended: (() => void) | null = null;
  constructor(kind: string, private context: Context) { super(kind); }
  start(when = this.context.currentTime) { this.starts.push(when); }
  stop(when = this.context.currentTime) { this.stopAt = when; }
  flush() {
    if (!this.ended && this.stopAt !== null && this.stopAt <= this.context.currentTime) {
      this.ended = true; this.onended?.();
    }
  }
}

class Buffer {
  channels: Float32Array[];
  constructor(channelCount: number, length: number) { this.channels = Array.from({ length: channelCount }, () => new Float32Array(length)); }
  getChannelData(channel: number) { return this.channels[channel]; }
}

class Context {
  static created: Context[] = [];
  static nextResumeGate: Promise<void> | null = null;
  static nextResumeError: Error | null = null;
  state = 'suspended';
  sampleRate = 8000;
  currentTime = 0;
  destination = new Node('destination');
  nodes: Node[] = [];
  resumeCalls = 0; suspendCalls = 0; closeCalls = 0;
  resumeGate = Context.nextResumeGate;
  resumeError = Context.nextResumeError;
  suspendGate: Promise<void> | null = null;
  constructor() { Context.created.push(this); }
  private node(kind: string) { const node = new Node(kind); this.nodes.push(node); return node; }
  createGain() { return this.node('gain'); }
  createBiquadFilter() { return this.node('filter'); }
  createDynamicsCompressor() { return this.node('compressor'); }
  createConvolver() { return this.node('convolver'); }
  createBuffer(channels: number, length: number) { return new Buffer(channels, length); }
  private source(kind: string) { const node = new Source(kind, this); this.nodes.push(node); return node; }
  createOscillator() { return this.source('oscillator'); }
  createBufferSource() { return this.source('buffer-source'); }
  async resume() {
    this.resumeCalls++;
    if (this.resumeError) { const error = this.resumeError; this.resumeError = null; throw error; }
    if (this.resumeGate) await this.resumeGate;
    if (this.state === 'closed') throw new Error('Context closed');
    this.state = 'running';
  }
  async suspend() {
    this.suspendCalls++;
    if (this.suspendGate) await this.suspendGate;
    if (this.state !== 'closed') this.state = 'suspended';
  }
  async close() { this.closeCalls++; this.state = 'closed'; }
  flush() { this.nodes.forEach(node => { if (node instanceof Source) node.flush(); }); }
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(complete => { resolve = complete; });
  return { promise, resolve };
}

const players: CozyAmbience[] = [];
function player() { const value = new CozyAmbience(); players.push(value); return value; }
function master(context: Context) { return context.nodes.find(node => node.connections.has(context.destination))!; }
function oscillators(context: Context) { return context.nodes.filter(node => node.kind === 'oscillator') as Source[]; }
function advance(milliseconds: number) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 40) {
    const step = Math.min(40, milliseconds - elapsed);
    for (const context of Context.created) if (context.state === 'running') context.currentTime += step / 1000;
    Context.created.forEach(context => context.flush());
    vi.advanceTimersByTime(step);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  Context.created = []; Context.nextResumeGate = null; Context.nextResumeError = null;
  vi.stubGlobal('AudioContext', Context); vi.stubGlobal('webkitAudioContext', undefined);
});

afterEach(() => {
  players.splice(0).forEach(value => value.dispose());
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});

describe('CozyAmbience lifecycle and bounded musical scheduling', () => {
  it('does not allocate or play audio during construction, feature detection, volume changes, or an idle pause', () => {
    const music = player();
    expect(supported()).toBe(true);
    music.setVolume(0.8); music.pause(); music.dispose();
    expect(Context.created).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects unsupported playback for UI feedback without starting a timer', async () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(supported()).toBe(false);
    await expect(player().play()).rejects.toThrow('belum mendukung');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shares one context and scheduler across simultaneous and repeated play calls', async () => {
    const music = player();
    await Promise.all([music.play(), music.play(), music.play()]);
    const [context] = Context.created;
    expect(Context.created).toHaveLength(1);
    expect(context.resumeCalls).toBeGreaterThanOrEqual(1);
    expect(vi.getTimerCount()).toBe(1);
    expect(master(context).gain.events.at(-1)).toMatchObject({ method: 'linear', value: 0.35 });
    expect(Math.min(...oscillators(context).flatMap(source => source.starts))).toBeCloseTo(0.045);
    const count = context.nodes.length;
    await music.play();
    expect(context.nodes).toHaveLength(count);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('fades active voices and the master before suspending, then resumes the same reusable graph', async () => {
    const music = player(); await music.play();
    const context = Context.created[0];
    const output = master(context);
    music.pause();
    expect(output.gain.events.at(-1)).toMatchObject({ method: 'linear', value: 0, time: 0.18 });
    expect(context.suspendCalls).toBe(0);
    const existingVoices = oscillators(context).length;
    advance(200);
    expect(context.suspendCalls).toBe(0);
    expect(oscillators(context)).toHaveLength(existingVoices);
    advance(80); await Promise.resolve();
    expect(context.state).toBe('suspended');
    expect(vi.getTimerCount()).toBe(0);
    await music.play();
    expect(Context.created).toHaveLength(1);
    expect(master(context)).toBe(output);
    expect(context.nodes.filter(node => node.kind === 'buffer-source')).toHaveLength(1);
    expect(context.state).toBe('running');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('unlocks a pending autoplay resume through a fresh play without waiting for the original promise', async () => {
    const blocked = deferred(); Context.nextResumeGate = blocked.promise;
    const music = player();
    let autoplayFinished = false;
    const autoplay = music.play().then(() => { autoplayFinished = true; });
    const context = Context.created[0];
    expect(context.resumeCalls).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    // The native call made inside the subsequent trusted gesture can now unlock.
    context.resumeGate = null;
    await music.play();
    expect(autoplayFinished).toBe(false);
    expect(context.resumeCalls).toBe(2);
    expect(Context.created).toHaveLength(1);
    expect(context.state).toBe('running');
    expect(vi.getTimerCount()).toBe(1);
    const nodes = context.nodes.length;
    blocked.resolve(); await autoplay;
    expect(context.nodes).toHaveLength(nodes);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('keeps manual pause authoritative when multiple blocked resume calls complete out of order', async () => {
    const autoplayGate = deferred(); Context.nextResumeGate = autoplayGate.promise;
    const music = player(); const autoplay = music.play();
    const context = Context.created[0];
    const gestureGate = deferred(); context.resumeGate = gestureGate.promise;
    const gesture = music.play();
    expect(context.resumeCalls).toBe(2);
    music.pause(); await vi.advanceTimersByTimeAsync(300);
    gestureGate.resolve(); await gesture; await Promise.resolve();
    expect(context.state).toBe('suspended');
    autoplayGate.resolve(); await autoplay;
    expect(context.state).toBe('suspended');
    expect(oscillators(context)).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(Context.created).toHaveLength(1);
  });

  it('cancels pending suspension when replayed during the fade without stacking schedulers', async () => {
    const music = player(); await music.play();
    const context = Context.created[0];
    music.pause(); advance(80); await music.play(); advance(300);
    expect(context.suspendCalls).toBe(0);
    expect(context.state).toBe('running');
    expect(vi.getTimerCount()).toBe(1);
    expect(oscillators(context).filter(source => !source.disconnected).length).toBeLessThanOrEqual(72);
  });

  it('suspends a stale resume that resolves only after pause already finished', async () => {
    const gate = deferred(); Context.nextResumeGate = gate.promise;
    const music = player(); const playing = music.play();
    const context = Context.created[0];
    music.pause(); await vi.advanceTimersByTimeAsync(300);
    expect(context.state).toBe('suspended');
    gate.resolve(); await playing;
    expect(context.state).toBe('suspended');
    expect(context.suspendCalls).toBe(2);
    expect(oscillators(context)).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits for an in-flight suspend before replay resumes the context', async () => {
    const music = player(); await music.play();
    const context = Context.created[0];
    const gate = deferred(); context.suspendGate = gate.promise;
    music.pause(); await vi.advanceTimersByTimeAsync(300);
    const playing = music.play();
    expect(context.resumeCalls).toBe(1);
    gate.resolve(); await playing;
    expect(context.resumeCalls).toBe(2);
    expect(context.state).toBe('running');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('cancels a replay waiting for suspension when the page is hidden again', async () => {
    const music = player(); await music.play();
    const context = Context.created[0];
    const gate = deferred(); context.suspendGate = gate.promise;
    music.pause(); await vi.advanceTimersByTimeAsync(300);
    const replay = music.play();
    music.pause();
    gate.resolve(); await replay; await vi.advanceTimersByTimeAsync(300);
    expect(context.state).toBe('suspended');
    expect(context.resumeCalls).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates a denied resume, leaving no scheduler, and can retry with the same context', async () => {
    Context.nextResumeError = new Error('NotAllowedError');
    const music = player();
    await expect(music.play()).rejects.toThrow('NotAllowedError');
    const context = Context.created[0];
    expect(vi.getTimerCount()).toBe(0);
    expect(oscillators(context)).toHaveLength(0);
    expect(master(context).gain.value).toBe(0);
    await music.play();
    expect(Context.created).toHaveLength(1);
    expect(context.state).toBe('running');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('smooths and clamps finite volume values without unmuting a paused player', async () => {
    const music = player(); music.setVolume(0.6); await music.play();
    const context = Context.created[0]; const output = master(context);
    expect(output.gain.events.at(-1)?.value).toBe(0.6);
    music.setVolume(2); expect(output.gain.events.at(-1)).toMatchObject({ method: 'linear', value: 1 });
    music.setVolume(-1); expect(output.gain.events.at(-1)?.value).toBe(0);
    const events = output.gain.events.length;
    music.setVolume(NaN); expect(output.gain.events).toHaveLength(events);
    music.pause(); music.setVolume(0.7);
    expect(output.gain.events.at(-1)?.value).toBe(0);
    advance(300); await music.play();
    expect(output.gain.events.at(-1)?.value).toBe(0.7);
  });

  it('keeps the musical voice count bounded across repeated bars and skips delayed scheduling instead of bursting', async () => {
    const music = player(); await music.play();
    const context = Context.created[0];
    let peak = 0;
    for (let second = 0; second < 120; second++) {
      advance(1000);
      peak = Math.max(peak, oscillators(context).filter(source => !source.disconnected).length);
    }
    expect(peak).toBeGreaterThan(8); expect(peak).toBeLessThanOrEqual(72);
    const tones = new Set(oscillators(context).map(source => Math.round(source.frequency.value)));
    expect(tones.size).toBeGreaterThanOrEqual(12);
    expect(context.nodes.filter(node => node.kind === 'buffer-source')).toHaveLength(1);
    expect(context.nodes.filter(node => node.kind === 'convolver')).toHaveLength(1);
    context.currentTime += 60 * 60; context.flush();
    const count = oscillators(context).length;
    advance(40);
    expect(oscillators(context).length - count).toBeLessThanOrEqual(12);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('closes and disconnects all owned audio resources and cancels timers exactly once on disposal', async () => {
    const music = player(); await music.play();
    const context = Context.created[0];
    music.pause(); music.dispose(); music.dispose(); advance(1000);
    expect(context.closeCalls).toBe(1);
    expect(context.state).toBe('closed');
    expect(context.nodes.every(node => node.disconnected)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await expect(music.play()).rejects.toThrow('sudah ditutup');
    expect(Context.created).toHaveLength(1);
  });

  it('cannot restart scheduling when a pending resume finishes after disposal', async () => {
    const gate = deferred(); Context.nextResumeGate = gate.promise;
    const music = player(); const playing = music.play();
    const rejection = expect(playing).rejects.toThrow('Context closed');
    music.dispose(); gate.resolve(); await rejection;
    expect(Context.created[0].closeCalls).toBe(1);
    expect(Context.created[0].nodes.every(node => node.disconnected)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
