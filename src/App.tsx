import { useCallback, useEffect, useRef, useState } from "react";
import { Garage } from "./components/Garage";
import { MapScreen } from "./components/MapScreen";
import { RaceView, type Finished } from "./components/RaceView";
import { Help, Settings } from "./components/Settings";
import { Title } from "./components/Title";
import { music, sfx, unlockAudio, type SongName } from "./game/audio";
import { CHARACTERS, EVENTS, roundTrack, type Character, type EventDef } from "./game/data";
import { loadPrefs, savePrefs, type Prefs } from "./game/prefs";
import type { LiveData, RaceResult } from "./game/race";
import { applyResult, buyUpgrade, clearSave, loadSave, newSave, regionOpen, selectChar, writeSave, type GameSave } from "./game/save";
import { useRoster } from "./web3/useRoster";
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
  const liveRef = useRef<LiveData>({ running: false, fever: false, source: "demo", rpm: 0, chain: null });
  liveRef.current = { running: wheel.running, fever, source: wheel.source, rpm: wheel.rpm, chain: wheel.chain };
  const [prediction, setPrediction] = useState<"yes" | "no" | null>(null);
  const roster = useRoster();
  // the chosen Squeek, else your first own Squeek, else today's first guest, else a classic hamster
  const racer: Character =
    (save && save.char.startsWith("sq-") ? roster.find(save.char) : undefined) ?? roster.mine[0] ?? roster.guests[0] ?? CHARACTERS[0];

  // each screen has its own song; the race screen plays its track's song itself
  const songFor = (s: Screen): SongName | null => (s === "title" || s === "settings" || s === "help" ? "title" : s === "map" ? "map" : s === "garage" ? "garage" : null);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  useEffect(() => {
    const name = songFor(screen);
    if (name) music(name);
  }, [screen]);

  useEffect(() => {
    const go = () => {
      unlockAudio();
      const name = songFor(screenRef.current);
      if (name) music(name);
    };
    // every button clicks, Back buttons click lower, and buttons tick softly under a mouse
    const click = (e: MouseEvent) => {
      const b = (e.target as HTMLElement | null)?.closest?.("button, a");
      if (!b || (b as HTMLButtonElement).disabled) return;
      if (/^\W*back\b/i.test(b.textContent ?? "") || b.getAttribute("aria-label") === "Back") sfx.back();
      else sfx.click();
    };
    let lastHover: Element | null = null;
    const hover = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const b = (e.target as HTMLElement | null)?.closest?.("button");
      if (b && b !== lastHover && !(b as HTMLButtonElement).disabled) sfx.hover();
      lastHover = b ?? null;
    };
    window.addEventListener("pointerdown", go);
    window.addEventListener("keydown", go);
    window.addEventListener("click", click, true);
    window.addEventListener("pointerover", hover);
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
      window.removeEventListener("click", click, true);
      window.removeEventListener("pointerover", hover);
    };
  }, []);

  const setSave = useCallback((s: GameSave | null) => {
    setSaveState(s);
    if (s) writeSave(s);
    else clearSave();
  }, []);

  const nav = (s: Screen, from?: Screen) => {
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
    const predicted = r.prediction?.correct === true ? out.seeds : 0;
    const seeds = out.seeds + r.seeds + predicted;
    const next = { ...out.save, seeds: out.save.seeds + r.seeds + predicted };
    setSave(next);
    for (let i = 0; i < out.stars; i++) setTimeout(() => sfx.star(i), 300 + i * 250);
    return { result: r, stars: out.stars, seeds, bonus, newBest: out.newBest, predicted };
  };

  const nextEvent = (() => {
    if (!event || !save) return null;
    const i = EVENTS.findIndex((e) => e.id === event.id);
    const n = EVENTS[i + 1];
    return n && n.kind !== "round" && regionOpen(save, n.track) ? n : null;
  })();

  return (
    <>
      {screen === "title" && (
        <Title
          save={save}
          wheel={wheel}
          fever={fever}
          roster={roster}
          racer={racer}
          onPlay={() => (save ? nav("map") : startNew())}
          onNew={() => (save ? setConfirmNew(true) : startNew())}
          onGarage={() => {
            if (!save) setSave(newSave(Date.now()));
            nav("garage", "title");
          }}
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
          onStart={(e, pick) => {
            sfx.go();
            setPrediction(pick);
            // the Round Cup races on the track picked by the current settled round
            setEvent(e.kind === "round" && wheel.chain ? { ...e, track: roundTrack(wheel.chain.round) } : e);
            setScreen("race");
          }}
        />
      )}
      {screen === "garage" && save && (
        <Garage
          save={save}
          roster={roster}
          racer={racer}
          onBack={() => nav(back === "garage" ? "title" : back)}
          onSelect={(id) => {
            sfx.unlock();
            setSave(selectChar(save, id));
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
          key={event.id + event.track}
          event={event}
          prediction={prediction}
          save={save}
          racer={racer}
          rivals={roster.rivals}
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
