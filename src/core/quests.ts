// Wheel quests: a goal everyone shares (read from the wheel's work counter) and a forecast of what the hamster does next.
export const QUEST_KEY = "squeek-burrow-quests-v1";
export const GOAL_UNITS = 250;
export const PREDICT_MS = 5 * 60_000;
export const PREDICT_GRACE_MS = 90_000;

export interface Prediction {
  guess: boolean; // true = running when the time is up
  from: boolean; // was the hamster running when the guess was made
  resolveAt: number;
}

export interface Quests {
  v: 1;
  goalIndex: number | null; // last goal index seen; goals are GOAL_UNITS wide
  goalsDone: number;
  pending: Prediction | null;
  wins: number;
  losses: number;
  streak: number;
  best: number;
}

export function emptyQuests(): Quests {
  return { v: 1, goalIndex: null, goalsDone: 0, pending: null, wins: 0, losses: 0, streak: 0, best: 0 };
}

export function migrateQuests(raw: unknown): Quests {
  const base = emptyQuests();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Quests>;
  if (r.v !== 1) return base;
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
  const p = r.pending;
  const pending =
    p && typeof p.guess === "boolean" && typeof p.from === "boolean" && typeof p.resolveAt === "number" && Number.isFinite(p.resolveAt)
      ? { guess: p.guess, from: p.from, resolveAt: p.resolveAt }
      : null;
  return {
    v: 1,
    goalIndex: r.goalIndex === null || r.goalIndex === undefined ? null : n(r.goalIndex),
    goalsDone: n(r.goalsDone),
    pending,
    wins: n(r.wins),
    losses: n(r.losses),
    streak: n(r.streak),
    best: n(r.best),
  };
}

export interface GoalProgress {
  into: number;
  target: number;
  remaining: number;
  pct: number;
  index: number;
}

export function goalProgress(units: number): GoalProgress {
  const index = Math.floor(units / GOAL_UNITS);
  const into = units - index * GOAL_UNITS;
  return { into, target: GOAL_UNITS, remaining: GOAL_UNITS - into, pct: into / GOAL_UNITS, index };
}

export function goalReward(perSec: number): number {
  return Math.max(100, Math.floor(perSec * 120));
}

// The first sighting only sets a baseline. A later goal index pays out once, however many goals were skipped.
export function checkGoal(q: Quests, units: number): { q: Quests; reached: boolean } {
  const idx = Math.floor(units / GOAL_UNITS);
  if (q.goalIndex === null) return { q: { ...q, goalIndex: idx }, reached: false };
  if (idx > q.goalIndex) return { q: { ...q, goalIndex: idx, goalsDone: q.goalsDone + 1 }, reached: true };
  // counter went backwards (a new counter epoch): follow it without paying out
  if (idx < q.goalIndex) return { q: { ...q, goalIndex: idx }, reached: false };
  return { q, reached: false };
}

// A guess against the current state pays double, because staying the same is the easy call.
export function predictionMult(from: boolean, guess: boolean): number {
  return from === guess ? 1 : 2;
}

export function predictionReward(perSec: number, streak: number, from: boolean, guess: boolean): number {
  const base = Math.max(75, perSec * 60);
  return Math.floor(base * predictionMult(from, guess) * (1 + Math.min(streak, 5) * 0.2));
}

export function startPrediction(q: Quests, guess: boolean, runningNow: boolean, now: number): Quests {
  if (q.pending) return q;
  return { ...q, pending: { guess, from: runningNow, resolveAt: now + PREDICT_MS } };
}

export type Outcome = "win" | "loss" | "void";

// Judged on the first look at the wheel after the time is up. A late look voids the guess.
export function resolvePrediction(q: Quests, runningNow: boolean, now: number): { q: Quests; outcome: Outcome | null } {
  const p = q.pending;
  if (!p || now < p.resolveAt) return { q, outcome: null };
  if (now > p.resolveAt + PREDICT_GRACE_MS) return { q: { ...q, pending: null }, outcome: "void" };
  if (p.guess === runningNow) {
    const streak = q.streak + 1;
    return { q: { ...q, pending: null, wins: q.wins + 1, streak, best: Math.max(q.best, streak) }, outcome: "win" };
  }
  return { q: { ...q, pending: null, losses: q.losses + 1, streak: 0 }, outcome: "loss" };
}
