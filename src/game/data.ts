// Static game content: hamsters, regions, events and garage upgrades.

export type CharId = "squeek" | "nibbles" | "biscuit" | "mochi";
export type TrackId = "meadow" | "kitchen" | "burrow";
export type EventKind = "race" | "trial" | "rush";
export type UpgradeId = "engine" | "tires" | "turbo";

export interface Character {
  id: CharId;
  name: string;
  blurb: string;
  fur: number; // body colour
  belly: number;
  kart: number; // kart paint
  speed: number; // 1..5
  accel: number;
  handling: number;
  cost: number; // seeds to unlock, 0 = free
}

export const CHARACTERS: Character[] = [
  { id: "squeek", name: "Squeek", blurb: "The wheel champion. Good at everything.", fur: 0xe8a65a, belly: 0xfff0d4, kart: 0xe2463f, speed: 3, accel: 3, handling: 3, cost: 0 },
  { id: "nibbles", name: "Nibbles", blurb: "Tiny and twitchy. Off the line before you blink.", fur: 0xc9c2b8, belly: 0xffffff, kart: 0x3a8dde, speed: 2, accel: 5, handling: 4, cost: 300 },
  { id: "biscuit", name: "Biscuit", blurb: "A round heavyweight with a huge top speed.", fur: 0x8a5a3a, belly: 0xe9c99a, kart: 0xf2b630, speed: 5, accel: 2, handling: 2, cost: 800 },
  { id: "mochi", name: "Mochi", blurb: "Glides through corners like warm butter.", fur: 0xf4f0ea, belly: 0xffe3ea, kart: 0x5bbf6a, speed: 3, accel: 3, handling: 5, cost: 1500 },
];

export interface TrackTheme {
  sky: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  ground: number;
  road: number;
  kerbA: number;
  kerbB: number;
  wall: number;
  sun: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  night: boolean;
}

export interface TrackDef {
  id: TrackId;
  name: string;
  region: string;
  blurb: string;
  width: number; // road half width in metres
  points: [number, number][]; // closed loop, x/z
  theme: TrackTheme;
}

export const TRACKS: Record<TrackId, TrackDef> = {
  meadow: {
    id: "meadow",
    name: "Sunflower Loop",
    region: "Sunflower Meadow",
    blurb: "Wide, sunny and forgiving. Learn to drift here.",
    width: 9,
    points: [
      [0, -90], [70, -95], [120, -60], [125, 0], [95, 45], [40, 40], [10, 75], [-30, 105], [-90, 95], [-120, 40], [-100, -20], [-60, -70],
    ],
    theme: {
      sky: 0x8fdcec, fog: 0xbfe9f2, fogNear: 120, fogFar: 420, ground: 0x6cbf5a, road: 0x5c5560, kerbA: 0xe2463f, kerbB: 0xffffff,
      wall: 0xf2d38a, sun: 0xfff2d8, sunIntensity: 2.4, hemiSky: 0xcfefff, hemiGround: 0x5a8a3a, night: false,
    },
  },
  kitchen: {
    id: "kitchen",
    name: "Counter Dash",
    region: "Kitchen Counter",
    blurb: "Tight turns between giant cups and cheese.",
    width: 7.5,
    points: [
      [-100, -60], [-20, -70], [30, -40], [80, -75], [120, -30], [100, 20], [40, 10], [20, 60], [70, 90], [20, 120], [-60, 110], [-80, 60], [-40, 30], [-110, 10],
    ],
    theme: {
      sky: 0xf6e3c4, fog: 0xf3dcc0, fogNear: 110, fogFar: 380, ground: 0xc58a55, road: 0xece7df, kerbA: 0x3a8dde, kerbB: 0xffffff,
      wall: 0xd96b4a, sun: 0xfff6e8, sunIntensity: 2.2, hemiSky: 0xfff1dc, hemiGround: 0x8a5a3a, night: false,
    },
  },
  burrow: {
    id: "burrow",
    name: "Moonlit Burrow",
    region: "The Deep Burrow",
    blurb: "Night tunnels lit by glowing mushrooms.",
    width: 7,
    points: [
      [0, -110], [60, -100], [110, -120], [140, -60], [100, -20], [130, 40], [90, 100], [30, 80], [0, 120], [-60, 110], [-70, 50], [-20, 20], [-90, -10], [-130, -60], [-70, -100],
    ],
    theme: {
      sky: 0x1b1630, fog: 0x231c3a, fogNear: 50, fogFar: 260, ground: 0x3b2b2a, road: 0x4a4250, kerbA: 0x8a6bff, kerbB: 0x2ee6c8,
      wall: 0x5b4348, sun: 0xb9c4ff, sunIntensity: 0.9, hemiSky: 0x5a62a8, hemiGround: 0x2a1a1e, night: true,
    },
  },
};

// Track outlines above are drawn small; every track is scaled up by this much.
export const TRACK_SCALE = 1.45;

export const TRACK_ORDER: TrackId[] = ["meadow", "kitchen", "burrow"];

export interface EventDef {
  id: string;
  track: TrackId;
  kind: EventKind;
  name: string;
  laps: number;
  rivals: number;
  difficulty: number; // AI skill 0..1
  // stars: race uses finishing place; trial uses seconds (lower is better); rush uses seeds collected
  stars: [number, number, number];
  reward: number; // seeds for 3 stars, scaled down for fewer
}

export const EVENTS: EventDef[] = [
  { id: "meadow-race", track: "meadow", kind: "race", name: "Meadow Grand Prix", laps: 3, rivals: 5, difficulty: 0.55, stars: [3, 2, 1], reward: 220 },
  { id: "meadow-trial", track: "meadow", kind: "trial", name: "Sunflower Time Trial", laps: 3, rivals: 0, difficulty: 0, stars: [115, 100, 90], reward: 160 },
  { id: "meadow-rush", track: "meadow", kind: "rush", name: "Seed Rush", laps: 0, rivals: 0, difficulty: 0, stars: [25, 40, 55], reward: 160 },
  { id: "kitchen-race", track: "kitchen", kind: "race", name: "Counter Cup", laps: 3, rivals: 5, difficulty: 0.72, stars: [3, 2, 1], reward: 360 },
  { id: "kitchen-trial", track: "kitchen", kind: "trial", name: "Crumb Clock", laps: 3, rivals: 0, difficulty: 0, stars: [145, 128, 116], reward: 260 },
  { id: "kitchen-rush", track: "kitchen", kind: "rush", name: "Pantry Rush", laps: 0, rivals: 0, difficulty: 0, stars: [25, 40, 55], reward: 260 },
  { id: "burrow-race", track: "burrow", kind: "race", name: "Moonlight Cup", laps: 3, rivals: 5, difficulty: 0.86, stars: [3, 2, 1], reward: 520 },
  { id: "burrow-trial", track: "burrow", kind: "trial", name: "Tunnel Sprint", laps: 3, rivals: 0, difficulty: 0, stars: [158, 140, 127], reward: 380 },
  { id: "burrow-rush", track: "burrow", kind: "rush", name: "Glow Rush", laps: 0, rivals: 0, difficulty: 0, stars: [25, 40, 55], reward: 380 },
];

export const RUSH_SECONDS = 90;

// Stars needed before a region opens on the map.
export const REGION_GATE: Record<TrackId, number> = { meadow: 0, kitchen: 4, burrow: 10 };

export interface Upgrade {
  id: UpgradeId;
  name: string;
  blurb: string;
  base: number;
}

export const UPGRADES: Upgrade[] = [
  { id: "engine", name: "Wheel engine", blurb: "Higher top speed.", base: 150 },
  { id: "tires", name: "Grippy tyres", blurb: "Faster acceleration and less slowdown on grass.", base: 120 },
  { id: "turbo", name: "Cheek tank", blurb: "Turbo charges faster and lasts longer.", base: 140 },
];
export const MAX_UPGRADE = 4;

export function upgradeCost(id: UpgradeId, level: number): number {
  const u = UPGRADES.find((x) => x.id === id)!;
  return Math.round(u.base * Math.pow(1.9, level));
}

export function eventById(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}

// 0..3 stars from a result value.
export function starsFor(e: EventDef, value: number): number {
  if (e.kind === "race") return value <= e.stars[2] ? 3 : value <= e.stars[1] ? 2 : value <= e.stars[0] ? 1 : 0;
  if (e.kind === "trial") return value <= e.stars[2] ? 3 : value <= e.stars[1] ? 2 : value <= e.stars[0] ? 1 : 0;
  return value >= e.stars[2] ? 3 : value >= e.stars[1] ? 2 : value >= e.stars[0] ? 1 : 0;
}

// Seeds paid for a result. Only stars above your previous best pay the full reward; repeats pay a little.
export function rewardFor(e: EventDef, stars: number, prevStars: number): number {
  const share = [0, 0.35, 0.65, 1];
  const fresh = Math.max(0, share[stars] - share[prevStars]) * e.reward;
  const repeat = stars > 0 ? e.reward * 0.15 : 20;
  return Math.round(fresh + repeat);
}
