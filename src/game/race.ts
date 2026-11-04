// One race session: renderer, scene, karts, items, rules, effects and camera.
import * as THREE from "three";
import { ambience, drive, musicFast, sfx, stopAll } from "./audio";
import { CHARACTERS, RUSH_SECONDS, TRACKS, TRACK_SCALE, type Character, type EventDef, type UpgradeId } from "./data";
import { readInput, takePause } from "./input";
import { BOMB_RADIUS, ITEMS, ITEM_LIST, ROLL_TIME, SHOT_SPEED, rollItem, stepBomb, stepShot, type Bomb, type ItemId, type Shot, type Trap } from "./items";
import { DRIFT_BLUE, DRIFT_ORANGE, NO_INPUT, giveBoost, hitKart, newBrain, spawnKart, statsFor, stepKart, think, type Brain, type Input, type Kart, type Stats } from "./kart";
import { buildAcorn, buildBomb, buildBubble, buildCheese, buildItemBox, buildKart, buildPepper, buildSeed, type KartModel } from "./models";
import { angleDiff, buildPath, progress, rightAt, wrap, type TrackPath } from "./track";
import { buildWorld, type World } from "./world";

export interface Racer {
  n: number;
  name: string;
  char: Pick<Character, "fur" | "belly" | "kart">;
  kart: Kart;
  stats: Stats;
  model: KartModel;
  bubble: THREE.Mesh;
  brain: Brain | null; // null for the player until they finish
  player: boolean;
  color: string;
  topMul: number;
  padCool: number;
  itemT: number; // AI: seconds it has held its item
  spinAngle: number;
}

export interface Hud {
  phase: "intro" | "countdown" | "race" | "done";
  count: number;
  lap: number;
  laps: number;
  place: number;
  of: number;
  time: number;
  lastLap: number | null;
  speed: number;
  meter: number;
  boost: string;
  drift: number; // 0 none, 1 charging, 2 blue, 3 orange
  seeds: number;
  left: number; // rush seconds left
  wrongWay: boolean;
  liveRunning: boolean;
  fever: boolean;
  items: boolean;
  item: ItemId | null;
  rolling: boolean;
  shield: boolean;
  hit: number; // seconds since the player was hit
}

export interface RaceResult {
  value: number; // place, seconds or seeds depending on the event
  place: number;
  time: number;
  seeds: number;
  bestLap: number | null;
  hits: number;
}

export type RaceMsg = { text: string; tone: "info" | "good" | "warn" | "bad" };

export interface RaceConfig {
  event: EventDef;
  char: Character;
  upgrades: Record<UpgradeId, number>;
  quality: "high" | "low";
  live: () => { running: boolean; fever: boolean; source: string };
  onFinish: (r: RaceResult) => void;
  onMsg: (m: RaceMsg) => void;
  onPause: () => void;
  autopilot?: boolean;
  timeScale?: number;
}

const RIVALS = [
  { name: "Pip", fur: 0xd9b48a, belly: 0xfff6e6, kart: 0x8a6bff },
  { name: "Hazel", fur: 0x9c6b4a, belly: 0xf3dcc0, kart: 0xff7ad9 },
  { name: "Peanut", fur: 0xe0c08a, belly: 0xffffff, kart: 0x2ee6c8 },
  { name: "Dusty", fur: 0x9a9590, belly: 0xe9e4dc, kart: 0xff8a2a },
  { name: "Chomp", fur: 0x5c4434, belly: 0xd9b48a, kart: 0x1f9d55 },
];
const hex = (c: number) => "#" + c.toString(16).padStart(6, "0");

interface Pickup {
  obj: THREE.Object3D;
  x: number;
  z: number;
  i: number;
  gone: number; // seconds until respawn, 0 = present
}

interface ShotObj extends Shot {
  obj: THREE.Object3D;
}
interface BombObj extends Bomb {
  obj: THREE.Object3D;
}
interface TrapObj extends Trap {
  obj: THREE.Object3D;
}
interface Blast {
  ball: THREE.Mesh;
  ring: THREE.Mesh;
  t: number;
}

let dotTex: THREE.Texture | null = null;
function softDot(): THREE.Texture {
  if (dotTex) return dotTex;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const c = cv.getContext("2d")!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(cv);
  return dotTex;
}

class Particles {
  pos: Float32Array;
  col: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  grav: Float32Array;
  next = 0;
  geo = new THREE.BufferGeometry();
  points: THREE.Points;
  constructor(public max: number, size: number, blending: THREE.Blending = THREE.NormalBlending) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(this.geo, new THREE.PointsMaterial({ size, map: softDot(), alphaTest: 0.02, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending }));
    this.points.frustumCulled = false;
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, c: THREE.Color, life: number, grav = 6) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.col.set([c.r, c.g, c.b], i * 3);
    this.life[i] = life;
    this.grav[i] = grav;
  }
  burst(x: number, y: number, z: number, n: number, speed: number, up: number, c: THREE.Color, life: number, grav = 6) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.emit(x, y, z, Math.cos(a) * s, up * (0.3 + Math.random()), Math.sin(a) * s, c, life * (0.6 + Math.random() * 0.6), grav);
    }
  }
  step(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -100;
        continue;
      }
      this.life[i] -= dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      if (this.pos[i * 3 + 1] < 0.05) {
        this.pos[i * 3 + 1] = 0.05;
        this.vel[i * 3 + 1] *= -0.3;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

const C = (h: number) => new THREE.Color(h);
const C_BLUE = C(0x5ab8ff);
const C_ORANGE = C(0xff9a2a);
const C_WHITE = C(0xfff6e0);
const C_DUST = C(0x9a7a55);
const C_GOLD = C(0xffd54a);
const C_SPARK = C(0xffe08a);
const C_FIRE = [C(0xffe14a), C(0xff9a2a), C(0xff4a1a)];
const C_SMOKE = C(0x4a4045);
const C_STAR = C(0xfff27a);
const C_PINK = C(0xff4fd8);
const C_BUBBLE = C(0x8fe8ff);

const BLAST_BALL = new THREE.SphereGeometry(1, 16, 12);
const BLAST_RING = new THREE.TorusGeometry(1, 0.18, 6, 32);

export class Race {
  cfg: RaceConfig;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, 0.3, 1500);
  path: TrackPath;
  world: World;
  width: number;
  racers: Racer[] = [];
  player!: Racer;
  seeds: Pickup[] = [];
  boxes: Pickup[] = [];
  shots: ShotObj[] = [];
  bombs: BombObj[] = [];
  traps: TrapObj[] = [];
  blasts: Blast[] = [];
  fx = new Particles(1200, 0.4);
  fire = new Particles(500, 0.9, THREE.AdditiveBlending);
  smoke = new Particles(300, 1.9);
  flash = new THREE.PointLight(0xffa040, 0, 45, 1.5);
  phase: Hud["phase"] = "intro";
  clock = 0;
  raceTime = 0;
  countdown = 3;
  paused = false;
  finishOrder: Racer[] = [];
  collected = 0;
  seedStreak = 0;
  seedStreakT = 0;
  lapStart = 0;
  lastLap: number | null = null;
  bestLap: number | null = null;
  doneAt = 0;
  result: RaceResult | null = null;
  liveRunning = false;
  feverOn = false;
  camYaw = 0;
  camPos = new THREE.Vector3();
  shake = 0;
  raf = 0;
  last = 0;
  acc = 0;
  host: HTMLElement;
  ro: ResizeObserver;
  minimap: CanvasRenderingContext2D | null = null;
  mapPts: [number, number][] = [];
  mapBox = { minX: 0, minZ: 0, s: 1, ox: 0, oz: 0 };
  lastCount = 4;
  lastPlace = 0;
  lastDrift = 0;
  rollTick = 0;
  hitAgo = 99;
  hits = 0;
  rngSeed = 12345;
  items: boolean;
  tpl = { acorn: buildAcorn(), cheese: buildCheese(), pepper: buildPepper(), bomb: buildBomb() };

  constructor(host: HTMLElement, cfg: RaceConfig) {
    this.cfg = cfg;
    this.host = host;
    this.items = cfg.event.kind === "race";
    const def = TRACKS[cfg.event.track];
    this.width = def.width;
    this.path = buildPath(def.points, TRACK_SCALE);
    const high = cfg.quality === "high";
    this.renderer = new THREE.WebGLRenderer({ antialias: high, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 2 : 1));
    this.renderer.shadowMap.enabled = high;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = def.theme.night ? 1.45 : 1.05;
    this.renderer.domElement.className = "raceCanvas";
    host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(def.theme.sky);
    this.scene.fog = new THREE.Fog(def.theme.fog, def.theme.fogNear, def.theme.fogFar);
    this.world = buildWorld(def, this.path, { shadows: high, rush: cfg.event.kind === "rush" });
    this.scene.add(this.world.group);
    this.scene.add(this.fx.points, this.fire.points, this.smoke.points, this.flash);

    this.spawnRacers();
    this.spawnSeeds();
    if (this.items) this.spawnBoxes();
    this.buildMap();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.camYaw = this.player.kart.heading;
    this.last = performance.now();
    ambience(cfg.event.track);
    this.raf = requestAnimationFrame(this.loop);
  }

  rand() {
    this.rngSeed = (this.rngSeed * 16807) % 2147483647;
    return (this.rngSeed - 1) / 2147483646;
  }

  spawnRacers() {
    const e = this.cfg.event;
    const n = this.path.n;
    const w = this.width;
    const total = 1 + e.rivals;
    const playerSlot = e.rivals > 0 ? Math.min(total - 1, 4) : 0;
    const aiUp = Math.max(0, Math.round((e.difficulty - 0.5) * 8));
    let r = 0;
    for (let slot = 0; slot < total; slot++) {
      const row = Math.floor(slot / 2);
      const idx = n - 6 - row * 7;
      const lat = total === 1 ? 0 : (slot % 2 ? 1 : -1) * w * 0.42;
      const kart = spawnKart(this.path, idx, lat);
      const isPlayer = slot === playerSlot;
      const look = isPlayer ? this.cfg.char : RIVALS[r % RIVALS.length];
      const model = buildKart(look);
      const bubble = buildBubble();
      model.root.add(bubble);
      this.scene.add(model.root);
      if (isPlayer) {
        this.player = {
          n: this.racers.length, name: this.cfg.char.name, char: look, kart, model, bubble,
          stats: statsFor(this.cfg.char, this.cfg.upgrades),
          brain: this.cfg.autopilot ? newBrain(99, 1) : null,
          player: true, color: "#ffc83d", topMul: 0.98, padCool: 0, itemT: 0, spinAngle: 0,
        };
        this.racers.push(this.player);
      } else {
        const rv = RIVALS[r % RIVALS.length];
        const base = CHARACTERS[(r + 1) % CHARACTERS.length];
        const spread = [0.02, -0.01, 0.0, -0.03, -0.05][r % 5];
        this.racers.push({
          n: this.racers.length, name: rv.name, char: rv, kart, model, bubble,
          stats: statsFor(base, { engine: aiUp, tires: aiUp, turbo: aiUp }),
          brain: newBrain(31 + r * 101, 1),
          player: false, color: hex(rv.kart), topMul: 0.8 + e.difficulty * 0.14 + spread, padCool: 0, itemT: 0, spinAngle: 0,
        });
        r++;
      }
    }
  }

  spawnSeeds() {
    const tpl = buildSeed();
    for (const s of this.world.seedSpots) {
      const o = tpl.clone();
      o.position.set(s.x, 1, s.z);
      this.scene.add(o);
      this.seeds.push({ obj: o, x: s.x, z: s.z, i: s.i, gone: 0 });
    }
  }

  spawnBoxes() {
    const tpl = buildItemBox();
    const n = this.path.n;
    for (const f of [0.12, 0.37, 0.6, 0.83]) {
      let i = Math.floor(n * f);
      // nudge off boost pads
      while (this.world.pads.some((p) => wrap(i - p.i + 6, n) < p.len + 12)) i = wrap(i + 10, n);
      const [rx, rz] = rightAt(this.path, i);
      for (const lat of [-0.66, -0.22, 0.22, 0.66]) {
        const o = tpl.clone();
        const x = this.path.px[i] + rx * lat * this.width;
        const z = this.path.pz[i] + rz * lat * this.width;
        o.position.set(x, 1.3, z);
        this.scene.add(o);
        this.boxes.push({ obj: o, x, z, i, gone: 0 });
      }
    }
  }

  buildMap() {
    const p = this.path;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < p.n; i++) {
      minX = Math.min(minX, p.px[i]);
      maxX = Math.max(maxX, p.px[i]);
      minZ = Math.min(minZ, p.pz[i]);
      maxZ = Math.max(maxZ, p.pz[i]);
    }
    const size = 150;
    const s = (size - 20) / Math.max(maxX - minX, maxZ - minZ);
    this.mapBox = { minX, minZ, s, ox: (size - (maxX - minX) * s) / 2, oz: (size - (maxZ - minZ) * s) / 2 };
    for (let i = 0; i < p.n; i += 4) this.mapPts.push(this.toMap(p.px[i], p.pz[i]));
  }

  // seen from above and mirrored so the map matches the driver's left and right
  toMap(x: number, z: number): [number, number] {
    const b = this.mapBox;
    return [150 - (b.ox + (x - b.minX) * b.s), 150 - (b.oz + (z - b.minZ) * b.s)];
  }

  setMinimap(c: HTMLCanvasElement | null) {
    this.minimap = c ? c.getContext("2d") : null;
  }

  resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 78 : 62;
    this.camera.updateProjectionMatrix();
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (p) drive(null);
    this.last = performance.now();
  }

  loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (takePause() && this.phase !== "done") this.cfg.onPause();
    if (!this.paused) {
      dt *= this.cfg.timeScale ?? 1;
      this.acc += dt;
      const h = 1 / 120;
      let steps = 0;
      while (this.acc >= h && steps < 40) {
        this.step(h);
        this.acc -= h;
        steps++;
      }
      if (steps === 40) this.acc = 0;
      this.visuals(dt);
    }
    this.renderer.render(this.scene, this.camera);
    this.drawMap();
  };

  near(x: number, z: number, r = 70): boolean {
    const p = this.player.kart;
    return (p.x - x) ** 2 + (p.z - z) ** 2 < r * r;
  }

  distToPlayer(x: number, z: number): number {
    const p = this.player.kart;
    return Math.hypot(p.x - x, p.z - z);
  }

  step(dt: number) {
    this.clock += dt;
    this.hitAgo += dt;
    const live = this.cfg.live();
    if (live.running !== this.liveRunning) {
      this.liveRunning = live.running;
      if (this.phase === "race") this.cfg.onMsg(live.running ? { text: "Real hamster is running: turbo charges 2x", tone: "good" } : { text: "Real hamster is napping", tone: "info" });
    }
    if (live.fever && !this.feverOn && this.phase === "race") {
      this.player.kart.meter = 3;
      sfx.fever();
      this.cfg.onMsg({ text: "SQUEEK FEVER! Turbo tank full", tone: "good" });
    }
    this.feverOn = live.fever;

    if (this.phase === "intro") {
      if (this.clock > 2.6) this.phase = "countdown";
      return;
    }
    if (this.phase === "countdown") {
      this.countdown -= dt;
      const c = Math.ceil(this.countdown);
      if (c !== this.lastCount && c > 0) {
        this.lastCount = c;
        sfx.count();
      }
      if (this.countdown <= 0) {
        this.phase = "race";
        this.lapStart = 0;
        this.lastPlace = this.placeOf(this.player);
        sfx.go();
      }
      return;
    }

    if (this.phase === "race") this.raceTime += dt;
    const e = this.cfg.event;
    const meterRate = this.liveRunning ? 2 : 1;
    const pProg = this.prog(this.player);

    for (const r of this.racers) {
      const k = r.kart;
      let inp: Input;
      if (r.brain) {
        const gap = this.prog(r) - pProg;
        const rubber = r.player ? 1 : gap < -0.08 ? 1.08 : gap > 0.12 ? 0.94 : 1;
        inp = think(k, r.brain, this.path, this.width, dt, r.stats.max * r.topMul * rubber);
      } else {
        inp = this.phase === "race" ? readInput() : NO_INPUT;
      }
      const wasDrift = k.drifting;
      const ev = stepKart(k, inp, r.stats, this.path, this.width, dt, r.player ? meterRate : 1.2);

      // effects for everyone, sounds for the player only
      if (ev.wall) {
        const [rx, rz] = rightAt(this.path, k.idx);
        const s = Math.sign(k.lateral);
        this.fx.burst(k.x + rx * s * 1.2, 0.6, k.z + rz * s * 1.2, 16, 7, 5, C_SPARK, 0.35, 12);
        if (r.player) {
          sfx.wall();
          this.shake = Math.max(this.shake, 0.35);
        }
      }
      if (r.player && !r.brain) {
        if (ev.driftStart) sfx.hop();
        if (ev.boost) {
          sfx.boost(ev.boost);
          if (ev.boost === "orange") this.cfg.onMsg({ text: "Super mini-turbo!", tone: "good" });
        }
        const lvl = !k.drifting ? 0 : k.driftCharge >= DRIFT_ORANGE ? 3 : k.driftCharge >= DRIFT_BLUE ? 2 : 1;
        if (lvl > this.lastDrift && lvl >= 2) sfx.driftLevel(lvl);
        this.lastDrift = lvl;
      }
      if (wasDrift && !k.drifting && ev.boost) this.fx.burst(k.x, 0.6, k.z, 18, 6, 4, ev.boost === "orange" ? C_ORANGE : C_BLUE, 0.5);
      if (ev.boost === "turbo") this.fx.burst(k.x, 0.8, k.z, 20, 5, 3, C_PINK, 0.5);

      r.padCool = Math.max(0, r.padCool - dt);
      for (const p of this.world.pads) {
        if (r.padCool > 0) break;
        const d = wrap(k.idx - p.i, this.path.n);
        if (d <= p.len && Math.abs(k.lateral - p.lateral) < p.half + 0.6) {
          giveBoost(k, "pad", 1.0, 1.3);
          r.padCool = 1.2;
          if (r.player) sfx.boost("pad");
        }
      }

      // items
      if (this.items && this.phase === "race") {
        if (k.roll > 0) {
          k.roll = Math.max(0, k.roll - dt);
          if (r.player && !r.brain) {
            this.rollTick -= dt;
            if (this.rollTick <= 0) {
              sfx.roll();
              this.rollTick = 0.08;
            }
            if (k.roll === 0) sfx.itemReady();
          }
        } else if (k.item) {
          let use = false;
          let back = false;
          if (r.brain && !r.player) {
            r.itemT += dt;
            const d = this.aiItemDecision(r);
            use = d.use;
            back = d.back;
          } else if (!r.brain) {
            use = inp.item && !k.itemHeld;
            back = inp.brake > 0 && inp.throttle === 0;
          }
          if (use && k.spin === 0) this.useItem(r, k.item as ItemId, back);
        }
      }
      k.itemHeld = inp.item;

      if (ev.lap && r.player && !k.finished && e.kind !== "rush") this.playerLap();
      if (ev.lap && !r.player && !k.finished && k.lap.lap >= e.laps && e.kind === "race") {
        k.finished = true;
        k.finishTime = this.raceTime;
        this.finishOrder.push(r);
      }
    }
    this.collide();
    this.pickSeeds(dt);
    if (this.items) {
      this.pickBoxes(dt);
      this.stepWeapons(dt);
    }

    if (this.phase === "race" && e.kind === "race") {
      const place = this.placeOf(this.player);
      if (place !== this.lastPlace && this.lastPlace) sfx.overtake(place < this.lastPlace);
      this.lastPlace = place;
    }

    if (e.kind === "rush" && this.phase === "race" && this.raceTime >= RUSH_SECONDS) this.finishPlayer();
    if (this.phase === "done" && !this.result && this.clock - this.doneAt > 2.8) {
      const place = this.finishOrder.indexOf(this.player) + 1 || this.placeOf(this.player);
      this.result = {
        value: e.kind === "race" ? place : e.kind === "trial" ? Math.round(this.player.kart.finishTime * 100) / 100 : this.collected,
        place,
        time: this.player.kart.finishTime,
        seeds: this.collected,
        bestLap: this.bestLap,
        hits: this.hits,
      };
      this.cfg.onFinish(this.result);
    }
  }

  // ---------- items ----------
  aheadOf(r: Racer): Racer | null {
    const sorted = [...this.racers].sort((a, b) => this.prog(b) - this.prog(a));
    const i = sorted.indexOf(r);
    return i > 0 ? sorted[i - 1] : null;
  }

  aiItemDecision(r: Racer): { use: boolean; back: boolean } {
    const k = r.kart;
    const item = k.item as ItemId;
    const t = r.itemT;
    const fx = Math.sin(k.heading);
    const fz = Math.cos(k.heading);
    let front = Infinity;
    let behind = Infinity;
    for (const o of this.racers) {
      if (o === r) continue;
      const dx = o.kart.x - k.x;
      const dz = o.kart.z - k.z;
      const d = Math.hypot(dx, dz);
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot > 0.93) front = Math.min(front, d);
      if (dot < -0.7) behind = Math.min(behind, d);
    }
    const late = t > 7;
    switch (item) {
      case "shield":
        return { use: t > 0.8, back: false };
      case "dash":
        return { use: t > 1 && this.path.curve[k.idx] < 0.3, back: false };
      case "acorn":
        if (front < 45 && t > 0.6) return { use: true, back: false };
        if (behind < 14 && t > 0.6) return { use: true, back: true };
        return { use: late, back: false };
      case "cheese":
        return { use: t > 1.2 && !!this.aheadOf(r), back: false };
      case "pepper":
        return { use: (behind < 18 && t > 0.6) || late, back: true };
      case "bomb":
        if (front < 38 && t > 0.6) return { use: true, back: false };
        if (behind < 10 && t > 0.6) return { use: true, back: true };
        return { use: late, back: false };
    }
  }

  useItem(r: Racer, item: ItemId, back: boolean) {
    const k = r.kart;
    k.item = null;
    r.itemT = 0;
    const fx = Math.sin(k.heading);
    const fz = Math.cos(k.heading);
    const dir = back ? -1 : 1;
    const loud = r.player || this.near(k.x, k.z, 50);
    switch (item) {
      case "acorn":
      case "cheese": {
        const speed = SHOT_SPEED[item] + (back ? 0 : Math.max(0, k.speed));
        const target = item === "cheese" ? (this.aheadOf(r)?.n ?? -1) : -1;
        const obj = this.tpl[item].clone();
        const s: ShotObj = {
          kind: item, x: k.x + fx * 3 * dir, z: k.z + fz * 3 * dir, vx: fx * speed * dir, vz: fz * speed * dir,
          idx: k.idx, life: item === "acorn" ? 6 : 9, bounces: 0, owner: r.n, safe: 0.5, target, obj,
        };
        obj.position.set(s.x, 0.8, s.z);
        this.scene.add(obj);
        this.shots.push(s);
        if (loud) item === "acorn" ? sfx.shoot() : sfx.homing();
        if (item === "cheese" && target === this.player.n && !r.player) this.cfg.onMsg({ text: "Homing cheese behind you!", tone: "warn" });
        break;
      }
      case "pepper": {
        const obj = this.tpl.pepper.clone();
        const x = k.x - fx * 3;
        const z = k.z - fz * 3;
        obj.position.set(x, 0, z);
        obj.rotation.y = Math.random() * 6;
        this.scene.add(obj);
        this.traps.push({ x, z, life: 25, owner: r.n, safe: 0.8, obj });
        if (loud) sfx.trap();
        break;
      }
      case "bomb": {
        const obj = this.tpl.bomb.clone();
        const b: BombObj = back
          ? { x: k.x - fx * 3, y: 1.2, z: k.z - fz * 3, vx: -fx * 4, vy: 3, vz: -fz * 4, fuse: 1.1, owner: r.n, obj }
          : { x: k.x + fx * 2.5, y: 1.6, z: k.z + fz * 2.5, vx: fx * (Math.max(0, k.speed) + 18), vy: 11, vz: fz * (Math.max(0, k.speed) + 18), fuse: 1.6, owner: r.n, obj };
        obj.position.set(b.x, b.y, b.z);
        this.scene.add(obj);
        this.bombs.push(b);
        if (loud) sfx.throwBomb();
        break;
      }
      case "shield":
        k.shield = 10;
        if (loud) sfx.shieldUp();
        this.fx.burst(k.x, 1, k.z, 20, 4, 4, C_BUBBLE, 0.5, 2);
        break;
      case "dash":
        giveBoost(k, "dash", 1.8, 1.5);
        k.spin = 0;
        if (loud) sfx.boost("dash");
        this.fire.burst(k.x - fx * 2.6, 0.6, k.z - fz * 2.6, 10, 5, 1.5, C_FIRE[1], 0.3, 0);
        break;
    }
  }

  pickBoxes(dt: number) {
    for (const b of this.boxes) {
      if (b.gone > 0) {
        b.gone = Math.max(0, b.gone - dt);
        b.obj.visible = b.gone === 0;
        if (b.gone === 0) b.obj.scale.setScalar(0.1);
        continue;
      }
      for (const r of this.racers) {
        const dx = r.kart.x - b.x;
        const dz = r.kart.z - b.z;
        if (dx * dx + dz * dz > 5.5) continue;
        b.gone = 2.5;
        b.obj.visible = false;
        this.fx.burst(b.x, 1.3, b.z, 22, 6, 5, [C_PINK, C_GOLD, C_BLUE][Math.floor(Math.random() * 3)], 0.5);
        if (!r.kart.item && r.kart.roll === 0 && this.phase === "race") {
          r.kart.item = rollItem(this.placeOf(r), this.racers.length, () => this.rand());
          r.kart.roll = ROLL_TIME;
          r.itemT = 0;
        }
        if (r.player) sfx.itemBox();
        break;
      }
    }
  }

  // Apply a hit and the matching messages and effects. Returns true if the kart was knocked out.
  hit(victim: Racer, seconds: number, by: number, what: string): boolean {
    const k = victim.kart;
    const hadShield = k.shield > 0;
    const spun = hitKart(k, seconds);
    if (!spun && !hadShield) return false;
    const attacker = this.racers[by];
    if (hadShield) {
      this.fx.burst(k.x, 1.2, k.z, 30, 7, 5, C_BUBBLE, 0.5, 3);
      if (victim.player) {
        sfx.shieldPop();
        this.cfg.onMsg({ text: "Shield blocked it!", tone: "good" });
      }
      return false;
    }
    this.fx.burst(k.x, 1.8, k.z, 12, 3, 4, C_STAR, 0.6, 3);
    if (victim.player) {
      sfx.spinout();
      this.shake = Math.max(this.shake, 0.7);
      this.hitAgo = 0;
      this.hits++;
      if (attacker && attacker !== victim) this.cfg.onMsg({ text: `${attacker.name} got you with ${what}!`, tone: "bad" });
    } else if (attacker?.player) {
      sfx.hitOther();
      this.cfg.onMsg({ text: `Hit ${victim.name}!`, tone: "good" });
    }
    return true;
  }

  explode(x: number, z: number, owner: number) {
    const d = this.distToPlayer(x, z);
    sfx.explosion(d);
    this.shake = Math.max(this.shake, Math.max(0, 1.2 - d / 40));
    for (let i = 0; i < 45; i++) this.fire.burst(x, 1, z, 1, 12, 8, C_FIRE[i % 3], 0.55, 4);
    this.smoke.burst(x, 2, z, 16, 4, 5, C_SMOKE, 1.3, -1.5);
    this.fx.burst(x, 0.8, z, 40, 16, 10, C_SPARK, 0.7, 14);
    const ball = new THREE.Mesh(BLAST_BALL, new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.9, depthWrite: false }));
    ball.position.set(x, 1.2, z);
    const ring = new THREE.Mesh(BLAST_RING, new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.8, depthWrite: false }));
    ring.position.set(x, 0.3, z);
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ball, ring);
    this.blasts.push({ ball, ring, t: 0 });
    this.flash.position.set(x, 3, z);
    this.flash.intensity = 400;
    for (const r of this.racers) {
      const dd = Math.hypot(r.kart.x - x, r.kart.z - z);
      if (r.n === owner) continue; // your own bomb never hurts you
      if (dd < BOMB_RADIUS && this.hit(r, 1.6, owner, "a seed bomb")) r.kart.hop = 0.6;
    }
    for (const t of this.traps) if (Math.hypot(t.x - x, t.z - z) < BOMB_RADIUS) t.life = 0;
  }

  stepWeapons(dt: number) {
    // shots
    for (const s of this.shots) {
      const tgt = s.target >= 0 ? this.racers[s.target].kart : null;
      const res = stepShot(s, this.path, this.width, dt, tgt);
      if (res === "wall") {
        this.fx.burst(s.x, 0.8, s.z, 6, 5, 3, C_SPARK, 0.25, 10);
        if (this.near(s.x, s.z, 40)) sfx.ricochet();
      }
      if (res === "dead") {
        s.life = 0;
        continue;
      }
      for (const r of this.racers) {
        if (r.n === s.owner && s.safe > 0) continue;
        if ((r.kart.x - s.x) ** 2 + (r.kart.z - s.z) ** 2 > 3.6) continue;
        this.hit(r, 1.1, s.owner, s.kind === "acorn" ? "an acorn" : "homing cheese");
        this.fx.burst(s.x, 1, s.z, 14, 6, 5, s.kind === "acorn" ? C_DUST : C_GOLD, 0.5);
        s.life = 0;
        break;
      }
      // shots knock out traps
      for (const t of this.traps) {
        if (s.life > 0 && (t.x - s.x) ** 2 + (t.z - s.z) ** 2 < 3) {
          t.life = 0;
          s.life = 0;
          this.fx.burst(t.x, 0.6, t.z, 12, 5, 4, C_ORANGE, 0.4);
        }
      }
    }
    // shot vs shot
    for (let a = 0; a < this.shots.length; a++)
      for (let b = a + 1; b < this.shots.length; b++) {
        const A = this.shots[a];
        const B = this.shots[b];
        if (A.life > 0 && B.life > 0 && (A.x - B.x) ** 2 + (A.z - B.z) ** 2 < 2.5) {
          A.life = B.life = 0;
          this.fx.burst(A.x, 0.8, A.z, 16, 6, 4, C_SPARK, 0.4);
        }
      }
    this.shots = this.shots.filter((s) => {
      if (s.life > 0) return true;
      this.scene.remove(s.obj);
      return false;
    });
    // traps
    for (const t of this.traps) {
      t.life -= dt;
      t.safe = Math.max(0, t.safe - dt);
      if (t.life <= 0) continue;
      for (const r of this.racers) {
        if (r.n === t.owner && t.safe > 0) continue;
        if ((r.kart.x - t.x) ** 2 + (r.kart.z - t.z) ** 2 > 3.2) continue;
        this.hit(r, 1.0, t.owner, "a pepper trap");
        this.fire.burst(t.x, 0.6, t.z, 20, 4, 4, C_FIRE[2], 0.4, 2);
        t.life = 0;
        break;
      }
    }
    this.traps = this.traps.filter((t) => {
      if (t.life > 0) return true;
      this.scene.remove(t.obj);
      return false;
    });
    // bombs
    this.bombs = this.bombs.filter((b) => {
      if (!stepBomb(b, dt)) {
        // contact with a kart sets it off early
        if (b.y < 2 && this.racers.some((r) => r.n !== b.owner && (r.kart.x - b.x) ** 2 + (r.kart.z - b.z) ** 2 < 4)) b.fuse = -99;
        else return true;
      }
      this.scene.remove(b.obj);
      this.explode(b.x, b.z, b.owner);
      return false;
    });
  }

  prog(r: Racer): number {
    if (r.kart.finished) return 1000 - this.finishOrder.indexOf(r);
    return progress(r.kart.lap, r.kart.idx, this.path.n);
  }

  placeOf(r: Racer): number {
    const sorted = [...this.racers].sort((a, b) => this.prog(b) - this.prog(a));
    return sorted.indexOf(r) + 1;
  }

  playerLap() {
    const k = this.player.kart;
    const e = this.cfg.event;
    const lapTime = this.raceTime - this.lapStart;
    this.lapStart = this.raceTime;
    this.lastLap = lapTime;
    if (this.bestLap === null || lapTime < this.bestLap) this.bestLap = lapTime;
    if (k.lap.lap >= e.laps) {
      this.finishPlayer();
      return;
    }
    const final = k.lap.lap === e.laps - 1;
    sfx.lap(final);
    if (final) musicFast(true);
    this.cfg.onMsg({ text: final ? "Final lap!" : `Lap ${k.lap.lap + 1}`, tone: final ? "warn" : "info" });
  }

  finishPlayer() {
    const k = this.player.kart;
    k.finished = true;
    k.finishTime = this.raceTime;
    this.finishOrder.push(this.player);
    this.phase = "done";
    this.doneAt = this.clock;
    this.player.brain = newBrain(5, 1);
    this.player.topMul = 0.9;
    k.item = null;
    const e = this.cfg.event;
    const place = this.finishOrder.indexOf(this.player) + 1;
    const good = e.kind !== "race" || place <= 3;
    sfx.finish(good);
    musicFast(false);
    if (good) for (let i = 0; i < 4; i++) this.fx.burst(k.x, 4, k.z, 40, 8, 10, [C_GOLD, C_PINK, C_BLUE, C_WHITE][i], 1.4, 5);
    this.cfg.onMsg({ text: e.kind === "race" ? `Finished ${ordinal(place)}!` : e.kind === "rush" ? `Time! ${this.collected} seeds` : "Finished!", tone: good ? "good" : "info" });
    drive(null);
  }

  collide() {
    const rs = this.racers;
    const R = 1.7;
    for (let a = 0; a < rs.length; a++)
      for (let b = a + 1; b < rs.length; b++) {
        const ka = rs[a].kart;
        const kb = rs[b].kart;
        const dx = kb.x - ka.x;
        const dz = kb.z - ka.z;
        const d = Math.hypot(dx, dz);
        if (d >= R * 2 || d === 0) continue;
        const push = (R * 2 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        ka.x -= nx * push;
        ka.z -= nz * push;
        kb.x += nx * push;
        kb.z += nz * push;
        const rel = Math.abs(ka.speed - kb.speed);
        const avg = (ka.speed + kb.speed) / 2;
        ka.speed = ka.speed * 0.9 + avg * 0.1;
        kb.speed = kb.speed * 0.9 + avg * 0.1;
        // a boosting kart barges through
        if (ka.boostKind === "dash" && kb.boostKind !== "dash") this.hit(rs[b], 0.9, a, "a cheek rocket");
        else if (kb.boostKind === "dash" && ka.boostKind !== "dash") this.hit(rs[a], 0.9, b, "a cheek rocket");
        if (push > 0.12 && ka.wallHit > 0.4 && kb.wallHit > 0.4) {
          ka.wallHit = kb.wallHit = 0;
          this.fx.burst(ka.x + nx * R, 0.7, ka.z + nz * R, 10 + Math.round(rel), 6, 4, C_SPARK, 0.3, 12);
          if (rs[a].player || rs[b].player) {
            sfx.bump();
            this.shake = Math.max(this.shake, 0.25 + Math.min(0.3, rel * 0.02));
          }
        }
      }
  }

  pickSeeds(dt: number) {
    const rush = this.cfg.event.kind === "rush";
    this.seedStreakT = Math.max(0, this.seedStreakT - dt);
    if (this.seedStreakT === 0) this.seedStreak = 0;
    for (const s of this.seeds) {
      if (s.gone > 0) {
        s.gone = Math.max(0, s.gone - dt);
        s.obj.visible = s.gone === 0;
        continue;
      }
      for (const r of this.racers) {
        if (rush && !r.player) continue;
        const dx = r.kart.x - s.x;
        const dz = r.kart.z - s.z;
        if (dx * dx + dz * dz > 4.4) continue;
        s.gone = rush ? 7 : 9;
        s.obj.visible = false;
        r.kart.meter = Math.min(3, r.kart.meter + 0.2);
        if (r.player && this.phase === "race") {
          this.collected++;
          this.seedStreak++;
          this.seedStreakT = 1.2;
          sfx.seed(this.seedStreak);
          this.fx.burst(s.x, 1, s.z, 10, 3, 5, C_GOLD, 0.6);
        }
        break;
      }
    }
  }

  visuals(dt: number) {
    this.world.tick(this.clock);
    for (const r of this.racers) {
      const k = r.kart;
      const m = r.model;
      const lift = k.hop > 0 ? Math.sin(Math.min(1, k.hop / (k.spin > 0 ? 0.6 : 0.18)) * Math.PI) * (k.spin > 0 ? 1.4 : 0.35) : 0;
      m.root.position.set(k.x, lift, k.z);
      if (k.spin > 0) {
        const t = 1 - k.spin / k.spinMax;
        r.spinAngle = (1 - (1 - t) * (1 - t)) * Math.PI * 4;
      } else r.spinAngle = 0;
      const visYaw = k.drifting ? -k.driftDir * 0.38 : 0;
      m.root.rotation.y = k.heading + visYaw + r.spinAngle;
      const sp = Math.min(1, Math.abs(k.speed) / 30);
      m.body.rotation.z = THREE.MathUtils.lerp(m.body.rotation.z, k.steer * 0.07 * sp + (k.drifting ? k.driftDir * 0.06 : 0), 0.2);
      m.body.rotation.x = THREE.MathUtils.lerp(m.body.rotation.x, k.boost > 0 ? -0.05 : 0, 0.1);
      for (const w of m.wheels) w.rotation.x += (k.speed * dt) / 0.4;
      for (const f of m.front) f.rotation.y = -k.steer * 0.45;
      m.driver.rotation.z = -k.steer * 0.12 + (k.spin > 0 ? Math.sin(this.clock * 20) * 0.2 : 0);
      r.bubble.visible = k.shield > 0;
      if (k.shield > 0) {
        r.bubble.scale.setScalar(1 + Math.sin(this.clock * 6) * 0.04);
        (r.bubble.material as THREE.MeshStandardMaterial).opacity = k.shield < 2 ? 0.12 + 0.16 * Math.abs(Math.sin(this.clock * 12)) : 0.28;
      }
      const flame = k.boost > 0;
      for (const f of m.flames) {
        f.visible = flame;
        if (flame) {
          f.scale.set(1, 0.7 + Math.random() * 0.6 * (k.boostPower - 0.9) * 3, 1);
          (f.material as THREE.MeshBasicMaterial).color.set(k.boostKind === "blue" ? 0x5ab8ff : k.boostKind === "turbo" ? 0xff4fd8 : k.boostKind === "dash" ? 0xff5a1a : 0xffa02e);
        }
      }
      const fx = Math.sin(k.heading);
      const fz = Math.cos(k.heading);
      if (k.drifting && Math.random() < 0.8) {
        const c = k.driftCharge >= DRIFT_ORANGE ? C_ORANGE : k.driftCharge >= DRIFT_BLUE ? C_BLUE : C_WHITE;
        for (const s of [-1, 1]) this.fx.emit(k.x - fx * 1 + fz * s * 0.9, 0.25, k.z - fz * 1 - fx * s * 0.9, -fx * 2 + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, -fz * 2 + (Math.random() - 0.5) * 3, c, 0.3);
      }
      if (k.drifting && Math.random() < 0.3) this.smoke.emit(k.x - fx * 1.4, 0.3, k.z - fz * 1.4, (Math.random() - 0.5), 0.8, (Math.random() - 0.5), C_WHITE, 0.6, -0.5);
      if (k.boost > 0 && Math.random() < 0.35) this.fire.emit(k.x - fx * 2.6, 0.5, k.z - fz * 2.6, -fx * 5, 0.5, -fz * 5, C_FIRE[Math.floor(Math.random() * 3)], 0.14, 0);
      if (k.offroad && Math.abs(k.speed) > 8 && Math.random() < 0.6) this.fx.emit(k.x - fx * 1.2, 0.3, k.z - fz * 1.2, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2, C_DUST, 0.6);
      if (k.spin > 0 && Math.random() < 0.25) this.fx.emit(k.x + (Math.random() - 0.5) * 2, 2.4, k.z + (Math.random() - 0.5) * 2, 0, 0.5, 0, C_STAR, 0.4, 0);
    }
    this.fx.step(dt);
    this.fire.step(dt);
    this.smoke.step(dt);
    for (const s of this.seeds)
      if (s.obj.visible) {
        s.obj.rotation.y += dt * 2.5;
        s.obj.position.y = 1 + Math.sin(this.clock * 3 + s.i) * 0.15;
      }
    for (const b of this.boxes)
      if (b.obj.visible) {
        b.obj.rotation.y += dt * 1.5;
        b.obj.rotation.x = Math.sin(this.clock * 1.3 + b.i) * 0.3;
        b.obj.position.y = 1.3 + Math.sin(this.clock * 2 + b.x) * 0.2;
        const sc = Math.min(1, b.obj.scale.x + dt * 3);
        b.obj.scale.setScalar(sc);
      }
    for (const s of this.shots) {
      s.obj.position.set(s.x, 0.8, s.z);
      s.obj.rotation.y = Math.atan2(s.vx, s.vz);
      if (s.kind === "acorn") s.obj.rotation.x += dt * 20;
      else if (Math.random() < 0.5) this.fx.emit(s.x, 0.8, s.z, 0, 0.5, 0, C_GOLD, 0.3, 0);
    }
    for (const t of this.traps) t.obj.position.y = Math.abs(Math.sin(this.clock * 3 + t.x)) * 0.15;
    for (const b of this.bombs) {
      b.obj.position.set(b.x, b.y, b.z);
      b.obj.rotation.x += dt * 6;
      if (Math.random() < 0.8) this.fire.emit(b.x, b.y + 1.1, b.z, (Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2, C_FIRE[0], 0.15, 0);
    }
    this.blasts = this.blasts.filter((bl) => {
      bl.t += dt;
      const p = bl.t / 0.55;
      bl.ball.scale.setScalar(1 + p * BOMB_RADIUS * 0.45);
      (bl.ball.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.65 * (1 - p) * (1 - p));
      bl.ring.scale.setScalar(1 + p * BOMB_RADIUS * 1.6);
      (bl.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - p));
      if (p < 1) return true;
      this.scene.remove(bl.ball, bl.ring);
      (bl.ball.material as THREE.Material).dispose();
      (bl.ring.material as THREE.Material).dispose();
      return false;
    });
    this.flash.intensity *= Math.max(0, 1 - dt * 8);

    // camera
    const k = this.player.kart;
    const fx = Math.sin(k.heading);
    const fz = Math.cos(k.heading);
    if (this.phase === "intro") {
      const t = Math.min(1, this.clock / 2.6);
      const ease = t * t * (3 - 2 * t);
      const a = k.heading + Math.PI * (1 - ease) * 0.9;
      const dist = 7.5 + (1 - ease) * 22;
      const hgt = 3.2 + (1 - ease) * 14;
      this.camera.position.set(k.x - Math.sin(a) * dist, hgt, k.z - Math.cos(a) * dist);
      this.camera.lookAt(k.x + fx * 4, 1.2, k.z + fz * 4);
      this.camPos.copy(this.camera.position);
      this.camYaw = k.heading;
    } else {
      const lagYaw = angleDiff(this.camYaw, k.heading);
      this.camYaw += lagYaw * Math.min(1, dt * (k.drifting ? 3.2 : k.spin > 0 ? 0.5 : 5));
      const back = k.speed < -1 ? -6 : 7.2;
      const cx = k.x - Math.sin(this.camYaw) * back;
      const cz = k.z - Math.cos(this.camYaw) * back;
      this.camPos.lerp(new THREE.Vector3(cx, 3.1, cz), Math.min(1, dt * 8));
      this.camera.position.copy(this.camPos);
      if (this.shake > 0.01) {
        const s = this.shake * this.shake;
        this.camera.position.x += (Math.random() - 0.5) * s * 1.2;
        this.camera.position.y += (Math.random() - 0.5) * s * 0.9;
        this.camera.position.z += (Math.random() - 0.5) * s * 1.2;
      }
      this.shake = Math.max(0, this.shake - dt * 1.8);
      this.camera.lookAt(k.x + Math.sin(this.camYaw) * 5, 1.3, k.z + Math.cos(this.camYaw) * 5);
      const wantFov = (this.camera.aspect < 0.8 ? 78 : 62) + Math.min(10, Math.max(0, k.speed - 20) * 0.35) + (k.boost > 0 ? (k.boostKind === "dash" ? 12 : 6) : 0);
      this.camera.fov += (wantFov - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }
    const sun = this.world.sun;
    sun.position.set(k.x + 50, 110, k.z + 35);
    sun.target.position.set(k.x, 0, k.z);

    if (this.phase === "race" && !this.paused) {
      let rd = Infinity;
      let rsp = 0;
      for (const r of this.racers) {
        if (r.player) continue;
        const d = Math.hypot(r.kart.x - k.x, r.kart.z - k.z);
        if (d < rd) {
          rd = d;
          rsp = r.kart.speed;
        }
      }
      drive({
        speed: k.speed, max: this.player.stats.max, boosting: k.boost > 0,
        drift: !k.drifting ? 0 : k.driftCharge >= DRIFT_ORANGE ? 3 : k.driftCharge >= DRIFT_BLUE ? 2 : 1,
        offroad: k.offroad, spinning: k.spin > 0, rivalDist: rd, rivalSpeed: rsp,
      });
    }
  }

  drawMap() {
    const c = this.minimap;
    if (!c) return;
    c.clearRect(0, 0, 150, 150);
    c.lineJoin = "round";
    c.strokeStyle = "rgba(0,0,0,0.45)";
    c.lineWidth = 9;
    c.beginPath();
    this.mapPts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.stroke();
    c.strokeStyle = "#fff0d4";
    c.lineWidth = 4;
    c.stroke();
    const [sx, sy] = this.toMap(this.path.px[0], this.path.pz[0]);
    c.fillStyle = "#2a1a1e";
    c.fillRect(sx - 4, sy - 4, 8, 8);
    for (const s of this.shots) {
      const [x, y] = this.toMap(s.x, s.z);
      c.fillStyle = s.kind === "acorn" ? "#b5793a" : "#ffd34d";
      c.fillRect(x - 2, y - 2, 4, 4);
    }
    for (const b of this.bombs) {
      const [x, y] = this.toMap(b.x, b.z);
      c.fillStyle = "#ff4a1a";
      c.fillRect(x - 3, y - 3, 6, 6);
    }
    for (const r of [...this.racers].sort((a) => (a.player ? 1 : -1))) {
      const [x, y] = this.toMap(r.kart.x, r.kart.z);
      c.beginPath();
      c.arc(x, y, r.player ? 6 : 4.5, 0, Math.PI * 2);
      c.fillStyle = r.color;
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = "#2a1a1e";
      c.stroke();
    }
  }

  hud(): Hud {
    const k = this.player.kart;
    const e = this.cfg.event;
    const along = Math.atan2(this.path.tx[k.idx], this.path.tz[k.idx]);
    return {
      phase: this.phase,
      count: Math.ceil(this.countdown),
      lap: Math.min(e.laps, k.lap.lap + 1),
      laps: e.laps,
      place: this.phase === "done" ? this.finishOrder.indexOf(this.player) + 1 : this.placeOf(this.player),
      of: this.racers.length,
      time: this.raceTime,
      lastLap: this.lastLap,
      speed: Math.round(Math.abs(k.speed) * 3.6),
      meter: k.meter,
      boost: k.boostKind,
      drift: !k.drifting ? 0 : k.driftCharge >= DRIFT_ORANGE ? 3 : k.driftCharge >= DRIFT_BLUE ? 2 : 1,
      seeds: this.collected,
      left: Math.max(0, RUSH_SECONDS - this.raceTime),
      wrongWay: this.phase === "race" && k.speed > 5 && k.spin === 0 && Math.abs(angleDiff(k.heading, along)) > 1.9,
      liveRunning: this.liveRunning,
      fever: this.feverOn,
      items: this.items,
      item: k.roll > 0 ? ITEM_LIST[Math.floor(this.clock * 12) % ITEM_LIST.length] : (k.item as ItemId | null),
      rolling: k.roll > 0,
      shield: k.shield > 0,
      hit: this.hitAgo,
    };
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    stopAll();
    musicFast(false);
    this.world.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && m.geometry !== BLAST_BALL && m.geometry !== BLAST_RING) m.geometry.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export { ITEMS };

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}
