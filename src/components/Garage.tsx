import { useState } from "react";
import { MAX_UPGRADE, UPGRADES, upgradeCost, type Character } from "../game/data";
import { canUpgrade, type GameSave } from "../game/save";
import type { Roster } from "../web3/useRoster";
import { Seeds, StatBar, TopBar } from "./Common";
import { Showroom } from "./Showroom";
import { WalletButton } from "./WalletButton";

interface Props {
  save: GameSave;
  roster: Roster;
  racer: Character;
  onBack: () => void;
  onSelect: (id: string) => void;
  onUpgrade: (id: (typeof UPGRADES)[number]["id"]) => void;
}

const hex = (c: number) => "#" + c.toString(16).padStart(6, "0");
const SOURCE: Record<string, string> = { wallet: "In wallet", staked: "Staked, still earning", guest: "Guest", classic: "Offline racer" };

function Card({ c, on, chosen, onPick }: { c: Character; on: boolean; chosen: boolean; onPick: () => void }) {
  return (
    <button className={`sqCard${on ? " on" : ""}`} onClick={onPick} aria-pressed={on}>
      <span className="sqArt" style={{ background: hex(c.kart) }}>
        {c.image ? <img src={c.image} alt="" loading="lazy" /> : null}
      </span>
      <span className="sqMeta">
        <b>{c.tokenId ? `#${c.tokenId}` : c.name}</b>
        {chosen ? <em className="badge race">RACING</em> : <em className={`badge ${c.source}`}>{c.source === "staked" ? "STAKED" : c.source === "wallet" ? "WALLET" : c.source === "guest" ? "GUEST" : "OFFLINE"}</em>}
      </span>
    </button>
  );
}

export function Garage({ save, roster, racer, onBack, onSelect, onUpgrade }: Props) {
  const [viewId, setViewId] = useState(racer.id);
  const view = roster.find(viewId) ?? racer;
  const traits = (view.traits ?? []).slice(0, 8);

  return (
    <div className="screen garage">
      <TopBar title="GARAGE" onBack={onBack}>
        <span className="chip">
          <Seeds n={save.seeds} />
        </span>
        <WalletButton compact />
      </TopBar>
      <div className="garageBody">
        <section className="card detail">
          <div className="detailArt">
            <div className="nftFrame" style={{ background: hex(view.kart) }}>
              {view.image ? <img src={view.image} alt={`${view.name} on-chain art`} /> : <span className="noArt">No on-chain art</span>}
            </div>
            <div className="stageFrame">
              <Showroom char={view} />
            </div>
          </div>
          <div className="detailHead">
            <h2>{view.name}</h2>
            <span className={`badge ${view.source}`}>{SOURCE[view.source ?? "classic"]}</span>
          </div>
          <StatBar label="Top speed" value={view.speed} />
          <StatBar label="Acceleration" value={view.accel} />
          <StatBar label="Handling" value={view.handling} />
          {traits.length > 0 && (
            <ul className="traits">
              {traits.map((t) => (
                <li key={t.trait_type}>
                  <span>{t.trait_type}</span>
                  <b>{String(t.value)}</b>
                </li>
              ))}
            </ul>
          )}
          {racer.id === view.id ? (
            <button className="cta wide" disabled>
              RACING WITH {view.tokenId ? `#${view.tokenId}` : view.name.toUpperCase()}
            </button>
          ) : (
            <button className="cta wide" onClick={() => onSelect(view.id)}>
              RACE WITH {view.tokenId ? `#${view.tokenId}` : view.name.toUpperCase()}
            </button>
          )}
        </section>

        <div className="garageSide">
          <section className="card">
            <div className="secHead">
              <h2>MY SQUEEKS</h2>
              {roster.mineStatus === "ready" && <span>{roster.mine.length} found</span>}
            </div>
            {!roster.address && (
              <div className="empty">
                <p>Connect your wallet to race with your own Genesis Squeeks. Staked ones count too. Read-only: no transactions, no approvals.</p>
                <WalletButton />
              </div>
            )}
            {roster.address && roster.mineStatus === "loading" && (
              <div className="sqGrid">
                {Array.from({ length: 3 }, (_, i) => (
                  <span key={i} className="sqCard skeleton" />
                ))}
                <p className="muted span">Reading your Squeeks from Sepolia. The first time can take up to a minute.</p>
              </div>
            )}
            {roster.address && roster.mineStatus === "error" && (
              <div className="empty">
                <p>Could not read your Squeeks right now. The public Sepolia RPC may be busy. Progress is saved, so Try again picks up where it stopped.</p>
                {roster.mineError && <p className="muted errLine">{roster.mineError}</p>}
                <button className="ghost" onClick={roster.refresh}>
                  Try again
                </button>
              </div>
            )}
            {roster.address && roster.mineStatus === "ready" && roster.mine.length === 0 && (
              <div className="empty">
                <p>No Genesis Squeeks found in this wallet or in staking. You can still race today's guests below.</p>
              </div>
            )}
            {roster.mine.length > 0 && (
              <div className="sqGrid">
                {roster.mine.map((c) => (
                  <Card key={c.id} c={c} on={c.id === view.id} chosen={c.id === racer.id} onPick={() => setViewId(c.id)} />
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="secHead">
              <h2>TODAY'S GUESTS</h2>
              <span>{roster.poolStatus === "error" ? "Offline racers" : "From the collection"}</span>
            </div>
            <div className="sqGrid">
              {roster.poolStatus === "loading" && !roster.guests.length
                ? Array.from({ length: 6 }, (_, i) => <span key={i} className="sqCard skeleton" />)
                : roster.guests.map((c) => <Card key={c.id} c={c} on={c.id === view.id} chosen={c.id === racer.id} onPick={() => setViewId(c.id)} />)}
            </div>
          </section>

          <section className="card">
            <h2>KART UPGRADES</h2>
            <p>Upgrades apply to every Squeek you race.</p>
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
