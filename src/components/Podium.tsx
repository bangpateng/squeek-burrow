import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildKart, mat } from "../game/models";
import type { PodiumEntry } from "../game/race";

// The top three on a podium with confetti, shown on the results screen.
export function Podium({ entries }: { entries: PodiumEntry[] }) {
  const host = useRef<HTMLDivElement>(null);
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
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, 2, 0.1, 100);
    cam.position.set(0, 6, 17);
    cam.lookAt(0, 2.2, 0);
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a4048, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 8, 6);
    scene.add(key);

    const steps: [number, number][] = [[0, 2.2], [-4.2, 1.5], [4.2, 1]];
    const colors = [0xffc83d, 0xd8d6e0, 0xd9935a];
    const karts: THREE.Group[] = [];
    entries.slice(0, 3).forEach((e, i) => {
      const [x, h] = steps[i];
      const block = new THREE.Mesh(new THREE.BoxGeometry(3.8, h, 3), mat(colors[i], { rough: 0.5 }));
      block.position.set(x, h / 2, 0);
      scene.add(block);
      const k = buildKart(e.look, 0.95);
      k.root.position.set(x, h, 0);
      k.root.rotation.y = 0.35 * Math.sign(-x || 1) * (x === 0 ? 0 : 1);
      scene.add(k.root);
      karts.push(k.root);
    });

    // confetti
    const n = 160;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const vel = new Float32Array(n);
    const palette = [0xffc83d, 0xe2463f, 0x5ab8ff, 0xff7ad9, 0x5bbf6a].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      pos.set([(Math.random() - 0.5) * 16, 4 + Math.random() * 8, (Math.random() - 0.5) * 4], i * 3);
      const c = palette[i % palette.length];
      col.set([c.r, c.g, c.b], i * 3);
      vel[i] = 1.2 + Math.random() * 1.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.22, vertexColors: true })));

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
    let raf = 0;
    let last = performance.now();
    let t = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      t += dt;
      karts.forEach((k, i) => {
        k.position.y = steps[i][1] + Math.abs(Math.sin(t * 4 + i)) * (i === 0 ? 0.35 : 0.15);
      });
      for (let i = 0; i < n; i++) {
        pos[i * 3 + 1] -= vel[i] * dt;
        pos[i * 3] += Math.sin(t * 2 + i) * dt * 0.6;
        if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 12;
      }
      geo.attributes.position.needsUpdate = true;
      renderer.render(scene, cam);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [entries]);
  return (
    <div className="podiumWrap">
      <div ref={host} className="podium" aria-hidden="true" />
      <ol className="podiumNames">
        {entries.slice(0, 3).map((e, i) => (
          <li key={i} className={e.player ? "you" : ""}>
            {i + 1}. {e.player ? "You" : e.name}
          </li>
        ))}
      </ol>
    </div>
  );
}
