// Genesis Squeek NFTs on Sepolia: decoding tokenURI, turning the on-chain art and traits into a racer,
// and working out which Squeeks a wallet owns (in the wallet or staked). Pure functions, unit tested.

export const SQUEEK_NFT = "0xc4c7982657f00509548f3a3a41db7fa439a6856b" as const;
export const SQUEEK_STAKING = "0x50fd1780526c3186a0c037c7622203bc4fb611ca" as const;
export const SQUEEK_MINTER = "0xe78b4420ce205b8864f2f326f3181f9dd5ea8b5f" as const;
export const DEPLOY_BLOCK = 12057772n;
export const MAX_TOKEN_ID = 9999;
export const ZERO = "0x0000000000000000000000000000000000000000";

export interface Attribute {
  trait_type: string;
  value: string | number;
}

export interface SqueekMeta {
  id: number;
  name: string;
  image: string; // data URI, usually image/svg+xml
  attributes: Attribute[];
}

function b64ToUtf8(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// tokenURI comes back as data:application/json;base64,…, sometimes as utf8 or a plain JSON string.
export function decodeTokenURI(id: number, uri: string): SqueekMeta {
  let json: string;
  if (uri.startsWith("data:")) {
    const comma = uri.indexOf(",");
    const head = uri.slice(0, comma);
    const body = uri.slice(comma + 1);
    json = head.includes(";base64") ? b64ToUtf8(body) : decodeURIComponent(body);
  } else json = uri;
  const raw = JSON.parse(json) as { name?: unknown; image?: unknown; image_data?: unknown; attributes?: unknown };
  let image = typeof raw.image === "string" ? raw.image : "";
  if (!image && typeof raw.image_data === "string") image = `data:image/svg+xml;utf8,${encodeURIComponent(raw.image_data)}`;
  const attributes = Array.isArray(raw.attributes)
    ? raw.attributes
        .filter((a): a is Attribute => !!a && typeof a === "object" && typeof (a as Attribute).trait_type === "string")
        .map((a) => ({ trait_type: a.trait_type, value: typeof a.value === "number" ? a.value : String(a.value) }))
    : [];
  return { id, name: typeof raw.name === "string" ? raw.name : `Squeek #${id}`, image, attributes };
}

// The SVG text inside an image data URI (or "" for other image types).
export function svgText(image: string): string {
  if (!image.startsWith("data:image/svg+xml")) return "";
  const comma = image.indexOf(",");
  const head = image.slice(0, comma);
  const body = image.slice(comma + 1);
  try {
    return head.includes(";base64") ? b64ToUtf8(body) : decodeURIComponent(body);
  } catch {
    return "";
  }
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export function rgbToHsl(c: number): HSL {
  const r = ((c >> 16) & 255) / 255;
  const g = ((c >> 8) & 255) / 255;
  const b = (c & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return { h, s, l };
}

export function hslToRgb(h: number, s: number, l: number): number {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

// Colours used in an SVG, most used first, ignoring near-black, near-white and greys.
export function vividColors(svg: string): number[] {
  const counts = new Map<number, number>();
  const add = (c: number) => counts.set(c, (counts.get(c) ?? 0) + 1);
  for (const m of svg.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    let hex = m[1];
    if (hex.length === 3) hex = hex.split("").map((x) => x + x).join("");
    add(parseInt(hex, 16));
  }
  for (const m of svg.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)) add((Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]));
  return [...counts.entries()]
    .filter(([c]) => {
      const { s, l } = rgbToHsl(c);
      return s > 0.25 && l > 0.18 && l < 0.88;
    })
    .sort((a, b) => b[1] - a[1] || rgbToHsl(b[0]).s - rgbToHsl(a[0]).s)
    .map(([c]) => c);
}

// Small stable hash for spreading values from a token id and its traits.
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface SqueekLook {
  fur: number;
  belly: number;
  kart: number;
  palette: number[]; // the NFT's own colours, most used first
  glyph: string; // body glyph shape from the traits, e.g. "Triangle"
  speed: number;
  accel: number;
  handling: number;
}

// Racing stats always add up to 10 so no Squeek is strictly better; each stat is 2..5.
export function statsFromTraits(id: number, attributes: Attribute[]): { speed: number; accel: number; handling: number } {
  const key = attributes.map((a) => `${a.trait_type}=${a.value}`).sort().join("|") || `id:${id}`;
  const h = hash(key);
  const options = [
    [5, 2, 3], [5, 3, 2], [2, 5, 3], [3, 5, 2], [2, 3, 5], [3, 2, 5], [4, 3, 3], [3, 4, 3], [3, 3, 4], [4, 4, 2], [4, 2, 4], [2, 4, 4],
  ];
  const [speed, accel, handling] = options[h % options.length];
  return { speed, accel, handling };
}

// Fur, belly and kart colours from the token's own art; falls back to colours spread from the id.
export function lookFromMeta(meta: SqueekMeta): SqueekLook {
  const colors = vividColors(svgText(meta.image));
  const h0 = hash(`squeek-${meta.id}`);
  const main = colors[0] ?? hslToRgb((h0 % 360) / 360, 0.75, 0.55);
  const second = colors.find((c) => Math.abs(rgbToHsl(c).h - rgbToHsl(main).h) > 0.08) ?? hslToRgb((((h0 >> 9) % 360) / 360 + 0.5) % 1, 0.7, 0.55);
  const m = rgbToHsl(main);
  // fur: a soft, furry version of the main colour; belly: a pale tint; kart: the boldest accent
  const fur = hslToRgb(m.h, Math.min(0.55, m.s * 0.7), 0.66);
  const belly = hslToRgb(m.h, 0.45, 0.92);
  const k = rgbToHsl(second);
  const kart = hslToRgb(k.h, Math.max(0.65, k.s), Math.min(0.6, Math.max(0.45, k.l)));
  const palette = colors.slice(0, 6);
  while (palette.length < 3) palette.push(palette.length === 0 ? main : second);
  return { fur, belly, kart, palette, glyph: bodyGlyph(meta), ...statsFromTraits(meta.id, meta.attributes) };
}

// The body glyph decides the dot shape on the 3D hamster. It is a trait, and also written in the SVG's <desc>.
export function bodyGlyph(meta: SqueekMeta): string {
  const a = meta.attributes.find((x) => /body\s*glyph/i.test(x.trait_type));
  if (a) return String(a.value);
  const m = svgText(meta.image).match(/Body Glyph:\s*([^;<]+)/i);
  return m ? m[1].trim() : "Circle";
}

export function trait(meta: SqueekMeta, type: string): string | null {
  const a = meta.attributes.find((x) => x.trait_type.toLowerCase() === type.toLowerCase());
  return a ? String(a.value) : null;
}

// ---------- ownership ----------

export interface TransferLog {
  tokenId: number;
  from: string;
  to: string;
  block: number;
  index: number; // log index, for ordering inside a block
  tx: string;
}

const lc = (s: string) => s.toLowerCase();
const later = (a: { block: number; index: number }, b: { block: number; index: number }) => a.block > b.block || (a.block === b.block && a.index > b.index);

// Token ids that could belong to the wallet: received by it, or sent into staking in a transaction
// that also mentions the wallet (deposits and mint-to-stake claims).
export function candidateIds(wallet: string, incoming: TransferLog[], stakedInWalletTx: TransferLog[]): number[] {
  const w = lc(wallet);
  const ids = new Set<number>();
  for (const l of incoming) if (lc(l.to) === w) ids.add(l.tokenId);
  for (const l of stakedInWalletTx) if (lc(l.to) === lc(SQUEEK_STAKING)) ids.add(l.tokenId);
  return [...ids].sort((a, b) => a - b);
}

export interface Owned {
  wallet: number[];
  staked: number[];
}

// Decide ownership from current owners. A token held by the staking contract counts as ours when the
// last event linking it to the wallet put it into staking (not when it came back out to the wallet).
export function resolveOwned(
  wallet: string,
  ids: number[],
  owners: Map<number, string | null>,
  incoming: TransferLog[],
  outgoing: TransferLog[],
  stakedInWalletTx: TransferLog[],
): Owned {
  const w = lc(wallet);
  const st = lc(SQUEEK_STAKING);
  const res: Owned = { wallet: [], staked: [] };
  for (const id of ids) {
    const owner = owners.get(id);
    if (!owner) continue; // burned by a merge, or unreadable
    if (lc(owner) === w) {
      res.wallet.push(id);
      continue;
    }
    if (lc(owner) !== st) continue;
    let last: { block: number; index: number; intoStaking: boolean } | null = null;
    const consider = (l: TransferLog, intoStaking: boolean) => {
      if (l.tokenId !== id) return;
      if (!last || later(l, last)) last = { block: l.block, index: l.index, intoStaking };
    };
    for (const l of incoming) consider(l, false);
    for (const l of outgoing) consider(l, lc(l.to) === st);
    for (const l of stakedInWalletTx) consider(l, lc(l.to) === st);
    if (last && (last as { intoStaking: boolean }).intoStaking) res.staked.push(id);
  }
  return res;
}

// ---------- tiny ABI helpers (no ABI library needed for these few calls) ----------

export const SIG = {
  ownerOf: "0x6352211e",
  tokenURI: "0xc87b56dd",
  transfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
};

export const pad32 = (hex: string) => hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");
export const callData = (sig: string, id: number) => sig + pad32(id.toString(16));
export const topicAddr = (addr: string) => "0x" + pad32(addr);

export function decodeAddress(ret: string): string | null {
  const h = ret.replace(/^0x/, "");
  if (h.length < 64) return null;
  return "0x" + h.slice(24, 64);
}

export function decodeString(ret: string): string {
  const h = ret.replace(/^0x/, "");
  const off = parseInt(h.slice(0, 64), 16) * 2;
  const len = parseInt(h.slice(off, off + 64), 16);
  const start = off + 64;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = parseInt(h.substr(start + i * 2, 2), 16);
  return new TextDecoder().decode(bytes);
}

export interface RawLog {
  topics: string[];
  blockNumber: string;
  logIndex: string;
  transactionHash: string;
}

export function parseTransfer(l: RawLog): TransferLog | null {
  if (l.topics.length < 4 || lc(l.topics[0]) !== SIG.transfer) return null;
  return {
    from: "0x" + l.topics[1].slice(26),
    to: "0x" + l.topics[2].slice(26),
    tokenId: parseInt(l.topics[3], 16),
    block: parseInt(l.blockNumber, 16),
    index: parseInt(l.logIndex, 16),
    tx: lc(l.transactionHash),
  };
}

// ---------- the dot grid inside a Genesis Squeek SVG ----------
// The art is a 25088-unit square: glyph paths in <defs>, then groups like <g color="#FF8712">
// holding <use href="#A" x=".." y=".."/> dots. Faint background dots carry opacity < 0.4.

export interface SqueekDot {
  x: number; // -0.5..0.5 across the art, centred
  y: number; // 0 at the bottom of the figure, up is positive, in the same units as x
  color: number;
  glyph: string; // id of the glyph path
  size: number; // glyph radius in the same units
}

export interface SqueekDots {
  glyphs: Record<string, string>; // id -> path d, in glyph units (multiply by scale)
  scale: number; // glyph units -> art units (the SVG uses scale(16)), already divided by the art size
  dots: SqueekDot[];
  step: number; // grid spacing between dots, same units as x
}

export function parseSqueekDots(svg: string): SqueekDots | null {
  const vb = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  const size = vb ? Number(vb[1]) : 25088;
  const glyphs: Record<string, string> = {};
  const extent: Record<string, number> = {};
  let unit = 16;
  for (const m of svg.matchAll(/<path id="([A-Za-z0-9_-]+)" d="([^"]+)"([^>]*)\/?>/g)) {
    glyphs[m[1]] = m[2];
    const nums = (m[2].match(/-?\d*\.?\d+/g) ?? []).map(Number);
    extent[m[1]] = nums.length ? Math.max(...nums.map(Math.abs)) : 1;
    const sc = m[3].match(/scale\(([\d.]+)\)/);
    if (sc) unit = Number(sc[1]);
  }
  const dots: SqueekDot[] = [];
  const groupRe = /<g color="(#[0-9A-Fa-f]{6})">([\s\S]*?)<\/g>/g;
  for (const g of svg.matchAll(groupRe)) {
    const color = parseInt(g[1].slice(1), 16);
    for (const u of g[2].matchAll(/<use href="#([A-Za-z0-9_-]+)" x="(-?[\d.]+)" y="(-?[\d.]+)"(?: opacity="([\d.]+)")?\s*\/>/g)) {
      if (u[4] !== undefined && Number(u[4]) < 0.4) continue; // faint background grid
      if (!glyphs[u[1]]) continue;
      dots.push({ x: Number(u[2]), y: Number(u[3]), color, glyph: u[1], size: extent[u[1]] * unit });
    }
  }
  if (dots.length < 40) return null;
  // the grid step: the most common small gap between neighbouring x values
  const xs = [...new Set(dots.map((d) => Math.round(d.x)))].sort((a, b) => a - b);
  const gaps = new Map<number, number>();
  for (let i = 1; i < xs.length; i++) {
    const gp = xs[i] - xs[i - 1];
    if (gp > 50) gaps.set(gp, (gaps.get(gp) ?? 0) + 1);
  }
  const step = [...gaps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 395;
  const maxY = Math.max(...dots.map((d) => d.y));
  const minX = Math.min(...dots.map((d) => d.x));
  const maxX = Math.max(...dots.map((d) => d.x));
  const cx = (minX + maxX) / 2;
  return {
    glyphs,
    scale: unit / size,
    step: step / size,
    dots: dots.map((d) => ({ ...d, x: (d.x - cx) / size, y: (maxY - d.y) / size, size: d.size / size })),
  };
}
