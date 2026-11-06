import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { music } from "../game/audio";
import { TRACKS, type Character, type EventDef } from "../game/data";
import { attachKeys, clearTouch, touch } from "../game/input";
import { isTouch, type Prefs } from "../game/prefs";
import { ITEMS, Race, fmtTime, ordinal, type Hud, type LiveData, type RaceMsg, type RaceResult } from "../game/race";
import type { GameSave } from "../game/save";
import { Stars } from "./Common";
import { Podium } from "./Podium";
import { SoundControls } from "./Settings";

export interface Finished {
  result: RaceResult;
  stars: number;
  seeds: number;
  bonus: boolean;
  newBest: boolean;
  predicted: number; // extra seeds from a correct Round Cup prediction
}

interface Props {
  event: EventDef;
  prediction: "yes" | "no" | null;
  save: GameSave;
  racer: Character;
  rivals: Character[];
  prefs: Prefs;
  liveRef: MutableRefObject<LiveData>;
  onFinish: (r: RaceResult) => Finished;
  onQuit: () => void;
  onNext: (() => void) | null;
}

type TouchKey = "left" | "right" | "gas" | "brake" | "drift" | "turbo" | "item";

function Pad({ k, label, className }: { k: TouchKey; label: string; className?: string }) {
  const set = (v: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    touch[k] = v;
  };
  return (
    <button className={`tbtn ${className ?? ""}`} onPointerDown={set(true)} onPointerUp={set(false)} onPointerLeave={set(false)} onPointerCancel={set(false)} onContextMenu={(e) => e.preventDefault()} aria-label={label}>
      {label}
    </button>
  );
}

export function RaceView({ event, prediction, save, racer, rivals, prefs, liveRef, onFinish, onQuit, onNext }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const race = useRef<Race | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [msg, setMsg] = useState<(RaceMsg & { id: number }) | null>(null);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState<Finished | null>(null);
  const [run, setRun] = useState(0); // bump to restart
  const [error, setError] = useState(false);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const touchUI = isTouch();

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const detach = attachKeys();
    touch.auto = touchUI && prefs.autoGas;
    let r: Race;
    try {
      r = new Race(host.current!, {
        event,
        char: racer,
        rivals,
        upgrades: save.upgrades,
        quality: prefs.quality,
        live: () => liveRef.current,
        prediction,
        onFinish: (res) => setDone(finishRef.current(res)),
        onMsg: (m) => setMsg({ ...m, id: Math.random() }),
        onPause: () => setPaused((p) => !p),
        autopilot: params.has("autopilot"),
        timeScale: Number(params.get("timescale")) || 1,
      });
    } catch {
      setError(true);
      detach();
      return;
    }
    race.current = r;
    if (params.has("autopilot")) (window as unknown as { __race: Race }).__race = r;
    r.setMinimap(mapRef.current);
    music(event.track);
    const id = setInterval(() => setHud(r.hud()), 1000 / 20);
    const vis = () => document.hidden && setPaused(true);
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", vis);
      detach();
      clearTouch();
      r.dispose();
      race.current = null;
      music("menu");
    };
    // the save is read once at the start of each run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, run, prefs.quality]);

  useEffect(() => {
    race.current?.setPaused(paused || !!done);
    if (paused) clearTouch();
  }, [paused, done]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 1800);
    return () => clearTimeout(t);
  }, [msg]);

  const restart = () => {
    setDone(null);
    setPaused(false);
    setHud(null);
    setRun((n) => n + 1);
  };

  if (error)
    return (
      <div className="screen settings">
        <section className="card center">
          <h2>3D is not available</h2>
          <p>This browser could not start WebGL. Try another browser, or turn on hardware acceleration in its settings.</p>
          <button className="primary" onClick={onQuit}>
            Back to the map
          </button>
        </section>
      </div>
    );

  const h = hud;
  const t = TRACKS[event.track];
  return (
    <div className={`screen race${touchUI ? " touchUI" : ""}`}>
      <div ref={host} className="raceHost" />
      {h && (h.boost === "dash" || h.boost === "turbo" || h.boost === "orange") && <div className={`speedlines ${h.boost}`} aria-hidden="true" />}
      {h && h.hit < 0.6 && <div className="hitFlash" aria-hidden="true" />}
      <div className="hud">
        <div className="hudTL">
          {(event.kind === "race" || event.kind === "round" || event.kind === "ghost") && h && (
            <div className="place">
              <strong>{ordinal(h.place)}</strong>
              <span>/ {h.of}</span>
            </div>
          )}
          {event.kind !== "rush" && h && (
            <div className="lap">
              Lap <b>{h.lap}</b>/{h.laps}
            </div>
          )}
          {h && h.standings.length > 1 && (
            <ol className="standings">
              {h.standings.map((r, i) => (
                <li key={r.name} className={r.player ? "you" : ""}>
                  <b>{i + 1}</b>
                  <i style={{ background: r.color }} />
                  {r.player ? "You" : r.name}
                </li>
              ))}
            </ol>
          )}
          {event.kind === "rush" && h && (
            <div className="place">
              <strong>{h.seeds}</strong>
              <span>seeds</span>
            </div>
          )}
        </div>
        {h?.items && (
          <div className={`itemSlot${h.rolling ? " rolling" : h.item ? " ready" : ""}${h.shield ? " shielded" : ""}`} aria-label={h.item && !h.rolling ? `Item: ${ITEMS[h.item].name}` : "No item"}>
            <span className="itemIcon">{h.item ? ITEMS[h.item].icon : ""}</span>
            {h.item && !h.rolling && <span className="itemName">{ITEMS[h.item].name}</span>}
            {!touchUI && h.item && !h.rolling && <span className="itemKey">Q</span>}
          </div>
        )}
        <div className="hudTC">
          <div className="timer">{h ? (event.kind === "rush" ? fmtTime(h.left) : fmtTime(h.time)) : "0:00.00"}</div>
          {h && (
            <div className={`livechip${h.fever ? " fever" : h.liveRunning ? " on" : ""}`}>
              {h.fever ? "Squeek fever" : h.liveRunning ? "Hamster running: turbo x2" : liveRef.current.source === "offline" ? "Live wheel offline" : "Hamster napping"}
            </div>
          )}
        </div>
        <div className="hudTR">
          <canvas ref={mapRef} width={150} height={150} className="minimap" aria-label="Track map" />
          <button className="pauseBtn" onClick={togglePause} aria-label="Pause">
            ❚❚
          </button>
        </div>

        {h && h.phase !== "race" && h.phase !== "done" && (
          <div className="bigCenter">
            {h.phase === "intro" ? (
              <div className="intro">
                <span>{t.region}</span>
                <strong>{event.name}</strong>
              </div>
            ) : (
              <div key={h.count} className="count">
                {h.count > 0 ? h.count : "GO!"}
              </div>
            )}
          </div>
        )}
        {h?.wrongWay && <div className="wrongWay">Wrong way!</div>}
        {msg && (
          <div key={msg.id} className={`msg ${msg.tone}`}>
            {msg.text}
          </div>
        )}

        {h?.ghost && (
          <div className={`livePanel ghostPanel${h.ghost.asleep ? " asleep" : ""}`}>
            <span>Squeek, live from the wheel</span>
            <strong>{h.ghost.asleep ? "Napping z z z" : `${Math.round(h.ghost.rpm)} rpm`}</strong>
            <small>{h.ghost.gap > 0 ? `${Math.round(h.ghost.gap)} m ahead of you` : `${Math.round(-h.ghost.gap)} m behind you`}</small>
          </div>
        )}
        {event.kind === "round" && h && (
          <div className="livePanel chainPanel">
            <span>
              {!h.chain ? "Chain data unavailable" : h.startHeight !== null && h.chain.height > h.startHeight ? `Block ${h.startHeight + 1} done!` : `Building block ${h.chain.height + 1}`}
            </span>
            <div className="chainBar">
              <b style={{ width: `${h.chain && h.startHeight !== null && h.chain.height > h.startHeight ? 100 : Math.round((h.chain?.progress ?? 0) * 100)}%` }} />
            </div>
            <small>Your call: {h.pick === "yes" ? "it finishes first" : h.pick === "no" ? "you finish first" : "none"}</small>
          </div>
        )}
        <div className="hudBL">
          <div className="speedo">
            <strong>{h?.speed ?? 0}</strong>
            <span>km/h</span>
          </div>
          {h && h.drift > 0 && <div className={`driftTag d${h.drift}`}>{h.drift === 3 ? "MAX" : h.drift === 2 ? "BOOST" : "DRIFT"}</div>}
        </div>
        <div className="hudBC">
          <div className="meter" aria-label={`Turbo ${Math.floor(h?.meter ?? 0)} of 3`}>
            {[0, 1, 2].map((i) => (
              <i key={i} className={(h?.meter ?? 0) >= i + 1 ? "full" : ""}>
                <b style={{ width: `${Math.max(0, Math.min(1, (h?.meter ?? 0) - i)) * 100}%` }} />
              </i>
            ))}
          </div>
          {!touchUI && <span className="keyHint">{event.kind === "race" ? "Q item (hold S to throw back), E turbo, Space drift" : "E for turbo, hold Space to drift"}</span>}
        </div>
      </div>

      {touchUI && !paused && !done && (
        <div className="touch">
          <div className="tl">
            <Pad k="left" label="◀" />
            <Pad k="right" label="▶" />
          </div>
          <div className="tr">
            {event.kind === "race" && <Pad k="item" label="ITEM" className="small item" />}
            <Pad k="turbo" label="TURBO" className="small turbo" />
            <Pad k="drift" label="DRIFT" className="small" />
            <Pad k="brake" label="BRAKE" className="small" />
            {!prefs.autoGas && <Pad k="gas" label="GO" className="gas" />}
          </div>
        </div>
      )}

      {paused && !done && (
        <div className="modal">
          <div className="sheet">
            <h2>Paused</h2>
            <div className="menu">
              <button className="primary" onClick={() => setPaused(false)} autoFocus>
                Resume
              </button>
              <button onClick={restart}>Restart</button>
              <button onClick={onQuit}>Quit to map</button>
            </div>
            <SoundControls />
          </div>
        </div>
      )}

      {done && (
        <div className="modal">
          <div className="sheet result">
            {done.result.podium.length > 0 && <Podium entries={done.result.podium} />}
            <span className="kind">{event.name}</span>
            <h2>
              {event.kind === "ghost" ? (done.result.ghostWon ? "Squeek won" : "You beat Squeek!") : event.kind === "race" || event.kind === "round" ? `${ordinal(done.result.place)} place` : event.kind === "trial" ? fmtTime(done.result.time) : `${done.result.seeds} seeds`}
            </h2>
            <div className="bigStars">
              <Stars n={done.stars} />
            </div>
            <ul className="resultList">
              {event.kind !== "rush" && <li>Time {fmtTime(done.result.time)}</li>}
              {done.result.bestLap !== null && <li>Best lap {fmtTime(done.result.bestLap)}</li>}
              {event.kind !== "rush" && <li>Seeds picked up {done.result.seeds}</li>}
              {event.kind === "race" && <li>Times you got hit {done.result.hits}</li>}
              {done.newBest && <li className="good">New personal best</li>}
              {event.kind === "ghost" && <li>Squeek averaged {Math.round(done.result.ghostAvg * 3.6)} km/h from the real wheel{done.result.ghostAvg < 20 && !done.result.ghostWon ? ". Beat an awake Squeek for 3 stars" : ""}</li>}
              {done.result.prediction && (
                <li className={done.result.prediction.correct ? "good" : ""}>
                  {done.result.prediction.correct === null
                    ? "Chain data was missing, so the prediction did not count"
                    : `${done.result.prediction.end && done.result.prediction.start && done.result.prediction.end.height > done.result.prediction.start.height ? `Block ${done.result.prediction.end.height} finished before you` : "The block was not finished yet"}. Prediction ${done.result.prediction.correct ? `correct: +${done.predicted} seeds` : "wrong"}`}
                </li>
              )}
            </ul>
            <p className="earned">
              +{done.seeds} seeds{done.bonus && <span className="bonus"> including the 25% running-hamster bonus</span>}
            </p>
            <div className="menu">
              {onNext && (
                <button className="primary" onClick={onNext} autoFocus>
                  Next event
                </button>
              )}
              <button className={onNext ? "" : "primary"} onClick={restart} autoFocus={!onNext}>
                Race again
              </button>
              <button onClick={onQuit}>Back to the map</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
