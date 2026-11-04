// Item boxes, weapons and their projectiles. The maths here is pure so it can be tested.
import { WALL_GAP } from "./kart";
import { locate, wrap, type TrackPath } from "./track";

export type ItemId = "acorn" | "cheese" | "pepper" | "bomb" | "shield" | "dash";

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  blurb: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  acorn: { id: "acorn", name: "Acorn shot", icon: "🌰", blurb: "Fires straight and bounces off walls." },
  cheese: { id: "cheese", name: "Homing cheese", icon: "🧀", blurb: "Chases the racer in front of you." },
  pepper: { id: "pepper", name: "Pepper trap", icon: "🌶️", blurb: "Drop it behind you. Whoever drives over it spins." },
  bomb: { id: "bomb", name: "Seed bomb", icon: "💣", blurb: "Lob it ahead. It blows up everyone nearby." },
  shield: { id: "shield", name: "Bubble shield", icon: "🫧", blurb: "Blocks the next hit for 10 seconds." },
  dash: { id: "dash", name: "Cheek rocket", icon: "🚀", blurb: "A huge burst of speed." },
};

export const ITEM_LIST = Object.keys(ITEMS) as ItemId[];
export const ROLL_TIME = 1.3;

// Racers at the back get stronger items so races stay close.
const FRONT: Record<ItemId, number> = { acorn: 35, cheese: 5, pepper: 35, bomb: 8, shield: 17, dash: 0 };
const BACK: Record<ItemId, number> = { acorn: 10, cheese: 30, pepper: 5, bomb: 22, shield: 8, dash: 25 };

export function itemWeights(place: number, of: number): Record<ItemId, number> {
  const r = of <= 1 ? 0.5 : (place - 1) / (of - 1);
  const w = {} as Record<ItemId, number>;
  for (const id of ITEM_LIST) w[id] = FRONT[id] * (1 - r) + BACK[id] * r;
  return w;
}

export function rollItem(place: number, of: number, rand: () => number): ItemId {
  const w = itemWeights(place, of);
  const total = ITEM_LIST.reduce((a, id) => a + w[id], 0);
  let x = rand() * total;
  for (const id of ITEM_LIST) {
    x -= w[id];
    if (x <= 0) return id;
  }
  return "acorn";
}

export interface Shot {
  kind: "acorn" | "cheese";
  x: number;
  z: number;
  vx: number;
  vz: number;
  idx: number;
  life: number;
  bounces: number;
  owner: number; // racer index
  safe: number; // seconds before it can hit its owner
  target: number; // racer index for homing, -1 for none
}

export const SHOT_SPEED = { acorn: 58, cheese: 52 };

// Move a shot. Acorns bounce off walls, homing cheese steers towards its target.
// Returns "wall" when it bounced, "dead" when it should be removed.
export function stepShot(s: Shot, path: TrackPath, width: number, dt: number, target: { x: number; z: number } | null): "ok" | "wall" | "dead" {
  s.life -= dt;
  s.safe = Math.max(0, s.safe - dt);
  if (s.life <= 0) return "dead";
  if (s.kind === "cheese") {
    const sp = Math.hypot(s.vx, s.vz) || 1;
    let gx: number;
    let gz: number;
    const ahead = wrap(s.idx + 14, path.n);
    if (target && (target.x - s.x) ** 2 + (target.z - s.z) ** 2 < 45 * 45) {
      gx = target.x;
      gz = target.z;
    } else {
      gx = path.px[ahead];
      gz = path.pz[ahead];
    }
    const want = Math.atan2(gx - s.x, gz - s.z);
    const cur = Math.atan2(s.vx, s.vz);
    let d = want - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const turn = Math.max(-4 * dt, Math.min(4 * dt, d));
    const a = cur + turn;
    s.vx = Math.sin(a) * sp;
    s.vz = Math.cos(a) * sp;
  }
  s.x += s.vx * dt;
  s.z += s.vz * dt;
  const loc = locate(path, s.x, s.z, s.idx, 30);
  s.idx = loc.i;
  const limit = width + WALL_GAP - 0.6;
  if (Math.abs(loc.lateral) > limit) {
    const rx = -path.tz[loc.i];
    const rz = path.tx[loc.i];
    const sign = Math.sign(loc.lateral);
    const over = Math.abs(loc.lateral) - limit;
    s.x -= rx * over * sign;
    s.z -= rz * over * sign;
    if (s.kind === "cheese") {
      // homing cheese slides along walls instead of bouncing
      const dot = s.vx * rx + s.vz * rz;
      if (dot * sign > 0) {
        s.vx -= rx * dot;
        s.vz -= rz * dot;
      }
      return "ok";
    }
    const dot = s.vx * rx + s.vz * rz;
    if (dot * sign > 0) {
      s.vx -= 2 * dot * rx;
      s.vz -= 2 * dot * rz;
    }
    s.bounces++;
    return s.bounces > 4 ? "dead" : "wall";
  }
  return "ok";
}

export interface Bomb {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuse: number;
  owner: number;
}

export const BOMB_RADIUS = 8;

// Returns true when the bomb should explode.
export function stepBomb(b: Bomb, dt: number): boolean {
  b.fuse -= dt;
  b.vy -= 32 * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  if (b.y <= 0.5) {
    b.y = 0.5;
    // skid along the ground until the fuse runs out
    b.vy = 0;
    b.vx *= Math.max(0, 1 - 3 * dt);
    b.vz *= Math.max(0, 1 - 3 * dt);
    return b.fuse <= 0 || Math.hypot(b.vx, b.vz) < 2;
  }
  return b.fuse <= -1;
}

export interface Trap {
  x: number;
  z: number;
  life: number;
  owner: number;
  safe: number;
}
