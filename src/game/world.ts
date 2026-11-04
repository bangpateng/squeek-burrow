// Builds the 3D scene for one track: road, kerbs, walls, start gate, boost pads and themed scenery.
import * as THREE from "three";
import type { TrackDef } from "./data";
import { WALL_GAP } from "./kart";
import { buildSeed, canvasTexture, mat } from "./models";
import { rightAt, wrap, type TrackPath } from "./track";

export interface Pad {
  i: number;
  len: number;
  lateral: number;
  half: number; // half width
}

export interface World {
  group: THREE.Group;
  pads: Pad[];
  seedSpots: { x: number; z: number; i: number }[];
  sun: THREE.DirectionalLight;
  tick: (t: number) => void;
  dispose: () => void;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Coarse occupancy grid so scenery never lands on the road.
class Grid {
  cell = 4;
  map = new Map<string, number>();
  key(x: number, z: number) {
    return `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`;
  }
  mark(x: number, z: number, r: number, v: number) {
    const c = this.cell;
    for (let dx = -r; dx <= r; dx += c)
      for (let dz = -r; dz <= r; dz += c) {
        if (dx * dx + dz * dz > r * r) continue;
        const k = this.key(x + dx, z + dz);
        const cur = this.map.get(k);
        if (cur === undefined || v < cur) this.map.set(k, v);
      }
  }
  get(x: number, z: number) {
    return this.map.get(this.key(x, z));
  }
}

function instanced(geo: THREE.BufferGeometry, m: THREE.Material, items: THREE.Matrix4[], shadow = true): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(geo, m, Math.max(1, items.length));
  items.forEach((mx, i) => im.setMatrixAt(i, mx));
  im.count = items.length;
  im.castShadow = shadow;
  im.receiveShadow = false;
  im.instanceMatrix.needsUpdate = true;
  return im;
}

const m4 = (x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

export function buildWorld(def: TrackDef, path: TrackPath, opts: { shadows: boolean; rush: boolean }): World {
  const g = new THREE.Group();
  const th = def.theme;
  const w = def.width;
  const n = path.n;
  const rand = rng(def.id.length * 977 + n);
  const disposables: { dispose: () => void }[] = [];
  const ticks: ((t: number) => void)[] = [];

  // lights
  const hemi = new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.night ? 1.5 : 1.15);
  g.add(hemi);
  const sun = new THREE.DirectionalLight(th.sun, th.sunIntensity);
  sun.position.set(60, 120, 40);
  sun.castShadow = opts.shadows;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -70;
  sc.right = 70;
  sc.top = 70;
  sc.bottom = -70;
  sc.near = 10;
  sc.far = 300;
  sun.shadow.bias = -0.0005;
  g.add(sun, sun.target);

  // ground
  const groundTex = th.night
    ? canvasTexture(256, 256, (c) => {
        c.fillStyle = "#3b2b2a";
        c.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 500; i++) {
          c.fillStyle = Math.random() < 0.5 ? "#33241f" : "#45332f";
          c.fillRect(Math.random() * 256, Math.random() * 256, 6, 6);
        }
      })
    : def.id === "kitchen"
      ? canvasTexture(256, 256, (c) => {
          for (let i = 0; i < 8; i++) {
            c.fillStyle = i % 2 ? "#c58a55" : "#b97d4a";
            c.fillRect(0, i * 32, 256, 32);
            c.fillStyle = "rgba(90,50,20,0.25)";
            c.fillRect(0, i * 32 + 30, 256, 2);
            c.fillRect(((i * 97) % 200) + 20, i * 32, 2, 32);
          }
        })
      : canvasTexture(256, 256, (c) => {
          c.fillStyle = "#6cbf5a";
          c.fillRect(0, 0, 256, 256);
          for (let i = 0; i < 700; i++) {
            c.fillStyle = Math.random() < 0.5 ? "#62b351" : "#78c965";
            c.fillRect(Math.random() * 256, Math.random() * 256, 4, 8);
          }
        });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(90, 90);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);
  disposables.push(groundTex);

  // road
  const roadTex = canvasTexture(128, 256, (c) => {
    c.fillStyle = "#" + th.road.toString(16).padStart(6, "0");
    c.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 260; i++) {
      c.fillStyle = `rgba(${th.night ? "255,255,255" : "0,0,0"},${Math.random() * 0.06})`;
      c.fillRect(Math.random() * 128, Math.random() * 256, 3, 3);
    }
    c.fillStyle = def.id === "kitchen" ? "rgba(58,141,222,0.55)" : "rgba(255,255,255,0.55)";
    c.fillRect(61, 0, 6, 128);
  });
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  disposables.push(roadTex);
  {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const j = i % n;
      const [rx, rz] = rightAt(path, j);
      const v = (i * (path.length / n)) / 12;
      pos.push(path.px[j] - rx * w, 0.03, path.pz[j] - rz * w, path.px[j] + rx * w, 0.03, path.pz[j] + rz * w);
      uv.push(0, v, 1, v);
      if (i < n) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.92 }));
    road.receiveShadow = true;
    g.add(road);
    disposables.push(geo);
  }

  // kerbs and walls, built as flat-coloured quads
  {
    const kPos: number[] = [];
    const kCol: number[] = [];
    const wPos: number[] = [];
    const wCol: number[] = [];
    const ca = new THREE.Color(th.kerbA);
    const cb = new THREE.Color(th.kerbB);
    const wa = new THREE.Color(th.wall);
    const wb = new THREE.Color(th.wall).multiplyScalar(0.78);
    const quad = (arr: number[], col: number[], c: THREE.Color, p: number[][]) => {
      for (const k of [0, 1, 2, 0, 2, 3]) {
        arr.push(...p[k]);
        col.push(c.r, c.g, c.b);
      }
    };
    const step = 2;
    for (let i = 0; i < n; i += step) {
      const j = wrap(i + step, n);
      const [ax, az] = rightAt(path, i);
      const [bx, bz] = rightAt(path, j);
      const kc = Math.floor(i / 4) % 2 ? ca : cb;
      const wc = Math.floor(i / 8) % 2 ? wa : wb;
      for (const s of [-1, 1]) {
        const o0 = s * w;
        const o1 = s * (w + 1.3);
        quad(kPos, kCol, kc, [
          [path.px[i] + ax * o0, 0.05, path.pz[i] + az * o0],
          [path.px[j] + bx * o0, 0.05, path.pz[j] + bz * o0],
          [path.px[j] + bx * o1, 0.05, path.pz[j] + bz * o1],
          [path.px[i] + ax * o1, 0.05, path.pz[i] + az * o1],
        ]);
        const o = s * (w + WALL_GAP + 0.3);
        quad(wPos, wCol, wc, [
          [path.px[i] + ax * o, 0, path.pz[i] + az * o],
          [path.px[j] + bx * o, 0, path.pz[j] + bz * o],
          [path.px[j] + bx * o, 1.15, path.pz[j] + bz * o],
          [path.px[i] + ax * o, 1.15, path.pz[i] + az * o],
        ]);
      }
    }
    const kg = new THREE.BufferGeometry();
    kg.setAttribute("position", new THREE.Float32BufferAttribute(kPos, 3));
    kg.setAttribute("color", new THREE.Float32BufferAttribute(kCol, 3));
    kg.computeVertexNormals();
    const kerbs = new THREE.Mesh(kg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
    kerbs.receiveShadow = true;
    g.add(kerbs);
    const wg = new THREE.BufferGeometry();
    wg.setAttribute("position", new THREE.Float32BufferAttribute(wPos, 3));
    wg.setAttribute("color", new THREE.Float32BufferAttribute(wCol, 3));
    wg.computeVertexNormals();
    const walls = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide, flatShading: true }));
    walls.castShadow = opts.shadows;
    walls.receiveShadow = true;
    g.add(walls);
    disposables.push(kg, wg);
  }

  // start line and gate
  {
    const tex = canvasTexture(128, 32, (c) => {
      for (let x = 0; x < 16; x++)
        for (let y = 0; y < 4; y++) {
          c.fillStyle = (x + y) % 2 ? "#ffffff" : "#1a1214";
          c.fillRect(x * 8, y * 8, 8, 8);
        }
    });
    disposables.push(tex);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, 2.4), new THREE.MeshStandardMaterial({ map: tex }));
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = Math.atan2(path.tx[0], path.tz[0]) + Math.PI;
    line.position.set(path.px[0], 0.06, path.pz[0]);
    line.receiveShadow = true;
    g.add(line);
    const gate = new THREE.Group();
    gate.position.set(path.px[0], 0, path.pz[0]);
    gate.rotation.y = Math.atan2(path.tx[0], path.tz[0]);
    const post = mat(0x2a1a1e);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), post);
      p.position.set(s * (w + 2.2), 4, 0);
      p.castShadow = true;
      gate.add(p);
    }
    const banner = canvasTexture(1024, 128, (c) => {
      c.fillStyle = "#ffc83d";
      c.fillRect(0, 0, 1024, 128);
      c.fillStyle = "#2a1a1e";
      c.font = "800 78px 'Bricolage Grotesque', system-ui, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("SQUEEK BURROW", 512, 68);
    });
    disposables.push(banner);
    const bm = new THREE.MeshStandardMaterial({ map: banner, side: THREE.DoubleSide, emissive: 0x332200, emissiveMap: banner });
    const bar = new THREE.Mesh(new THREE.BoxGeometry((w + 2.5) * 2, 1.8, 0.4), [post, post, post, post, bm, bm]);
    bar.position.set(0, 7.4, 0);
    bar.castShadow = true;
    gate.add(bar);
    g.add(gate);
  }

  // boost pads on the straightest stretches
  const pads: Pad[] = [];
  {
    const scores: { i: number; c: number }[] = [];
    for (let i = 0; i < n; i += 5) scores.push({ i, c: path.curve[i] + path.curve[wrap(i + 20, n)] });
    scores.sort((a, b) => a.c - b.c);
    for (const s of scores) {
      if (pads.length >= 3) break;
      if (s.i < 40 || s.i > n - 40) continue;
      if (pads.some((p) => Math.abs(wrap(p.i - s.i + n / 2, n) - n / 2) < n / 5)) continue;
      pads.push({ i: s.i, len: 9, lateral: (pads.length - 1) * w * 0.35, half: 2.3 });
    }
    const tex = canvasTexture(64, 128, (c) => {
      c.fillStyle = "#ff7a1a";
      c.fillRect(0, 0, 64, 128);
      c.fillStyle = "#ffe14a";
      for (let k = 0; k < 3; k++) {
        const y = 100 - k * 40;
        c.beginPath();
        c.moveTo(8, y);
        c.lineTo(32, y - 26);
        c.lineTo(56, y);
        c.lineTo(56, y + 12);
        c.lineTo(32, y - 14);
        c.lineTo(8, y + 12);
        c.fill();
      }
    });
    disposables.push(tex);
    const pm = new THREE.MeshBasicMaterial({ map: tex });
    for (const p of pads) {
      const mid = wrap(p.i + Math.floor(p.len / 2), n);
      const [rx, rz] = rightAt(path, mid);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.half * 2, p.len), pm);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.atan2(path.tx[mid], path.tz[mid]) + Math.PI;
      m.position.set(path.px[mid] + rx * p.lateral, 0.07, path.pz[mid] + rz * p.lateral);
      g.add(m);
    }
  }

  // seed spots on the road
  const seedSpots: { x: number; z: number; i: number }[] = [];
  {
    const every = opts.rush ? 16 : 55;
    for (let i = 30; i < n - 10; i += every) {
      if (pads.some((p) => wrap(i - p.i, n) < p.len + 6)) continue;
      const rows = opts.rush ? 1 : 3;
      for (let r = 0; r < rows; r++) {
        const lat = opts.rush ? (rand() * 2 - 1) * w * 0.75 : (r - 1) * w * 0.45;
        const j = wrap(i + (opts.rush ? 0 : r * 2), n);
        const [rx, rz] = rightAt(path, j);
        seedSpots.push({ x: path.px[j] + rx * lat, z: path.pz[j] + rz * lat, i: j });
      }
    }
  }

  // scenery placement grid: value is distance to road
  const grid = new Grid();
  for (let i = 0; i < n; i += 3) grid.mark(path.px[i], path.pz[i], w + WALL_GAP + 5, 0);
  for (let i = 0; i < n; i += 6) grid.mark(path.px[i], path.pz[i], 90, 1);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, path.px[i]);
    maxX = Math.max(maxX, path.px[i]);
    minZ = Math.min(minZ, path.pz[i]);
    maxZ = Math.max(maxZ, path.pz[i]);
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const spots = (count: number, near = false): [number, number][] => {
    const out: [number, number][] = [];
    let tries = 0;
    while (out.length < count && tries < count * 40) {
      tries++;
      const x = minX - 60 + rand() * (maxX - minX + 120);
      const z = minZ - 60 + rand() * (maxZ - minZ + 120);
      const v = grid.get(x, z);
      if (v !== 1) continue;
      if (near) {
        // keep within ~20 m of the wall
        let close = false;
        for (let i = 0; i < n; i += 8) {
          const d = Math.hypot(x - path.px[i], z - path.pz[i]);
          if (d < w + WALL_GAP + 22) {
            close = true;
            break;
          }
        }
        if (!close) continue;
      }
      out.push([x, z]);
    }
    return out;
  };
  const ring = (count: number, radius: number): [number, number][] =>
    Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + rand() * 0.1;
      return [cx + Math.cos(a) * radius * (0.9 + rand() * 0.2), cz + Math.sin(a) * radius * (0.9 + rand() * 0.2)];
    });
  const sh = opts.shadows;

  if (def.id === "meadow") {
    const trees = spots(110);
    const trunk = trees.map(([x, z]) => m4(x, 1.6, z, 0, 1, 1 + rand() * 0.4, 1));
    g.add(instanced(new THREE.CylinderGeometry(0.45, 0.6, 3.2, 6), mat(0x7a4e2d), trunk, sh));
    const crowns = [0x4f9e45, 0x5bb04f, 0x3f8a3c];
    crowns.forEach((col, ci) => {
      const items = trees.filter((_, i) => i % 3 === ci).map(([x, z]) => m4(x, 5.2 + rand(), z, rand() * 6, 2.4 + rand() * 1.4));
      g.add(instanced(new THREE.IcosahedronGeometry(1.4, 0), mat(col), items, sh));
    });
    const flowers = spots(90, true);
    g.add(instanced(new THREE.CylinderGeometry(0.12, 0.15, 3.6, 5), mat(0x4f9e45), flowers.map(([x, z]) => m4(x, 1.8, z)), sh));
    const heads = flowers.map(([x, z]) => {
      const mx = new THREE.Matrix4().compose(new THREE.Vector3(x, 3.7, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.4, rand() * 6, 0)), new THREE.Vector3(1, 1, 1));
      return mx;
    });
    g.add(instanced(new THREE.CylinderGeometry(1.1, 1.1, 0.18, 10), mat(0xffc83d), heads, sh));
    g.add(instanced(new THREE.CylinderGeometry(0.55, 0.55, 0.22, 8), mat(0x6b3f1e), heads, false));
    const big = spots(14, true).map(([x, z]) => m4(x, 0.9, z, rand() * 6, 2.2, 1.6, 3.6));
    g.add(instanced(new THREE.SphereGeometry(1, 8, 6), mat(0x4a3a30), big, sh));
    const hills = ring(26, 520).map(([x, z]) => m4(x, 0, z, rand() * 6, 70 + rand() * 50, 35 + rand() * 40, 70 + rand() * 50));
    g.add(instanced(new THREE.IcosahedronGeometry(1, 0), mat(0x5aa64e), hills, false));
  } else if (def.id === "kitchen") {
    const cups = spots(14, true);
    const cupCols = [0xe2463f, 0x3a8dde, 0xffffff, 0xf2b630];
    cupCols.forEach((col, ci) => {
      const items = cups.filter((_, i) => i % 4 === ci);
      g.add(instanced(new THREE.CylinderGeometry(5, 4.2, 9, 14, 1, true), new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, flatShading: true }), items.map(([x, z]) => m4(x, 4.5, z, rand() * 6)), sh));
      g.add(instanced(new THREE.TorusGeometry(2.4, 0.6, 6, 12, Math.PI * 1.2), mat(col), items.map(([x, z]) => m4(x + 5, 4.5, z, 0)), sh));
    });
    const cheese = spots(16, true).map(([x, z]) => m4(x, 0, z, rand() * 6, 4 + rand() * 2));
    const wedge = new THREE.CylinderGeometry(1.6, 1.6, 1.8, 3, 1);
    wedge.translate(0, 0.9, 0);
    g.add(instanced(wedge, mat(0xffd34d), cheese, sh));
    const cookies = spots(22).map(([x, z]) => m4(x, 0.4, z, rand() * 6, 3 + rand() * 1.5, 1, 3 + rand() * 1.5));
    g.add(instanced(new THREE.CylinderGeometry(1, 1, 0.8, 12), mat(0xc98a4a), cookies, sh));
    const cubes = spots(40).map(([x, z]) => m4(x, 1.2, z, rand() * 6, 2.4));
    g.add(instanced(new THREE.BoxGeometry(1, 1, 1), mat(0xfaf6ee, { rough: 0.6 }), cubes, sh));
    const boxes = ring(22, 480).map(([x, z]) => m4(x, 60, z, rand() * 6, 60 + rand() * 30, 120 + rand() * 60, 25));
    const boxCols = [0xe2463f, 0x3a8dde, 0xf2b630, 0x5bbf6a];
    boxCols.forEach((col, ci) => g.add(instanced(new THREE.BoxGeometry(1, 1, 1), mat(col), boxes.filter((_, i) => i % 4 === ci), false)));
  } else {
    const shrooms = spots(110, true);
    const capCols = [0x2ee6c8, 0x8a6bff, 0xff7ad9];
    g.add(instanced(new THREE.CylinderGeometry(0.35, 0.5, 2.4, 6), mat(0xe9dccb, { emissive: 0x2a2030 }), shrooms.map(([x, z]) => m4(x, 1.2, z)), false));
    capCols.forEach((col, ci) => {
      const items = shrooms.filter((_, i) => i % 3 === ci).map(([x, z]) => m4(x, 2.4, z, rand() * 6, 1.6 + rand(), 0.9, 1.6 + rand()));
      g.add(instanced(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(col, { emissive: col }), items, false));
    });
    const crystals = spots(40).map(([x, z]) => m4(x, 2, z, rand() * 6, 1.2, 3 + rand() * 2, 1.2));
    g.add(instanced(new THREE.OctahedronGeometry(1, 0), mat(0x8fdcff, { emissive: 0x3a62c8, rough: 0.2 }), crystals, false));
    const rocks = spots(90).map(([x, z]) => m4(x, 0.6, z, rand() * 6, 1.5 + rand() * 2.5));
    g.add(instanced(new THREE.DodecahedronGeometry(1, 0), mat(0x5b4348), rocks, sh));
    const spikes = ring(40, 440).map(([x, z]) => m4(x, 40, z, rand() * 6, 30 + rand() * 25, 80 + rand() * 60, 30 + rand() * 25));
    g.add(instanced(new THREE.ConeGeometry(1, 1, 6), mat(0x2f2230), spikes, false));
    // tunnels: arches over two stretches
    const arches: THREE.Matrix4[] = [];
    for (const start of [Math.floor(n * 0.22), Math.floor(n * 0.62)]) {
      for (let k = 0; k < 120; k += 8) {
        const i = wrap(start + k, n);
        const ry = Math.atan2(path.tx[i], path.tz[i]) + Math.PI / 2;
        arches.push(m4(path.px[i], 0, path.pz[i], ry, 1));
      }
    }
    const archGeo = new THREE.TorusGeometry(w + WALL_GAP + 0.6, 0.9, 5, 14, Math.PI);
    g.add(instanced(archGeo, mat(0x6b4f4a), arches, sh));
    // lanterns
    for (let k = 0; k < 6; k++) {
      const i = wrap(Math.floor((k / 6) * n) + 20, n);
      const [rx, rz] = rightAt(path, i);
      const s = k % 2 ? 1 : -1;
      const x = path.px[i] + rx * s * (w + WALL_GAP + 1.5);
      const z = path.pz[i] + rz * s * (w + WALL_GAP + 1.5);
      const l = new THREE.PointLight(0xffb85a, 60, 40, 1.6);
      l.position.set(x, 4, z);
      g.add(l);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd08a }));
      bulb.position.set(x, 4, z);
      g.add(bulb);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 5), mat(0x2a1a1e));
      pole.position.set(x, 2, z);
      g.add(pole);
    }
    // stars
    const sp: number[] = [];
    for (let i = 0; i < 700; i++) {
      const a = rand() * Math.PI * 2;
      const e = 0.15 + rand() * 1.3;
      sp.push(cx + Math.cos(a) * Math.cos(e) * 700, Math.sin(e) * 700, cz + Math.sin(a) * Math.cos(e) * 700);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false })));
    disposables.push(sg);
  }

  // drifting clouds on day tracks
  if (!th.night) {
    const clouds = new THREE.Group();
    const cm = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xc8d8e0, flatShading: true, fog: false });
    for (let k = 0; k < 14; k++) {
      const c = new THREE.Group();
      for (let p = 0; p < 4; p++) {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(8 + rand() * 6, 1), cm);
        s.scale.y = 0.6;
        s.position.set(p * 10 - 15, rand() * 3, rand() * 6);
        c.add(s);
      }
      const a = rand() * Math.PI * 2;
      c.position.set(cx + Math.cos(a) * (200 + rand() * 250), 110 + rand() * 50, cz + Math.sin(a) * (200 + rand() * 250));
      clouds.add(c);
    }
    g.add(clouds);
    ticks.push((t) => {
      clouds.rotation.y = t * 0.004;
    });
  }

  // remember the seed template for the race to clone
  void buildSeed;

  return {
    group: g,
    pads,
    seedSpots,
    sun,
    tick: (t) => ticks.forEach((f) => f(t)),
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    },
  };
}
