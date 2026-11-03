import { useEffect, useRef, useState } from "react";
import type { AudioSettings } from "../core/sfx";

interface Props {
  settings: AudioSettings;
  onChange: (patch: Partial<AudioSettings>) => void;
}

export function SoundMenu({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const anyOn = settings.fx || settings.ticks || settings.music;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div className="soundMenu" ref={box}>
      <button className="soundBtn" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9H4z" />
          {anyOn ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
        </svg>
        Sound
      </button>
      {open && (
        <div className="soundPanel" role="group" aria-label="Sound settings">
          <label>
            <input type="checkbox" checked={settings.fx} onChange={(e) => onChange({ fx: e.target.checked })} />
            Effects
          </label>
          <label>
            <input type="checkbox" checked={settings.ticks} onChange={(e) => onChange({ ticks: e.target.checked })} />
            Wheel ticks
          </label>
          <label>
            <input type="checkbox" checked={settings.music} onChange={(e) => onChange({ music: e.target.checked })} />
            Music
          </label>
          <label className="vol">
            Volume
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(settings.volume * 100)}
              onChange={(e) => onChange({ volume: Number(e.target.value) / 100 })}
              aria-label="Volume"
            />
          </label>
        </div>
      )}
    </div>
  );
}
