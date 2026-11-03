import assert from "node:assert/strict";
import {
  achBonus, addSeeds, awayGain, baseRate, buy, buyCount, canBuy, catchGolden, cost, costBulk, dreamBonus, dreamGain,
  emptySave, fmt, forage, forageGain, goldenReward, hibernate, isUnlocked, level, maxAffordable, migrate, perSecond,
  tick, wheelMultiplier,
} from "./economy";
import { pendingAchievements } from "./achievements";

const t0 = 1_000_000;
let s = emptySave(t0);

// cost grows 15% per owned, rounded up
assert.equal(cost("pouch", 0), 15);
assert.equal(cost("pouch", 1), 18);
assert.equal(cost("farm", 2), Math.ceil(100 * 1.15 ** 2));

// buying
assert.equal(canBuy(s, "pouch"), true);
assert.equal(canBuy(s, "farm"), false);
assert.equal(buy(s, "farm"), s);
s = buy(s, "pouch");
assert.equal(s.owned.pouch, 1);
assert.equal(s.seeds, 0);
assert.equal(level(s), 1);

// chambers unlock in order
assert.equal(isUnlocked(s, 0), true);
assert.equal(isUnlocked(s, 1), true);
assert.equal(isUnlocked(s, 2), false);

// wheel multiplier
assert.equal(wheelMultiplier(true, false), 3);
assert.equal(wheelMultiplier(false, false), 0.1);
assert.equal(wheelMultiplier(true, true), 6);

// production: 1 pouch = 0.5/s, running x3
assert.equal(baseRate(s), 0.5);
assert.equal(perSecond(s, 3), 1.5);
const ticked = tick(s, 2, 3);
assert.equal(ticked.seeds, 3);
assert.equal(ticked.total, s.total + 3);
assert.equal(ticked.allTime, s.allTime + 3);

// foraging scales with pouches
assert.equal(forageGain(s), 2);
assert.equal(forage(s).seeds, s.seeds + 2);

// addSeeds ignores zero and negatives
assert.equal(addSeeds(s, 0), s);
assert.equal(addSeeds(s, -5), s);

// away gain: base speed, ignores short gaps, capped at 8 hours
assert.equal(awayGain(s, 3), 0);
assert.equal(awayGain(s, 100), 50);
assert.equal(awayGain(s, 10 * 3600), 0.5 * 8 * 3600);

// hibernate needs enough seeds, then grants a permanent bonus
let rich = { ...s, total: 200000, seeds: 5 };
assert.equal(dreamGain(rich), 2);
const reborn = hibernate(rich, t0);
assert.equal(reborn.dream, 2);
assert.equal(dreamBonus(reborn), 1.2);
assert.equal(reborn.owned.pouch, 0);
assert.equal(reborn.hibernations, 1);
assert.equal(reborn.allTime, rich.allTime);
assert.equal(hibernate(s, t0), s);

// dream bonus raises production
const boosted = { ...s, dream: 5 };
assert.equal(perSecond(boosted, 1), 0.5 * 1.5);

// save validation
assert.deepEqual(migrate(null, t0), emptySave(t0));
assert.deepEqual(migrate({ v: 2 }, t0), emptySave(t0));
const loaded = migrate({ v: 1, seeds: 42, owned: { pouch: 3, farm: -1 }, dream: "x" }, t0);
assert.equal(loaded.seeds, 42);
assert.equal(loaded.owned.pouch, 3);
assert.equal(loaded.owned.farm, 0);
assert.equal(loaded.dream, 0);

// number formatting
assert.equal(fmt(999), "999");
assert.equal(fmt(1500), "1.5K");
assert.equal(fmt(2_340_000), "2.3M");
assert.equal(fmt(150_000), "150K");

// bulk buying
const flush = { ...emptySave(t0), seeds: 1000 };
assert.equal(costBulk("pouch", 0, 1), 15);
assert.equal(costBulk("pouch", 0, 3), 15 + 18 + 20);
assert.equal(canBuy(flush, "pouch", 10), true);
assert.equal(canBuy({ ...flush, seeds: 100 }, "pouch", 10), false);
const bought10 = buy(flush, "pouch", 10);
assert.equal(bought10.owned.pouch, 10);
assert.equal(bought10.seeds, 1000 - costBulk("pouch", 0, 10));
assert.equal(buy({ ...flush, seeds: 100 }, "pouch", 10).owned.pouch, 0);
const mx = maxAffordable(flush, "pouch");
assert.ok(mx > 10);
assert.ok(costBulk("pouch", 0, mx) <= 1000);
assert.ok(costBulk("pouch", 0, mx + 1) > 1000);
assert.equal(buyCount(flush, "pouch", 10), 10);
assert.equal(buyCount(flush, "pouch", "max"), mx);
assert.equal(maxAffordable({ ...flush, seeds: 5 }, "pouch"), 0);

// achievements add +1% each, to production, foraging, and away gain
const withAch = { ...s, ach: ["a", "b"] };
assert.equal(achBonus(withAch), 1.02);
assert.equal(perSecond(withAch, 1), 0.5 * 1.02);
assert.equal(forageGain(withAch), 2 * 1.02);
assert.equal(awayGain(withAch, 100), 0.5 * 1.02 * 100);

// golden seed: 45 seconds of production, at least 50
assert.equal(goldenReward(emptySave(t0), 3), 50);
const farmy = { ...emptySave(t0), owned: { pouch: 0, farm: 10, tunnels: 0, spa: 0, observatory: 0 } };
assert.equal(goldenReward(farmy, 3), Math.floor(40 * 3 * 45));
const caught = catchGolden(farmy, 3);
assert.equal(caught.golden, 1);
assert.equal(caught.seeds, farmy.seeds + goldenReward(farmy, 3));

// hibernate keeps achievements and counters
const keeper = hibernate({ ...rich, ach: ["x"], golden: 3, fevers: 2 }, t0);
assert.deepEqual(keeper.ach, ["x"]);
assert.equal(keeper.golden, 3);
assert.equal(keeper.fevers, 2);

// save validation of the new fields
const l2 = migrate({ v: 1, ach: ["a", "a", 5, "b"], golden: 4, fevers: -2 }, t0);
assert.deepEqual(l2.ach, ["a", "b"]);
assert.equal(l2.golden, 4);
assert.equal(l2.fevers, 0);

// achievement rules
assert.deepEqual(pendingAchievements(emptySave(t0)).map((a) => a.id), []);
const pend = pendingAchievements({ ...farmy, allTime: 1500, fevers: 1 }).map((a) => a.id);
assert.deepEqual(pend.sort(), ["farm", "fever", "seed100", "seed1k"].sort());
assert.deepEqual(pendingAchievements({ ...farmy, allTime: 1500, fevers: 1, ach: ["farm", "seed100"] }).map((a) => a.id).sort(), ["fever", "seed1k"]);

console.log("economy tests passed");
