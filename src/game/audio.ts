// Every sound is synthesised with the Web Audio API, so there are no audio files to load.
// Buses: music (with a small reverb), effects, ambience and the engine, all into a compressor.

const KEY = "squeek-burrow-3d-audio-v1";

export interface AudioSettings {
  fx: boolean;
  music: boolean;
  engine: boolean;
  ambience: boolean;
  volume: number;
}

export const DEFAULT_AUDIO: AudioSettings = { fx: true, music: true, engine: true, ambience: true, volume: 0.65 };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let fxBus: GainNode | null = null;
let ambBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let st: AudioSettings = loadAudio();

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function loadAudio(): AudioSettings {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "null");
    if (r && typeof r === "object")
      return {
        fx: r.fx !== false,
        music: r.music !== false,
        engine: r.engine !== false,
        ambience: r.ambience !== false,
        volume: typeof r.volume === "number" ? clamp(r.volume) : DEFAULT_AUDIO.volume,
      };
  } catch {
    // defaults below
  }
  return { ...DEFAULT_AUDIO };
}

export function setAudio(s: AudioSettings) {
  st = { ...s, volume: clamp(s.volume) };
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch {
    // storage can be unavailable
  }
  if (master) master.gain.value = st.volume;
  if (ambBus) ambBus.gain.value = st.ambience ? 1 : 0;
  if (!st.engine) loopsOff();
  if (st.music && song) startMusic();
  else stopMusic();
}

function makeImpulse(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  }
  return b;
}

// Call from a click or key press: browsers block audio until the player interacts.
export function unlockAudio() {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = st.volume;
    master.connect(comp);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.42;
    musicBus.connect(master);
    const verb = ctx.createConvolver();
    verb.buffer = makeImpulse(ctx, 1.6);
    const send = ctx.createGain();
    send.gain.value = 0.22;
    musicBus.connect(send);
    send.connect(verb);
    verb.connect(master);
    fxBus = ctx.createGain();
    fxBus.gain.value = 0.9;
    fxBus.connect(master);
    ambBus = ctx.createGain();
    ambBus.gain.value = st.ambience ? 1 : 0;
    ambBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (st.music && song) startMusic();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number, bus?: AudioNode | null) {
  if (!ctx) return;
  const out = bus ?? fxBus;
  if (!out) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number, delay = 0, type: BiquadFilterType = "bandpass", sweepTo?: number, bus?: AudioNode | null, q = 1) {
  if (!ctx || !noiseBuf) return;
  const out = bus ?? fxBus;
  if (!out) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(out);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

const on = () => st.fx && !!ctx;

export const sfx = {
  click() {
    if (on()) tone(700, 0.05, "square", 0.06), tone(1050, 0.05, "square", 0.04, 0.03);
  },
  error() {
    if (on()) tone(180, 0.12, "square", 0.08), tone(140, 0.16, "square", 0.08, 0.1);
  },
  buy() {
    if (!on()) return;
    [523, 659, 784].forEach((f, i) => tone(f, 0.1, "square", 0.09, i * 0.06));
    noise(0.2, 0.05, 6000, 0.12, "highpass");
  },
  unlock() {
    if (!on()) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, "triangle", 0.18, i * 0.08));
    noise(0.6, 0.06, 8000, 0.3, "highpass", 3000);
  },
  count() {
    if (on()) tone(440, 0.28, "square", 0.12), tone(220, 0.28, "triangle", 0.12);
  },
  go() {
    if (!on()) return;
    tone(880, 0.6, "square", 0.13);
    tone(440, 0.6, "triangle", 0.14);
    noise(0.7, 0.08, 1200, 0, "bandpass", 5000);
  },
  seed(streak: number) {
    if (!on()) return;
    const f = 988 * Math.pow(2, (Math.min(streak, 10) * 2) / 12);
    tone(f, 0.08, "triangle", 0.13);
    tone(f * 1.5, 0.12, "sine", 0.06, 0.04);
  },
  boost(kind: string) {
    if (!on()) return;
    const big = kind === "orange" || kind === "turbo" || kind === "dash";
    noise(big ? 0.9 : 0.55, big ? 0.3 : 0.2, 500, 0, "bandpass", 3500);
    tone(big ? 180 : 220, big ? 0.7 : 0.4, "sawtooth", 0.07, 0, big ? 900 : 600);
    if (kind === "dash") tone(90, 1, "sawtooth", 0.1, 0, 300);
  },
  driftLevel(level: number) {
    if (on()) tone(level === 3 ? 1320 : 990, 0.12, "triangle", 0.1), tone(level === 3 ? 1760 : 1320, 0.14, "triangle", 0.08, 0.06);
  },
  hop() {
    if (on()) tone(380, 0.09, "sine", 0.09, 0, 640), noise(0.08, 0.05, 900);
  },
  wall() {
    if (!on()) return;
    noise(0.25, 0.4, 260, 0, "lowpass");
    noise(0.12, 0.18, 3500, 0.01, "bandpass");
    tone(70, 0.2, "sine", 0.25, 0, 40);
  },
  bump() {
    if (!on()) return;
    tone(320, 0.08, "square", 0.08, 0, 180);
    noise(0.15, 0.2, 1800, 0, "bandpass");
    tone(90, 0.12, "sine", 0.18, 0, 50);
  },
  lap(final: boolean) {
    if (!on()) return;
    const notes = final ? [784, 988, 1175, 1568] : [659, 880, 1047];
    notes.forEach((f, i) => tone(f, 0.18, "square", 0.08, i * 0.09));
    if (final) noise(0.5, 0.05, 6000, 0.3, "highpass");
  },
  finish(good: boolean) {
    if (!on()) return;
    const notes = good ? [523, 659, 784, 1047, 784, 1047, 1319, 1568] : [523, 494, 440, 392, 330];
    notes.forEach((f, i) => tone(f, i === notes.length - 1 ? 0.8 : 0.15, "square", 0.09, i * 0.11));
    if (good) {
      noise(2.2, 0.06, 2500, 0.2, "bandpass", 1500); // crowd
      for (let i = 0; i < 6; i++) noise(0.12, 0.08, 7000, 0.5 + i * 0.13, "highpass");
    }
  },
  fever() {
    if (!on()) return;
    tone(300, 0.5, "sawtooth", 0.08, 0, 900);
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, "square", 0.06, 0.35 + i * 0.07));
  },
  star(i: number) {
    if (on()) tone(784 * Math.pow(2, (i * 4) / 12), 0.3, "triangle", 0.18), noise(0.3, 0.04, 9000, 0, "highpass");
  },
  itemBox() {
    if (!on()) return;
    noise(0.18, 0.18, 4000, 0, "bandpass", 9000);
    tone(1200, 0.08, "square", 0.06);
    tone(1600, 0.1, "square", 0.05, 0.05);
  },
  roll() {
    if (on()) tone(900 + Math.random() * 500, 0.03, "square", 0.04);
  },
  itemReady() {
    if (on()) tone(1047, 0.1, "triangle", 0.12), tone(1568, 0.18, "triangle", 0.12, 0.08);
  },
  shoot() {
    if (!on()) return;
    tone(900, 0.18, "square", 0.08, 0, 200);
    noise(0.12, 0.15, 2000, 0, "bandpass", 600);
  },
  homing() {
    if (!on()) return;
    [880, 1175, 880, 1175].forEach((f, i) => tone(f, 0.07, "square", 0.06, i * 0.08));
    noise(0.4, 0.1, 800, 0, "bandpass", 3000);
  },
  ricochet() {
    if (on()) tone(2400, 0.12, "sine", 0.06, 0, 900), noise(0.05, 0.08, 5000);
  },
  trap() {
    if (on()) tone(160, 0.15, "sine", 0.18, 0, 90), noise(0.1, 0.08, 600, 0, "lowpass");
  },
  throwBomb() {
    if (!on()) return;
    noise(0.4, 0.12, 900, 0, "bandpass", 300);
    noise(1.2, 0.03, 5000, 0.1, "highpass"); // fuse fizz
  },
  explosion(dist = 0) {
    if (!on()) return;
    const v = Math.max(0.15, 1 - dist / 90);
    noise(1.4, 0.7 * v, 900, 0, "lowpass", 60);
    noise(0.35, 0.35 * v, 3000, 0, "bandpass", 500);
    tone(110, 0.9, "sine", 0.45 * v, 0, 28);
    tone(55, 1.1, "triangle", 0.3 * v, 0.02, 25);
  },
  shieldUp() {
    if (!on()) return;
    tone(400, 0.5, "sine", 0.12, 0, 1200);
    tone(600, 0.5, "triangle", 0.06, 0.05, 1800);
  },
  shieldPop() {
    if (on()) tone(1600, 0.15, "sine", 0.12, 0, 400), noise(0.15, 0.12, 6000, 0, "highpass");
  },
  spinout() {
    if (!on()) return;
    tone(150, 0.12, "square", 0.14, 0, 70);
    noise(0.8, 0.25, 2500, 0.03, "bandpass", 900, null, 3); // tyre squeal
    [1200, 1000, 800, 600].forEach((f, i) => tone(f, 0.08, "triangle", 0.06, 0.15 + i * 0.09)); // dizzy
  },
  hitOther() {
    if (on()) [660, 880, 1320].forEach((f, i) => tone(f, 0.09, "square", 0.07, i * 0.05));
  },
  overtake(up: boolean) {
    if (on()) up ? (tone(784, 0.07, "triangle", 0.08), tone(1047, 0.1, "triangle", 0.08, 0.06)) : tone(392, 0.12, "triangle", 0.06, 0, 330);
  },
};

// ---------------- continuous loops: engine, rivals, tyres, wind, offroad ----------------
interface Loops {
  o1: OscillatorNode;
  o2: OscillatorNode;
  eFilter: BiquadFilterNode;
  eGain: GainNode;
  rival: OscillatorNode;
  rivalGain: GainNode;
  skidF: BiquadFilterNode;
  skidG: GainNode;
  windF: BiquadFilterNode;
  windG: GainNode;
  roughG: GainNode;
  srcs: AudioScheduledSourceNode[];
}
let loops: Loops | null = null;

function makeLoops(c: AudioContext): Loops {
  const out = master!;
  const srcs: AudioScheduledSourceNode[] = [];
  const o1 = c.createOscillator();
  const o2 = c.createOscillator();
  o1.type = "sawtooth";
  o2.type = "square";
  const eFilter = c.createBiquadFilter();
  eFilter.type = "lowpass";
  eFilter.Q.value = 4;
  const eGain = c.createGain();
  eGain.gain.value = 0;
  o1.connect(eFilter);
  o2.connect(eFilter);
  eFilter.connect(eGain);
  eGain.connect(out);
  const rival = c.createOscillator();
  rival.type = "sawtooth";
  const rf = c.createBiquadFilter();
  rf.type = "lowpass";
  rf.frequency.value = 700;
  const rivalGain = c.createGain();
  rivalGain.gain.value = 0;
  rival.connect(rf);
  rf.connect(rivalGain);
  rivalGain.connect(out);
  const mkNoise = () => {
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    srcs.push(s);
    return s;
  };
  const skidF = c.createBiquadFilter();
  skidF.type = "bandpass";
  skidF.frequency.value = 2200;
  skidF.Q.value = 6;
  const skidG = c.createGain();
  skidG.gain.value = 0;
  mkNoise().connect(skidF);
  skidF.connect(skidG);
  skidG.connect(out);
  const windF = c.createBiquadFilter();
  windF.type = "lowpass";
  windF.frequency.value = 600;
  const windG = c.createGain();
  windG.gain.value = 0;
  mkNoise().connect(windF);
  windF.connect(windG);
  windG.connect(out);
  const roughF = c.createBiquadFilter();
  roughF.type = "lowpass";
  roughF.frequency.value = 180;
  const roughG = c.createGain();
  roughG.gain.value = 0;
  mkNoise().connect(roughF);
  roughF.connect(roughG);
  roughG.connect(out);
  for (const s of [o1, o2, rival, ...srcs]) s.start();
  return { o1, o2, eFilter, eGain, rival, rivalGain, skidF, skidG, windF, windG, roughG, srcs: [o1, o2, rival, ...srcs] };
}

export interface DriveSound {
  speed: number;
  max: number;
  boosting: boolean;
  drift: number; // 0..3
  offroad: boolean;
  spinning: boolean;
  rivalDist: number; // metres to the nearest rival
  rivalSpeed: number;
}

// Called every frame during a race.
export function drive(d: DriveSound | null) {
  if (!ctx || !noiseBuf || !master) return;
  if (!d || !st.engine) {
    loopsOff();
    return;
  }
  if (!loops) loops = makeLoops(ctx);
  const t = ctx.currentTime;
  const sp = Math.max(0, d.speed);
  // fake gearbox: pitch climbs within each gear, then drops on a shift
  const gearSpan = d.max / 4;
  const g = Math.min(3, Math.floor(sp / gearSpan));
  const inGear = (sp - g * gearSpan) / gearSpan;
  const rpm = 0.25 + inGear * 0.75 + g * 0.08;
  const base = 48 + rpm * 120 + (d.boosting ? 35 : 0);
  loops.o1.frequency.setTargetAtTime(base, t, 0.04);
  loops.o2.frequency.setTargetAtTime(base * 0.5, t, 0.04);
  loops.eFilter.frequency.setTargetAtTime(500 + rpm * 1400 + (d.boosting ? 800 : 0), t, 0.06);
  loops.eGain.gain.setTargetAtTime(d.spinning ? 0.02 : 0.05 + rpm * 0.03, t, 0.06);
  const s = Math.min(1, sp / d.max);
  loops.skidG.gain.setTargetAtTime(d.drift > 0 ? 0.06 + d.drift * 0.03 : d.spinning ? 0.12 : 0, t, 0.05);
  loops.skidF.frequency.setTargetAtTime(d.drift >= 3 ? 2800 : d.drift === 2 ? 2400 : 2000, t, 0.1);
  loops.windG.gain.setTargetAtTime(s * s * 0.12 + (d.boosting ? 0.08 : 0), t, 0.1);
  loops.windF.frequency.setTargetAtTime(300 + s * 1500, t, 0.1);
  loops.roughG.gain.setTargetAtTime(d.offroad && sp > 5 ? 0.35 * s + 0.1 : 0, t, 0.05);
  const near = Math.max(0, 1 - d.rivalDist / 30);
  loops.rival.frequency.setTargetAtTime(60 + Math.min(1, d.rivalSpeed / d.max) * 110, t, 0.08);
  loops.rivalGain.gain.setTargetAtTime(near * near * 0.05, t, 0.08);
}

function loopsOff() {
  if (!loops || !ctx) return;
  const l = loops;
  loops = null;
  for (const g of [l.eGain, l.rivalGain, l.skidG, l.windG, l.roughG]) g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  setTimeout(() => l.srcs.forEach((s) => s.stop()), 400);
}

// ---------------- ambience ----------------
let ambTimer: number | null = null;
let ambHum: { src: AudioScheduledSourceNode; g: GainNode } | null = null;

export function ambience(kind: "meadow" | "kitchen" | "burrow" | "wheel" | null) {
  if (ambTimer !== null) clearInterval(ambTimer);
  ambTimer = null;
  if (ambHum && ctx) {
    const h = ambHum;
    h.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    setTimeout(() => h.src.stop(), 800);
    ambHum = null;
  }
  if (!kind || !ctx || !ambBus) return;
  const c = ctx;
  if (kind !== "meadow") {
    // kitchen fridge hum, deep burrow wind or the stadium crowd
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = kind === "wheel" ? "bandpass" : "lowpass";
    f.frequency.value = kind === "kitchen" ? 120 : kind === "wheel" ? 700 : 260;
    const g = c.createGain();
    g.gain.value = kind === "kitchen" ? 0.12 : kind === "wheel" ? 0.07 : 0.16;
    src.connect(f);
    f.connect(g);
    g.connect(ambBus);
    src.start();
    ambHum = { src, g };
  }
  ambTimer = window.setInterval(() => {
    if (Math.random() > 0.45) return;
    if (kind === "meadow") {
      // bird song
      const f = 2200 + Math.random() * 1600;
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) tone(f * (1 + (Math.random() - 0.5) * 0.2), 0.07, "sine", 0.025, i * 0.09, f * 1.3, ambBus);
    } else if (kind === "wheel") {
      if (Math.random() < 0.3) noise(1.4, 0.06, 1200, 0, "bandpass", 1800, ambBus); // a cheer
    } else if (kind === "kitchen") {
      tone(2600 + Math.random() * 1200, 0.25, "sine", 0.015, 0, undefined, ambBus); // clink
    } else {
      const f = 900 + Math.random() * 900;
      tone(f, 0.18, "sine", 0.03, 0, f * 0.55, ambBus); // drip
    }
  }, 700);
}

// ---------------- music ----------------
// Each song is a chord loop with bass, drums, an arpeggio and a lead built from the chord tones.
interface Song {
  bpm: number;
  root: number; // midi
  chords: number[][]; // semitone offsets from root, one chord per bar
  kick: string;
  snare: string;
  hat: string;
  bass: string; // 16 steps: digits pick chord tones, "o" = octave, "." = rest
  lead: string; // 16 steps per bar, digits pick chord tones (+octave), "." rest
  arp: boolean;
  wave: OscillatorType;
}

const SONGS: Record<string, Song> = {
  menu: { bpm: 96, root: 60, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [7, 11, 14, 17]], kick: "x.......x.......", snare: "....x.......x...", hat: "..x...x...x...x.", bass: "0...0.2.0...1.2.", lead: "2...1...0.......", arp: true, wave: "triangle" },
  meadow: { bpm: 142, root: 62, chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], kick: "x...x...x...x...", snare: "....x.......x..x", hat: "x.x.x.x.x.x.x.xx", bass: "0.0o0.0o1.1o2.2o", lead: "2.1.0...2.3.2...", arp: true, wave: "square" },
  kitchen: { bpm: 128, root: 57, chords: [[0, 3, 7, 10], [5, 8, 12, 15], [3, 7, 10, 14], [-2, 2, 5, 9]], kick: "x..x..x...x..x..", snare: "....x.......x...", hat: "x.xxx.xxx.xxx.xx", bass: "0..0o.0.0..1o.2.", lead: "3...2.1...0.1.2.", arp: false, wave: "sawtooth" },
  wheel: { bpm: 150, root: 60, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], kick: "x...x...x...x...", snare: "....x.......x.x.", hat: "xxx.xxx.xxx.xxxx", bass: "0.0o0.0o0.0o1.2.", lead: "2.3.4.3.2...1.0.", arp: true, wave: "square" },
  burrow: { bpm: 134, root: 50, chords: [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-5, -1, 2]], kick: "x.....x.x.......", snare: "....x.......x.x.", hat: "..x...x...x...x.", bass: "0.0.0o0.0.0.1.2.", lead: "0.2.1...3...2.1.", arp: true, wave: "triangle" },
};

let song: Song | null = null;
let fast = false;
let musicTimer: number | null = null;
let nextTime = 0;
let step = 0;
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function kick(t: number) {
  if (!ctx || !musicBus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  o.connect(g);
  g.connect(musicBus);
  o.start(t);
  o.stop(t + 0.25);
}

function schedule() {
  if (!ctx || !musicBus || !song) return;
  const s = song;
  const bpm = s.bpm * (fast ? 1.1 : 1);
  const six = 60 / bpm / 4;
  const shift = fast ? 2 : 0;
  while (nextTime < ctx.currentTime + 0.25) {
    const bar = Math.floor(step / 16) % s.chords.length;
    const i = step % 16;
    const chord = s.chords[bar].map((n) => n + s.root + shift);
    const d = Math.max(0, nextTime - ctx.currentTime);
    const t = ctx.currentTime + d;
    if (s.kick[i] === "x") kick(t);
    if (s.snare[i] === "x") {
      noise(0.16, 0.22, 1800, d, "bandpass", undefined, musicBus);
      tone(190, 0.08, "triangle", 0.12, d, 140, musicBus);
    }
    if (s.hat[i] === "x") noise(0.035, 0.07, 8000, d, "highpass", undefined, musicBus);
    const b = s.bass[i];
    if (b !== ".") {
      const n = b === "o" ? chord[0] + 12 : chord[Number(b) % chord.length];
      tone(midi(n - 24), six * 1.8, "square", 0.11, d, undefined, musicBus);
    }
    if (s.arp && i % 2 === 1) tone(midi(chord[(i >> 1) % chord.length] + 12), six * 0.9, "triangle", 0.05, d, undefined, musicBus);
    const l = s.lead[i];
    if (l !== ".") {
      const k = Number(l);
      const n = chord[k % chord.length] + 12 * (1 + Math.floor(k / chord.length));
      tone(midi(n), six * 3, s.wave, s.wave === "sawtooth" ? 0.05 : 0.07, d, undefined, musicBus);
    }
    step++;
    nextTime += six;
  }
}

function startMusic() {
  if (!ctx || !musicBus || musicTimer !== null || !song) return;
  nextTime = ctx.currentTime + 0.1;
  musicTimer = window.setInterval(schedule, 50);
}

function stopMusic() {
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

export function music(name: "menu" | "meadow" | "kitchen" | "burrow" | "wheel" | "off") {
  if (name === "off") {
    song = null;
    stopMusic();
    return;
  }
  const next = SONGS[name];
  if (song !== next) {
    song = next;
    step = 0;
    fast = false;
  }
  if (st.music) startMusic();
}

// Final lap: the music speeds up and moves up a key.
export function musicFast(f: boolean) {
  fast = f;
}

export function stopAll() {
  loopsOff();
  ambience(null);
}
