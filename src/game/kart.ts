// Arcade kart handling and the rival AI. Pure functions over plain objects.
import type { Character, UpgradeId } from "./data";
import { advanceLap, angleDiff, locate, newLap, wrap, type LapState, type TrackPath } from "./track";

export interface Stats {
  max: number; // top speed m/s
  accel: number; // m/s^2
  turn: number; // rad/s at full lock
  grass: number; // top speed share on grass
  turboRate: number; // meter fill multiplier
  turboTime: number; // seconds of boost per bar
}

export function statsFor(c: Pick<Character, "speed" | "accel" | "handling">, up: Record<UpgradeId, number>): Stats {
  return {
    max: (30 + c.speed * 2) * (1 + up.engine * 0.03),
    accel: (11 + c.accel * 2.6) * (1 + up.tires * 0.05),
    turn: 1.55 + c.handling * 0.16,
    grass: 0.52 + up.tires * 0.04,
    turboRate: 1 + up.turbo * 0.15,
    turboTime: 1.5 + up.turbo * 0.15,
  };
}

export interface Input {
  throttle: number;
  brake: number;
  steer: number; // -1 left .. 1 right
  drift: boolean;
  turbo: boolean;
  item: boolean;
}

export const NO_INPUT: Input = { throttle: 0, brake: 0, steer: 0, drift: false, turbo: false, item: false };

export type BoostKind = "none" | "blue" | "orange" | "turbo" | "pad" | "dash";

export interface Kart {
  x: number;
  z: number;
  heading: number; // 0 faces +z
  speed: number;
  slip: number;
  steer: number;
  drifting: boolean;
  driftDir: number;
  driftCharge: number;
  boost: number; // seconds left
  boostPower: number;
  boostKind: BoostKind;
  meter: number; // turbo bars, 0..3
  turboHeld: boolean;
  idx: number;
  lateral: number;
  offroad: boolean;
  wallHit: number; // seconds since the last wall hit
  lap: LapState;
  finished: boolean;
  finishTime: number;
  hop: number;
  spin: number; // seconds of spin-out left
  spinMax: number;
  shield: number; // seconds of bubble shield left
  item: string | null;
  roll: number; // seconds of item roulette left
  itemHeld: boolean;
}

export function spawnKart(path: TrackPath, idx: number, lateral: number): Kart {
  const i = wrap(idx, path.n);
  const rx = -path.tz[i];
  const rz = path.tx[i];
  return {
    x: path.px[i] + rx * lateral,
    z: path.pz[i] + rz * lateral,
    heading: Math.atan2(path.tx[i], path.tz[i]),
    speed: 0,
    slip: 0,
    steer: 0,
    drifting: false,
    driftDir: 0,
    driftCharge: 0,
    boost: 0,
    boostPower: 1,
    boostKind: "none",
    meter: 0,
    turboHeld: false,
    idx: i,
    lateral,
    offroad: false,
    wallHit: 99,
    lap: newLap(i),
    finished: false,
    finishTime: 0,
    hop: 0,
    spin: 0,
    spinMax: 1,
    shield: 0,
    item: null,
    roll: 0,
    itemHeld: false,
  };
}

export const DRIFT_BLUE = 0.75;
export const DRIFT_ORANGE = 1.7;
export const WALL_GAP = 3.5;

export interface StepEvents {
  lap: boolean;
  wall: boolean;
  boost: BoostKind | null;
  driftStart: boolean;
}

export function giveBoost(k: Kart, kind: BoostKind, time: number, power: number) {
  if (k.boost > 0 && k.boostPower > power) {
    k.boost = Math.max(k.boost, time);
    return;
  }
  k.boost = Math.max(k.boost, time);
  k.boostPower = power;
  k.boostKind = kind;
}

// Knock a kart into a spin. A shield absorbs the hit instead. Returns true when the kart was hit.
export function hitKart(k: Kart, seconds: number): boolean {
  if (k.spin > 0) return false;
  if (k.shield > 0) {
    k.shield = 0;
    return false;
  }
  k.spin = seconds;
  k.spinMax = seconds;
  k.speed *= 0.35;
  k.boost = 0;
  k.boostPower = 1;
  k.boostKind = "none";
  k.drifting = false;
  k.driftCharge = 0;
  k.hop = 0.25;
  return true;
}

// Advance one kart by dt seconds. `meterRate` scales how fast turbo fills (the live hamster doubles it).
export function stepKart(k: Kart, inp: Input, st: Stats, path: TrackPath, width: number, dt: number, meterRate = 1): StepEvents {
  const ev: StepEvents = { lap: false, wall: false, boost: null, driftStart: false };
  k.steer += (inp.steer - k.steer) * Math.min(1, dt * 10);
  k.wallHit += dt;
  k.hop = Math.max(0, k.hop - dt);
  k.shield = Math.max(0, k.shield - dt);
  if (k.spin > 0) {
    // spinning out: no control, the kart skids to a crawl
    k.spin = Math.max(0, k.spin - dt);
    inp = NO_INPUT;
    k.drifting = false;
    k.driftCharge = 0;
    k.speed *= Math.max(0, 1 - 2.6 * dt);
  }

  // drifting
  if (!k.drifting && inp.drift && Math.abs(inp.steer) > 0.3 && k.speed > 12) {
    k.drifting = true;
    k.driftDir = Math.sign(inp.steer);
    k.driftCharge = 0;
    k.hop = 0.18;
    ev.driftStart = true;
  }
  if (k.drifting && (!inp.drift || k.speed < 8 || k.offroad)) {
    if (k.driftCharge >= DRIFT_ORANGE && !k.offroad) {
      giveBoost(k, "orange", 1.25, 1.32);
      ev.boost = "orange";
    } else if (k.driftCharge >= DRIFT_BLUE && !k.offroad) {
      giveBoost(k, "blue", 0.65, 1.24);
      ev.boost = "blue";
    }
    k.drifting = false;
    k.driftCharge = 0;
  }
  let steerEff = k.steer;
  if (k.drifting) {
    steerEff = k.driftDir * (0.6 + 0.5 * Math.max(-0.8, Math.min(1, k.steer * k.driftDir)));
    k.driftCharge += dt * (0.7 + 0.5 * Math.abs(k.steer));
    k.meter = Math.min(3, k.meter + dt * 0.12 * meterRate * st.turboRate);
  }

  // turbo: one bar per press
  if (inp.turbo && !k.turboHeld && k.meter >= 1) {
    k.meter -= 1;
    giveBoost(k, "turbo", st.turboTime, 1.42);
    ev.boost = "turbo";
  }
  k.turboHeld = inp.turbo;
  k.meter = Math.min(3, k.meter + dt * 0.03 * meterRate * st.turboRate);

  // steering
  const sp = Math.abs(k.speed);
  const grip = Math.min(1, sp / 10) * (1 - 0.28 * Math.min(1, sp / st.max));
  const dir = k.speed >= 0 ? 1 : -1;
  k.heading -= steerEff * st.turn * grip * dir * dt * (k.drifting ? 1.15 : 1);

  // speed
  if (k.boost > 0) k.boost = Math.max(0, k.boost - dt);
  if (k.boost === 0) {
    k.boostPower = 1;
    k.boostKind = "none";
  }
  const top = st.max * (k.offroad && k.boost === 0 ? st.grass : 1) * k.boostPower;
  if (inp.throttle > 0 && k.speed >= -0.5) {
    if (k.speed < top) k.speed = Math.min(top, k.speed + st.accel * inp.throttle * dt * (k.boost > 0 ? 2.2 : 1) * (1 - 0.55 * Math.max(0, k.speed) / top));
  }
  if (k.speed > top) k.speed = Math.max(top, k.speed - (k.speed - top) * 2.2 * dt - 6 * dt);
  if (k.boost > 0 && k.speed < top) k.speed = Math.min(top, k.speed + 30 * dt);
  if (inp.brake > 0) {
    if (k.speed > 0.5) k.speed = Math.max(0, k.speed - 30 * inp.brake * dt);
    else if (inp.throttle === 0) k.speed = Math.max(-9, k.speed - 9 * inp.brake * dt);
  }
  if (inp.throttle === 0 && inp.brake === 0) {
    const drag = 5 * dt;
    k.speed = Math.abs(k.speed) <= drag ? 0 : k.speed - Math.sign(k.speed) * drag;
  }

  // slide sideways while drifting
  const slipTarget = k.drifting ? -k.driftDir * Math.min(9, sp * 0.22) : 0;
  k.slip += (slipTarget - k.slip) * Math.min(1, dt * (k.drifting ? 3 : 7));

  const fx = Math.sin(k.heading);
  const fz = Math.cos(k.heading);
  const rx = -fz;
  const rz = fx;
  k.x += (fx * k.speed + rx * k.slip) * dt;
  k.z += (fz * k.speed + rz * k.slip) * dt;

  // keep to the track
  const loc = locate(path, k.x, k.z, k.idx);
  k.idx = loc.i;
  k.lateral = loc.lateral;
  const limit = width + WALL_GAP;
  if (Math.abs(loc.lateral) > limit) {
    const tx = -path.tz[loc.i];
    const tz = path.tx[loc.i];
    const push = Math.abs(loc.lateral) - limit;
    const s = Math.sign(loc.lateral);
    k.x -= tx * push * s;
    k.z -= tz * push * s;
    k.lateral = s * limit;
    if (k.wallHit > 0.35 && Math.abs(k.speed) > 6) {
      k.speed *= 0.72;
      ev.wall = true;
      k.wallHit = 0;
    }
    // turn the nose back along the road
    const along = Math.atan2(path.tx[loc.i], path.tz[loc.i]);
    const d = angleDiff(k.heading, along);
    if (Math.abs(d) < Math.PI / 2) k.heading += d * Math.min(1, dt * 4);
    k.slip *= 0.5;
  }
  k.offroad = Math.abs(k.lateral) > width;

  const lapStep = advanceLap(k.lap, k.idx, path.n);
  k.lap = lapStep.s;
  ev.lap = lapStep.crossed;
  return ev;
}

// ---------- AI ----------

export interface Brain {
  lane: number; // preferred offset share -1..1
  laneT: number;
  skill: number; // top speed multiplier
  mistake: number;
  seed: number;
}

export function newBrain(seed: number, skill: number): Brain {
  return { lane: 0, laneT: 0, skill, mistake: 0, seed };
}

function rand(b: Brain): number {
  b.seed = (b.seed * 16807) % 2147483647;
  return (b.seed - 1) / 2147483646;
}

// `top` is the speed this rival aims for on a straight, already scaled for skill and catch-up.
export function think(k: Kart, b: Brain, path: TrackPath, width: number, dt: number, top: number): Input {
  b.laneT -= dt;
  if (b.laneT <= 0) {
    b.lane = (rand(b) * 2 - 1) * 0.55;
    b.laneT = 2 + rand(b) * 3;
  }
  const look = Math.round(9 + Math.max(0, k.speed) * 0.55);
  const ti = wrap(k.idx + look, path.n);
  // cut to the inside of the coming bend
  const turn = angleDiff(Math.atan2(path.tx[k.idx], path.tz[k.idx]), Math.atan2(path.tx[ti], path.tz[ti]));
  const inside = Math.max(-0.45, Math.min(0.45, -turn * 1.2));
  const off = (b.lane * 0.35 + inside) * width;
  const rx = -path.tz[ti];
  const rz = path.tx[ti];
  const gx = path.px[ti] + rx * off;
  const gz = path.pz[ti] + rz * off;
  const want = Math.atan2(gx - k.x, gz - k.z);
  const err = angleDiff(k.heading, want);
  const steer = Math.max(-1, Math.min(1, -err * 2.6));

  const c = path.curve[k.idx];
  const target = top * (1 - Math.min(0.42, c * 0.2));
  const ratio = k.speed / Math.max(1, target);
  b.mistake = Math.max(0, b.mistake - dt);
  if (b.mistake === 0 && rand(b) < dt * 0.04) b.mistake = 0.4 + rand(b) * 0.5;
  return {
    throttle: b.mistake > 0 ? 0.4 : ratio < 1 ? 1 : 0,
    brake: ratio > 1.12 ? 0.6 : 0,
    steer,
    drift: c > 0.75 && k.speed > 18 && Math.abs(steer) > 0.35,
    turbo: k.meter >= 1 && c < 0.25 && rand(b) < dt * 0.8,
    item: false,
  };
}
