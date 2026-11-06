// Reads Genesis Squeeks straight from Sepolia through public JSON-RPC endpoints, with a browser cache.
import { get as idbGet, set as idbSet } from "idb-keyval";
import {
  DEPLOY_BLOCK, MAX_TOKEN_ID, SIG, SQUEEK_MINTER, SQUEEK_NFT, SQUEEK_STAKING,
  callData, candidateIds, decodeAddress, decodeString, decodeTokenURI, parseTransfer, resolveOwned, topicAddr,
  type Owned, type RawLog, type SqueekMeta, type TransferLog,
} from "./squeeks";

// Public Sepolia endpoints, tried in turn. VITE_SEPOLIA_RPC (for example a free Alchemy or Infura URL) goes first when set.
const CUSTOM_RPC: string = (import.meta.env.VITE_SEPOLIA_RPC as string | undefined) || "";
export const RPCS = [
  ...(CUSTOM_RPC ? [CUSTOM_RPC] : []),
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.drpc.org",
  "https://ethereum-sepolia.gateway.tatum.io",
  "https://sepolia.gateway.tenderly.co",
  "https://1rpc.io/sepolia",
];

let rpcIndex = 0;
let reqId = 1;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The last problem seen, shown in the Garage so a failure can be reported.
export let lastRpcError = "";
const note = (url: string, e: unknown) => {
  lastRpcError = `${new URL(url).host}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 160);
  console.warn("[squeek rpc]", lastRpcError);
};

// Sends one request, moving to the next endpoint on network errors, HTTP errors and JSON-RPC errors.
async function post(body: unknown, accept: (json: unknown) => boolean): Promise<unknown> {
  let lastErr: unknown = null;
  for (let round = 0; round < 2; round++) {
    for (let attempt = 0; attempt < RPCS.length; attempt++) {
      const i = (rpcIndex + attempt) % RPCS.length;
      const url = RPCS[i];
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20_000);
        const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!accept(json)) {
          const msg = (json as { error?: { message?: string } })?.error?.message ?? "unexpected answer";
          throw new Error(msg);
        }
        rpcIndex = i; // stick with the endpoint that answered
        return json;
      } catch (e) {
        lastErr = e;
        note(url, e);
      }
    }
    await sleep(1200);
  }
  throw lastErr ?? new Error("No RPC endpoint answered");
}

export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const r = (await post({ jsonrpc: "2.0", id: reqId++, method, params }, (j) => !!j && typeof j === "object" && "result" in (j as object))) as { result: T };
  return r.result;
}

// Several eth_calls in one HTTP request. Reverted calls come back as null.
// If no endpoint takes the batch, the calls are sent one by one.
async function batchCalls(calls: { to: string; data: string }[]): Promise<(string | null)[]> {
  if (!calls.length) return [];
  const body = calls.map((c, i) => ({ jsonrpc: "2.0", id: i, method: "eth_call", params: [c, "latest"] }));
  const out: (string | null)[] = new Array(calls.length).fill(null);
  try {
    const r = (await post(body, (j) => Array.isArray(j) && j.length > 0)) as { id: number; result?: string }[];
    for (const x of r) out[x.id] = x.result && x.result !== "0x" ? x.result : null;
    return out;
  } catch {
    for (let i = 0; i < calls.length; i++) {
      try {
        const res = await rpc<string>("eth_call", [calls[i], "latest"]);
        out[i] = res && res !== "0x" ? res : null;
      } catch {
        out[i] = null;
      }
    }
    return out;
  }
}

export async function latestBlock(): Promise<bigint> {
  return BigInt(await rpc<string>("eth_blockNumber", []));
}

// eth_getLogs over a long range, splitting the range whenever every endpoint refuses it.
export async function getLogs(filter: { address: string | string[]; topics: (string | null)[] }, from: bigint, to: bigint): Promise<RawLog[]> {
  const out: RawLog[] = [];
  let start = from;
  let span = 20_000n;
  while (start <= to) {
    const end = start + span - 1n > to ? to : start + span - 1n;
    try {
      const logs = await rpc<RawLog[]>("eth_getLogs", [{ ...filter, fromBlock: "0x" + start.toString(16), toBlock: "0x" + end.toString(16) }]);
      out.push(...(logs ?? []));
      start = end + 1n;
    } catch (e) {
      if (span <= 1_000n) throw e;
      span /= 4n;
    }
  }
  return out;
}

// ---------- ownership with an incremental cache per wallet ----------

interface OwnCache {
  v: 2;
  scannedTo: string;
  incoming: TransferLog[];
  outgoing: TransferLog[];
  staked: TransferLog[];
}

const ownKey = (w: string) => `squeek-own-v2-${w.toLowerCase()}`;

async function scan(wallet: string, from: bigint, to: bigint) {
  const w = topicAddr(wallet);
  // one after another, so a free endpoint is not flooded
  const inRaw = await getLogs({ address: SQUEEK_NFT, topics: [SIG.transfer, null, w] }, from, to);
  const outRaw = await getLogs({ address: SQUEEK_NFT, topics: [SIG.transfer, w] }, from, to);
  const m1 = await getLogs({ address: [SQUEEK_STAKING, SQUEEK_MINTER], topics: [null, w] }, from, to);
  const m2 = await getLogs({ address: [SQUEEK_STAKING, SQUEEK_MINTER], topics: [null, null, w] }, from, to);
  const m3 = await getLogs({ address: [SQUEEK_STAKING, SQUEEK_MINTER], topics: [null, null, null, w] }, from, to);
  // transactions where the staking or minter contract mentioned this wallet
  const txs = new Set<string>();
  const blocks = new Set<string>();
  for (const l of [...m1, ...m2, ...m3]) {
    txs.add(l.transactionHash.toLowerCase());
    blocks.add(l.blockNumber);
  }
  const staked: TransferLog[] = [];
  for (const b of [...blocks].slice(0, 300)) {
    const logs = await rpc<RawLog[]>("eth_getLogs", [{ address: SQUEEK_NFT, topics: [SIG.transfer, null, topicAddr(SQUEEK_STAKING)], fromBlock: b, toBlock: b }]);
    for (const l of logs ?? []) {
      const t = parseTransfer(l);
      if (t && txs.has(t.tx)) staked.push(t);
    }
  }
  const parse = (raw: RawLog[]) => raw.map(parseTransfer).filter((x): x is TransferLog => !!x);
  return { incoming: parse(inRaw), outgoing: parse(outRaw), staked };
}

export async function ownerOfMany(ids: number[]): Promise<Map<number, string | null>> {
  const out = new Map<number, string | null>();
  for (let i = 0; i < ids.length; i += 40) {
    const part = ids.slice(i, i + 40);
    const res = await batchCalls(part.map((id) => ({ to: SQUEEK_NFT, data: callData(SIG.ownerOf, id) })));
    part.forEach((id, k) => out.set(id, res[k] ? decodeAddress(res[k]!) : null));
  }
  return out;
}

export async function findOwned(wallet: string): Promise<Owned> {
  const key = ownKey(wallet);
  let cache: OwnCache | null = null;
  try {
    const c = JSON.parse(localStorage.getItem(key) || "null");
    if (c && c.v === 2) cache = c;
  } catch {
    cache = null;
  }
  const all: OwnCache = cache ?? { v: 2, scannedTo: (DEPLOY_BLOCK - 1n).toString(), incoming: [], outgoing: [], staked: [] };
  const head = await latestBlock();
  // scan in windows and save after each one, so a busy endpoint never costs the work already done
  const WINDOW = 100_000n;
  let from = BigInt(all.scannedTo) + 1n;
  while (from <= head) {
    const to = from + WINDOW - 1n > head ? head : from + WINDOW - 1n;
    const fresh = await scan(wallet, from, to);
    all.incoming.push(...fresh.incoming);
    all.outgoing.push(...fresh.outgoing);
    all.staked.push(...fresh.staked);
    all.scannedTo = to.toString();
    try {
      localStorage.setItem(key, JSON.stringify(all));
    } catch {
      // cache is optional
    }
    from = to + 1n;
  }
  const ids = candidateIds(wallet, all.incoming, all.staked);
  const owners = await ownerOfMany(ids);
  return resolveOwned(wallet, ids, owners, all.incoming, all.outgoing, all.staked);
}

// ---------- metadata, cached in IndexedDB for a day ----------

const DAY = 86_400_000;

export async function getMeta(ids: number[]): Promise<Map<number, SqueekMeta>> {
  const out = new Map<number, SqueekMeta>();
  const missing: number[] = [];
  for (const id of ids) {
    try {
      const c = (await idbGet(`squeek-meta-${id}`)) as { at: number; meta: SqueekMeta } | undefined;
      if (c && Date.now() - c.at < DAY) {
        out.set(id, c.meta);
        continue;
      }
    } catch {
      // IndexedDB can be unavailable (private mode); read from the chain instead
    }
    missing.push(id);
  }
  // each tokenURI is large (the SVG lives inside it), so ask for a few at a time
  for (let i = 0; i < missing.length; i += 4) {
    const part = missing.slice(i, i + 4);
    const res = await batchCalls(part.map((id) => ({ to: SQUEEK_NFT, data: callData(SIG.tokenURI, id) })));
    for (let k = 0; k < part.length; k++) {
      if (!res[k]) continue;
      try {
        const meta = decodeTokenURI(part[k], decodeString(res[k]!));
        out.set(part[k], meta);
        idbSet(`squeek-meta-${part[k]}`, { at: Date.now(), meta }).catch(() => {});
      } catch {
        // skip a token whose metadata cannot be read
      }
    }
  }
  return out;
}

// Random living Squeeks from the collection, for guests and rivals. Burned ids are skipped.
export async function randomSqueeks(n: number, seed: number, exclude: number[] = []): Promise<SqueekMeta[]> {
  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
  const pick = new Set<number>();
  while (pick.size < n * 3) {
    const id = 1 + Math.floor(rand() * MAX_TOKEN_ID);
    if (!exclude.includes(id)) pick.add(id);
  }
  const ids = [...pick];
  const owners = await ownerOfMany(ids);
  const alive = ids.filter((id) => owners.get(id)).slice(0, n);
  const metas = await getMeta(alive);
  return alive.map((id) => metas.get(id)).filter((m): m is SqueekMeta => !!m);
}
