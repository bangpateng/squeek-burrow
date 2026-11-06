// Low-poly models built from primitives. No external model files.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Look } from "./data";
import { buildDotFigure, dotsFor } from "./dotFigure";

const mats = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: number, opts: { emissive?: number; rough?: number; metal?: number } = {}): THREE.MeshStandardMaterial {
  const key = `${color}-${opts.emissive ?? 0}-${opts.rough ?? 0.8}-${opts.metal ?? 0}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: opts.rough ?? 0.8,
      metalness: opts.metal ?? 0,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissive ? 1 : 0,
    });
    mats.set(key, m);
  }
  return m;
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = shadow;
  return o;
}

const sphere = (r: number, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);

// Smooth, glossy material for characters and karts (the scenery keeps the flat low-poly look).
const smooth = new Map<string, THREE.MeshStandardMaterial>();
export function soft(color: number, opts: { rough?: number; metal?: number; emissive?: number; opacity?: number } = {}): THREE.MeshStandardMaterial {
  const key = `${color}-${opts.rough ?? 0.6}-${opts.metal ?? 0}-${opts.emissive ?? 0}-${opts.opacity ?? 1}`;
  let m = smooth.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.6,
      metalness: opts.metal ?? 0,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissive ? 1 : 0,
      transparent: (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? 1,
    });
    smooth.set(key, m);
  }
  return m;
}

const ball = (r: number) => new THREE.SphereGeometry(r, 24, 18);

// ---------- Genesis Squeek look: glowing dots on dark fur, like the on-chain dot-grid art ----------

const hexCss = (n: number) => "#" + n.toString(16).padStart(6, "0");
const mix = (a: number, b: number, t: number) => {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

function glyphPath(c: CanvasRenderingContext2D, glyph: string, x: number, y: number, r: number) {
  const g = glyph.toLowerCase();
  c.beginPath();
  if (g.includes("triangle")) {
    c.moveTo(x, y - r);
    c.lineTo(x + r * 0.95, y + r * 0.75);
    c.lineTo(x - r * 0.95, y + r * 0.75);
  } else if (g.includes("square") || g.includes("capsule")) {
    const k = r * 0.85;
    if (c.roundRect) c.roundRect(x - k, y - k, k * 2, k * 2, g.includes("rounded") || g.includes("capsule") ? k * 0.45 : 0);
    else c.rect(x - k, y - k, k * 2, k * 2);
  } else if (g.includes("sparkle") || g.includes("star") || g.includes("diamond") || g.includes("bolt") || g.includes("lightning")) {
    const k = r * 0.32;
    c.moveTo(x, y - r);
    c.lineTo(x + k, y - k);
    c.lineTo(x + r, y);
    c.lineTo(x + k, y + k);
    c.lineTo(x, y + r);
    c.lineTo(x - k, y + k);
    c.lineTo(x - r, y);
    c.lineTo(x - k, y - k);
  } else {
    c.arc(x, y, r, 0, Math.PI * 2);
  }
  c.closePath();
  c.fill();
}

const dotMats = new Map<string, THREE.MeshStandardMaterial>();
// A sphere-wrapped dot grid in the NFT's palette. Light = the paler muzzle and belly version.
function dotMaterial(palette: number[], glyph: string, seed: number, light: boolean): THREE.MeshStandardMaterial {
  const key = `${palette.join(",")}-${glyph}-${seed}-${light}`;
  let m = dotMats.get(key);
  if (m) return m;
  let s = (seed * 2654435761) >>> 0 || 7;
  const rnd = () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
  const tex = canvasTexture(512, 256, (c) => {
    c.fillStyle = light ? "#2a2633" : "#15131c";
    c.fillRect(0, 0, 512, 256);
    const step = light ? 11 : 13;
    for (let y = step / 2; y < 256; y += step) {
      for (let x = step / 2; x < 512; x += step) {
        const n = rnd();
        if (n < (light ? 0.12 : 0.22)) continue;
        const col = palette[Math.floor(rnd() * palette.length)];
        c.fillStyle = hexCss(light ? mix(col, 0xffffff, 0.45) : col);
        glyphPath(c, glyph, x, y, (light ? 1.6 : 1.4) + n * (step * 0.36));
      }
    }
  });
  m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.75 });
  dotMats.set(key, m);
  return m;
}

// The NFT's own art as a texture, drawn once per token.
const artTex = new Map<string, THREE.CanvasTexture>();
export function nftTexture(image: string, key: string): THREE.CanvasTexture {
  let t = artTex.get(key);
  if (t) return t;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#08070c";
  ctx.fillRect(0, 0, 256, 256);
  t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, 256, 256);
    t!.needsUpdate = true;
  };
  img.src = image;
  artTex.set(key, t);
  return t;
}

// A round, fluffy hamster facing +z, sitting with its base at y = 0.
// Genesis Squeeks (with a palette) get the dark fur with glowing glyph dots from their NFT art.
export function buildHamster(c: Look, lite = false): THREE.Group {
  // a Genesis Squeek with readable art: rebuild the NFT itself in 3D
  const dots = dotsFor(c.image, String(c.tokenId ?? c.image?.length ?? 0));
  if (dots) {
    const fig = buildDotFigure(dots, 1.9, lite);
    fig.userData.nftFigure = true;
    return fig;
  }
  const g = new THREE.Group();
  const nft = !!c.palette?.length;
  const seed = c.tokenId ?? 1;
  const fur = nft ? dotMaterial(c.palette!, c.glyph ?? "Circle", seed, false) : soft(c.fur, { rough: 0.85 });
  const cream = nft ? dotMaterial(c.palette!, c.glyph ?? "Circle", seed + 1, true) : soft(c.belly, { rough: 0.9 });
  const pink = nft ? soft(mix(c.palette![0], 0xffffff, 0.35), { rough: 0.5, emissive: mix(c.palette![0], 0x000000, 0.35) }) : soft(0xf7a3b5, { rough: 0.5 });
  const eyeMat = nft ? soft(0xf5f2ea, { rough: 0.3, emissive: 0xd8d4cc }) : soft(0x120c0e, { rough: 0.15, metal: 0.2 });
  const white = soft(0xffffff, { rough: 0.2 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, shadow = true) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = shadow;
    g.add(o);
    return o;
  };

  // one soft pear-shaped body: hamsters barely have a neck
  add(ball(0.6), fur, 0, 0.62, -0.02, 1, 1.05, 1.02);
  add(ball(0.5), fur, 0, 1.12, 0.08, 1.02, 0.92, 0.95);
  add(ball(0.46), cream, 0, 0.55, 0.24, 0.98, 1.05, 0.72);
  // face: cream muzzle and puffed cheek pouches
  add(ball(0.3), cream, 0, 1.0, 0.36, 1.25, 0.82, 0.8);
  for (const s of [-1, 1]) {
    add(ball(0.24), fur, s * 0.34, 1.0, 0.24, 1, 0.95, 1);
    add(ball(0.2), cream, s * 0.3, 0.94, 0.33, 1, 0.9, 0.8, false);
    // ears
    add(ball(0.17), fur, s * 0.3, 1.5, -0.02, 1, 1.05, 0.5);
    add(ball(0.11), pink, s * 0.3, 1.5, 0.03, 1, 1, 0.35, false);
    // big glossy eyes with two highlights
    add(ball(0.085), eyeMat, s * 0.17, 1.16, 0.47, 1, 1.15, 0.8, false);
    add(ball(0.03), white, s * 0.17 + 0.03, 1.2, 0.53, 1, 1, 1, false);
    add(ball(0.014), white, s * 0.17 - 0.02, 1.13, 0.535, 1, 1, 1, false);
    // blush
    add(new THREE.CircleGeometry(0.07, 16), soft(0xff8fa8, { opacity: 0.55, rough: 1 }), s * 0.27, 1.04, 0.48, 1, 0.7, 1, false).rotation.y = s * 0.45;
    // whiskers
    for (const k of [-1, 0, 1]) {
      const wsk = add(new THREE.CylinderGeometry(0.006, 0.006, 0.32, 4), soft(0x3a2a24), s * 0.32, 0.98 + k * 0.035, 0.42, 1, 1, 1, false);
      wsk.rotation.z = Math.PI / 2 + k * 0.15 * s;
      wsk.rotation.y = s * -0.35;
    }
    // front paws on the wheel and little feet
    add(ball(0.09), pink, s * 0.2, 0.86, 0.6, 1.1, 0.9, 1);
    add(ball(0.11), pink, s * 0.24, 0.12, 0.42, 1.2, 0.6, 1.4);
  }
  add(ball(0.055), pink, 0, 1.05, 0.6, 1.2, 0.9, 1, false);
  // buck teeth
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.035, 0.06, 0.02), white, s * 0.02, 0.9, 0.58, 1, 1, 1, false);
  // racing goggles pushed up on the forehead in the kart colour
  const band = add(new THREE.TorusGeometry(0.47, 0.035, 8, 32), soft(c.kart, { rough: 0.4 }), 0, 1.3, 0.04, 1, 1, 1, false);
  band.rotation.x = Math.PI / 2 - 0.25;
  for (const s of [-1, 1]) {
    const rim = add(new THREE.TorusGeometry(0.085, 0.025, 8, 20), soft(0x2a2a30, { metal: 0.6, rough: 0.3 }), s * 0.14, 1.4, 0.47, 1, 1, 1, false);
    rim.rotation.x = -0.55;
    const lens = add(new THREE.CircleGeometry(0.08, 20), soft(0x8fdcff, { metal: 0.4, rough: 0.05, emissive: 0x1a3a50 }), s * 0.14, 1.4, 0.48, 1, 1, 1, false);
    lens.rotation.x = -0.55;
  }
  // tail
  add(ball(0.08), fur, 0, 0.3, -0.6);
  return g;
}

export interface KartModel {
  root: THREE.Group; // positioned on the track
  body: THREE.Group; // tilts and hops
  wheels: THREE.Mesh[]; // spin
  front: THREE.Group[]; // steer
  flames: THREE.Mesh[];
  driver: THREE.Group;
}

export function buildKart(c: Look, scale = 1, lite = false): KartModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = soft(c.kart, { rough: 0.3, metal: 0.25 });
  const trim = soft(0x1c1418, { rough: 0.5 });
  const chrome = soft(0xd8d6e0, { rough: 0.15, metal: 0.95 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = body) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    parent.add(o);
    return o;
  };

  add(new RoundedBoxGeometry(1.5, 0.34, 2.6, 4, 0.14), paint, 0, 0.44, -0.05);
  // tapered nose with a front wing
  const nose = add(new RoundedBoxGeometry(0.9, 0.28, 0.95, 4, 0.12), paint, 0, 0.46, 1.5);
  nose.rotation.x = 0.08;
  add(new RoundedBoxGeometry(1.9, 0.08, 0.38, 2, 0.03), trim, 0, 0.3, 1.95);
  for (const s of [-1, 1]) add(new RoundedBoxGeometry(0.08, 0.26, 0.42, 2, 0.03), paint, s * 0.95, 0.38, 1.95);
  // side pods with a white racing stripe
  for (const s of [-1, 1]) {
    add(new RoundedBoxGeometry(0.38, 0.32, 1.5, 4, 0.12), paint, s * 0.88, 0.42, -0.15);
    add(new THREE.BoxGeometry(0.02, 0.07, 1.3), soft(0xffffff, { rough: 0.4 }), s * 1.075, 0.47, -0.15);
    // headlights
    add(new THREE.CircleGeometry(0.08, 16), soft(0xfff6d0, { emissive: 0xfff2b0 }), s * 0.32, 0.5, 1.98).rotation.y = 0;
  }
  // seat and steering wheel
  add(new RoundedBoxGeometry(0.95, 0.8, 0.28, 4, 0.1), trim, 0, 0.86, -0.88);
  const ring = add(new THREE.TorusGeometry(0.22, 0.045, 10, 24), trim, 0, 1.02, 0.62);
  ring.rotation.x = -0.9;
  const column = add(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), chrome, 0, 0.82, 0.76);
  column.rotation.x = 0.7;
  // rear wing on two struts
  add(new RoundedBoxGeometry(1.7, 0.08, 0.5, 2, 0.03), paint, 0, 1.15, -1.32);
  for (const s of [-1, 1]) {
    add(new RoundedBoxGeometry(0.06, 0.5, 0.42, 2, 0.02), trim, s * 0.86, 1.05, -1.32);
    add(new THREE.BoxGeometry(0.07, 0.42, 0.12), trim, s * 0.5, 0.88, -1.32);
    const pipe = add(new THREE.CylinderGeometry(0.08, 0.1, 0.55, 12), chrome, s * 0.36, 0.45, -1.48);
    pipe.rotation.x = Math.PI / 2;
  }
  // number roundel on the nose
  const art = c.image ? new THREE.MeshBasicMaterial({ map: nftTexture(c.image, String(c.tokenId ?? c.image.length)) }) : null;
  const num = add(new THREE.CircleGeometry(art ? 0.24 : 0.16, 24), art ?? soft(0xffffff, { rough: 0.4 }), 0, 0.61, 1.45);
  num.rotation.x = -Math.PI / 2 + 0.08;
  if (art) {
    // the NFT art on the back of the seat, where the chase camera sees it
    const plate = add(new THREE.PlaneGeometry(0.7, 0.7), art, 0, 0.88, -1.025);
    plate.rotation.y = Math.PI;
    plate.castShadow = false;
    const frame = add(new THREE.PlaneGeometry(0.78, 0.78), soft(c.kart, { rough: 0.4 }), 0, 0.88, -1.022);
    frame.rotation.y = Math.PI;
    frame.castShadow = false;
  }

  const flames: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.9, 10), new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.9 }));
    f.rotation.x = -Math.PI / 2;
    f.position.set(s * 0.36, 0.45, -2.1);
    f.visible = false;
    body.add(f);
    flames.push(f);
  }

  const driver = buildHamster(c, lite);
  driver.position.set(0, driver.userData.nftFigure ? 0.1 : 0.42, -0.4);
  driver.scale.setScalar(0.92);
  body.add(driver);

  const wheels: THREE.Mesh[] = [];
  const front: THREE.Group[] = [];
  const tyre = soft(0x26222a, { rough: 0.95 });
  const rimMat = soft(c.kart, { rough: 0.25, metal: 0.4 });
  for (const [x, z, f] of [[-0.98, 0.98, true], [0.98, 0.98, true], [-0.98, -0.92, false], [0.98, -0.92, false]] as [number, number, boolean][]) {
    const holder = new THREE.Group();
    holder.position.set(x, 0.38, z);
    const r = f ? 0.36 : 0.42;
    const wdt = f ? 0.32 : 0.42;
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, wdt, 24), tyre);
    w.rotation.z = Math.PI / 2;
    w.castShadow = true;
    for (const side of [-1, 1]) {
      const tread = new THREE.Mesh(new THREE.TorusGeometry(r - 0.02, 0.05, 6, 24), tyre);
      tread.rotation.x = Math.PI / 2;
      tread.position.y = side * (wdt / 2 - 0.04);
      w.add(tread);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, wdt + 0.02, 12), rimMat);
    w.add(hub);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, wdt + 0.05, 10), chrome);
    w.add(cap);
    w.position.y = r - 0.38;
    holder.add(w);
    root.add(holder);
    wheels.push(w);
    if (f) front.push(holder);
  }
  root.scale.setScalar(scale);
  return { root, body, wheels, front, flames, driver };
}

// Golden sunflower seed pickup.
export function buildSeed(): THREE.Group {
  const g = new THREE.Group();
  const s = new THREE.Mesh(sphere(0.5, 8, 6), mat(0xffc83d, { emissive: 0x8a5a00, rough: 0.35, metal: 0.3 }));
  s.scale.set(0.62, 0.42, 1);
  s.castShadow = true;
  g.add(s);
  const stripe = new THREE.Mesh(sphere(0.51, 8, 6), mat(0x6b4a12, { rough: 0.5 }));
  stripe.scale.set(0.2, 0.43, 0.98);
  g.add(stripe);
  return g;
}

export function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- items ----------
export function buildItemBox(): THREE.Group {
  const g = new THREE.Group();
  const tex = canvasTexture(128, 128, (c) => {
    const grd = c.createLinearGradient(0, 0, 128, 128);
    grd.addColorStop(0, "#ff7ad9");
    grd.addColorStop(0.5, "#ffc83d");
    grd.addColorStop(1, "#5ab8ff");
    c.fillStyle = grd;
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.fillRect(8, 8, 112, 112);
    c.fillStyle = "#2a1a1e";
    c.font = "900 92px system-ui, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("?", 64, 70);
  });
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.6, 1.6),
    new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35, transparent: true, opacity: 0.88, roughness: 0.3 }),
  );
  box.castShadow = true;
  g.add(box);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.75, 1.75), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 }));
  g.add(frame);
  return g;
}

export function buildAcorn(): THREE.Group {
  const g = new THREE.Group();
  const nut = new THREE.Mesh(sphere(0.55, 10, 8), mat(0xb5793a, { rough: 0.4 }));
  nut.scale.set(1, 1.15, 1);
  nut.castShadow = true;
  g.add(nut);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x6b4423, { rough: 0.9 }));
  cap.position.y = 0.2;
  g.add(cap);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 5), mat(0x4a2e16));
  stem.position.y = 0.85;
  g.add(stem);
  return g;
}

export function buildCheese(): THREE.Group {
  const g = new THREE.Group();
  const w = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.8, 3), mat(0xffd34d, { emissive: 0x6a4a00 }));
  w.rotation.y = Math.PI / 6;
  w.castShadow = true;
  g.add(w);
  for (const [x, z] of [[0.2, 0.1], [-0.25, 0.25], [0.05, -0.3]]) {
    const hole = new THREE.Mesh(sphere(0.12, 6, 4), mat(0xd9a520));
    hole.position.set(x, 0.38, z);
    g.add(hole);
  }
  return g;
}

export function buildPepper(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 8), mat(0xe2231a, { rough: 0.3, emissive: 0x3a0000 }));
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.45;
  body.castShadow = true;
  g.add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.4, 6), mat(0x2f9e3a));
  stem.rotation.z = Math.PI / 2;
  stem.position.set(0.95, 0.45, 0);
  g.add(stem);
  return g;
}

export function buildBomb(): THREE.Group {
  const g = new THREE.Group();
  const b = new THREE.Mesh(sphere(0.75, 12, 10), mat(0x2a2430, { rough: 0.35, metal: 0.3 }));
  b.castShadow = true;
  g.add(b);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.08, 6, 16), mat(0xffc83d));
  band.rotation.x = Math.PI / 2;
  g.add(band);
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 5), mat(0xc8b48a));
  fuse.position.y = 0.95;
  g.add(fuse);
  const spark = new THREE.Mesh(sphere(0.14, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe14a }));
  spark.position.y = 1.25;
  spark.name = "spark";
  g.add(spark);
  return g;
}

export function buildBubble(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(2.3, 20, 14),
    new THREE.MeshStandardMaterial({ color: 0x8fe8ff, emissive: 0x2a8fd0, emissiveIntensity: 0.6, transparent: true, opacity: 0.28, depthWrite: false, roughness: 0.1 }),
  );
  m.position.y = 1;
  m.visible = false;
  return m;
}
