import { useEffect, useRef, useState } from "react";
import { pickFeed, type FeverReason, type WheelState } from "../core/feed";

const FEVER_MS = 60_000;
const RECORD_COOLDOWN_MS = 120_000;

export function useWheel() {
  const [{ feed, live }] = useState(pickFeed);
  const [wheel, setWheel] = useState<WheelState>({
    running: false,
    rpm: 0,
    distanceMm: null,
    speedMmps: 0,
    workUnits: null,
    source: live ? "offline" : "demo",
  });
  const [feverUntil, setFeverUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const feverRef = useRef(0);
  const cooldownRef = useRef(0);

  useEffect(
    () =>
      feed.subscribe((s, reason: FeverReason | null) => {
        setWheel(s);
        if (!reason) return;
        const t = Date.now();
        if (t < feverRef.current) return;
        if (reason === "record" && t < cooldownRef.current) return;
        feverRef.current = t + FEVER_MS;
        cooldownRef.current = t + FEVER_MS + RECORD_COOLDOWN_MS;
        setFeverUntil(feverRef.current);
      }),
    [feed],
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fever = now < feverUntil;
  const feverLeft = fever ? Math.ceil((feverUntil - now) / 1000) : 0;
  return { wheel, fever, feverLeft };
}
