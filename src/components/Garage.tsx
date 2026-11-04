import { useState } from "react";
import { CHARACTERS, MAX_UPGRADE, UPGRADES, upgradeCost, type CharId } from "../game/data";
import { canUnlock, canUpgrade, type GameSave } from "../game/save";
import { Seeds, StatBar, TopBar } from "./Common";
import { Showroom } from "./Showroom";

interface Props {
  save: GameSave;
  onBack: () => void;
  onSelect: (id: CharId) => void;
  onUnlock: (id: CharId) => void;
  onUpgrade: (id: (typeof UPGRADES)[number]["id"]) => void;
}

export function Garage({ save, onBack, onSelect, onUnlock, onUpgrade }: Props) {
  const [view, setView] = useState<CharId>(save.char);
  const c = CHARACTERS.find((x) => x.id === view)!;
  const owned = save.owned.includes(view);
  const i = CHARACTERS.indexOf(c);
  const go = (d: number) => setView(CHARACTERS[(i + d + CHARACTERS.length) % CHARACTERS.length].id);

  return (
    <div className="screen garage">
      <TopBar title="Garage" onBack={onBack}>
        <span className="chip">
          <Seeds n={save.seeds} />
        </span>
      </TopBar>
      <div className="garageBody">
        <div className="garageStage">
          <Showroom char={c} />
          <div className="carousel">
            <button className="round" onClick={() => go(-1)} aria-label="Previous hamster">
              ‹
            </button>
            <div className="dots">
              {CHARACTERS.map((x) => (
                <i key={x.id} className={x.id === view ? "on" : ""} />
              ))}
            </div>
            <button className="round" onClick={() => go(1)} aria-label="Next hamster">
              ›
            </button>
          </div>
        </div>

        <div className="garageSide">
          <section className="card">
            <h2>{c.name}</h2>
            <p>{c.blurb}</p>
            <StatBar label="Top speed" value={c.speed} />
            <StatBar label="Acceleration" value={c.accel} />
            <StatBar label="Handling" value={c.handling} />
            {owned ? (
              save.char === view ? (
                <button className="primary wide" disabled>
                  Racing with {c.name}
                </button>
              ) : (
                <button className="primary wide" onClick={() => onSelect(view)}>
                  Race with {c.name}
                </button>
              )
            ) : (
              <button className="primary wide" onClick={() => onUnlock(view)} disabled={!canUnlock(save, view)}>
                Unlock for <Seeds n={c.cost} />
              </button>
            )}
          </section>

          <section className="card">
            <h2>Kart upgrades</h2>
            <p>Upgrades apply to every hamster.</p>
            <ul className="upgrades">
              {UPGRADES.map((u) => {
                const lvl = save.upgrades[u.id];
                const maxed = lvl >= MAX_UPGRADE;
                return (
                  <li key={u.id}>
                    <div>
                      <strong>{u.name}</strong>
                      <span>{u.blurb}</span>
                      <div className="pips small">
                        {Array.from({ length: MAX_UPGRADE }, (_, k) => (
                          <i key={k} className={k < lvl ? "on" : ""} />
                        ))}
                      </div>
                    </div>
                    <button onClick={() => onUpgrade(u.id)} disabled={maxed || !canUpgrade(save, u.id)}>
                      {maxed ? "Max" : <Seeds n={upgradeCost(u.id, lvl)} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
