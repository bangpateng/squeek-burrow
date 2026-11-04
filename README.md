# Squeek Burrow: hamster kart adventure

A 3D hamster kart racing game for Squeekchain, built with React, Three.js and Vite. All models, textures, music and sound effects are generated in code, so there are no asset files.

**Unofficial. Not affiliated with Squeekchain.** Built by [@naxweb3](https://x.com/naxweb3).

## How it uses Squeekchain

The game polls the public `GET /v1/status` endpoint of the Squeekchain hamster wheel every 3 seconds (`src/core/feed.ts`) and reads `measurement.freshness`, `rpmMilli`, `speedMmPerSecond` and `distanceMm`.

- While the real hamster is running, your turbo tank fills **twice as fast** and every event pays **25% more seeds**.
- When the hamster crosses a 50 m distance mark or beats its speed record, **Squeek fever** fills your turbo tank instantly mid-race.
- The live state is shown on the title screen, the map and in the race HUD.

Set `VITE_SQUEEK_API_URL=https://api.squeekchain.com` at build time. Without it the game uses a clearly labelled demo wheel.

## The game

- **Adventure map**: three regions (Sunflower Meadow, Kitchen Counter, The Deep Burrow), each with a Grand Prix against 5 AI rivals, a time trial and a 90-second seed rush. Stars open the next region (4 and 10 stars).
- **4 hamsters** with different speed, acceleration and handling. Unlock them with seeds.
- **Garage upgrades**: engine, tyres and turbo tank, 4 levels each.
- **Item boxes and weapons** (Grand Prix only): acorn shot that bounces off walls, homing cheese, pepper trap, seed bomb with an explosion radius, bubble shield and cheek rocket. Racers at the back get stronger items, and the AI rivals use items against you and each other. Hits spin you out; shields block one hit.
- **Effects**: explosions with fire, smoke and a shock ring, wall and kart-to-kart sparks, camera shake, red hit flash, speed lines on big boosts, drift smoke.
- **Sound**: all synthesised. A different song per track with drums, bass, arpeggio and lead (it speeds up on the final lap), a geared engine, tyre squeal, wind, offroad rumble, nearby rival engines, track ambience (birds, kitchen hum, cave drips) and sounds for every item, hit and explosion.
- **Driving**: drift through corners for blue and orange mini-turbos, boost pads, 3-bar turbo, seed pickups, minimap, positions, lap times.
- **Menus**: Play / Continue / New game, pause with resume and restart, results with stars, settings for music, effects, engine sound, volume and graphics quality. Progress saves in localStorage.
- **Controls**: keyboard (WASD or arrows, Space to drift, E to turbo, Q or F to use an item, hold S with Q to throw it back, Esc to pause), gamepads, and on-screen touch buttons on phones with optional auto-accelerate.

## Run it

```
npm install
npm test
npm run dev
```

Test helpers: add `?autopilot` to let the AI drive your kart and `?timescale=3` to speed up time.

squeekchain-project: 44d50f22-208e-4244-996f-d70152686fd5
