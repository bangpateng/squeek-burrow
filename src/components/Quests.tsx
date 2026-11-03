import { fmt } from "../core/economy";
import { GOAL_UNITS, goalProgress, goalReward, predictionMult, predictionReward } from "../core/quests";
import type { WheelState } from "../core/feed";
import type { useQuests } from "../hooks/useQuests";

type Q = ReturnType<typeof useQuests>;

function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Quests({ wheel, quests }: { wheel: WheelState; quests: Q }) {
  const { q, now, live, last, guess, perSec } = quests;
  const units = wheel.workUnits;
  const gp = units === null ? null : goalProgress(units);
  const p = q.pending;

  return (
    <section className="quests">
      <div className="wrap">
        <h2>Wheel quests</h2>
        <p className="questSub">Both quests read the real hamster, so they only run on live data.</p>
        <div className="questGrid">
          <article className="quest">
            <h3>Community goal</h3>
            <p>
              Everyone watching the same wheel shares one goal: every {GOAL_UNITS} work units on the wheel counter. When it is reached while you are here,
              you get {fmt(goalReward(perSec))} seeds.
            </p>
            {live && gp ? (
              <>
                <div className="bar2" role="progressbar" aria-valuemin={0} aria-valuemax={GOAL_UNITS} aria-valuenow={Math.floor(gp.into)} aria-label="Progress to the next community goal">
                  <span style={{ width: `${Math.round(gp.pct * 100)}%` }} />
                </div>
                <div className="questMeta">
                  <span>{Math.floor(gp.remaining)} units to go</span>
                  <span>Goals reached by you: {q.goalsDone}</span>
                </div>
              </>
            ) : (
              <p className="questOff">Waiting for live wheel data.</p>
            )}
          </article>

          <article className="quest">
            <h3>Hamster forecast</h3>
            {!live ? (
              <p className="questOff">Needs the live wheel. Connect the API to play.</p>
            ) : p ? (
              <>
                <p>
                  You said the hamster will be <strong>{p.guess ? "running" : "napping"}</strong> in {mmss(p.resolveAt - now)}.
                </p>
                <div className="count">{now >= p.resolveAt ? "Checking the wheel" : mmss(p.resolveAt - now)}</div>
                <p className="questOff">Keep this page open. If you are away when time is up, the forecast is cancelled.</p>
              </>
            ) : (
              <>
                <p>
                  Right now the hamster is {wheel.running ? "running" : "napping"}. What will it be doing in 5 minutes?
                </p>
                <div className="guessRow">
                  {[true, false].map((g) => (
                    <button key={String(g)} className="guess" onClick={() => guess(g)}>
                      <strong>{g ? "Running" : "Napping"}</strong>
                      <span>
                        +{fmt(predictionReward(perSec, q.streak, wheel.running, g))} seeds
                        {predictionMult(wheel.running, g) === 2 ? ", change bonus" : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {last && (
              <p className={`result ${last.outcome}`} role="status">
                {last.outcome === "win" && `Correct. +${fmt(last.seeds)} seeds.`}
                {last.outcome === "loss" && "Wrong this time. The streak resets."}
                {last.outcome === "void" && "Cancelled, because you were away when time was up."}
              </p>
            )}
            <div className="questMeta">
              <span>
                Won {q.wins}, lost {q.losses}
              </span>
              <span>
                Streak {q.streak} (best {q.best})
              </span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
