// A Genesis Squeek rebuilt in 3D from its own on-chain dot art: every dot of the NFT keeps its
// position, colour and glyph shape. Dots sit on a rounded front and back shell whose thickness
// comes from how far each dot is from the edge of the figure, so it looks like the NFT from the
// front and like a plump little figure from any other side.
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { parseSqueekDots, svgText, type SqueekDots } from "../web3/squeeks";

const parsed = new Map<string, SqueekDots | null>();
export function dotsFor(image: string | undefined, key: string): SqueekDots | null {
  if (!image) return null;
  if (!parsed.has(key)) {
    let d: SqueekDots | null = null;
    try {
      d = parseSqueekDots(svgText(image));
    } catch {
      d = null;
    }
    parsed.set(key, d);
  }
  return parsed.get(key) ?? null;
}

const glyphGeos = new Map<string, THREE.BufferGeometry>();
function glyphGeometry(d: string): THREE.BufferGeometry {
  let g = glyphGeos.get(d);
  if (g) return g;
  try {
    const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
    const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
    g = shapes.length ? new THREE.ShapeGeometry(shapes, 3) : new THREE.CircleGeometry(2.5, 10);
  } catch {
    g = new THREE.CircleGeometry(2.5, 10);
  }
  g.scale(1, -1, 1); // SVG y points down
  glyphGeos.set(d, g);
  return g;
}

const dotMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const coreMat = new THREE.MeshStandardMaterial({ color: 0x0c0b12, roughness: 0.85, side: THREE.DoubleSide });

// lite: for rivals, half the dots on the back and no rim, which they rarely show up close
export function buildDotFigure(f: SqueekDots, height: number, lite = false): THREE.Group {
  const group = new THREE.Group();
  const maxY = Math.max(...f.dots.map((d) => d.y));
  const S = height / maxY; // art units -> world
  const step = f.step;

  // occupancy grid of the figure, with enclosed holes filled so the body is solid
  // quantise on the art's own grid origin, so dots never land half a cell off (that split the figure in two)
  const x0 = Math.min(...f.dots.map((d) => d.x));
  const y0 = Math.min(...f.dots.map((d) => d.y));
  const col = (x: number) => Math.round((x - x0) / step);
  const row = (y: number) => Math.round((y - y0) / step);
  const occ = new Set<string>();
  let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
  for (const d of f.dots) {
    const c = col(d.x), r = row(d.y);
    occ.add(`${c},${r}`);
    c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r);
  }
  c0 -= 1; c1 += 1; r0 -= 1; r1 += 1;
  const outside = new Set<string>();
  const queue: [number, number][] = [[c0, r0]];
  outside.add(`${c0},${r0}`);
  while (queue.length) {
    const [c, r] = queue.pop()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr, k = `${nc},${nr}`;
      if (nc < c0 || nc > c1 || nr < r0 || nr > r1 || outside.has(k) || occ.has(k)) continue;
      outside.add(k);
      queue.push([nc, nr]);
    }
  }
  const solid = (c: number, r: number) => c >= c0 && c <= c1 && r >= r0 && r <= r1 && !outside.has(`${c},${r}`);

  // distance (in cells) from each solid cell to the outside
  const dist = new Map<string, number>();
  let frontier: [number, number][] = [];
  for (let c = c0; c <= c1; c++)
    for (let r = r0; r <= r1; r++) {
      if (!solid(c, r)) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => !solid(c + dc, r + dr));
      if (edge) {
        dist.set(`${c},${r}`, 1);
        frontier.push([c, r]);
      }
    }
  while (frontier.length) {
    const next: [number, number][] = [];
    for (const [c, r] of frontier) {
      const dv = dist.get(`${c},${r}`)!;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${c + dc},${r + dr}`;
        if (!solid(c + dc, r + dr) || dist.has(k)) continue;
        dist.set(k, dv + 1);
        next.push([c + dc, r + dr]);
      }
    }
    frontier = next;
  }
  const width = (c1 - c0) * step * S;
  const cap = 12;
  const D = width * 0.3; // half thickness at the deepest point
  const depthAt = (c: number, r: number) => {
    const dv = dist.get(`${c},${r}`);
    if (!dv) return 0;
    const t = Math.min(dv, cap) / cap;
    return D * Math.sqrt(t * (2 - t)); // round profile
  };

  // dark solid core so the gaps between dots read as dark fur, not see-through
  const verts: number[] = [];
  const idx: number[] = [];
  const vid = new Map<string, number>();
  const vtx = (c: number, r: number, side: number) => {
    const k = `${c},${r},${side}`;
    let i = vid.get(k);
    if (i === undefined) {
      i = verts.length / 3;
      verts.push((x0 + c * step) * S, (y0 + r * step) * S, side * Math.max(0.004, depthAt(c, r) * 0.93));
      vid.set(k, i);
    }
    return i;
  };
  for (let c = c0; c < c1; c++)
    for (let r = r0; r < r1; r++) {
      if (!(solid(c, r) && solid(c + 1, r) && solid(c, r + 1) && solid(c + 1, r + 1))) continue;
      for (const side of [1, -1]) {
        const a = vtx(c, r, side), b = vtx(c + 1, r, side), d = vtx(c, r + 1, side), e = vtx(c + 1, r + 1, side);
        idx.push(a, b, e, a, e, d);
      }
    }
  const core = new THREE.BufferGeometry();
  core.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  core.setIndex(idx);
  core.computeVertexNormals();
  const coreMesh = new THREE.Mesh(core, coreMat);
  coreMesh.castShadow = true;
  group.add(coreMesh);

  // the dots: front shell, back shell (no white eye glyphs), and a rim around the edge
  type Inst = { m: THREE.Matrix4; color: THREE.Color };
  const byGlyph = new Map<string, Inst[]>();
  const push = (g: string, pos: THREE.Vector3, normal: THREE.Vector3, size: number, color: number, dim = 1) => {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.normalize());
    const m = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(size, size, size));
    const col = new THREE.Color(color).multiplyScalar(dim);
    (byGlyph.get(g) ?? byGlyph.set(g, []).get(g)!).push({ m, color: col });
  };
  // rare glyphs are the face features (eyes, cheeks, muzzle): they stay on the front only
  const glyphCount = new Map<string, number>();
  for (const d of f.dots) glyphCount.set(d.glyph, (glyphCount.get(d.glyph) ?? 0) + 1);
  let n = 0;
  for (const d of f.dots) {
    n++;
    // a touch bigger than the art so the figure reads at racing distance; tiny dots get a floor
    const glyphScale = f.scale * S * Math.max(1.5, (0.22 * step) / Math.max(d.size, 1e-6));
    const c = col(d.x), r = row(d.y);
    const z = depthAt(c, r);
    const gx = (depthAt(c + 1, r) - depthAt(c - 1, r)) / (2 * step * S);
    const gy = (depthAt(c, r + 1) - depthAt(c, r - 1)) / (2 * step * S);
    const x = d.x * S, y = d.y * S;
    push(d.glyph, new THREE.Vector3(x, y, z + 0.002), new THREE.Vector3(-gx, -gy, 1), glyphScale, d.color);
    const white = ((d.color >> 16) & 255) > 235 && ((d.color >> 8) & 255) > 235 && (d.color & 255) > 235;
    const feature = (glyphCount.get(d.glyph) ?? 0) <= 12;
    if (!white && !feature && (!lite || n % 2 === 0)) push(d.glyph, new THREE.Vector3(x, y, -z - 0.002), new THREE.Vector3(-gx, -gy, -1), glyphScale, d.color, 1);
    if (!lite && dist.get(`${c},${r}`) === 1) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (solid(c + dc, r + dr)) continue;
        push(d.glyph, new THREE.Vector3(x + dc * step * S * 0.35, y + dr * step * S * 0.35, 0), new THREE.Vector3(dc, dr, 0), glyphScale, d.color, 0.9);
      }
    }
  }
  for (const [g, list] of byGlyph) {
    const mesh = new THREE.InstancedMesh(glyphGeometry(f.glyphs[g]), dotMat, list.length);
    list.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      mesh.setColorAt(i, it.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  }
  return group;
}
