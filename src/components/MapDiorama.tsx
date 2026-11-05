import { useEffect, useRef } from "react";
import * as THREE from "three";
import { TRACK_ORDER, type TrackId } from "../game/data";
import { buildHamster, mat } from "../game/models";

interface Props {
  selected: TrackId;
  open: Record<TrackId, boolean>;
  rpm: number;
  running: boolean;
  onSelect: (id: TrackId) => void;
}

const SPOT: Record<TrackId, [number, number]> = { wheel: [-5.6, -5], meadow: [-6, 5.4], kitchen: [5.8, 5.2], burrow: [6, -5.2] };
const GROUND: Record<TrackId, number> = { wheel: 0x8a6bff, meadow: 0x7ccf63, kitchen: 0xd9a066, burrow: 0x4a3a5a };

function landmark(id: TrackId): { group: THREE.Group; wheel?: THREE.Group } {
  const g = new THREE.Group();
  if (id === "wheel") {
    const wheel = new THREE.Group();
    wheel.position.y = 2.6;
    const rim = mat(0xffc83d, { emissive: 0x3a2400, metal: 0.3, rough: 0.4 });
    for (const z of [-0.6, 0.6]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(2, 0.12, 6, 32), rim);
      r.position.z = z;
      wheel.add(r);
    }
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 5), mat(0xf2ead8));
      rung.rotation.x = Math.PI / 2;
      rung.position.set(Math.cos(a) * 2, Math.sin(a) * 2, 0);
      wheel.add(rung);
    }
    g.add(wheel);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), mat(0x5b4f6a));
      leg.position.set(s * 0.8, 1.3, 0.9);
      leg.rotation.z = s * 0.3;
      g.add(leg);
    }
    const ham = buildHamster({ fur: 0xe8a65a, belly: 0xfff0d4, kart: 0xffc83d });
    ham.scale.setScalar(0.85);
    ham.position.set(0, 0.62, 0);
    ham.rotation.y = Math.PI / 2;
    g.add(ham);
    g.rotation.y = 0.5;
    return { group: g, wheel };
  }
  if (id === "meadow") {
    for (let k = 0; k < 5; k++) {
      const a = k * 1.3;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 5), mat(0x4f9e45));
      stem.position.set(Math.cos(a) * 1.4, 0.9, Math.sin(a) * 1.4);
      g.add(stem);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 10), mat(0xffc83d));
      head.position.set(stem.position.x, 1.85, stem.position.z);
      head.rotation.x = 1.1;
      g.add(head);
    }
    for (const [x, z, s] of [[0.6, -0.4, 1.3], [-0.9, 0.7, 1]]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 5), mat(0x7a4e2d));
      trunk.position.set(x, 0.6, z);
      g.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 * s, 0), mat(0x3f8a3c));
      crown.position.set(x, 1.6 * s + 0.4, z);
      g.add(crown);
    }
  } else if (id === "kitchen") {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.85, 1.8, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xe2463f, side: THREE.DoubleSide, flatShading: true }));
    cup.position.set(-0.6, 0.9, 0);
    g.add(cup);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.12, 6, 12, Math.PI * 1.2), mat(0xe2463f));
    handle.position.set(0.4, 0.95, 0);
    g.add(handle);
    const cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.8, 3), mat(0xffd34d));
    cheese.position.set(1, 0.4, 1);
    g.add(cheese);
    const cookie = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.2, 12), mat(0xc98a4a));
    cookie.position.set(-1, 0.1, 1.3);
    g.add(cookie);
  } else {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3b2b2a));
    g.add(mound);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.6, 12), new THREE.MeshBasicMaterial({ color: 0x0a0608 }));
    hole.position.set(0, 0.55, 1.62);
    hole.rotation.x = -0.35;
    g.add(hole);
    for (let k = 0; k < 6; k++) {
      const a = k * 1.05;
      const col = [0x2ee6c8, 0x8a6bff, 0xff7ad9][k % 3];
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 5), mat(0xe9dccb));
      stem.position.set(Math.cos(a) * 2.2, 0.3, Math.sin(a) * 2.2);
      g.add(stem);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(col, { emissive: col }));
      cap.position.set(stem.position.x, 0.6, stem.position.z);
      g.add(cap);
    }
  }
  return { group: g };
}

export function MapDiorama({ selected, open, rpm, running, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ selected, open, rpm, running, onSelect });
  state.current = { selected, open, rpm, running, onSelect };

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    scene.add(new THREE.HemisphereLight(0xdff6ff, 0x4a3a48, 1.5));
    const sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
    sun.position.set(8, 16, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
    scene.add(sun);

    const world = new THREE.Group();
    scene.add(world);
    // sea and island
    const sea = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: 0x3aa6c8, roughness: 0.3, metalness: 0.1 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.6;
    world.add(sea);
    const island = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 14.5, 1.2, 40), mat(0x6cbf5a));
    island.position.y = -0.6;
    island.receiveShadow = true;
    world.add(island);
    const cliff = new THREE.Mesh(new THREE.CylinderGeometry(14.5, 15, 0.8, 40), mat(0xc9a06a));
    cliff.position.y = -1.3;
    world.add(cliff);

    // dotted path between the zones in adventure order
    const order: TrackId[] = ["wheel", "meadow", "kitchen", "burrow"];
    const stone = mat(0xf2e3c0);
    for (let k = 0; k < order.length - 1; k++) {
      const [ax, az] = SPOT[order[k]];
      const [bx, bz] = SPOT[order[k + 1]];
      for (let t = 0.2; t < 0.85; t += 0.09) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 8), stone);
        s.position.set(ax + (bx - ax) * t, 0.02, az + (bz - az) * t);
        s.receiveShadow = true;
        world.add(s);
      }
    }

    const zones = new Map<TrackId, { pad: THREE.Mesh; lock: THREE.Group; land: THREE.Group; hit: THREE.Mesh; wheel?: THREE.Group }>();
    for (const id of TRACK_ORDER) {
      const [x, z] = SPOT[id];
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.3, 32), mat(GROUND[id]));
      pad.position.set(x, 0.12, z);
      pad.receiveShadow = true;
      world.add(pad);
      const { group: land, wheel } = landmark(id);
      land.position.set(x, 0.27, z);
      land.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true;
      });
      world.add(land);
      const lock = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.4), mat(0x2a1a1e));
      const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.09, 6, 16, Math.PI), mat(0x9a9590, { metal: 0.6, rough: 0.3 }));
      shackle.position.y = 0.45;
      lock.add(body, shackle);
      lock.position.set(x, 4.2, z);
      world.add(lock);
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 6, 12), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(x, 3, z);
      hit.userData.id = id;
      world.add(hit);
      zones.set(id, { pad, lock, land, hit, wheel });
    }
    // selection marker
    const marker = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 4), mat(0xffc83d, { emissive: 0x6a4a00 }));
    marker.rotation.x = Math.PI;
    scene.add(marker);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0.8 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.12, 6, 48), ringMat);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const ray = new THREE.Raycaster();
    const pick = (ev: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      const p = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(p, cam);
      const hits = ray.intersectObjects([...zones.values()].map((z) => z.hit));
      return hits.length ? (hits[0].object.userData.id as TrackId) : null;
    };
    const click = (ev: PointerEvent) => {
      const id = pick(ev);
      if (id && state.current.open[id]) state.current.onSelect(id);
    };
    const move = (ev: PointerEvent) => {
      const id = pick(ev);
      renderer.domElement.style.cursor = id && state.current.open[id] ? "pointer" : "default";
    };
    renderer.domElement.addEventListener("pointerup", click);
    renderer.domElement.addEventListener("pointermove", move);

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let spin = 0;
    const camTarget = new THREE.Vector3();
    const focus = new THREE.Vector3();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      t += reduce ? 0 : dt;
      const st = state.current;
      const [sx, sz] = SPOT[st.selected];
      focus.lerp(new THREE.Vector3(sx * 0.18, 0, sz * 0.18 + 0.5), Math.min(1, dt * 3));
      const narrow = cam.aspect < 1.1;
      const a = 0.2 + Math.sin(t * 0.15) * 0.1;
      const dist = narrow ? 46 : 38;
      camTarget.set(focus.x + Math.sin(a) * dist * 0.75, narrow ? 34 : 28, focus.z + Math.cos(a) * dist * 0.75);
      cam.position.lerp(camTarget, Math.min(1, dt * 2));
      cam.lookAt(focus.x, 0, focus.z);
      for (const [id, z] of zones) {
        const isOpen = st.open[id];
        z.lock.visible = !isOpen;
        z.lock.rotation.y = t * 1.2;
        z.lock.position.y = 4.2 + Math.sin(t * 2) * 0.2;
        (z.pad.material as THREE.MeshStandardMaterial).color.set(isOpen ? GROUND[id] : 0x6a6470);
        z.land.scale.setScalar(THREE.MathUtils.lerp(z.land.scale.x, id === st.selected ? 1.12 : 1, Math.min(1, dt * 6)));
      }
      const target = st.running ? (st.rpm / 60) * Math.PI * 2 * 0.6 : 0;
      spin += (target - spin) * Math.min(1, dt * 1.5);
      const w = zones.get("wheel")!.wheel;
      if (w) w.rotation.z -= spin * dt;
      marker.position.set(sx, 7 + Math.sin(t * 3) * 0.4, sz);
      marker.rotation.y = t * 2;
      ring.position.set(sx, 0.32, sz);
      ringMat.opacity = 0.5 + Math.sin(t * 4) * 0.3;
      renderer.render(scene, cam);
    };
    cam.position.set(0, 30, 40);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerup", click);
      renderer.domElement.removeEventListener("pointermove", move);
      scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className="diorama" role="img" aria-label="Adventure map. Use the region buttons to choose a region." />;
}
