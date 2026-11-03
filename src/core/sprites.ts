// Original pixel hamster art for this project. It is a generic hamster, not the official Squeek artwork.

const mirror = (half: string[]) => half.map((r) => r + [...r].reverse().join(""));

export const SIT = mirror([
  "....kk..",
  "...kbbk.",
  "..kkbbbb",
  ".kbbbbbb",
  "kbbbbbbb",
  "kbbbebbb",
  "kbppbbww",
  "kbbbbbwp",
  ".kbbbwww",
  ".kbbwwww",
  ".kbwwwww",
  ".kbwwwww",
  "..kbwwww",
  "..kbbbbb",
  "...kkkkk",
]);

export const SIT_SEED = mirror([
  "....kk..",
  "...kbbk.",
  "..kkbbbb",
  ".kbbbbbb",
  "kbbbbbbb",
  "kbbbebbb",
  "kbppbbww",
  "kbbbbbwp",
  ".kbbbwww",
  ".kbbwwww",
  ".kbwwwws",
  ".kbwwwws",
  "..kbwwww",
  "..kbbbbb",
  "...kkkkk",
]);

export const SLEEP = [
  "................",
  "......kkkkkk....",
  "....kkbbbbbbkk..",
  "...kbbbbbbbbbbk.",
  "..kbbbbbbbbbbbbk",
  "..kbbkkbbbbbbbbk",
  "..kbppbbbbbbbbbk",
  "..kbbbbbbbwwbbbk",
  "...kbbbbbwwwwbk.",
  "....kkkkkkkkkk..",
];

export const RUN_A = [
  "......kk.kk.",
  "..kkkkbkbbk.",
  ".kbbbbbbbbbk",
  "kbbbbbbbbebk",
  "kbwwwwbbbbpk",
  "kbwwwwwbbbbk",
  ".kbwwwwwbbk.",
  "..kkbbbbkk..",
  "..k.k..k.k..",
];

export const RUN_B = [
  "......kk.kk.",
  "..kkkkbkbbk.",
  ".kbbbbbbbbbk",
  "kbbbbbbbbebk",
  "kbwwwwbbbbpk",
  "kbwwwwwbbbbk",
  ".kbwwwwwbbk.",
  "..kkbbbbkk..",
  "...k.kk.k...",
];

export const SEED = [
  "..kk..",
  ".kyyk.",
  "kyyyyk",
  "kyyyyk",
  "kyyyyk",
  ".kyyk.",
  "..kk..",
];

export const CLOUD = [
  "....cccc......",
  "..ccccccccc...",
  ".cccccccccccc.",
  "..cccccccccc..",
];

export const HAM: Record<string, string> = {
  k: "#3a2418",
  b: "#e8a95b",
  w: "#fff0d4",
  e: "#1b1210",
  p: "#ff9db8",
  s: "#ffc83d",
};

export const SEED_PAL: Record<string, string> = { k: "#8a5d00", y: "#ffc83d" };
export const CLOUD_PAL: Record<string, string> = { c: "#ffffff" };
export const SILHOUETTE: Record<string, string> = {
  k: "#1c1320",
  b: "#2a1d2e",
  w: "#2a1d2e",
  e: "#2a1d2e",
  p: "#2a1d2e",
  s: "#2a1d2e",
};
