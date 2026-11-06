import { useState } from "react";
import type { WheelState } from "../core/feed";
import { EVENTS, REGION_GATE, RUSH_SECONDS, TRACKS, TRACK_ORDER, ghostSpeed, roundTrack, type EventDef, type TrackId } from "../game/data";
import { regionOpen, regionStars, totalStars, type GameSave } from "../game/save";
import { fmtTime, ordinal } from "../game/race";
import { Footer, LivePill, Seeds, Stars, TopBar } from "./Common";
import { MapDiorama } from "./MapDiorama";
import { WalletButton } from "./WalletButton";

const KIND: Record<EventDef["kind"], string> = { race: "Grand Prix", trial: "Time trial", rush: "Seed rush", ghost: "Live duel", round: "On-chain cup" };
const ART: Record<TrackId, string> = { wheel: "🎡", meadow: "🌻", kitchen: "🧀", burrow: "🍄" };

function goal(e: EventDef): string {
  if (e.kind === "ghost") return `${e.laps} laps against a ghost of Squeek whose speed comes straight from the real hamster wheel. Finish for 1 star, beat Squeek for 2, beat Squeek while the hamster is awake and fast for 3.`;
  if (e.kind === "round") return `A ${e.laps}-lap Grand Prix with items. Before the start you predict whether the next Squeekchain block is finished before you cross the line. Call it right and your seeds are doubled. The track changes with every settled round.`;
  if (e.kind === "race") return `${e.laps} laps against ${e.rivals} rivals. 1st place for 3 stars, top 3 for 1 star.`;
  if (e.kind === "trial") return `${e.laps} laps alone. Beat ${fmtTime(e.stars[2])} for 3 stars, ${fmtTime(e.stars[0])} for 1 star.`;
  return `Grab seeds for ${RUSH_SECONDS} seconds. ${e.stars[2]} seeds for 3 stars, ${e.stars[0]} for 1 star.`;
}

function best(e: EventDef, v: number | null | undefined): string {
  if (v === null || v === undefined) return "Not raced yet";
  if (e.kind === "ghost") return v >= 2 ? "You have beaten Squeek" : "Squeek is still unbeaten";
  if (e.kind === "race" || e.kind === "round") return `Best: ${ordinal(v)}`;
  if (e.kind === "trial") return `Best: ${fmtTime(v)}`;
  return `Best: ${v} seeds`;
}

export function MapScreen({ save, wheel, fever, onBack, onGarage, onStart }: { save: GameSave; wheel: WheelState; fever: boolean; onBack: () => void; onGarage: () => void; onStart: (e: EventDef, pick: "yes" | "no" | null) => void }) {
  const [region, setRegion] = useState<TrackId>(save.lastTrack);
  const [pick, setPick] = useState<EventDef | null>(null);
  const t = TRACKS[region];
  return (
    <div className={`screen map theme-${region}`}>
      <TopBar title="ADVENTURE" onBack={onBack}>
        <span className="chip">
          <Stars n={1} max={1} /> {totalStars(save)}
        </span>
        <span className="chip">
          <Seeds n={save.seeds} />
        </span>
        <button className="ghost" onClick={onGarage}>
          Garage
        </button>
        <WalletButton compact />
      </TopBar>
      <div className="mapBody">
        <div className="mapLeft">
        <MapDiorama
          selected={region}
          open={Object.fromEntries(TRACK_ORDER.map((id) => [id, regionOpen(save, id)])) as Record<TrackId, boolean>}
          rpm={wheel.rpm}
          running={wheel.running}
          onSelect={setRegion}
        />
        <ol className="regions">
          {TRACK_ORDER.map((id) => {
            const open = regionOpen(save, id);
            return (
              <li key={id}>
                <button className={`region${region === id ? " on" : ""}${open ? "" : " locked"}${id === "wheel" ? " special" : ""}`} onClick={() => open && setRegion(id)} aria-pressed={region === id} disabled={!open}>
                  <span className="regionArt" aria-hidden="true">
                    {open ? ART[id] : "🔒"}
                  </span>
                  <span className="regionName">{TRACKS[id].region}</span>
                  <span className="regionSub">
                    {open ? (
                      <>
                        <Stars n={regionStars(save, id)} max={EVENTS.filter((e) => e.track === id).length * 3} />
                        <span className="short">★ {regionStars(save, id)}/{EVENTS.filter((e) => e.track === id).length * 3}</span>
                      </>
                    ) : (
                      `Needs ${REGION_GATE[id]} stars`
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        </div>

        <section className="regionPanel">
          <div className="regionHead">
            <h2>{t.region}</h2>
            <p>
              {t.name}. {t.blurb}
            </p>
          </div>
          <div className="events">
            {EVENTS.filter((e) => e.track === region).map((e) => {
              const rec = save.records[e.id];
              return (
                <button key={e.id} className="eventCard" onClick={() => setPick(e)}>
                  <span className={`kind k-${e.kind}`}>{KIND[e.kind]}</span>
                  <strong>{e.name}</strong>
                  <Stars n={rec?.stars ?? 0} />
                  <span className="best">{best(e, rec?.best)}</span>
                </button>
              );
            })}
          </div>
          <LivePill wheel={wheel} fever={fever} />
          <p className="hint">While the real hamster runs, turbo charges twice as fast and you earn 25% more seeds.</p>
        </section>
      </div>

      {pick && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={pick.name} onClick={() => setPick(null)}>
          <div className="sheet" onClick={(ev) => ev.stopPropagation()}>
            <span className={`kind k-${pick.kind}`}>{KIND[pick.kind]}</span>
            <h2>{pick.name}</h2>
            <p className="trackLine">{pick.kind === "round" ? "The track changes with every settled round" : `${TRACKS[pick.track].name}, ${TRACKS[pick.track].region}`}</p>
            <p>{goal(pick)}</p>
            {pick.kind === "ghost" && (
              <div className="liveBox">
                <span>Squeek right now</span>
                <strong>{wheel.source === "offline" ? "Wheel offline" : wheel.running ? `Running at ${Math.round(wheel.rpm)} rpm` : "Napping"}</strong>
                <small>{wheel.running ? `Ghost top speed about ${Math.round(ghostSpeed(wheel.rpm, true) * 3.6)} km/h` : "A sleeping Squeek stays on the start line. Easy win, but only 2 stars."}</small>
              </div>
            )}
            {pick.kind === "round" && (
              <div className="liveBox">
                <span>Squeekchain right now</span>
                {wheel.chain ? (
                  <>
                    <strong>
                      Round {wheel.chain.round}, block {wheel.chain.height}
                    </strong>
                    <div className="chainBar">
                      <b style={{ width: `${Math.round(wheel.chain.progress * 100)}%` }} />
                    </div>
                    <small>
                      Next block {Math.round(wheel.chain.progress * 100)}% done. Hamster {wheel.running ? "running, so the block is moving" : "napping, so the block is frozen"}. This round races on {TRACKS[roundTrack(wheel.chain.round)].name}.
                    </small>
                  </>
                ) : (
                  <small>Chain data is not available right now, so the prediction will not count.</small>
                )}
              </div>
            )}
            <p className="muted">3 stars pays up to {pick.reward} seeds. Repeat runs pay a little.</p>
            {pick.kind === "round" ? (
              <>
                <p className="question">Will block {wheel.chain ? wheel.chain.height + 1 : "next"} be finished before you cross the line?</p>
                <div className="sheetBtns predict">
                  <button className="primary" onClick={() => onStart(pick, "yes")} autoFocus>
                    Yes, start
                  </button>
                  <button className="primary alt" onClick={() => onStart(pick, "no")}>
                    No, start
                  </button>
                </div>
                <button className="ghost" onClick={() => setPick(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <div className="sheetBtns">
                <button className="ghost" onClick={() => setPick(null)}>
                  Cancel
                </button>
                <button className="primary" onClick={() => onStart(pick, null)} autoFocus>
                  Start
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
