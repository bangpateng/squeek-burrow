export type FeedSource = "live" | "demo" | "offline";
export type FeverReason = "milestone" | "record" | "demo";

export interface WheelState {
  running: boolean;
  rpm: number;
  distanceMm: number | null;
  speedMmps: number;
  workUnits: number | null;
  source: FeedSource;
}

export interface Feed {
  subscribe(onState: (s: WheelState, fever: FeverReason | null) => void): () => void;
}

export const MILESTONE_MM = 50_000;
export const MIN_RECORD_MMPS = 50;

export interface Parsed {
  running: boolean;
  rpm: number;
  distanceMm: number | null;
  speedMmps: number;
  workUnits: number | null;
}

// Reads GET /v1/status. Everything except `measurement` is ignored.
export function parseStatus(body: unknown): Parsed | null {
  const m = (body as { measurement?: Record<string, unknown> } | null)?.measurement;
  if (!m) return null;
  const distance = Number(m.distanceMm);
  const speed = Number(m.speedMmPerSecond);
  const rpmMilli = Number(m.rpmMilli);
  const work = m.cumulativeWorkUnits === undefined ? NaN : Number(m.cumulativeWorkUnits);
  const online = m.freshness === undefined || m.freshness === "online";
  const speedMmps = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const rpm = Number.isFinite(rpmMilli) ? Math.max(0, rpmMilli / 1000) : 0;
  const distanceMm = Number.isFinite(distance) ? distance : null;
  if (distanceMm === null && !Number.isFinite(speed)) return null;
  return { running: online && (speedMmps > 0 || rpm > 0), rpm, distanceMm, speedMmps, workUnits: Number.isFinite(work) && work >= 0 ? work : null };
}

export interface FeverMemory {
  distanceMm: number | null;
  maxSpeed: number;
}

// Fever triggers: the hamster crosses a 50 m mark of total distance, or beats the fastest speed seen this visit.
export function detectFever(
  prev: FeverMemory | null,
  cur: Pick<Parsed, "distanceMm" | "speedMmps">,
): { reason: FeverReason | null; memory: FeverMemory } {
  const memory: FeverMemory = {
    distanceMm: cur.distanceMm,
    maxSpeed: Math.max(prev?.maxSpeed ?? 0, cur.speedMmps),
  };
  if (!prev) return { reason: null, memory };
  if (
    prev.distanceMm !== null &&
    cur.distanceMm !== null &&
    Math.floor(cur.distanceMm / MILESTONE_MM) > Math.floor(prev.distanceMm / MILESTONE_MM)
  ) {
    return { reason: "milestone", memory };
  }
  if (prev.maxSpeed >= MIN_RECORD_MMPS && cur.speedMmps > prev.maxSpeed) {
    return { reason: "record", memory };
  }
  return { reason: null, memory };
}

export function createLiveFeed(
  baseUrl: string,
  intervalMs = 3000,
  fetchImpl: typeof fetch = (...a) => fetch(...a),
): Feed {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/status`;
  return {
    subscribe(onState) {
      let mem: FeverMemory | null = null;
      let stopped = false;
      const poll = async () => {
        try {
          const res = await fetchImpl(url);
          if (!res.ok) throw new Error(`status ${res.status}`);
          const parsed = parseStatus(await res.json());
          if (!parsed) throw new Error("unexpected response");
          const { reason, memory } = detectFever(mem, parsed);
          mem = memory;
          if (!stopped) onState({ ...parsed, source: "live" }, reason);
        } catch {
          if (!stopped)
            onState({ running: false, rpm: 0, distanceMm: null, speedMmps: 0, workUnits: null, source: "offline" }, null);
        }
      };
      poll();
      const id = setInterval(poll, intervalMs);
      return () => {
        stopped = true;
        clearInterval(id);
      };
    },
  };
}

// Demo wheel: runs for a while, naps for a while, and throws a fever now and then.
export function createDemoFeed(tickMs = 1000): Feed {
  return {
    subscribe(onState) {
      let t = 0;
      let work = 1000;
      const id = setInterval(() => {
        t++;
        const phase = t % 60;
        const running = phase < 42;
        const rpm = running ? 32 + Math.round(Math.random() * 14) : 0;
        work += running ? 2 : 0;
        onState(
          { running, rpm, distanceMm: null, speedMmps: running ? rpm * 11 : 0, workUnits: work, source: "demo" },
          t % 90 === 20 ? "demo" : null,
        );
      }, tickMs);
      onState({ running: true, rpm: 38, distanceMm: null, speedMmps: 420, workUnits: work, source: "demo" }, null);
      return () => clearInterval(id);
    },
  };
}

export function pickFeed(): { feed: Feed; live: boolean } {
  const url = import.meta.env.VITE_SQUEEK_API_URL as string | undefined;
  const forceDemo = new URLSearchParams(location.search).has("demo");
  if (url && !forceDemo) return { feed: createLiveFeed(url), live: true };
  return { feed: createDemoFeed(), live: false };
}
