// The Big Wheel stadium: a giant hamster wheel in the infield that spins at the real wheel's rpm,
// grandstands, floodlights and a jumbotron that shows the live Squeekchain data.
import * as THREE from "three";
import { buildHamster, canvasTexture, mat } from "./models";

export interface LiveView {
  rpm: number;
  running: boolean;
  source: string;
  height: number | null;
  progress: number | null;
  round: number | null;
}

export interface Arena {
  live: (v: LiveView, t: number, dt: number) => void;
  disposables: { dispose: () => void }[];
}

const SQUEEK = { fur: 0xe8a65a, belly: 0xfff0d4, kart: 0xffc83d };

export function buildArena(g: THREE.Group, cx: number, cz: number, ring: (n: number, r: number) => [number, number][], shadows: boolean): Arena {
  const disposables: { dispose: () => void }[] = [];
  const R = 38;
  const depth = 14;
  const root = new THREE.Group();
  root.position.set(cx, 0, cz);
  root.rotation.y = 0.5;
  g.add(root);

  // stand
  const steel = mat(0x5b4f6a, { metal: 0.6, rough: 0.4 });
  for (const side of [-1, 1]) {
    for (const lean of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(2.2, R + 10, 2.2), steel);
      leg.position.set(lean * 13, (R + 6) / 2, side * (depth / 2 + 2));
      leg.rotation.z = lean * 0.38;
      leg.castShadow = shadows;
      root.add(leg);
    }
  }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, depth + 8, 12), steel);
  axle.rotation.x = Math.PI / 2;
  axle.position.y = R + 4;
  root.add(axle);

  // the wheel itself
  const wheel = new THREE.Group();
  wheel.position.y = R + 4;
  root.add(wheel);
  const rimMat = mat(0xffc83d, { metal: 0.3, rough: 0.35, emissive: 0x3a2400 });
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 1.1, 8, 64), rimMat);
    rim.position.z = side * depth / 2;
    rim.castShadow = shadows;
    wheel.add(rim);
    for (let k = 0; k < 8; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.9, R * 2, 0.9), steel);
      spoke.rotation.z = (k / 8) * Math.PI;
      spoke.position.z = side * depth / 2;
      wheel.add(spoke);
    }
  }
  const rungGeo = new THREE.CylinderGeometry(0.45, 0.45, depth, 6);
  const rungMat = mat(0xf2ead8, { metal: 0.4, rough: 0.3 });
  const rungs = new THREE.InstancedMesh(rungGeo, rungMat, 72);
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    rungs.setMatrixAt(k, m);
  }
  rungs.castShadow = shadows;
  wheel.add(rungs);
  // light ring that glows brighter the faster the wheel turns
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0.5 });
  const glow = new THREE.Mesh(new THREE.TorusGeometry(R + 1.6, 0.35, 6, 80), glowMat);
  glow.position.set(0, R + 4, depth / 2 + 0.8);
  root.add(glow);

  // a giant Squeek running inside the wheel
  const hamster = buildHamster(SQUEEK);
  hamster.scale.setScalar(11);
  hamster.position.set(0, 4 + 1.1, 0);
  hamster.rotation.y = Math.PI / 2;
  hamster.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = shadows;
  });
  root.add(hamster);

  // grandstands with a crowd of coloured dots
  const crowdTex = canvasTexture(256, 64, (c) => {
    c.fillStyle = "#2a2236";
    c.fillRect(0, 0, 256, 64);
    const cols = ["#ffc83d", "#e2463f", "#3a8dde", "#ffffff", "#ff7ad9", "#5bbf6a"];
    for (let y = 4; y < 64; y += 10)
      for (let x = 4 + (y % 20 ? 4 : 0); x < 256; x += 9) {
        c.fillStyle = cols[Math.floor(Math.random() * cols.length)];
        c.beginPath();
        c.arc(x, y, 3.2, 0, Math.PI * 2);
        c.fill();
      }
  });
  crowdTex.wrapS = THREE.RepeatWrapping;
  crowdTex.repeat.set(3, 1);
  disposables.push(crowdTex);
  const standMat = new THREE.MeshStandardMaterial({ map: crowdTex, roughness: 0.9 });
  const standSide = mat(0x3a2f48);
  for (const [x, z] of ring(10, 245)) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(70, 20, 24), [standSide, standSide, standSide, standSide, standMat, standSide]);
    s.position.set(x, 10, z);
    s.lookAt(cx, 10, cz);
    s.rotateX(-0.35);
    g.add(s);
  }
  // floodlight towers
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff4d0 });
  for (const [x, z] of ring(6, 215)) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 46, 8), steel);
    pole.position.set(x, 23, z);
    g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 2), lampMat);
    head.position.set(x, 47, z);
    head.lookAt(cx, 0, cz);
    g.add(head);
  }

  // jumbotron with live data
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const screenTex = new THREE.CanvasTexture(cv);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  disposables.push(screenTex);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ map: screenTex, side: THREE.DoubleSide }));
  const frame = new THREE.Mesh(new THREE.BoxGeometry(42, 22, 1.5), mat(0x1a1420));
  const board = new THREE.Group();
  board.add(frame, screen);
  screen.position.z = 0.8;
  board.position.set(0, R * 2 + 22, 0);
  root.add(board);
  const boardPost = new THREE.Mesh(new THREE.BoxGeometry(1.4, 14, 1.4), steel);
  boardPost.position.set(0, R * 2 + 8, 0);
  root.add(boardPost);

  let lastDraw = -1;
  let angle = 0;
  let spin = 0;
  const draw = (v: LiveView, t: number) => {
    const c = cv.getContext("2d")!;
    c.fillStyle = "#14101a";
    c.fillRect(0, 0, 512, 256);
    c.fillStyle = v.source === "live" ? "#3fd16a" : v.source === "demo" ? "#c98a00" : "#e2463f";
    c.beginPath();
    c.arc(28, 30, 9 + (v.running ? Math.sin(t * 6) * 2 : 0), 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#fff0d4";
    c.font = "800 26px system-ui, sans-serif";
    c.textBaseline = "middle";
    c.fillText(v.source === "live" ? "SQUEEKCHAIN LIVE" : v.source === "demo" ? "DEMO WHEEL" : "WHEEL OFFLINE", 48, 31);
    c.font = "900 92px system-ui, sans-serif";
    c.fillStyle = v.running ? "#ffc83d" : "#8a7f99";
    c.fillText(v.running ? `${Math.round(v.rpm)} rpm` : "napping", 22, 118);
    c.font = "700 28px system-ui, sans-serif";
    c.fillStyle = "#fff0d4";
    if (v.height !== null) {
      c.fillText(`Block ${v.height}   Round ${v.round ?? "-"}`, 22, 190);
      c.fillStyle = "#3a2f48";
      c.fillRect(22, 214, 468, 22);
      c.fillStyle = "#8a6bff";
      c.fillRect(22, 214, 468 * (v.progress ?? 0), 22);
    } else c.fillText("Chain data unavailable", 22, 200);
    screenTex.needsUpdate = true;
  };

  return {
    disposables,
    live: (v, t, dt) => {
      const target = v.running ? (v.rpm / 60) * Math.PI * 2 * 0.35 : 0;
      spin += (target - spin) * Math.min(1, dt * 1.5);
      angle -= spin * dt;
      wheel.rotation.z = angle;
      glowMat.opacity = 0.25 + Math.min(0.7, spin * 0.5);
      // the giant hamster bobs while it runs and slumps when it naps
      const run = Math.min(1, spin * 1.5);
      hamster.position.y = 5.3 + Math.abs(Math.sin(t * 12)) * 1.2 * run;
      hamster.rotation.z = THREE.MathUtils.lerp(0.35, -0.12, run);
      if (Math.floor(t * 2) !== lastDraw) {
        lastDraw = Math.floor(t * 2);
        draw(v, t);
      }
    },
  };
}
