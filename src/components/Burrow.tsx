import {
  UPGRADES, buyCount, canBuy, cost, costBulk, dreamBonus, fmt, isUnlocked, level,
  type BuyMode, type Save, type Upgrade, type UpgradeId,
} from "../core/economy";
import { HAM, SEED, SEED_PAL, SILHOUETTE, SIT, SIT_SEED, SLEEP } from "../core/sprites";
import { RunSprite, Sprite } from "./Sprite";

interface Props {
  save: Save;
  running: boolean;
  away: number;
  mode: BuyMode;
  onMode: (m: BuyMode) => void;
  onBuy: (id: UpgradeId, n: number) => void;
  onClearAway: () => void;
}

function Art({ id, locked, running }: { id: UpgradeId; locked: boolean; running: boolean }) {
  if (locked) return <Sprite rows={SIT} palette={SILHOUETTE} px={6} />;
  switch (id) {
    case "farm":
      return <Sprite rows={SIT_SEED} palette={HAM} px={6} label="A hamster carrying a seed" />;
    case "tunnels":
      return <RunSprite running={running} px={7} label="A hamster running through a tunnel" />;
    case "spa":
      return <Sprite rows={SLEEP} palette={HAM} px={6} label="A hamster napping" />;
    default:
      return <Sprite rows={SIT} palette={HAM} px={6} label="A hamster sitting" />;
  }
}

function Room({ u, index, save, running, mode, onBuy }: { u: Upgrade; index: number; save: Save; running: boolean; mode: BuyMode; onBuy: (n: number) => void }) {
  const unlocked = isUnlocked(save, index);
  const owned = save.owned[u.id];
  const prev = UPGRADES[index - 1];
  const n = buyCount(save, u.id, mode);
  const count = Math.max(1, n);
  const price = costBulk(u.id, owned, count);
  const label = mode === 1 ? `Buy for ${fmt(cost(u.id, owned))}` : mode === "max" && n < 1 ? "Buy max" : `Buy ${count} for ${fmt(price)}`;
  return (
    <article className={`room${unlocked ? "" : " locked"}`}>
      <div className="roomArt">
        <Art id={u.id} locked={!unlocked} running={running} />
      </div>
      <div className="roomBody">
        <h3>{unlocked ? u.name : "Unknown chamber"}</h3>
        {unlocked ? (
          <>
            <p>{u.blurb}</p>
            <div className="roomMeta">
              <span>Owned {owned}</span>
              <span>+{u.rate} seeds per second each</span>
            </div>
            <button className="buy" onClick={() => onBuy(count)} disabled={!canBuy(save, u.id, count)}>
              {label}
              <Sprite rows={SEED} palette={SEED_PAL} px={2} />
            </button>
          </>
        ) : (
          <p>Buy {prev.name.toLowerCase()} to dig this chamber.</p>
        )}
      </div>
    </article>
  );
}

const MODES: { mode: BuyMode; label: string }[] = [
  { mode: 1, label: "x1" },
  { mode: 10, label: "x10" },
  { mode: "max", label: "Max" },
];

export function Burrow({ save, running, away, mode, onMode, onBuy, onClearAway }: Props) {
  return (
    <section className="soil">
      <div className="wrap">
        <div className="soilHead">
          <div>
            <h2>Your burrow</h2>
            <p>
              {level(save)} chambers dug. Dream bonus x{dreamBonus(save).toFixed(1)}.
            </p>
          </div>
          <div className="modes" role="group" aria-label="Buy amount">
            <span>Buy</span>
            {MODES.map((m) => (
              <button key={m.label} className={m.mode === mode ? "on" : ""} aria-pressed={m.mode === mode} onClick={() => onMode(m.mode)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {away >= 1 && (
          <div className="away" role="status">
            <span>
              While you were away your hamsters gathered <strong>{fmt(away)} seeds</strong>. They work at base speed when you are not watching.
            </span>
            <button onClick={onClearAway}>Nice</button>
          </div>
        )}

        <div className="rooms">
          {UPGRADES.map((u, i) => (
            <Room key={u.id} u={u} index={i} save={save} running={running} mode={mode} onBuy={(n) => onBuy(u.id, n)} />
          ))}
        </div>
      </div>
    </section>
  );
}
