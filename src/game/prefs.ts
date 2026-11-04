const KEY = "squeek-burrow-3d-prefs";

export interface Prefs {
  quality: "high" | "low";
  autoGas: boolean;
}

export const isTouch = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export function loadPrefs(): Prefs {
  const def: Prefs = { quality: isTouch() ? "low" : "high", autoGas: true };
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "null");
    if (r && typeof r === "object") return { quality: r.quality === "low" ? "low" : r.quality === "high" ? "high" : def.quality, autoGas: r.autoGas !== false };
  } catch {
    // defaults
  }
  return def;
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}
