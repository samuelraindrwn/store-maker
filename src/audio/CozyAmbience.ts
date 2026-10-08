type Voice = { sources: OscillatorNode[]; nodes: AudioNode[]; envelope: GainNode; released: boolean };
type Note = { beat: number; midi: number; length: number; level: number; bass?: boolean };
export type AmbienceTrack = 'cheerful' | 'calm';
type Graph = {
  master: GainNode;
  piano: BiquadFilterNode;
  bass: BiquadFilterNode;
  rain: AudioBufferSourceNode;
  rainLevel: GainNode;
  wet: GainNode;
  nodes: AudioNode[];
};

const SCORE_BEATS = 32;
const LOOK_AHEAD = 0.18;
const FADE_OUT = 0.18;
const MAX_VOICES = 36;

// An original eight-bar C-major score: open ninths, suspended dominants, and
// a small answering melody. Voicings leave room above the slow bass line.
const CHORDS = [
  [55, 59, 62, 64], [55, 59, 62, 67], [55, 59, 60, 64], [57, 60, 64, 67],
  [57, 60, 64, 65], [53, 57, 59, 64], [55, 59, 62, 64], [55, 60, 62, 64],
];
const BASSES = [36, 40, 45, 41, 38, 43, 36, 43];
const MELODIES = [
  [[1.5, 76], [3, 74]], [[2.5, 71]], [[1.75, 72], [3.25, 76]], [[2, 74]],
  [[1.5, 77], [3, 76]], [[2.25, 74], [3.25, 71]], [[1.5, 72]], [[2.75, 67]],
];
const CALM_SCORE: Note[] = CHORDS.flatMap((chord, bar) => [
  ...chord.map((midi, index) => ({ beat: bar * 4 + index * 0.075, midi, length: 3.8, level: 0.085 - index * 0.004 })),
  { beat: bar * 4 + 0.02, midi: BASSES[bar], length: 3.5, level: 0.13, bass: true },
  ...MELODIES[bar].map(([beat, midi]) => ({ beat: bar * 4 + beat, midi, length: 1.8, level: 0.065 })),
]).sort((a, b) => a.beat - b.beat);

// A second original eight-bar tune: lilting wooden-key melody, light plucked
// arpeggios, and a bouncing root/fifth bass. No samples or external downloads.
const CHEERFUL_CHORDS = [
  [60, 64, 67], [60, 64, 69], [60, 65, 69], [59, 62, 67],
  [60, 64, 67], [60, 64, 69], [60, 65, 69], [59, 62, 67],
];
const CHEERFUL_MELODIES = [
  [76, 79, 81, 79, 76, 74], [72, 76, 79, 81, 79, 76],
  [77, 81, 84, 81, 79, 77], [74, 76, 79, 77, 76, 74],
  [76, 79, 84, 83, 81, 79], [81, 79, 76, 74, 72, 76],
  [77, 79, 81, 79, 77, 74], [74, 71, 74, 79, 76, 72],
];
const CHEERFUL_BASSES = [36, 45, 41, 43, 36, 45, 41, 43];
const CHEERFUL_SCORE: Note[] = CHEERFUL_CHORDS.flatMap((chord, bar) => [
  ...[0, 1, 2, 1].map((tone, index) => ({ beat: bar * 4 + index + 0.02, midi: chord[tone], length: 0.95, level: 0.075 })),
  ...[0, 2].map((beat, index) => ({ beat: bar * 4 + beat, midi: CHEERFUL_BASSES[bar] + index * 7, length: 1.2, level: 0.13, bass: true })),
  ...CHEERFUL_MELODIES[bar].map((midi, index) => ({ beat: bar * 4 + [0, 0.6, 1, 2, 2.6, 3][index], midi, length: 0.9, level: index === 0 || index === 3 ? 0.1 : 0.08 })),
]).sort((a, b) => a.beat - b.beat);
const TRACKS = {
  cheerful: { beat: 60 / 104, score: CHEERFUL_SCORE, rain: 0, filter: 3800, reverb: 0.12 },
  calm: { beat: 60 / 72, score: CALM_SCORE, rain: 0.014, filter: 2300, reverb: 0.23 },
} satisfies Record<AmbienceTrack, { beat: number; score: Note[]; rain: number; filter: number; reverb: number }>;

function audioConstructor(): typeof AudioContext | undefined {
  return globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

/** Checking availability never allocates a context or requests playback. */
export function supported(): boolean { return typeof audioConstructor() === 'function'; }

function random(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000 * 2 - 1;
  };
}

function hold(parameter: AudioParam, time: number) {
  if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(time);
  else {
    const value = parameter.value;
    parameter.cancelScheduledValues(time);
    parameter.setValueAtTime(value, time);
  }
}

function ramp(parameter: AudioParam, value: number, time: number, duration: number) {
  hold(parameter, time);
  parameter.linearRampToValueAtTime(value, time + duration);
}

/** Original synthesized music; all resources belong to this one disposable player. */
export class CozyAmbience {
  private context: AudioContext | null = null;
  private graph: Graph | null = null;
  private volume = 0.35;
  private track: AmbienceTrack = 'cheerful';
  private wanted = false;
  private disposed = false;
  private generation = 0;
  private suspendTask: Promise<void> | null = null;
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private voices = new Set<Voice>();
  private scoreStart = 0;
  private scoreLoop = 0;
  private eventIndex = 0;

  // Deliberately no constructor work: Web Audio begins only inside play().
  async play(): Promise<void> {
    if (this.disposed) throw new Error('Pemutar musik sudah ditutup.');
    this.wanted = true;
    const generation = ++this.generation;
    this.cancelSuspension();
    try {
      const context = this.ensureContext();
      await this.resume(context);
      if (this.disposed || !this.wanted || generation !== this.generation) {
        // A blocked resume can resolve after pause's timer already suspended it.
        if (!this.disposed && !this.wanted && this.suspendTimer === null && context.state === 'running') this.suspend(context);
        return;
      }
      if (this.scheduler !== null) return;
      this.scoreStart = context.currentTime + 0.045;
      this.scoreLoop = 0;
      this.eventIndex = 0;
      ramp(this.graph!.master.gain, this.volume, context.currentTime, 0.22);
      this.schedule();
      this.scheduler = setInterval(() => this.schedule(), 40);
    } catch (error) {
      if (generation === this.generation) this.wanted = false;
      throw error;
    }
  }

  pause(): void {
    this.wanted = false;
    const generation = ++this.generation;
    this.cancelScheduler();
    this.cancelSuspension();
    const context = this.context;
    if (!context || this.disposed) return;
    const now = context.currentTime;
    if (this.graph) ramp(this.graph.master.gain, 0, now, FADE_OUT);
    this.releaseVoices(now, FADE_OUT);
    this.suspendTimer = setTimeout(() => {
      this.suspendTimer = null;
      if (this.disposed || this.wanted || generation !== this.generation || context.state === 'closed') return;
      this.suspend(context);
    }, (FADE_OUT + 0.06) * 1000);
  }

  setVolume(value: number): void {
    if (!Number.isFinite(value) || this.disposed) return;
    this.volume = Math.max(0, Math.min(1, value));
    if (this.wanted && this.scheduler !== null && this.context && this.graph) {
      ramp(this.graph.master.gain, this.volume, this.context.currentTime, 0.12);
    }
  }

  /** Switch the score without resuming a paused player or adding a scheduler. */
  setTrack(value: AmbienceTrack): void {
    if (this.disposed || !Object.hasOwn(TRACKS, value) || value === this.track) return;
    this.track = value;
    const context = this.context;
    if (!context || !this.graph) return;
    const now = context.currentTime;
    const track = TRACKS[value];
    ramp(this.graph.rainLevel.gain, track.rain, now, 0.25);
    ramp(this.graph.piano.frequency, track.filter, now, 0.18);
    ramp(this.graph.wet.gain, track.reverb, now, 0.25);
    this.releaseVoices(now, 0.12);
    this.scoreStart = now + 0.14;
    this.scoreLoop = 0;
    this.eventIndex = 0;
    if (this.scheduler !== null) this.schedule();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.wanted = false;
    this.generation++;
    this.cancelScheduler();
    this.cancelSuspension();
    const context = this.context;
    for (const voice of [...this.voices]) this.removeVoice(voice, true);
    if (this.graph) {
      this.graph.rain.stop();
      for (const node of this.graph.nodes) node.disconnect();
    }
    this.graph = null;
    this.context = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context;
    const Constructor = audioConstructor();
    if (!Constructor) throw new Error('Browser ini belum mendukung audio ambient.');
    const context = new Constructor();
    try {
      this.graph = this.createGraph(context);
      this.context = context;
      return context;
    } catch (error) {
      void context.close().catch(() => {});
      throw error;
    }
  }

  private async resume(context: AudioContext): Promise<void> {
    if (this.suspendTask) await this.suspendTask.catch(() => {});
    if (this.disposed || !this.wanted) return;
    if (context.state === 'running') return;
    // A blocked autoplay resume may remain pending. A fresh play from a trusted
    // gesture must call the native method again, rather than await that promise.
    // play() generations still allow only the latest request to start the score.
    await context.resume();
    if (!this.disposed && this.wanted && (context.state as AudioContextState) !== 'running') throw new Error('Audio belum bisa diputar. Coba tekan putar lagi.');
  }

  private suspend(context: AudioContext) {
    if (this.suspendTask) return;
    const task = context.suspend();
    this.suspendTask = task;
    // A later play waits for a pending suspend before resuming the same context.
    void task.catch(() => {}).finally(() => { if (this.suspendTask === task) this.suspendTask = null; });
  }

  private createGraph(context: AudioContext): Graph {
    const track = TRACKS[this.track];
    const master = context.createGain(); master.gain.value = 0;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18; compressor.knee.value = 18; compressor.ratio.value = 3;
    compressor.attack.value = 0.008; compressor.release.value = 0.3;
    const music = context.createGain();
    const piano = context.createBiquadFilter(); piano.type = 'lowpass'; piano.frequency.value = track.filter; piano.Q.value = 0.45;
    const bass = context.createBiquadFilter(); bass.type = 'lowpass'; bass.frequency.value = 550; bass.Q.value = 0.4;
    piano.connect(music); bass.connect(music);
    const dry = context.createGain(); dry.gain.value = 0.85;
    music.connect(dry); dry.connect(compressor);
    const reverb = context.createConvolver();
    const impulse = context.createBuffer(2, Math.floor(context.sampleRate * 2.6), context.sampleRate);
    const impulseNoise = random(0x4e454d55);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      let smooth = 0;
      for (let i = 0; i < data.length; i++) {
        smooth += (impulseNoise() - smooth) * 0.24;
        const t = i / context.sampleRate;
        data[i] = t < 0.018 ? 0 : smooth * Math.exp(-t * 2.6) * Math.min(1, (t - 0.018) / 0.025);
      }
    }
    reverb.buffer = impulse;
    const wet = context.createGain(); wet.gain.value = track.reverb;
    music.connect(reverb); reverb.connect(wet); wet.connect(compressor);

    const rain = context.createBufferSource();
    const rainBuffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const rainNoise = random(0x534f4654);
    const rainData = rainBuffer.getChannelData(0);
    for (let i = 0; i < rainData.length; i++) rainData[i] = rainNoise();
    rain.buffer = rainBuffer; rain.loop = true;
    const rainLow = context.createBiquadFilter(); rainLow.type = 'lowpass'; rainLow.frequency.value = 1500; rainLow.Q.value = 0.35;
    const rainHigh = context.createBiquadFilter(); rainHigh.type = 'highpass'; rainHigh.frequency.value = 450; rainHigh.Q.value = 0.35;
    const rainLevel = context.createGain(); rainLevel.gain.value = track.rain;
    rain.connect(rainLow); rainLow.connect(rainHigh); rainHigh.connect(rainLevel); rainLevel.connect(compressor);
    compressor.connect(master); master.connect(context.destination);
    rain.start();
    return { master, piano, bass, rain, rainLevel, wet, nodes: [master, compressor, music, piano, bass, dry, reverb, wet, rain, rainLow, rainHigh, rainLevel] };
  }

  private schedule() {
    const context = this.context;
    if (!context || !this.graph || !this.wanted || this.disposed || context.state !== 'running') return;
    const { beat, score } = TRACKS[this.track];
    const now = context.currentTime;
    const cycle = SCORE_BEATS * beat;
    // Background throttling must skip missed bars, not allocate a burst of notes.
    if (this.scoreStart + (this.scoreLoop + 1) * cycle < now) {
      this.scoreLoop = Math.max(0, Math.floor((now - this.scoreStart) / cycle));
      this.eventIndex = 0;
    }
    while (true) {
      const note = score[this.eventIndex];
      const when = this.scoreStart + this.scoreLoop * cycle + note.beat * beat;
      if (when > now + LOOK_AHEAD) break;
      if (when >= now - 0.025 && this.voices.size < MAX_VOICES) this.note(note, Math.max(when, now));
      this.eventIndex++;
      if (this.eventIndex === score.length) { this.eventIndex = 0; this.scoreLoop++; }
    }
  }

  private note(note: Note, when: number) {
    const context = this.context!;
    const cheerful = this.track === 'cheerful';
    const envelope = context.createGain();
    const fundamental = context.createOscillator();
    const warmth = context.createOscillator();
    const overtone = context.createGain(); overtone.gain.value = note.bass ? 0.12 : cheerful ? 0.3 : 0.22;
    const frequency = 440 * 2 ** ((note.midi - 69) / 12);
    fundamental.type = 'sine'; fundamental.frequency.value = frequency;
    warmth.type = cheerful && !note.bass ? 'sine' : 'triangle';
    warmth.frequency.value = frequency * (cheerful && !note.bass ? 3 : 1);
    warmth.detune.value = note.bass || cheerful ? 0 : 1.7;
    fundamental.connect(envelope); warmth.connect(overtone); overtone.connect(envelope);
    envelope.connect(note.bass ? this.graph!.bass : this.graph!.piano);
    const end = when + note.length * TRACKS[this.track].beat;
    envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(note.level, when + (cheerful ? 0.008 : note.bass ? 0.065 : 0.028));
    envelope.gain.exponentialRampToValueAtTime(note.level * (cheerful ? 0.3 : 0.24), when + (cheerful ? 0.12 : 0.65));
    envelope.gain.exponentialRampToValueAtTime(0.0001, end - 0.08);
    envelope.gain.linearRampToValueAtTime(0, end);
    const voice: Voice = { sources: [fundamental, warmth], nodes: [fundamental, warmth, overtone, envelope], envelope, released: false };
    this.voices.add(voice);
    let ended = 0;
    for (const source of voice.sources) {
      source.onended = () => { if (++ended === voice.sources.length) this.removeVoice(voice); };
      source.start(when); source.stop(end + 0.025);
    }
  }

  private releaseVoices(now: number, duration: number) {
    for (const voice of this.voices) {
      if (voice.released) continue;
      voice.released = true;
      ramp(voice.envelope.gain, 0, now, duration);
      for (const source of voice.sources) source.stop(now + duration + 0.025);
    }
  }

  private removeVoice(voice: Voice, stop = false) {
    if (!this.voices.delete(voice)) return;
    for (const source of voice.sources) { source.onended = null; if (stop) source.stop(); }
    for (const node of voice.nodes) node.disconnect();
  }

  private cancelScheduler() {
    if (this.scheduler !== null) clearInterval(this.scheduler);
    this.scheduler = null;
  }

  private cancelSuspension() {
    if (this.suspendTimer !== null) clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
  }
}
