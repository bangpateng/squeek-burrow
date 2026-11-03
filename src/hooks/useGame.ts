import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { pendingAchievements } from "../core/achievements";
import {
  KEY, addSeeds, awayGain, buy, canBuy, catchGolden, emptySave, forage, hibernate, migrate, tick,
  type Save, type UpgradeId,
} from "../core/economy";
import { sfx } from "../core/sfx";

export interface Toast {
  id: number;
  title: string;
  desc: string;
  plain?: boolean;
}

function load(): { save: Save; away: number } {
  const now = Date.now();
  let raw: unknown = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    raw = null;
  }
  const save = migrate(raw, now);
  const gain = awayGain(save, (now - save.lastSeen) / 1000);
  return { save: addSeeds(save, gain), away: gain };
}

export function useGame(multRef: MutableRefObject<number>) {
  const [init] = useState(load);
  const [save, setSave] = useState<Save>(init.save);
  const [away, setAway] = useState(init.away);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const saveRef = useRef(save);
  saveRef.current = save;
  const toastId = useRef(0);

  useEffect(() => {
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      if (dt > 5) {
        const g = awayGain(saveRef.current, dt);
        if (g > 0) {
          setSave((s) => addSeeds(s, g));
          setAway((a) => a + g);
        }
        return;
      }
      setSave((s) => tick(s, dt, multRef.current));
    }, 250);
    return () => clearInterval(id);
  }, [multRef]);

  useEffect(() => {
    const persist = () => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...saveRef.current, lastSeen: Date.now() }));
      } catch {
        // storage can be unavailable (private mode); the game keeps running
      }
    };
    const id = setInterval(persist, 4000);
    window.addEventListener("beforeunload", persist);
    document.addEventListener("visibilitychange", persist);
    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", persist);
      document.removeEventListener("visibilitychange", persist);
    };
  }, []);

  useEffect(() => {
    const pending = pendingAchievements(save);
    if (pending.length === 0) return;
    setSave((s) => ({ ...s, ach: [...new Set([...s.ach, ...pending.map((a) => a.id)])] }));
    setToasts((t) => [...t, ...pending.map((a) => ({ id: ++toastId.current, title: a.name, desc: a.desc }))]);
    sfx.achieve();
  }, [save]);

  const doForage = useCallback(() => {
    sfx.forage();
    setSave((s) => forage(s));
  }, []);

  const doBuy = useCallback((id: UpgradeId, n: number) => {
    const cur = saveRef.current;
    if (!canBuy(cur, id, n)) {
      sfx.error();
      return;
    }
    if (cur.owned[id] === 0) sfx.unlock();
    else sfx.buy();
    setSave((s) => buy(s, id, n));
  }, []);

  const doGolden = useCallback(() => {
    sfx.golden();
    setSave((s) => catchGolden(s, multRef.current));
  }, [multRef]);

  const noteFever = useCallback(() => setSave((s) => ({ ...s, fevers: s.fevers + 1 })), []);

  const doHibernate = useCallback(() => {
    sfx.hibernate();
    setSave((s) => hibernate(s, Date.now()));
  }, []);

  const doReset = useCallback(() => {
    setSave(emptySave(Date.now()));
    setAway(0);
  }, []);

  const grant = useCallback((n: number, title: string, desc: string) => {
    setSave((s) => addSeeds(s, n));
    setToasts((t) => [...t, { id: ++toastId.current, title, desc, plain: true }]);
  }, []);

  const clearAway = useCallback(() => setAway(0), []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  return { save, away, toasts, doForage, doBuy, doGolden, noteFever, doHibernate, doReset, grant, clearAway, dismissToast };
}
