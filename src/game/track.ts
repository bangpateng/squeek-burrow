// Track geometry maths. Pure functions, no rendering, so they can be unit tested.

export interface TrackPath {
  n: number; // sample count, about one per metre
  length: number; // metres
  px: Float32Array;
  pz: Float32Array;
  tx: Float32Array; // unit tangent
  tz: Float32Array;
  curve: Float32Array; // turn sharpness ahead of each sample, radians over the next 30 m
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export function buildPath(raw: [number, number][], scale = 1, spacing = 1): TrackPath {
  const points = raw.map(([x, z]) => [x * scale, z * scale] as [number, number]);
  const m = points.length;
  const dense: [number, number][] = [];
  const per = 200;
  for (let i = 0; i < m; i++) {
    const a = points[(i - 1 + m) % m];
    const b = points[i];
    const c = points[(i + 1) % m];
    const d = points[(i + 2) % m];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      dense.push([catmull(a[0], b[0], c[0], d[0], t), catmull(a[1], b[1], c[1], d[1], t)]);
    }
  }
  const cum = new Float64Array(dense.length + 1);
  for (let i = 0; i < dense.length; i++) {
    const p = dense[i];
    const q = dense[(i + 1) % dense.length];
    cum[i + 1] = cum[i] + Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  const length = cum[dense.length];
  const n = Math.max(16, Math.round(length / spacing));
  const px = new Float32Array(n);
  const pz = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = (i / n) * length;
    while (cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const f = (target - cum[j]) / seg;
    const p = dense[j];
    const q = dense[(j + 1) % dense.length];
    px[i] = p[0] + (q[0] - p[0]) * f;
    pz[i] = p[1] + (q[1] - p[1]) * f;
  }
  const tx = new Float32Array(n);
  const tz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n;
    const b = (i + 1) % n;
    const dx = px[b] - px[a];
    const dz = pz[b] - pz[a];
    const l = Math.hypot(dx, dz) || 1;
    tx[i] = dx / l;
    tz[i] = dz / l;
  }
  const curve = new Float32Array(n);
  const ahead = Math.round(30 / (length / n));
  for (let i = 0; i < n; i++) {
    let total = 0;
    for (let k = 0; k < ahead; k += 3) {
      const a = (i + k) % n;
      const b = (i + k + 3) % n;
      total += Math.abs(angleDiff(Math.atan2(tx[a], tz[a]), Math.atan2(tx[b], tz[b])));
    }
    curve[i] = total;
  }
  return { n, length, px, pz, tx, tz, curve };
}

export function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const wrap = (i: number, n: number) => ((i % n) + n) % n;

// Right-hand side vector of the road at sample i (x, z).
export function rightAt(p: TrackPath, i: number): [number, number] {
  return [-p.tz[i], p.tx[i]];
}

export interface Locate {
  i: number;
  lateral: number; // metres, positive to the right of the centre line
  dist2: number;
}

// Find the closest sample, searching near a hint so crossing sections of track never confuse it.
export function locate(p: TrackPath, x: number, z: number, hint: number, window = 40): Locate {
  let best = hint;
  let bd = Infinity;
  for (let k = -window; k <= window; k++) {
    const i = wrap(hint + k, p.n);
    const dx = x - p.px[i];
    const dz = z - p.pz[i];
    const d = dx * dx + dz * dz;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  const [rx, rz] = rightAt(p, best);
  const lateral = (x - p.px[best]) * rx + (z - p.pz[best]) * rz;
  return { i: best, lateral, dist2: bd };
}

// Full scan, used once at spawn.
export function locateGlobal(p: TrackPath, x: number, z: number): Locate {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < p.n; i++) {
    const dx = x - p.px[i];
    const dz = z - p.pz[i];
    const d = dx * dx + dz * dz;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  const [rx, rz] = rightAt(p, best);
  return { i: best, lateral: (x - p.px[best]) * rx + (z - p.pz[best]) * rz, dist2: bd };
}

// Lap tracking. A lap counts when the kart wraps past the start after visiting the half-way checkpoint.
export interface LapState {
  lap: number; // completed laps
  last: number; // last sample index
  half: boolean; // passed the half-way checkpoint this lap
}

export function newLap(i: number): LapState {
  return { lap: 0, last: i, half: false };
}

export function advanceLap(s: LapState, i: number, n: number): { s: LapState; crossed: boolean } {
  let { lap, half } = s;
  let crossed = false;
  const step = angleDiff((s.last / n) * Math.PI * 2, (i / n) * Math.PI * 2) / (Math.PI * 2);
  if (i > n * 0.45 && i < n * 0.55) half = true;
  // wrapped forwards past the start line
  if (step > 0 && s.last > n * 0.8 && i < n * 0.2) {
    if (half) {
      lap += 1;
      crossed = true;
    }
    half = false;
  }
  // backed over the line: undo the lap so reversing cannot farm laps
  if (step < 0 && s.last < n * 0.2 && i > n * 0.8) {
    if (!half && lap > 0) {
      lap -= 1;
      half = true;
    }
  }
  return { s: { lap, last: i, half }, crossed };
}

// Race progress used for positions: laps plus the fraction of the current lap.
export function progress(s: LapState, i: number, n: number): number {
  // before the first crossing the kart may sit behind the line (high index)
  const frac = i / n;
  const adj = !s.half && frac > 0.8 ? frac - 1 : frac;
  return s.lap + adj;
}
