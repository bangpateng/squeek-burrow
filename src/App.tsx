import { useEffect, useRef, useState } from "react";
import { perSecond, wheelMultiplier, type BuyMode } from "./core/economy";
import { sfx } from "./core/sfx";
import { useAudio, useWheelTicks } from "./hooks/useAudio";
import { useGame } from "./hooks/useGame";
import { useQuests } from "./hooks/useQuests";
import { useWheel } from "./hooks/useWheel";
import { Achievements } from "./components/Achievements";
import { Burrow } from "./components/Burrow";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { Quests } from "./components/Quests";
import { Toasts } from "./components/Toasts";
import { Tools } from "./components/Tools";

export default function App() {
  const { wheel, fever, feverLeft } = useWheel();
  const mult = wheelMultiplier(wheel.running, fever);
  const multRef = useRef(mult);
  multRef.current = mult;
  const game = useGame(multRef);
  const audio = useAudio();
  const quests = useQuests(wheel, perSecond(game.save, mult), game.grant);
  const [mode, setMode] = useState<BuyMode>(1);

  useWheelTicks(wheel.running, wheel.rpm);

  const forageRef = useRef(game.doForage);
  forageRef.current = game.doForage;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "BUTTON" || tag === "A") return;
      e.preventDefault();
      forageRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const wasFever = useRef(false);
  useEffect(() => {
    if (fever && !wasFever.current) {
      sfx.fever();
      game.noteFever();
    }
    wasFever.current = fever;
  }, [fever, game]);

  const wasRunning = useRef<boolean | null>(null);
  useEffect(() => {
    if (wheel.source === "offline") return;
    if (wasRunning.current !== null && wasRunning.current !== wheel.running) {
      if (wheel.running) sfx.wake();
      else sfx.nap();
    }
    wasRunning.current = wheel.running;
  }, [wheel.running, wheel.source]);

  return (
    <>
      <Hero
        wheel={wheel}
        fever={fever}
        feverLeft={feverLeft}
        save={game.save}
        mult={mult}
        audio={audio.settings}
        onAudio={audio.update}
        onForage={game.doForage}
        onGolden={game.doGolden}
      />
      <main>
        <Burrow
          save={game.save}
          running={wheel.running}
          away={game.away}
          mode={mode}
          onMode={setMode}
          onBuy={game.doBuy}
          onClearAway={game.clearAway}
        />
        <Quests wheel={wheel} quests={quests} />
        <Achievements save={game.save} />
        <Tools save={game.save} onHibernate={game.doHibernate} onReset={game.doReset} />
      </main>
      <Footer />
      <Toasts toasts={game.toasts} onDone={game.dismissToast} />
    </>
  );
}
