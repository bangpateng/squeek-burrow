// All sounds are generated with the Web Audio API. There are no audio files.

const KEY = "squeek-burrow-audio-v1";

export interface AudioSettings {
  fx: boolean;
  ticks: boolean;
  music: boolean;
  volume: number;
}

export const DEFAULT_AUDIO: AudioSettings = { fx: true, ticks: true, music: false, volume: 0.6 };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let st: AudioSettings = { ...DEFAULT_AUDIO };

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function loadAudioSettings(): AudioSettings {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "null");
    if (r && typeof r === "object") {
      return {
        fx: r.fx !== false,
        ticks: r.ticks !== false,
        music: r.music === true,
        volume: typeof r.volume === "number" ? clamp(r.volume) : DEFAULT_AUDIO.volume,
      };
    }
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_AUDIO };
}

export function applyAudioSettings(s: AudioSettings) {
  st = { ...s, volume: clamp(s.volume) };
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch {
    // storage can be unavailable
  }
  if (master) master.gain.value = st.volume;
  if (st.music) startMusic();
  else stopMusic();
}

// Browsers only allow audio after a user gesture, so call this from a click or key press.
export function initAudio() {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = st.volume;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.5;
    musicBus.connect(master);
    if (st.music) startMusic();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number, bus?: AudioNode) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(bus ?? master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
let streak = 0;
let lastForage = 0;

export const sfx = {
  // Quick clicks climb a pentatonic scale, so mashing the button sounds like a tune.
  forage() {
    if (!st.fx) return;
    const now = performance.now();
    streak = now - lastForage < 700 ? Math.min(streak + 1, PENTA.length - 1) : 0;
    lastForage = now;
    tone(392 * Math.pow(2, PENTA[streak] / 12), 0.09, "square", 0.12);
  },
  buy() {
    if (!st.fx) return;
    tone(523, 0.08, "square", 0.12);
    tone(784, 0.12, "square", 0.12, 0.07);
  },
  unlock() {
    if (!st.fx) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "triangle", 0.2, i * 0.09));
  },
  error() {
    if (!st.fx) return;
    tone(160, 0.12, "square", 0.08);
  },
  fever() {
    if (!st.fx) return;
    tone(300, 0.5, "sawtooth", 0.09, 0, 900);
    [523, 659, 784].forEach((f) => tone(f, 0.6, "square", 0.06, 0.4));
  },
  wake() {
    if (!st.fx) return;
    tone(440, 0.15, "sine", 0.2);
    tone(660, 0.22, "sine", 0.2, 0.12);
  },
  nap() {
    if (!st.fx) return;
    tone(440, 0.2, "sine", 0.15);
    tone(330, 0.4, "sine", 0.15, 0.15);
  },
  golden() {
    if (!st.fx) return;
    [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.18, "triangle", 0.16, i * 0.07));
  },
  achieve() {
    if (!st.fx) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i === 4 ? 0.4 : 0.12, "square", 0.1, i * 0.09));
  },
  hibernate() {
    if (!st.fx) return;
    tone(392, 0.7, "sine", 0.2, 0, 196);
    tone(262, 0.9, "sine", 0.15, 0.3, 131);
  },
  tick() {
    if (!st.ticks) return;
    tone(180, 0.035, "triangle", 0.07);
  },
};

// A small procedural loop: C, G, Am, F with a triangle arpeggio over a square bass.
const CHORDS = [
  { bass: 48, notes: [60, 64, 67] },
  { bass: 43, notes: [59, 62, 67] },
  { bass: 45, notes: [60, 64, 69] },
  { bass: 41, notes: [60, 65, 69] },
];
const PATTERN = [0, 1, 2, 1, 0, 1, 2, 1];
const BPM = 104;
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

let musicTimer: number | null = null;
let nextTime = 0;
let step = 0;

function schedule() {
  if (!ctx || !musicBus) return;
  const eighth = 60 / BPM / 2;
  while (nextTime < ctx.currentTime + 0.3) {
    const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
    const idx = step % 8;
    const delay = Math.max(0, nextTime - ctx.currentTime);
    tone(midi(chord.notes[PATTERN[idx]] + 12), eighth * 0.9, "triangle", 0.22, delay, undefined, musicBus);
    if (idx % 4 === 0) tone(midi(chord.bass), eighth * 3.5, "square", 0.08, delay, undefined, musicBus);
    step++;
    nextTime += eighth;
  }
}

function startMusic() {
  if (!ctx || !musicBus || musicTimer !== null) return;
  nextTime = ctx.currentTime + 0.1;
  step = 0;
  musicTimer = window.setInterval(schedule, 60);
}

function stopMusic() {
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}
