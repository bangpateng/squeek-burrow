import assert from "node:assert/strict";
import { createLiveFeed, detectFever, parseStatus } from "./feed";

// real shape of GET /v1/status
const idle = { measurement: { freshness: "online", rpmMilli: 0, speedMmPerSecond: 0, distanceMm: 7660550, coreStatus: "IDLE" } };
let p = parseStatus(idle);
assert.ok(p);
assert.equal(p.running, false);
assert.equal(p.distanceMm, 7660550);

const running = { measurement: { freshness: "online", rpmMilli: 42500, speedMmPerSecond: 480, distanceMm: 7660700 } };
p = parseStatus(running);
assert.ok(p);
assert.equal(p.running, true);
assert.equal(p.rpm, 42.5);

// stale data never counts as running
p = parseStatus({ measurement: { freshness: "stale", rpmMilli: 40000, speedMmPerSecond: 400, distanceMm: 1 } });
assert.ok(p);
assert.equal(p.running, false);

// the shared work counter is a string in the real response
p = parseStatus({ measurement: { freshness: "online", rpmMilli: 0, speedMmPerSecond: 0, distanceMm: 0, cumulativeWorkUnits: "84732" } });
assert.ok(p);
assert.equal(p.workUnits, 84732);
assert.equal(parseStatus(idle)?.workUnits, null);

// chain fields from the real response
p = parseStatus({ measurement: { freshness: "online", rpmMilli: 0, speedMmPerSecond: 0, distanceMm: 0 }, builder: { anchor: { blockHeight: "7661", blockProgress: "911286742", settledThroughRound: "1189" }, projected: { blockHeight: "7661", blockProgress: "911286742" } } });
assert.ok(p?.chain);
assert.equal(p.chain.height, 7661);
assert.ok(Math.abs(p.chain.progress - 0.911286742) < 1e-9);
assert.equal(p.chain.round, 1189);
assert.equal(parseStatus(idle)?.chain, null);

// junk is rejected
assert.equal(parseStatus(null), null);
assert.equal(parseStatus({}), null);
assert.equal(parseStatus({ measurement: { distanceMm: "n/a", speedMmPerSecond: "n/a" } }), null);

// fever: the first sample is only a baseline
let f = detectFever(null, { distanceMm: 7_660_550, speedMmps: 0 });
assert.equal(f.reason, null);

// crossing a 50 m mark triggers a milestone
f = detectFever({ distanceMm: 7_699_900, maxSpeed: 0 }, { distanceMm: 7_700_100, speedMmps: 300 });
assert.equal(f.reason, "milestone");

// staying inside the same 50 m block does not
f = detectFever({ distanceMm: 7_660_550, maxSpeed: 300 }, { distanceMm: 7_661_000, speedMmps: 300 });
assert.equal(f.reason, null);

// a new speed record needs an established baseline
f = detectFever({ distanceMm: 1000, maxSpeed: 10 }, { distanceMm: 1100, speedMmps: 400 });
assert.equal(f.reason, null);
f = detectFever({ distanceMm: 1000, maxSpeed: 300 }, { distanceMm: 1100, speedMmps: 450 });
assert.equal(f.reason, "record");
assert.equal(f.memory.maxSpeed, 450);

// live feed: ok response, then a failure becomes "offline"
async function liveFlow() {
  const bodies = [
    { measurement: { freshness: "online", rpmMilli: 30000, speedMmPerSecond: 300, distanceMm: 1000 } },
    { measurement: { freshness: "online", rpmMilli: 0, speedMmPerSecond: 0, distanceMm: 1200 } },
  ];
  let i = 0;
  const fakeFetch = (async () => {
    if (i >= bodies.length) throw new Error("down");
    return { ok: true, json: async () => bodies[i++] };
  }) as unknown as typeof fetch;
  const seen: string[] = [];
  const stop = createLiveFeed("https://example.test/", 20, fakeFetch).subscribe((s) =>
    seen.push(`${s.source}:${s.running}`),
  );
  await new Promise((r) => setTimeout(r, 120));
  stop();
  assert.equal(seen[0], "live:true");
  assert.equal(seen[1], "live:false");
  assert.equal(seen[seen.length - 1], "offline:false");
}

liveFlow().then(() => console.log("feed tests passed"));
