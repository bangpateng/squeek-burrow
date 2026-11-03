import assert from "node:assert/strict";
import {
  GOAL_UNITS, PREDICT_GRACE_MS, PREDICT_MS, checkGoal, emptyQuests, goalProgress, goalReward, migrateQuests,
  predictionReward, resolvePrediction, startPrediction,
} from "./quests";

// goal progress from the shared work counter
let g = goalProgress(84732);
assert.equal(g.index, 338);
assert.equal(g.into, 232);
assert.equal(g.remaining, 18);
assert.equal(goalProgress(250).into, 0);

// the first sighting is a baseline, crossing a goal pays once
let q = emptyQuests();
let r = checkGoal(q, 84732);
assert.equal(r.reached, false);
q = r.q;
assert.equal(checkGoal(q, 84740).reached, false);
r = checkGoal(q, 84751);
assert.equal(r.reached, true);
assert.equal(r.q.goalsDone, 1);
// skipping many goals still pays once
r = checkGoal(r.q, 84751 + GOAL_UNITS * 5);
assert.equal(r.reached, true);
assert.equal(r.q.goalsDone, 2);
// a counter reset never pays
r = checkGoal(r.q, 10);
assert.equal(r.reached, false);
assert.equal(r.q.goalIndex, 0);
assert.equal(goalReward(0), 100);
assert.equal(goalReward(10), 1200);

// predictions: pay more for calling a change
assert.equal(predictionReward(0, 0, false, true), 150);
assert.equal(predictionReward(0, 0, false, false), 75);
assert.equal(predictionReward(0, 5, false, true), 300);
assert.equal(predictionReward(0, 99, false, false), 150);

const t = 5_000_000;
q = startPrediction(emptyQuests(), true, false, t);
assert.equal(q.pending?.resolveAt, t + PREDICT_MS);
// cannot start a second one
assert.equal(startPrediction(q, false, false, t + 1), q);
// not yet due
assert.equal(resolvePrediction(q, true, t + PREDICT_MS - 1).outcome, null);
// win
let w = resolvePrediction(q, true, t + PREDICT_MS + 1000);
assert.equal(w.outcome, "win");
assert.equal(w.q.wins, 1);
assert.equal(w.q.streak, 1);
assert.equal(w.q.pending, null);
// loss resets the streak but keeps the best
let q2 = { ...w.q, streak: 3, best: 3 };
q2 = startPrediction(q2, true, false, t);
const l = resolvePrediction(q2, false, t + PREDICT_MS + 1000);
assert.equal(l.outcome, "loss");
assert.equal(l.q.streak, 0);
assert.equal(l.q.best, 3);
// a late look voids it with no win or loss
const v = resolvePrediction(q, true, t + PREDICT_MS + PREDICT_GRACE_MS + 1);
assert.equal(v.outcome, "void");
assert.equal(v.q.wins, 0);
assert.equal(v.q.losses, 0);
assert.equal(v.q.pending, null);

// saved data is validated
assert.deepEqual(migrateQuests(null), emptyQuests());
assert.deepEqual(migrateQuests({ v: 1, wins: -4, streak: "x", pending: { guess: 1 } }), emptyQuests());
assert.equal(migrateQuests({ v: 1, goalIndex: 12, pending: { guess: true, from: false, resolveAt: 99 } }).pending?.resolveAt, 99);

console.log("quests tests passed");
