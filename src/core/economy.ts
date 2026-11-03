export type UpgradeId = "pouch" | "farm" | "tunnels" | "spa" | "observatory";

export interface Upgrade {
  id: UpgradeId;
  name: string;
  blurb: string;
  baseCost: number;
  rate: number;
}

export const UPGRADES: Upgrade[] = [
  { id: "pouch", name: "Cheek pouches", blurb: "Stuffed cheeks mean bigger hauls when you forage.", baseCost: 15, rate: 0.5 },
  { id: "farm", name: "Seed farm", blurb: "Sunflowers keep growing, even while you are away.", baseCost: 100, rate: 4 },
  { id: "tunnels", name: "Tunnel network", blurb: "More rooms, more hamsters on the job.", baseCost: 1100, rate: 30 },
  { id: "spa", name: "Hamster spa", blurb: "Rested hamsters work twice as hard.", baseCost: 12000, rate: 200 },
  { id: "observatory", name: "Moon observatory", blurb: "Harvest the seeds that only fall at night.", baseCost: 130000, rate: 1500 },
];

export const GROWTH = 1.15;
export const OFFLINE_CAP_S = 8 * 3600;
export const DREAM_STEP = 50000;
export const DREAM_BONUS = 0.1;
export const ACH_BONUS = 0.01;
export const RUNNING_MULT = 3;
export const NAPPING_MULT = 0.1;
export const FEVER_MULT = 2;
export const GOLDEN_SECONDS = 45;
export const MAX_BULK = 1000;
export const KEY = "squeek-burrow-save-v1";

export type BuyMode = 1 | 10 | "max";

export interface Save {
  v: 1;
  seeds: number;
  total: number;
  allTime: number;
  owned: Record<UpgradeId, number>;
  dream: number;
  hibernations: number;
  ach: string[];
  golden: number;
  fevers: number;
  lastSeen: number;
}

export function emptySave(now: number): Save {
  return {
    v: 1,
    seeds: 15,
    total: 15,
    allTime: 15,
    owned: { pouch: 0, farm: 0, tunnels: 0, spa: 0, observatory: 0 },
    dream: 0,
    hibernations: 0,
    ach: [],
    golden: 0,
    fevers: 0,
    lastSeen: now,
  };
}

const find = (id: UpgradeId) => UPGRADES.find((u) => u.id === id)!;

export function cost(id: UpgradeId, owned: number): number {
  return Math.ceil(find(id).baseCost * Math.pow(GROWTH, owned));
}

export function costBulk(id: UpgradeId, owned: number, n: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) total += cost(id, owned + i);
  return total;
}

export function maxAffordable(s: Save, id: UpgradeId): number {
  let n = 0;
  let spent = 0;
  while (n < MAX_BULK) {
    const next = cost(id, s.owned[id] + n);
    if (spent + next > s.seeds) break;
    spent += next;
    n++;
  }
  return n;
}

export function buyCount(s: Save, id: UpgradeId, mode: BuyMode): number {
  return mode === "max" ? maxAffordable(s, id) : mode;
}

export function canBuy(s: Save, id: UpgradeId, n = 1): boolean {
  return n >= 1 && s.seeds >= costBulk(id, s.owned[id], n);
}

export function buy(s: Save, id: UpgradeId, n = 1): Save {
  if (!canBuy(s, id, n)) return s;
  const price = costBulk(id, s.owned[id], n);
  return { ...s, seeds: s.seeds - price, owned: { ...s.owned, [id]: s.owned[id] + n } };
}

export function baseRate(s: Save): number {
  return UPGRADES.reduce((sum, u) => sum + s.owned[u.id] * u.rate, 0);
}

export function dreamBonus(s: Save): number {
  return 1 + DREAM_BONUS * s.dream;
}

export function achBonus(s: Save): number {
  return 1 + ACH_BONUS * s.ach.length;
}

export function wheelMultiplier(running: boolean, fever: boolean): number {
  return (running ? RUNNING_MULT : NAPPING_MULT) * (fever ? FEVER_MULT : 1);
}

export function perSecond(s: Save, mult: number): number {
  return baseRate(s) * dreamBonus(s) * achBonus(s) * mult;
}

export function addSeeds(s: Save, n: number): Save {
  if (n <= 0) return s;
  return { ...s, seeds: s.seeds + n, total: s.total + n, allTime: s.allTime + n };
}

export function tick(s: Save, dtSec: number, mult: number): Save {
  return addSeeds(s, perSecond(s, mult) * dtSec);
}

export function forageGain(s: Save): number {
  return (1 + s.owned.pouch) * dreamBonus(s) * achBonus(s);
}

export function forage(s: Save): Save {
  return addSeeds(s, forageGain(s));
}

export function goldenReward(s: Save, mult: number): number {
  return Math.max(50, Math.floor(perSecond(s, mult) * GOLDEN_SECONDS));
}

export function catchGolden(s: Save, mult: number): Save {
  const next = addSeeds(s, goldenReward(s, mult));
  return { ...next, golden: next.golden + 1 };
}

// Away time earns at base speed: the wheel bonus only applies while you watch.
export function awayGain(s: Save, seconds: number): number {
  if (seconds <= 5) return 0;
  return baseRate(s) * dreamBonus(s) * achBonus(s) * Math.min(seconds, OFFLINE_CAP_S);
}

export function dreamGain(s: Save): number {
  return Math.floor(Math.sqrt(s.total / DREAM_STEP));
}

export function hibernate(s: Save, now: number): Save {
  const gain = dreamGain(s);
  if (gain < 1) return s;
  return {
    ...emptySave(now),
    total: 0,
    allTime: s.allTime,
    dream: s.dream + gain,
    hibernations: s.hibernations + 1,
    ach: s.ach,
    golden: s.golden,
    fevers: s.fevers,
  };
}

export function isUnlocked(s: Save, index: number): boolean {
  return index === 0 || s.owned[UPGRADES[index - 1].id] > 0;
}

export function level(s: Save): number {
  return UPGRADES.reduce((n, u) => n + s.owned[u.id], 0);
}

export function migrate(raw: unknown, now: number): Save {
  const base = emptySave(now);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Save>;
  if (r.v !== 1) return base;
  const num = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : d);
  const owned = { ...base.owned };
  for (const u of UPGRADES) owned[u.id] = Math.floor(num(r.owned?.[u.id], 0));
  const ach = Array.isArray(r.ach) ? r.ach.filter((x): x is string => typeof x === "string") : [];
  return {
    v: 1,
    seeds: num(r.seeds, base.seeds),
    total: num(r.total, base.total),
    allTime: num(r.allTime, base.allTime),
    owned,
    dream: Math.floor(num(r.dream, 0)),
    hibernations: Math.floor(num(r.hibernations, 0)),
    ach: [...new Set(ach)],
    golden: Math.floor(num(r.golden, 0)),
    fevers: Math.floor(num(r.fevers, 0)),
    lastSeen: num(r.lastSeen, now),
  };
}

export function fmt(n: number): string {
  if (n < 1000) return Math.floor(n).toLocaleString("en-US");
  const units = ["K", "M", "B", "T"];
  let v = n;
  let i = -1;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)}${units[i]}`;
}
