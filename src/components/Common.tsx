import type { ReactNode } from "react";
import type { WheelState } from "../core/feed";

export function Footer() {
  return (
    <footer className="foot">
      <span>UNOFFICIAL. NOT AFFILIATED WITH SQUEEKCHAIN.</span>
      <span className="footLinks">
        <a href="https://squeekchain.com/genesis/" target="_blank" rel="noopener noreferrer">
          Squeekchain Genesis
        </a>
        <a href="https://x.com/naxweb3" target="_blank" rel="noopener noreferrer">
          Built by @naxweb3
        </a>
      </span>
    </footer>
  );
}

const LABEL: Record<WheelState["source"], string> = {
  live: "Live Squeekchain hamster",
  demo: "Demo wheel, not live data",
  offline: "Can't reach the live wheel",
};

export function LivePill({ wheel, fever }: { wheel: WheelState; fever: boolean }) {
  const state = wheel.source === "offline" ? "" : fever ? "Squeek fever!" : wheel.running ? `running, ${Math.round(wheel.rpm)} rpm` : "napping";
  return (
    <div className={`live ${wheel.source}${wheel.running ? " on" : ""}${fever ? " fever" : ""}`}>
      <span className="dot" />
      <span>
        {LABEL[wheel.source]}
        {state && <b>: {state}</b>}
      </span>
    </div>
  );
}

export function Seeds({ n }: { n: number }) {
  return (
    <span className="seedCount">
      <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden="true">
        <ellipse cx="8" cy="10" rx="6.5" ry="9" fill="#ffc83d" stroke="#2a1a1e" strokeWidth="2" />
        <path d="M8 2v16" stroke="#6b4a12" strokeWidth="2" />
      </svg>
      {n.toLocaleString("en-US")}
    </span>
  );
}

export function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return (
    <span className="stars" aria-label={`${n} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className={i < n ? "got" : ""}>
          <path d="M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z" />
        </svg>
      ))}
    </span>
  );
}

export function TopBar({ title, onBack, children }: { title: string; onBack: () => void; children?: ReactNode }) {
  return (
    <header className="topBar">
      <button className="ghost" onClick={onBack}>
        ← Back
      </button>
      <h1>{title}</h1>
      <div className="topRight">{children}</div>
    </header>
  );
}

export function StatBar({ label, value, max = 5 }: { label: string; value: number; max?: number }) {
  return (
    <div className="statBar">
      <span>{label}</span>
      <div className="pips">
        {Array.from({ length: max }, (_, i) => (
          <i key={i} className={i < value ? "on" : ""} />
        ))}
      </div>
    </div>
  );
}
