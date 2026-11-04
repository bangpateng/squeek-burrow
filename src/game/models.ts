// Low-poly models built from primitives. No external model files.
import * as THREE from "three";
import type { Character } from "./data";

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

// A chubby hamster facing +z, sitting with its base at y = 0.
export function buildHamster(c: Pick<Character, "fur" | "belly" | "kart">): THREE.Group {
  const g = new THREE.Group();
  const fur = mat(c.fur);
  const belly = mat(c.belly);
  const pink = mat(0xf59ab0);
  const black = mat(0x1a1214, { rough: 0.3 });

  const body = mesh(sphere(0.55), fur, 0, 0.5, 0);
  body.scale.set(1, 0.92, 1.05);
  g.add(body);
  const tummy = mesh(sphere(0.4), belly, 0, 0.45, 0.22);
  tummy.scale.set(1, 1, 0.8);
  g.add(tummy);
  const head = mesh(sphere(0.43), fur, 0, 1.02, 0.12);
  g.add(head);
  const face = mesh(sphere(0.3), belly, 0, 0.94, 0.33);
  face.scale.set(1.1, 0.8, 0.7);
  g.add(face);
  for (const s of [-1, 1]) {
    const cheek = mesh(sphere(0.2, 8, 6), fur, s * 0.3, 0.92, 0.24);
    g.add(cheek);
    const ear = mesh(sphere(0.15, 8, 6), fur, s * 0.27, 1.38, 0.02);
    ear.scale.set(1, 1, 0.45);
    g.add(ear);
    const inner = mesh(sphere(0.09, 8, 6), pink, s * 0.27, 1.38, 0.07, false);
    inner.scale.set(1, 1, 0.4);
    g.add(inner);
    const eye = mesh(sphere(0.065, 8, 6), black, s * 0.16, 1.1, 0.48, false);
    g.add(eye);
    const shine = mesh(sphere(0.022, 6, 4), mat(0xffffff), s * 0.16 + 0.02, 1.13, 0.535, false);
    g.add(shine);
    const paw = mesh(sphere(0.1, 8, 6), pink, s * 0.2, 0.78, 0.55);
    g.add(paw);
  }
  const nose = mesh(sphere(0.05, 6, 4), pink, 0, 0.98, 0.57, false);
  g.add(nose);
  // racing scarf in the kart colour
  const scarf = mesh(new THREE.TorusGeometry(0.36, 0.08, 6, 14), mat(c.kart), 0, 0.78, 0.08);
  scarf.rotation.x = Math.PI / 2;
  g.add(scarf);
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

export function buildKart(c: Pick<Character, "fur" | "belly" | "kart">, scale = 1): KartModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = mat(c.kart, { rough: 0.45, metal: 0.1 });
  const dark = mat(0x2a1a1e);
  const metal = mat(0xb9b6c2, { rough: 0.35, metal: 0.6 });

  const chassis = mesh(new THREE.BoxGeometry(1.5, 0.32, 2.5), paint, 0, 0.42, 0);
  body.add(chassis);
  const nose = mesh(new THREE.BoxGeometry(1.1, 0.26, 0.7), paint, 0, 0.45, 1.45);
  body.add(nose);
  const bumper = mesh(new THREE.BoxGeometry(1.7, 0.16, 0.22), dark, 0, 0.32, 1.85);
  body.add(bumper);
  const sideL = mesh(new THREE.BoxGeometry(0.3, 0.3, 1.6), paint, -0.9, 0.4, -0.1);
  const sideR = sideL.clone();
  sideR.position.x = 0.9;
  body.add(sideL, sideR);
  const seat = mesh(new THREE.BoxGeometry(0.95, 0.75, 0.25), dark, 0, 0.85, -0.85);
  body.add(seat);
  const wheelRing = mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 12), dark, 0, 1.0, 0.6);
  wheelRing.rotation.x = -0.9;
  body.add(wheelRing);
  const column = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), dark, 0, 0.8, 0.75);
  column.rotation.x = 0.7;
  body.add(column);
  // spoiler
  const wing = mesh(new THREE.BoxGeometry(1.6, 0.08, 0.45), paint, 0, 1.12, -1.3);
  body.add(wing);
  for (const s of [-1, 1]) {
    body.add(mesh(new THREE.BoxGeometry(0.08, 0.5, 0.2), dark, s * 0.55, 0.85, -1.3));
    const pipe = mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.5, 8), metal, s * 0.35, 0.45, -1.45);
    pipe.rotation.x = Math.PI / 2;
    body.add(pipe);
  }
  // flames shown while boosting
  const flames: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 7), new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.9 }));
    f.rotation.x = -Math.PI / 2;
    f.position.set(s * 0.35, 0.45, -2.05);
    f.visible = false;
    body.add(f);
    flames.push(f);
  }

  const driver = buildHamster(c);
  driver.position.set(0, 0.42, -0.35);
  driver.scale.setScalar(0.95);
  body.add(driver);

  const wheels: THREE.Mesh[] = [];
  const front: THREE.Group[] = [];
  const tyre = mat(0x222026, { rough: 0.9 });
  const hub = mat(0xf2f0e8, { rough: 0.5 });
  for (const [x, z, f] of [[-0.95, 0.95, true], [0.95, 0.95, true], [-0.95, -0.9, false], [0.95, -0.9, false]] as [number, number, boolean][]) {
    const holder = new THREE.Group();
    holder.position.set(x, 0.38, z);
    const r = f ? 0.36 : 0.42;
    const w = mesh(new THREE.CylinderGeometry(r, r, f ? 0.32 : 0.4, 12), tyre);
    w.rotation.z = Math.PI / 2;
    const h = mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, (f ? 0.32 : 0.4) + 0.02, 8), hub, 0, 0, 0, false);
    w.add(h);
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
