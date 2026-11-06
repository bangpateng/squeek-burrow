import { useThumb } from "../web3/thumb";
import type { WheelState } from "../core/feed";
import type { Character } from "../game/data";
import type { GameSave } from "../game/save";
import { totalStars } from "../game/save";
import type { Roster } from "../web3/useRoster";
import { Footer, Seeds } from "./Common";
import { WalletButton } from "./WalletButton";

interface Props {
  save: GameSave | null;
  wheel: WheelState;
  fever: boolean;
  roster: Roster;
  racer: Character;
  onPlay: () => void;
  onNew: () => void;
  onGarage: () => void;
  onSettings: () => void;
  onHelp: () => void;
}

const MODES = [
  { img: "/media/wheel.jpg", pos: "50% 75%", tag: "LIVE DUEL", tone: "amber", title: "RACE THE HAMSTER", text: "A ghost of Squeek drives as fast as the real hamster runs." },
  { img: "/media/kitchen.jpg", pos: "center", tag: "ON-CHAIN", tone: "cyan", title: "ROUND CUP", text: "Call the next block. The chain decides. Double your seeds." },
  { img: "/media/night.jpg", pos: "center", tag: "ADVENTURE", tone: "white", title: "GRAND PRIX", text: "Three worlds, five rivals, item boxes and weapons." },
  { img: "/media/garage.jpg", pos: "30% center", tag: "NFT HOLDERS", tone: "lime", title: "YOUR SQUEEKS", text: "Every racer is a Genesis Squeek. Bring your own, even staked." },
];

function LiveCard({ wheel, fever }: { wheel: WheelState; fever: boolean }) {
  const c = wheel.chain;
  const status = wheel.source === "offline" ? "OFFLINE" : fever ? "SQUEEK FEVER" : wheel.running ? "RUNNING" : "NAPPING";
  return (
    <aside className="liveCard" aria-label="Live from the wheel">
      <span className={`liveHead ${wheel.source}`}>
        <i />
        {wheel.source === "demo" ? "DEMO WHEEL" : "LIVE FROM THE WHEEL"}
      </span>
      <div className="liveBig">
        <strong>{wheel.running ? Math.round(wheel.rpm) : 0}</strong>
        <span>RPM · {status}</span>
      </div>
      {c ? (
        <>
          <div className="liveRow">
            <span>Building block {(c.height + 1).toLocaleString("en-US")}</span>
            <span>{Math.round(c.progress * 100)}%</span>
          </div>
          <div className="liveBar">
            <b style={{ width: `${Math.round(c.progress * 100)}%` }} />
          </div>
          <div className="liveRow split">
            <span>Settled round</span>
            <b>{c.round.toLocaleString("en-US")}</b>
          </div>
        </>
      ) : (
        <div className="liveRow">Chain data unavailable</div>
      )}
    </aside>
  );
}

export function Title({ save, wheel, fever, roster, racer, onPlay, onNew, onGarage, onSettings, onHelp }: Props) {
  const show = roster.mine.length ? roster.mine : roster.guests;
  return (
    <div className="screen launcher">
      <section className="hero">
        <img className="heroImg" src="/media/hero.jpg" alt="Six hamster karts lined up on the night start grid" />
        <div className="heroShade" />
        <header className="lnav">
          <span className="brand">
            SQUEEK<b>/</b>BURROW
          </span>
          <nav className="lnavLinks">
            <button onClick={onPlay}>PLAY</button>
            <button onClick={onGarage}>GARAGE</button>
            <button onClick={onHelp}>HOW TO PLAY</button>
            <button onClick={onSettings}>SETTINGS</button>
          </nav>
          <div className="lnavRight">
            <span className={`wheelPill ${wheel.source}${wheel.running ? " on" : ""}`}>
              <i />
              {wheel.source === "offline" ? "Wheel offline" : wheel.running ? `Wheel live · ${Math.round(wheel.rpm)} rpm` : "Squeek is napping"}
            </span>
            <WalletButton />
          </div>
        </header>

        <div className="heroBody">
          <div className="heroText">
            <div className="tags">
              <span className="t amber">3D KART RACING</span>
              <span className="t cyan">LIVE ON SQUEEKCHAIN</span>
              <span className="t">FREE TO PLAY</span>
            </div>
            <h1 className="mega">
              Squeek
              <br />
              <span>Burrow</span>
            </h1>
            <p className="tagline">Race Genesis Squeeks powered by the real Squeekchain wheel. When Squeek runs, your turbo burns hotter.</p>
            <div className="ctaRow">
              <button className="cta" onClick={onPlay} autoFocus>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 4.5v15l12.5-7.5z" />
                </svg>
                {save ? "CONTINUE" : "PLAY NOW"}
              </button>
              <button className="cta2" onClick={onGarage}>
                RACE WITH MY SQUEEK
              </button>
            </div>
            <span className="fine">
              {save ? (
                <>
                  {totalStars(save)} stars · <Seeds n={save.seeds} /> · Racing as {racer.name} ·{" "}
                  <button className="linkBtn" onClick={onNew}>
                    New game
                  </button>
                </>
              ) : (
                "No wallet needed to play · Wallet connection is read-only"
              )}
            </span>
          </div>
          <LiveCard wheel={wheel} fever={fever} />
        </div>
      </section>

      <main className="lmain">
        <section className="lsec">
          <div className="lsecHead">
            <h2>GAME MODES</h2>
            <span>Every mode reads the live wheel</span>
          </div>
          <div className="tiles">
            {MODES.map((m) => (
              <button key={m.title} className="tile" onClick={m.tag === "NFT HOLDERS" ? onGarage : onPlay}>
                <img src={m.img} alt="" style={{ objectPosition: m.pos }} />
                <span className="tileShade" />
                <span className="tileBody">
                  <span className={`chipTag ${m.tone}`}>{m.tag}</span>
                  <strong>{m.title}</strong>
                  <span>{m.text}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="nftBand">
          <div className="nftArt">
            <img src="/media/garage.jpg" alt="A Squeek in its kart in the garage" />
          </div>
          <div className="nftText">
            <span className="kicker">FOR GENESIS SQUEEK HOLDERS</span>
            <h2>
              YOUR SQUEEK.
              <br />
              YOUR RACER.
            </h2>
            <p>
              Connect your wallet and every Squeek you hold or have staked joins your garage, with its colours taken from its on-chain art. No unstaking, no approvals:
              your SQK keeps flowing while you race. No Squeek yet? Race today's guest Squeeks from the collection.
            </p>
            <div className="nftStrip">
              {roster.poolStatus === "loading" && !show.length
                ? Array.from({ length: 6 }, (_, i) => <span key={i} className="nftThumb skeleton" />)
                : show.slice(0, 6).map((c) => (
                    <span key={c.id} className="nftThumb" title={c.name}>
                      {c.image ? <StripArt src={c.image} alt={c.name} /> : <i style={{ background: `#${c.kart.toString(16).padStart(6, "0")}` }} />}
                      <b>{c.tokenId ? `#${c.tokenId}` : c.name}</b>
                    </span>
                  ))}
            </div>
            <div className="ctaRow">
              <button className="cta small" onClick={onGarage}>
                OPEN THE GARAGE
              </button>
              {!roster.address && <WalletButton />}
            </div>
          </div>
        </section>

        <section className="lsec">
          <div className="lsecHead">
            <h2>MEDIA</h2>
          </div>
          <div className="media">
            <img src="/media/wheel-side.jpg" alt="Squeek boosting past the giant wheel in the stadium" />
            <img src="/media/night.jpg" alt="Night race in the Deep Burrow" />
            <img src="/media/kitchen.jpg" alt="The Kitchen Counter track" />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function StripArt({ src, alt }: { src: string; alt: string }) {
  const url = useThumb(src, 192);
  return url ? <img src={url} alt={alt} /> : null;
}
