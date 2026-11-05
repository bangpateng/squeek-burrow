import { useState } from "react";
import { loadAudio, setAudio, type AudioSettings } from "../game/audio";
import type { Prefs } from "../game/prefs";
import { ITEMS } from "../game/items";
import { TopBar } from "./Common";

export function SoundControls() {
  const [a, setA] = useState<AudioSettings>(loadAudio);
  const up = (p: Partial<AudioSettings>) => {
    const n = { ...a, ...p };
    setA(n);
    setAudio(n);
  };
  return (
    <div className="toggles">
      <label>
        <input type="checkbox" checked={a.music} onChange={(e) => up({ music: e.target.checked })} /> Music
      </label>
      <label>
        <input type="checkbox" checked={a.fx} onChange={(e) => up({ fx: e.target.checked })} /> Sound effects
      </label>
      <label>
        <input type="checkbox" checked={a.engine} onChange={(e) => up({ engine: e.target.checked })} /> Engine, tyres and wind
      </label>
      <label>
        <input type="checkbox" checked={a.ambience} onChange={(e) => up({ ambience: e.target.checked })} /> Ambience (birds, drips)
      </label>
      <label className="vol">
        Volume
        <input type="range" min="0" max="100" value={Math.round(a.volume * 100)} onChange={(e) => up({ volume: Number(e.target.value) / 100 })} />
      </label>
    </div>
  );
}

export function Settings({ prefs, onPrefs, onBack, onReset, hasSave }: { prefs: Prefs; onPrefs: (p: Prefs) => void; onBack: () => void; onReset: () => void; hasSave: boolean }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen settings">
      <TopBar title="Settings" onBack={onBack} />
      <div className="cols">
        <section className="card">
          <h2>Sound</h2>
          <SoundControls />
        </section>
        <section className="card">
          <h2>Graphics</h2>
          <div className="seg" role="group" aria-label="Graphics quality">
            {(["high", "low"] as const).map((q) => (
              <button key={q} className={prefs.quality === q ? "on" : ""} aria-pressed={prefs.quality === q} onClick={() => onPrefs({ ...prefs, quality: q })}>
                {q === "high" ? "High (shadows)" : "Fast (phones)"}
              </button>
            ))}
          </div>
          <h2>Touch controls</h2>
          <label className="check">
            <input type="checkbox" checked={prefs.autoGas} onChange={(e) => onPrefs({ ...prefs, autoGas: e.target.checked })} /> Accelerate automatically
          </label>
        </section>
        <section className="card">
          <h2>Progress</h2>
          <p>Your progress is saved in this browser only.</p>
          {!confirm ? (
            <button className="danger" onClick={() => setConfirm(true)} disabled={!hasSave}>
              Delete progress
            </button>
          ) : (
            <div className="row">
              <button className="danger" onClick={onReset}>
                Yes, delete everything
              </button>
              <button className="ghost" onClick={() => setConfirm(false)}>
                Keep it
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function Help({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen settings">
      <TopBar title="How to play" onBack={onBack} />
      <div className="cols">
        <section className="card">
          <h2>The adventure</h2>
          <p>Three regions, three events each: a Grand Prix against five rivals, a time trial and a seed rush. Stars open the next region. Seeds buy new hamsters and kart upgrades in the garage.</p>
          <h2>The real hamster</h2>
          <p>
            The game reads the live Squeekchain hamster wheel. While it runs, your turbo tank fills twice as fast and you earn 25% more seeds. When it hits a milestone or a speed record, Squeek fever fills your tank instantly.
          </p>
          <h2>Squeek's Wheel</h2>
          <p>
            Race the Hamster pits you against a ghost of Squeek that drives exactly as fast as the real hamster is running right now. In the Round Cup you predict whether the next Squeekchain block is finished before you cross the line; the real chain decides, and a correct call doubles your seeds.
          </p>
        </section>
        <section className="card">
          <h2>Keyboard</h2>
          <dl className="keys">
            <dt>W or ↑</dt>
            <dd>Accelerate</dd>
            <dt>S or ↓</dt>
            <dd>Brake and reverse</dd>
            <dt>A D or ← →</dt>
            <dd>Steer</dd>
            <dt>Space or Shift</dt>
            <dd>Hold while turning to drift</dd>
            <dt>E or X</dt>
            <dd>Use one turbo bar</dd>
            <dt>Q or F</dt>
            <dd>Use your item. Hold S as well to throw it backwards</dd>
            <dt>Esc or P</dt>
            <dd>Pause</dd>
          </dl>
          <p className="muted">Gamepads work too: right trigger to go, left trigger to brake, bumpers to drift, B to turbo, X or Y for items.</p>
        </section>
        <section className="card">
          <h2>Item boxes</h2>
          <p>In every Grand Prix, drive through the rainbow ? boxes to get an item. Racers at the back get the strongest ones.</p>
          <ul className="itemList">
            {Object.values(ITEMS).map((i) => (
              <li key={i.id}>
                <span>{i.icon}</span>
                <div>
                  <strong>{i.name}</strong>
                  <p>{i.blurb}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>Drift boosts</h2>
          <p>Hold drift through a corner. Sparks turn blue, then orange. Let go for a mini-turbo: the longer the drift, the bigger the boost. Orange arrow pads on the road give a free boost.</p>
        </section>
      </div>
    </div>
  );
}
