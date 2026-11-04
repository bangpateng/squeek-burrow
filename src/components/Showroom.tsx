import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Character } from "../game/data";
import { buildKart, buildSeed, mat } from "../game/models";

// A small turntable scene that shows a hamster in its kart. Used on the title screen and in the garage.
export function Showroom({ char, className, spin = true }: { char: Character; className?: string; spin?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const setChar = useRef<(c: Character) => void>(() => {});

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
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    cam.position.set(0, 3.2, 8.5);
    cam.lookAt(0, 0.9, 0);
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6b4f4a, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(4, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fdcec, 1.4);
    rim.position.set(-5, 3, -4);
    scene.add(rim);

    const stage = new THREE.Group();
    scene.add(stage);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3, 0.35, 40), mat(0xffc83d, { rough: 0.6 }));
    disc.position.y = -0.18;
    disc.receiveShadow = true;
    stage.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.08, 6, 48), mat(0x2a1a1e));
    ring.rotation.x = Math.PI / 2;
    stage.add(ring);
    const seeds: THREE.Object3D[] = [];
    const tpl = buildSeed();
    for (let i = 0; i < 6; i++) {
      const s = tpl.clone();
      const a = (i / 6) * Math.PI * 2;
      s.position.set(Math.cos(a) * 3.6, 1.2, Math.sin(a) * 3.6);
      s.scale.setScalar(0.7);
      scene.add(s);
      seeds.push(s);
    }

    let kart: THREE.Group | null = null;
    setChar.current = (c) => {
      if (kart) {
        stage.remove(kart);
        kart.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      }
      const m = buildKart(c);
      m.root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true;
      });
      kart = m.root;
      stage.add(kart);
    };
    setChar.current(char);

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.position.set(0, 3.2, w / h < 1 ? 11 : 8.5);
      cam.lookAt(0, 0.9, 0);
      cam.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let t = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      if (!reduce) {
        stage.rotation.y = spin ? t * 0.45 : 0.6;
        seeds.forEach((s, i) => {
          const a = (i / 6) * Math.PI * 2 + t * 0.3;
          s.position.set(Math.cos(a) * 3.6, 1.2 + Math.sin(t * 2 + i) * 0.25, Math.sin(a) * 3.6);
          s.rotation.y = t * 2;
        });
      } else stage.rotation.y = 0.6;
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
  }, [spin]);

  useEffect(() => {
    setChar.current(char);
  }, [char]);

  return <div ref={host} className={`showroom ${className ?? ""}`} aria-hidden="true" />;
}
