import { useCallback, useEffect, useRef, useState } from "react";
import type { WheelState } from "../core/feed";
import {
  QUEST_KEY, checkGoal, emptyQuests, goalReward, migrateQuests, predictionReward, resolvePrediction, startPrediction,
  type Outcome, type Quests,
} from "../core/quests";
import { fmt } from "../core/economy";
import { sfx } from "../core/sfx";

function load(): Quests {
  try {
    return migrateQuests(JSON.parse(localStorage.getItem(QUEST_KEY) || "null"));
  } catch {
    return emptyQuests();
  }
}

export function useQuests(
  wheel: WheelState,
  perSec: number,
  grant: (n: number, title: string, desc: string) => void,
) {
  const [q, setQ] = useState<Quests>(load);
  const [now, setNow] = useState(() => Date.now());
  const [last, setLast] = useState<{ outcome: Outcome; seeds: number } | null>(null);
  const qRef = useRef(q);
  qRef.current = q;
  const rateRef = useRef(perSec);
  rateRef.current = perSec;
  const live = wheel.source === "live";

  useEffect(() => {
    try {
      localStorage.setItem(QUEST_KEY, JSON.stringify(q));
    } catch {
      // storage can be unavailable; quests keep working for this visit
    }
  }, [q]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // community goal: only judged on live data
  useEffect(() => {
    if (!live || wheel.workUnits === null) return;
    const r = checkGoal(qRef.current, wheel.workUnits);
    if (r.q === qRef.current) return;
    setQ(r.q);
    if (r.reached) {
      const seeds = goalReward(rateRef.current);
      sfx.achieve();
      grant(seeds, "Community goal reached", `The wheel passed the next goal. +${fmt(seeds)} seeds for everyone watching.`);
    }
  }, [live, wheel.workUnits, grant]);

  // forecast: resolved on the first live reading after the time is up
  useEffect(() => {
    if (!live) return;
    const r = resolvePrediction(qRef.current, wheel.running, now);
    if (r.outcome === null) return;
    const p = qRef.current.pending!;
    setQ(r.q);
    if (r.outcome === "win") {
      const seeds = predictionReward(rateRef.current, qRef.current.streak, p.from, p.guess);
      setLast({ outcome: "win", seeds });
      sfx.golden();
      grant(seeds, "Forecast correct", `You called it. +${fmt(seeds)} seeds.`);
    } else if (r.outcome === "loss") {
      setLast({ outcome: "loss", seeds: 0 });
      sfx.error();
    } else {
      setLast({ outcome: "void", seeds: 0 });
    }
  }, [live, wheel.running, now, grant]);

  const guess = useCallback(
    (g: boolean) => {
      if (!live) return;
      sfx.buy();
      setLast(null);
      setQ((cur) => startPrediction(cur, g, wheel.running, Date.now()));
    },
    [live, wheel.running],
  );

  return { q, now, live, last, guess, perSec };
}
