import { useState } from "react";
import type { WheelState } from "../core/feed";
import { EVENTS, REGION_GATE, RUSH_SECONDS, TRACKS, TRACK_ORDER, type EventDef, type TrackId } from "../game/data";
import { regionOpen, regionStars, totalStars, type GameSave } from "../game/save";
import { fmtTime, ordinal } from "../game/race";
import { Footer, LivePill, Seeds, Stars, TopBar } from "./Common";

const KIND: Record<EventDef["kind"], string> = { race: "Grand Prix", trial: "Time trial", rush: "Seed rush" };
const ART: Record<TrackId, string> = { meadow: "🌻", kitchen: "🧀", burrow: "🍄" };

function goal(e: EventDef): string {
  if (e.kind === "race") return `${e.laps} laps against ${e.rivals} rivals. 1st place for 3 stars, top 3 for 1 star.`;
  if (e.kind === "trial") return `${e.laps} laps alone. Beat ${fmtTime(e.stars[2])} for 3 stars, ${fmtTime(e.stars[0])} for 1 star.`;
  return `Grab seeds for ${RUSH_SECONDS} seconds. ${e.stars[2]} seeds for 3 stars, ${e.stars[0]} for 1 star.`;
}

function best(e: EventDef, v: number | null | undefined): string {
  if (v === null || v === undefined) return "Not raced yet";
  if (e.kind === "race") return `Best: ${ordinal(v)}`;
  if (e.kind === "trial") return `Best: ${fmtTime(v)}`;
  return `Best: ${v} seeds`;
}

export function MapScreen({ save, wheel, fever, onBack, onGarage, onStart }: { save: GameSave; wheel: WheelState; fever: boolean; onBack: () => void; onGarage: () => void; onStart: (e: EventDef) => void }) {
  const [region, setRegion] = useState<TrackId>(save.lastTrack);
  const [pick, setPick] = useState<EventDef | null>(null);
  const t = TRACKS[region];
  return (
    <div className={`screen map theme-${region}`}>
      <TopBar title="Adventure" onBack={onBack}>
        <span className="chip">
          <Stars n={1} max={1} /> {totalStars(save)}
        </span>
        <span className="chip">
          <Seeds n={save.seeds} />
        </span>
        <button className="ghost" onClick={onGarage}>
          Garage
        </button>
      </TopBar>
      <div className="mapBody">
        <ol className="regions">
          {TRACK_ORDER.map((id, i) => {
            const open = regionOpen(save, id);
            return (
              <li key={id}>
                {i > 0 && <span className={`trail${open ? " open" : ""}`} aria-hidden="true" />}
                <button className={`region${region === id ? " on" : ""}${open ? "" : " locked"}`} onClick={() => open && setRegion(id)} aria-pressed={region === id} disabled={!open}>
                  <span className="regionArt" aria-hidden="true">
                    {open ? ART[id] : "🔒"}
                  </span>
                  <span className="regionName">{TRACKS[id].region}</span>
                  <span className="regionSub">
                    {open ? (
                      <>
                        <Stars n={regionStars(save, id)} max={9} />
                        <span className="short">★ {regionStars(save, id)}/9</span>
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
            <p className="trackLine">
              {TRACKS[pick.track].name}, {TRACKS[pick.track].region}
            </p>
            <p>{goal(pick)}</p>
            <p className="muted">3 stars pays up to {pick.reward} seeds. Repeat runs pay a little.</p>
            <div className="sheetBtns">
              <button className="ghost" onClick={() => setPick(null)}>
                Cancel
              </button>
              <button className="primary" onClick={() => onStart(pick)} autoFocus>
                Start
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
