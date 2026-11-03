import { useEffect, useState } from "react";
import { applyAudioSettings, initAudio, loadAudioSettings, sfx, type AudioSettings } from "../core/sfx";

export function useAudio() {
  const [settings, setSettings] = useState<AudioSettings>(loadAudioSettings);

  useEffect(() => {
    applyAudioSettings(settings);
  }, [settings]);

  useEffect(() => {
    const unlock = () => initAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const update = (patch: Partial<AudioSettings>) => setSettings((s) => ({ ...s, ...patch }));
  return { settings, update };
}

// A soft tick for every turn of the wheel while the hamster runs.
export function useWheelTicks(running: boolean, rpm: number) {
  const r = Math.round(rpm);
  useEffect(() => {
    if (!running) return;
    const period = Math.min(2000, Math.max(500, r > 0 ? 60000 / r : 1500));
    let id = window.setTimeout(function loop() {
      sfx.tick();
      id = window.setTimeout(loop, period);
    }, period);
    return () => clearTimeout(id);
  }, [running, r]);
}
