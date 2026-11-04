import { useCallback, useEffect, useRef, useState } from "react";
import { Garage } from "./components/Garage";
import { MapScreen } from "./components/MapScreen";
import { RaceView, type Finished } from "./components/RaceView";
import { Help, Settings } from "./components/Settings";
import { Title } from "./components/Title";
import { music, sfx, unlockAudio } from "./game/audio";
import { EVENTS, type EventDef } from "./game/data";
import { loadPrefs, savePrefs, type Prefs } from "./game/prefs";
import type { RaceResult } from "./game/race";
import { applyResult, buyUpgrade, clearSave, loadSave, newSave, regionOpen, selectChar, unlockChar, writeSave, type GameSave } from "./game/save";
import { useWheel } from "./hooks/useWheel";

type Screen = "title" | "map" | "garage" | "settings" | "help" | "race";

export default function App() {
  const [save, setSaveState] = useState<GameSave | null>(loadSave);
  const [screen, setScreen] = useState<Screen>("title");
  const [back, setBack] = useState<Screen>("title");
  const [event, setEvent] = useState<EventDef | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [confirmNew, setConfirmNew] = useState(false);
  const { wheel, fever } = useWheel();
  const liveRef = useRef({ running: false, fever: false, source: "demo" });
  liveRef.current = { running: wheel.running, fever, source: wheel.source };

  useEffect(() => {
    const go = () => {
      unlockAudio();
      music("menu");
    };
    window.addEventListener("pointerdown", go);
    window.addEventListener("keydown", go);
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, []);

  const setSave = useCallback((s: GameSave | null) => {
    setSaveState(s);
    if (s) writeSave(s);
    else clearSave();
  }, []);

  const nav = (s: Screen, from?: Screen) => {
    sfx.click();
    if (from) setBack(from);
    setScreen(s);
  };

  const startNew = () => {
    const s = newSave(Date.now());
    setSave(s);
    setConfirmNew(false);
    nav("map");
  };

  const finish = (r: RaceResult): Finished => {
    const cur = save!;
    const bonus = liveRef.current.running && liveRef.current.source !== "offline";
    const out = applyResult(cur, event!.id, r.value, bonus ? 1.25 : 1);
    const seeds = out.seeds + r.seeds;
    const next = { ...out.save, seeds: out.save.seeds + r.seeds };
    setSave(next);
    for (let i = 0; i < out.stars; i++) setTimeout(() => sfx.star(i), 300 + i * 250);
    return { result: r, stars: out.stars, seeds, bonus, newBest: out.newBest };
  };

  const nextEvent = (() => {
    if (!event || !save) return null;
    const i = EVENTS.findIndex((e) => e.id === event.id);
    const n = EVENTS[i + 1];
    return n && regionOpen(save, n.track) ? n : null;
  })();

  return (
    <>
      {screen === "title" && (
        <Title
          save={save}
          wheel={wheel}
          fever={fever}
          onContinue={() => nav("map")}
          onNew={() => (save ? setConfirmNew(true) : startNew())}
          onGarage={() => nav("garage", "title")}
          onSettings={() => nav("settings", "title")}
          onHelp={() => nav("help", "title")}
        />
      )}
      {screen === "map" && save && (
        <MapScreen
          save={save}
          wheel={wheel}
          fever={fever}
          onBack={() => nav("title")}
          onGarage={() => nav("garage", "map")}
          onStart={(e) => {
            sfx.go();
            setEvent(e);
            setScreen("race");
          }}
        />
      )}
      {screen === "garage" && save && (
        <Garage
          save={save}
          onBack={() => nav(back === "garage" ? "title" : back)}
          onSelect={(id) => {
            sfx.click();
            setSave(selectChar(save, id));
          }}
          onUnlock={(id) => {
            const n = unlockChar(save, id);
            if (n === save) sfx.error();
            else sfx.unlock();
            setSave(n);
          }}
          onUpgrade={(id) => {
            const n = buyUpgrade(save, id);
            if (n === save) sfx.error();
            else sfx.buy();
            setSave(n);
          }}
        />
      )}
      {screen === "settings" && (
        <Settings
          prefs={prefs}
          hasSave={!!save}
          onPrefs={(p) => {
            setPrefs(p);
            savePrefs(p);
          }}
          onBack={() => nav(back)}
          onReset={() => {
            setSave(null);
            nav("title");
          }}
        />
      )}
      {screen === "help" && <Help onBack={() => nav(back)} />}
      {screen === "race" && save && event && (
        <RaceView
          key={event.id}
          event={event}
          save={save}
          prefs={prefs}
          liveRef={liveRef}
          onFinish={finish}
          onQuit={() => nav("map")}
          onNext={nextEvent ? () => setEvent(nextEvent) : null}
        />
      )}

      {confirmNew && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Start a new game">
          <div className="sheet">
            <h2>Start over?</h2>
            <p>This deletes your stars, seeds, hamsters and upgrades.</p>
            <div className="sheetBtns">
              <button className="ghost" onClick={() => setConfirmNew(false)} autoFocus>
                Keep my game
              </button>
              <button className="danger" onClick={startNew}>
                Start over
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
