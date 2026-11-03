import { ACHIEVEMENTS } from "../core/achievements";
import type { Save } from "../core/economy";

export function Achievements({ save }: { save: Save }) {
  const done = ACHIEVEMENTS.filter((a) => save.ach.includes(a.id)).length;
  return (
    <section className="trophies">
      <div className="wrap">
        <h2>Achievements</h2>
        <p className="trophySub">
          {done} of {ACHIEVEMENTS.length} unlocked. Each one adds 1% to all production.
        </p>
        <ul className="trophyGrid">
          {ACHIEVEMENTS.map((a) => {
            const got = save.ach.includes(a.id);
            return (
              <li key={a.id} className={got ? "got" : ""}>
                <strong>{got ? a.name : "Locked"}</strong>
                <span>{a.desc}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
