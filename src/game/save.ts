import { CHARACTERS, EVENTS, MAX_UPGRADE, REGION_GATE, TRACK_ORDER, eventById, rewardFor, starsFor, upgradeCost, type CharId, type TrackId, type UpgradeId } from "./data";

export const SAVE_KEY = "squeek-burrow-3d-v1";

export interface EventRecord {
  stars: number;
  best: number | null; // race: best place, trial: best seconds, rush: most seeds
}

export interface GameSave {
  v: 1;
  seeds: number;
  char: string; // selected racer: "sq-<tokenId>" for a Squeek NFT, or a classic id
  owned: CharId[];
  upgrades: Record<UpgradeId, number>;
  records: Record<string, EventRecord>;
  lastTrack: TrackId;
  races: number;
  wins: number;
  createdAt: number;
}

export function newSave(now: number): GameSave {
  return {
    v: 1,
    seeds: 0,
    char: "squeek",
    owned: ["squeek"],
    upgrades: { engine: 0, tires: 0, turbo: 0 },
    records: {},
    lastTrack: "meadow",
    races: 0,
    wins: 0,
    createdAt: now,
  };
}

const nat = (x: unknown, d = 0) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.floor(x) : d);

export function migrateSave(raw: unknown, now: number): GameSave | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<GameSave>;
  if (r.v !== 1) return null;
  const base = newSave(now);
  const ids = CHARACTERS.map((c) => c.id);
  const owned = Array.isArray(r.owned) ? r.owned.filter((c): c is CharId => ids.includes(c as CharId)) : [];
  if (!owned.includes("squeek")) owned.unshift("squeek");
  const char = typeof r.char === "string" && (/^sq-\d{1,6}$/.test(r.char) || (ids.includes(r.char as CharId) && owned.includes(r.char as CharId))) ? r.char : "squeek";
  const upgrades = { ...base.upgrades };
  for (const k of Object.keys(upgrades) as UpgradeId[]) upgrades[k] = Math.min(MAX_UPGRADE, nat(r.upgrades?.[k]));
  const records: Record<string, EventRecord> = {};
  if (r.records && typeof r.records === "object") {
    for (const e of EVENTS) {
      const rec = (r.records as Record<string, unknown>)[e.id] as Partial<EventRecord> | undefined;
      if (!rec) continue;
      const best = typeof rec.best === "number" && Number.isFinite(rec.best) && rec.best >= 0 ? rec.best : null;
      records[e.id] = { stars: Math.min(3, nat(rec.stars)), best };
    }
  }
  return {
    v: 1,
    seeds: nat(r.seeds),
    char,
    owned: [...new Set(owned)],
    upgrades,
    records,
    lastTrack: TRACK_ORDER.includes(r.lastTrack as TrackId) ? (r.lastTrack as TrackId) : "meadow",
    races: nat(r.races),
    wins: nat(r.wins),
    createdAt: nat(r.createdAt, now),
  };
}

export function totalStars(s: GameSave): number {
  return Object.values(s.records).reduce((a, r) => a + r.stars, 0);
}

export function regionOpen(s: GameSave, t: TrackId): boolean {
  return totalStars(s) >= REGION_GATE[t];
}

export function regionStars(s: GameSave, t: TrackId): number {
  return EVENTS.filter((e) => e.track === t).reduce((a, e) => a + (s.records[e.id]?.stars ?? 0), 0);
}

function better(kind: string, a: number, b: number | null): boolean {
  if (b === null) return true;
  return kind === "rush" ? a > b : a < b;
}

export interface Outcome {
  save: GameSave;
  stars: number;
  seeds: number;
  newBest: boolean;
}

// Apply a finished event. `value` is the place, the time in seconds or the seeds collected. `bonus` multiplies seeds.
export function applyResult(s: GameSave, eventId: string, value: number, bonus = 1): Outcome {
  const e = eventById(eventId);
  if (!e) return { save: s, stars: 0, seeds: 0, newBest: false };
  const prev = s.records[e.id] ?? { stars: 0, best: null };
  const stars = starsFor(e, value);
  const seeds = Math.round(rewardFor(e, stars, prev.stars) * bonus);
  const newBest = better(e.kind, value, prev.best);
  const records = { ...s.records, [e.id]: { stars: Math.max(prev.stars, stars), best: newBest ? value : prev.best } };
  const won = e.kind === "race" && value === 1;
  return {
    save: { ...s, seeds: s.seeds + seeds, records, lastTrack: e.track, races: s.races + 1, wins: s.wins + (won ? 1 : 0) },
    stars,
    seeds,
    newBest,
  };
}

export function canUnlock(s: GameSave, id: CharId): boolean {
  const c = CHARACTERS.find((x) => x.id === id);
  return !!c && !s.owned.includes(id) && s.seeds >= c.cost;
}

export function unlockChar(s: GameSave, id: CharId): GameSave {
  if (!canUnlock(s, id)) return s;
  const c = CHARACTERS.find((x) => x.id === id)!;
  return { ...s, seeds: s.seeds - c.cost, owned: [...s.owned, id], char: id };
}

export function selectChar(s: GameSave, id: string): GameSave {
  return /^sq-\d{1,6}$/.test(id) || s.owned.includes(id as CharId) ? { ...s, char: id } : s;
}

export function canUpgrade(s: GameSave, id: UpgradeId): boolean {
  const lvl = s.upgrades[id];
  return lvl < MAX_UPGRADE && s.seeds >= upgradeCost(id, lvl);
}

export function buyUpgrade(s: GameSave, id: UpgradeId): GameSave {
  if (!canUpgrade(s, id)) return s;
  const lvl = s.upgrades[id];
  return { ...s, seeds: s.seeds - upgradeCost(id, lvl), upgrades: { ...s.upgrades, [id]: lvl + 1 } };
}

export function loadSave(): GameSave | null {
  try {
    return migrateSave(JSON.parse(localStorage.getItem(SAVE_KEY) || "null"), Date.now());
  } catch {
    return null;
  }
}

export function writeSave(s: GameSave) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // storage can be unavailable (private mode); the game still runs
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
