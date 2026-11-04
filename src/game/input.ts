// Keyboard, gamepad and on-screen touch controls merged into one Input.
import type { Input } from "./kart";

const keys = new Set<string>();
export const touch = { left: false, right: false, gas: false, brake: false, drift: false, turbo: false, item: false, auto: false };
let pausePressed = false;

const GAME_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "KeyE", "KeyX", "KeyZ", "KeyK", "KeyJ", "KeyQ", "KeyF", "KeyL", "ControlLeft"]);

export function attachKeys(): () => void {
  const down = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.code === "Escape" || e.code === "KeyP") pausePressed = true;
    keys.add(e.code);
  };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  const blur = () => keys.clear();
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
    keys.clear();
  };
}

let padPauseHeld = false;

export function readInput(): Input {
  const k = (c: string) => keys.has(c);
  let steer = (k("ArrowRight") || k("KeyD") || touch.right ? 1 : 0) - (k("ArrowLeft") || k("KeyA") || touch.left ? 1 : 0);
  let throttle = k("ArrowUp") || k("KeyW") || k("KeyK") || touch.gas || (touch.auto && !touch.brake) ? 1 : 0;
  let brake = k("ArrowDown") || k("KeyS") || k("KeyJ") || touch.brake ? 1 : 0;
  let drift = k("Space") || k("ShiftLeft") || k("KeyZ") || touch.drift;
  let turbo = k("KeyE") || k("KeyX") || k("ShiftRight") || touch.turbo;
  let item = k("KeyQ") || k("KeyF") || k("KeyL") || k("ControlLeft") || touch.item;

  const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp) continue;
    const ax = gp.axes[0] ?? 0;
    if (Math.abs(ax) > 0.15) steer = Math.max(-1, Math.min(1, ax));
    if (gp.buttons[14]?.pressed) steer = -1;
    if (gp.buttons[15]?.pressed) steer = 1;
    throttle = Math.max(throttle, gp.buttons[7]?.value ?? 0, gp.buttons[0]?.pressed ? 1 : 0);
    brake = Math.max(brake, gp.buttons[6]?.value ?? 0);
    drift = drift || !!gp.buttons[5]?.pressed || !!gp.buttons[4]?.pressed;
    turbo = turbo || !!gp.buttons[1]?.pressed;
    item = item || !!gp.buttons[2]?.pressed || !!gp.buttons[3]?.pressed;
    const p = !!gp.buttons[9]?.pressed;
    if (p && !padPauseHeld) pausePressed = true;
    padPauseHeld = p;
    break;
  }
  return { throttle, brake, steer, drift, turbo, item };
}

export function takePause(): boolean {
  const p = pausePressed;
  pausePressed = false;
  return p;
}

export function clearTouch() {
  for (const k of Object.keys(touch) as (keyof typeof touch)[]) if (k !== "auto") touch[k] = false;
}
