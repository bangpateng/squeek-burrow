import assert from "node:assert/strict";
import {
  SQUEEK_STAKING, callData, candidateIds, decodeAddress, decodeString, decodeTokenURI, hslToRgb, lookFromMeta, parseTransfer,
  resolveOwned, rgbToHsl, statsFromTraits, topicAddr, vividColors, SIG, type TransferLog,
} from "./squeeks";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect fill="#000000"/><path stroke="#ff2a6d"/><path stroke="#ff2a6d"/><path stroke="#ff2a6d"/><circle fill="#05d9e8"/><circle fill="#ffffff"/><rect fill="#777"/></svg>`;
const meta = { name: "Squeek #381", image: `data:image/svg+xml;base64,${b64(svg)}`, attributes: [{ trait_type: "Palette", value: "Reactor Red" }, { trait_type: "Pattern", value: "Grid" }] };

// tokenURI decoding: base64, utf8 and plain JSON
const m = decodeTokenURI(381, `data:application/json;base64,${b64(JSON.stringify(meta))}`);
assert.equal(m.name, "Squeek #381");
assert.equal(m.attributes.length, 2);
assert.equal(decodeTokenURI(1, `data:application/json;utf8,${encodeURIComponent(JSON.stringify({ name: "A é" }))}`).name, "A é");
assert.equal(decodeTokenURI(2, JSON.stringify({ attributes: [{ trait_type: "Glyphs", value: 7 }] })).attributes[0].value, 7);
assert.equal(decodeTokenURI(3, JSON.stringify({})).name, "Squeek #3");

// colours: the most used vivid colour first; black, white and grey ignored
const cols = vividColors(svg);
assert.deepEqual(cols, [0xff2a6d, 0x05d9e8]);
const back = rgbToHsl(hslToRgb(0.3, 0.6, 0.5));
assert.ok(Math.abs(back.h - 0.3) < 0.01 && Math.abs(back.s - 0.6) < 0.02 && Math.abs(back.l - 0.5) < 0.01);
const look = lookFromMeta(m);
assert.ok(Math.abs(rgbToHsl(look.fur).h - rgbToHsl(0xff2a6d).h) < 0.02, "fur follows the main colour");
assert.ok(Math.abs(rgbToHsl(look.kart).h - rgbToHsl(0x05d9e8).h) < 0.02, "kart follows the second colour");
assert.equal(look.speed + look.accel + look.handling, 10);
// stats are stable and depend on traits
assert.deepEqual(statsFromTraits(381, m.attributes), statsFromTraits(999, m.attributes));
const spread = new Set<string>();
for (let i = 0; i < 60; i++) spread.add(JSON.stringify(statsFromTraits(i, [{ trait_type: "Palette", value: `P${i}` }])));
assert.ok(spread.size > 5, "stats vary across Squeeks");
// art without colours still gets a look
const plain = lookFromMeta({ id: 5, name: "x", image: "data:image/png;base64,AAAA", attributes: [] });
assert.ok(plain.fur > 0 && plain.kart > 0);

// ABI helpers
assert.equal(callData(SIG.tokenURI, 381), "0xc87b56dd" + "0".repeat(61) + "17d");
assert.equal(decodeAddress("0x" + "0".repeat(24) + "50fd1780526c3186a0c037c7622203bc4fb611ca"), SQUEEK_STAKING);
const str = "data:application/json;base64,eyJ9";
const enc = Buffer.from(str).toString("hex");
const ret = "0x" + (32).toString(16).padStart(64, "0") + str.length.toString(16).padStart(64, "0") + enc.padEnd(Math.ceil(enc.length / 64) * 64, "0");
assert.equal(decodeString(ret), str);
const W = "0xcae876e5b0d1b2e28fdfe70281ec9ac0ee88ac40";
const t = parseTransfer({ topics: [SIG.transfer, topicAddr("0x0000000000000000000000000000000000000000"), topicAddr(W), "0x" + (381).toString(16).padStart(64, "0")], blockNumber: "0xb7fa00", logIndex: "0x3", transactionHash: "0xABC" });
assert.ok(t);
assert.equal(t.to, W);
assert.equal(t.tokenId, 381);
assert.equal(t.tx, "0xabc");

// ownership
const L = (tokenId: number, from: string, to: string, block: number, tx = "0x" + block): TransferLog => ({ tokenId, from, to, block, index: 0, tx });
const Z = "0x0000000000000000000000000000000000000000";
const OTHER = "0x1111111111111111111111111111111111111111";
const incoming = [L(381, Z, W, 10), L(382, Z, W, 10), L(390, Z, W, 11), L(391, Z, W, 12), L(395, OTHER, W, 20)];
const outgoing = [L(381, W, SQUEEK_STAKING, 15), L(390, W, OTHER, 16), L(391, W, SQUEEK_STAKING, 17)];
// 391 came back out of staking to the wallet, then the wallet sold it and the buyer staked it
incoming.push(L(391, SQUEEK_STAKING, W, 18));
outgoing.push(L(391, W, OTHER, 19));
// 386 was minted straight into staking in a claim transaction that mentioned the wallet
const stakedInTx = [L(386, Z, SQUEEK_STAKING, 9)];
const ids = candidateIds(W, incoming, stakedInTx);
assert.deepEqual(ids, [381, 382, 386, 390, 391, 395]);
const owners = new Map<number, string | null>([
  [381, SQUEEK_STAKING], [382, W], [386, SQUEEK_STAKING], [390, OTHER], [391, SQUEEK_STAKING], [395, null],
]);
const own = resolveOwned(W, ids, owners, incoming, outgoing, stakedInTx);
assert.deepEqual(own.wallet, [382]);
assert.deepEqual(own.staked, [381, 386]);

console.log("squeek tests passed");
