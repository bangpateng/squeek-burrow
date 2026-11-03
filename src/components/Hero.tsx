import { useState } from "react";
import { fmt, forageGain, perSecond, type Save } from "../core/economy";
import type { WheelState } from "../core/feed";
import type { AudioSettings } from "../core/sfx";
import { CLOUD, CLOUD_PAL, HAM, SEED, SEED_PAL, SIT } from "../core/sprites";
import { GoldenSeed } from "./GoldenSeed";
import { SoundMenu } from "./SoundMenu";
import { RunSprite, Sprite } from "./Sprite";

interface Props {
  wheel: WheelState;
  fever: boolean;
  feverLeft: number;
  save: Save;
  mult: number;
  audio: AudioSettings;
  onAudio: (patch: Partial<AudioSettings>) => void;
  onForage: () => void;
  onGolden: () => void;
}

const NOTE: Record<WheelState["source"], string> = {
  live: "Live from the Squeekchain hamster",
  demo: "Demo wheel, not live data",
  offline: "Can't reach the live wheel. Retrying.",
};

export function Hero({ wheel, fever, feverLeft, save, mult, audio, onAudio, onForage, onGolden }: Props) {
  const [pop, setPop] = useState(0);
  const rate = perSecond(save, mult);
  const gain = forageGain(save);
  const spin = wheel.running ? Math.min(6, Math.max(0.8, 60 / Math.max(wheel.rpm, 10))) : 6;
  const status = wheel.running ? (wheel.rpm > 0 ? `Hamster running, ${Math.round(wheel.rpm)} rpm` : "Hamster running") : "Hamster napping";
  const napping = !wheel.running && wheel.source !== "offline";

  return (
    <section className={`sky${napping ? " nap" : ""}${fever ? " fever" : ""}`}>
      <div className="cloud c1"><Sprite rows={CLOUD} palette={CLOUD_PAL} px={10} /></div>
      <div className="cloud c2"><Sprite rows={CLOUD} palette={CLOUD_PAL} px={7} /></div>
      <GoldenSeed onCatch={onGolden} />

      <div className="wrap">
        <header className="bar">
          <div className="logo">
            <Sprite rows={SIT} palette={HAM} px={2} />
            <span>Squeek Burrow</span>
          </div>
          <div className="barRight">
            <div className={`live ${wheel.source}`}>
              <span className="dot" />
              <span>{NOTE[wheel.source]}</span>
            </div>
            <SoundMenu settings={audio} onChange={onAudio} />
          </div>
        </header>

        <div className="heroGrid">
          <div className="heroText">
            <h1>Your burrow runs on the real hamster.</h1>
            <p className="lead">
              While the Squeekchain hamster is on the wheel, every chamber works at triple speed. When it naps, your burrow slows to a crawl.
            </p>

            <div className="hud">
              <div className="stat big">
                <span className="lbl">Seeds</span>
                <strong>{fmt(save.seeds)}</strong>
                <span className="sub">+{rate >= 100 ? fmt(rate) : rate.toFixed(1)} per second</span>
              </div>
              <div className={`stat power${fever ? " hot" : ""}`}>
                <span className="lbl">Wheel power</span>
                <strong>x{Math.round(mult * 10) / 10}</strong>
                <span className="sub">{fever ? `Squeek fever, ${feverLeft}s left` : status}</span>
              </div>
            </div>

            <div className="forageRow">
              <button
                className="forage"
                onClick={() => {
                  onForage();
                  setPop((p) => p + 1);
                }}
              >
                <Sprite rows={SEED} palette={SEED_PAL} px={3} />
                Forage +{fmt(gain)}
              </button>
              {pop > 0 && (
                <span key={pop} className="pop" aria-hidden="true">
                  +{fmt(gain)}
                </span>
              )}
              <span className="tip">Or press space</span>
            </div>
          </div>

          <div className="wheelWrap">
            <svg className={`wheel${wheel.running ? "" : " idle"}`} style={{ animationDuration: `${spin}s` }} viewBox="0 0 320 320" aria-hidden="true">
              <circle className="rim" cx="160" cy="160" r="146" fill="#ffffff" fillOpacity="0.28" stroke="#2a1a1e" strokeWidth="10" />
              {[0, 30, 60, 90, 120, 150].map((a) => (
                <line key={a} x1="160" y1="20" x2="160" y2="300" stroke="#2a1a1e" strokeWidth="4" transform={`rotate(${a} 160 160)`} />
              ))}
              <circle cx="160" cy="160" r="12" fill="#2a1a1e" />
            </svg>
            <div className="runner">
              <RunSprite running={wheel.running} px={9} label="The hamster on the wheel" />
            </div>
            {napping && (
              <span className="zzz" aria-hidden="true">
                z z z
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="grass" />
    </section>
  );
}
