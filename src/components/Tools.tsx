import { useState } from "react";
import { dreamGain, fmt, type Save } from "../core/economy";
import { makeShareCard } from "../core/shareCard";

interface Props {
  save: Save;
  onHibernate: () => void;
  onReset: () => void;
}

export function Tools({ save, onHibernate, onReset }: Props) {
  const [confirm, setConfirm] = useState<"hibernate" | "reset" | null>(null);
  const [busy, setBusy] = useState(false);
  const gain = dreamGain(save);
  const text = `My Squeek Burrow has ${fmt(save.allTime)} seeds, and it only grows fast while the real Squeekchain hamster runs.`;
  const tweet = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.origin)}`;

  const share = async () => {
    setBusy(true);
    try {
      const blob = await makeShareCard(save, location.host);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "squeek-burrow.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tools">
      <div className="wrap toolGrid">
        <div className="tool">
          <h3>Hibernate</h3>
          <p>
            Start a new burrow and keep a permanent +10% production for every dream seed. You would earn <strong>{gain}</strong> now
            {gain < 1 ? " (reach 50,000 seeds in a single run to earn your first)." : "."}
          </p>
          {confirm === "hibernate" ? (
            <div className="row">
              <button
                className="solid"
                onClick={() => {
                  onHibernate();
                  setConfirm(null);
                }}
              >
                Yes, hibernate
              </button>
              <button onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          ) : (
            <button className="solid" disabled={gain < 1} onClick={() => setConfirm("hibernate")}>
              Hibernate
            </button>
          )}
        </div>

        <div className="tool">
          <h3>Share your burrow</h3>
          <p>Download a picture of your progress to post anywhere.</p>
          <div className="row">
            <button className="solid" onClick={share} disabled={busy}>
              {busy ? "Drawing" : "Download share card"}
            </button>
            <a className="btnLink" href={tweet} target="_blank" rel="noopener noreferrer">
              Post on X
            </a>
          </div>
        </div>

        <div className="tool">
          <h3>Start over</h3>
          <p>Wipe this browser's save, including dream seeds. This can't be undone.</p>
          {confirm === "reset" ? (
            <div className="row">
              <button
                className="danger"
                onClick={() => {
                  onReset();
                  setConfirm(null);
                }}
              >
                Yes, wipe it
              </button>
              <button onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirm("reset")}>Reset save</button>
          )}
        </div>
      </div>
    </section>
  );
}
