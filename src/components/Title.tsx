import { CHARACTERS } from "../game/data";
import type { GameSave } from "../game/save";
import { totalStars } from "../game/save";
import type { WheelState } from "../core/feed";
import { Footer, LivePill, Seeds } from "./Common";
import { Showroom } from "./Showroom";

interface Props {
  save: GameSave | null;
  wheel: WheelState;
  fever: boolean;
  onContinue: () => void;
  onNew: () => void;
  onGarage: () => void;
  onSettings: () => void;
  onHelp: () => void;
}

export function Title({ save, wheel, fever, onContinue, onNew, onGarage, onSettings, onHelp }: Props) {
  const char = CHARACTERS.find((c) => c.id === save?.char) ?? CHARACTERS[0];
  return (
    <div className="screen title">
      <Showroom char={char} className="titleStage" />
      <div className="titlePanel">
        <LivePill wheel={wheel} fever={fever} />
        <h1 className="logo">
          Squeek
          <br />
          Burrow
        </h1>
        <p className="tag">A hamster kart adventure. When the real Squeekchain hamster runs, your turbo charges twice as fast.</p>
        <nav className="menu">
          {save ? (
            <>
              <button className="primary" onClick={onContinue} autoFocus>
                Continue
                <small>
                  {totalStars(save)} stars, <Seeds n={save.seeds} />
                </small>
              </button>
              <button onClick={onNew}>New game</button>
            </>
          ) : (
            <button className="primary" onClick={onNew} autoFocus>
              Play
              <small>Start the adventure</small>
            </button>
          )}
          <button onClick={onGarage} disabled={!save}>
            Garage
          </button>
          <button onClick={onHelp}>How to play</button>
          <button onClick={onSettings}>Settings</button>
        </nav>
      </div>
      <Footer />
    </div>
  );
}
