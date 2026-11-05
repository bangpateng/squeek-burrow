import assert from "node:assert/strict";
import { CHARACTERS, EVENTS, TRACKS, TRACK_ORDER, TRACK_SCALE, eventById, rewardFor, starsFor } from "./data";
import { NO_INPUT, newBrain, spawnKart, statsFor, stepKart, think } from "./kart";
import { applyResult, buyUpgrade, canUnlock, migrateSave, newSave, regionOpen, totalStars, unlockChar } from "./save";
import { advanceLap, buildPath, locate, locateGlobal, newLap, progress } from "./track";

// paths are closed, about a metre per sample
for (const id of TRACK_ORDER) {
  const p = buildPath(TRACKS[id].points, TRACK_SCALE);
  assert.ok(p.length > 500 && p.length < 1600, `${id} length ${p.length}`);
  assert.ok(Math.abs(p.length / p.n - 1) < 0.05);
  const l = locate(p, p.px[10] + 2 * -p.tz[10], p.pz[10] + 2 * p.tx[10], 12);
  assert.equal(l.i, 10);
  assert.ok(Math.abs(l.lateral - 2) < 0.01);
  console.log(`${id}: ${Math.round(p.length)} m`);
}

// laps: crossing needs the half-way point, reversing over the line undoes it
const n = 1000;
let ls = newLap(990);
for (const i of [995, 5, 100]) ls = advanceLap(ls, i, n).s;
assert.equal(ls.lap, 0);
for (const i of [300, 500, 700, 900, 999]) ls = advanceLap(ls, i, n).s;
const c = advanceLap(ls, 3, n);
assert.equal(c.crossed, true);
assert.equal(c.s.lap, 1);
assert.equal(advanceLap(c.s, 995, n).s.lap, 0);
assert.ok(progress(newLap(990), 990, n) < 0);

// stars and rewards
const race = eventById("meadow-race")!;
assert.equal(starsFor(race, 1), 3);
assert.equal(starsFor(race, 3), 1);
assert.equal(starsFor(race, 4), 0);
const rush = eventById("meadow-rush")!;
assert.equal(starsFor(rush, 60), 3);
assert.equal(starsFor(rush, 10), 0);
assert.equal(rewardFor(race, 3, 0), Math.round(race.reward * 1.15));
assert.ok(rewardFor(race, 3, 3) < race.reward * 0.2);

// save: results, unlocks, upgrades, gates
let s = newSave(1);
assert.equal(regionOpen(s, "kitchen"), false);
let o = applyResult(s, "meadow-race", 1);
assert.equal(o.stars, 3);
s = o.save;
assert.equal(s.wins, 1);
o = applyResult(s, "meadow-race", 4);
assert.equal(o.save.records["meadow-race"].stars, 3);
assert.equal(o.save.records["meadow-race"].best, 1);
s = applyResult(s, "meadow-trial", 90).save;
assert.equal(totalStars(s), 6);
assert.equal(regionOpen(s, "kitchen"), true);
assert.equal(canUnlock(s, "nibbles"), s.seeds >= 300);
s = { ...s, seeds: 5000 };
s = unlockChar(s, "mochi");
assert.ok(s.owned.includes("mochi"));
assert.equal(s.char, "mochi");
assert.equal(s.seeds, 3500);
s = buyUpgrade(s, "engine");
assert.equal(s.upgrades.engine, 1);
const m = migrateSave(JSON.parse(JSON.stringify(s)), 2)!;
assert.deepEqual(m, s);
assert.equal(migrateSave({ v: 1, char: "ghost", owned: ["ghost"], seeds: -5, upgrades: { engine: 99 } }, 2)!.char, "squeek");
assert.equal(migrateSave({ v: 1, upgrades: { engine: 99 } }, 2)!.upgrades.engine, 4);
assert.equal(migrateSave(null, 1), null);
assert.equal(EVENTS.length, 11);
assert.equal(starsFor(eventById("wheel-ghost")!, 3), 3);
assert.equal(starsFor(eventById("wheel-round")!, 1), 3);

// a rival can lap every track and is held to the road
for (const id of TRACK_ORDER) {
  const t = TRACKS[id];
  const p = buildPath(t.points, TRACK_SCALE);
  const st = statsFor(CHARACTERS[0], { engine: 0, tires: 0, turbo: 0 });
  const k = spawnKart(p, p.n - 12, 0);
  const b = newBrain(7, 1);
  let time = 0;
  let maxLat = 0;
  while (k.lap.lap < 3 && time < 400) {
    const inp = think(k, b, p, t.width, 1 / 60, st.max * 0.97);
    stepKart(k, inp, st, p, t.width, 1 / 60);
    maxLat = Math.max(maxLat, Math.abs(k.lateral));
    time += 1 / 60;
  }
  assert.equal(k.lap.lap, 3, `${id} AI finished`);
  console.log(`${id}: AI 3 laps in ${time.toFixed(1)} s, widest ${maxLat.toFixed(1)} m of ${t.width}`);
}

// a parked kart stays parked, throttle moves it
{
  const p = buildPath(TRACKS.meadow.points, TRACK_SCALE);
  const st = statsFor(CHARACTERS[0], { engine: 0, tires: 0, turbo: 0 });
  const k = spawnKart(p, 0, 0);
  stepKart(k, NO_INPUT, st, p, 9, 0.1);
  assert.equal(k.speed, 0);
  for (let i = 0; i < 90; i++) stepKart(k, { ...NO_INPUT, throttle: 1 }, st, p, 9, 1 / 60);
  assert.ok(k.speed > 15, `speed ${k.speed}`);
}
console.log("sim tests passed");

// ---- items ----
import { ITEM_LIST, itemWeights, rollItem, stepBomb, stepShot, type Shot } from "./items";
import { hitKart } from "./kart";
{
  assert.equal(itemWeights(1, 6).dash, 0);
  assert.ok(itemWeights(6, 6).cheese > itemWeights(1, 6).cheese);
  let seed = 3;
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) seen.add(rollItem(4, 6, r));
  assert.equal(seen.size, ITEM_LIST.length);
  for (let i = 0; i < 200; i++) assert.notEqual(rollItem(1, 6, r), "dash");

  const p = buildPath(TRACKS.kitchen.points, TRACK_SCALE);
  const w = TRACKS.kitchen.width;
  // an acorn fired sideways bounces and stays inside the walls
  const s: Shot = { kind: "acorn", x: p.px[50], z: p.pz[50], vx: -p.tz[50] * 58, vz: p.tx[50] * 58, idx: 50, life: 6, bounces: 0, owner: 0, safe: 0.4, target: -1 };
  let walls = 0;
  let state = "ok";
  for (let i = 0; i < 600 && state !== "dead"; i++) {
    state = stepShot(s, p, w, 1 / 120, null);
    if (state === "wall") walls++;
    const l = locateGlobal(p, s.x, s.z);
    assert.ok(Math.abs(l.lateral) < w + 4.5, "acorn inside walls");
  }
  assert.ok(walls >= 1, "acorn bounced");
  // homing cheese catches a kart parked up the road
  const k = spawnKart(p, 140, 2);
  const c: Shot = { kind: "cheese", x: p.px[60], z: p.pz[60], vx: p.tx[60] * 52, vz: p.tz[60] * 52, idx: 60, life: 8, bounces: 0, owner: 0, safe: 0, target: 1 };
  let caught = false;
  for (let i = 0; i < 960 && !caught; i++) {
    stepShot(c, p, w, 1 / 120, k);
    if (Math.hypot(c.x - k.x, c.z - k.z) < 1.8) caught = true;
  }
  assert.ok(caught, "cheese homes in");
  // shields absorb one hit, a spinning kart cannot be hit again
  const v = spawnKart(p, 10, 0);
  v.speed = 30;
  v.shield = 5;
  assert.equal(hitKart(v, 1), false);
  assert.equal(v.shield, 0);
  assert.equal(hitKart(v, 1), true);
  assert.ok(v.speed < 11);
  assert.equal(hitKart(v, 1), false);
  // a lobbed bomb lands and goes off
  const b = { x: 0, y: 1.5, z: 0, vx: 0, vy: 12, vz: 40, fuse: 1.4, owner: 0 };
  let t = 0;
  while (!stepBomb(b, 1 / 120) && t < 5) t += 1 / 120;
  assert.ok(t > 0.5 && t < 3, `bomb time ${t}`);
  console.log("item tests passed");
}
