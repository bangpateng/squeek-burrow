import { useEffect, useState } from "react";
import { SEED, SEED_PAL } from "../core/sprites";
import { Sprite } from "./Sprite";

// A golden seed drifts into the sky now and then. Catching it pays out about 45 seconds of production.
export function GoldenSeed({ onCatch }: { onCatch: () => void }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const quick = new URLSearchParams(location.search).has("golden");
    let t1 = 0;
    let t2 = 0;
    const next = (first: boolean) => {
      const wait = quick ? 1500 : first ? 20_000 + Math.random() * 20_000 : 45_000 + Math.random() * 45_000;
      t1 = window.setTimeout(() => {
        setPos({ top: 16 + Math.random() * 52, left: 6 + Math.random() * 82 });
        t2 = window.setTimeout(() => {
          setPos(null);
          next(false);
        }, 12_000);
      }, wait);
    };
    next(true);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!pos) return null;
  return (
    <button
      className="golden"
      style={{ top: `${pos.top}%`, left: `${pos.left}%` }}
      aria-label="Golden seed. Catch it for a bonus."
      onClick={() => {
        setPos(null);
        onCatch();
      }}
    >
      <Sprite rows={SEED} palette={SEED_PAL} px={9} />
    </button>
  );
}
