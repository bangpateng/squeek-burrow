# Squeek Burrow

An idle game for Squeekchain. You dig a burrow, collect seeds, and unlock chambers. The twist is the real hamster: while it runs on the wheel, every chamber works at triple speed. When it naps, production drops to a tenth.

Unofficial fan project, not affiliated with Squeekchain. All hamster art here is original pixel art made for this project.

## Run it

```bash
npm install
npm test
npm run dev
```

Open `/?demo` to force the demo wheel (a hamster that runs and naps on a loop).

## Live hamster data

The game reads `GET {VITE_SQUEEK_API_URL}/v1/status` every 3 seconds.

```bash
cp .env.example .env     # set VITE_SQUEEK_API_URL=https://api.squeekchain.com
```

- Running means `freshness` is `online` and speed or rpm is above zero. The real rpm (`rpmMilli`) sets how fast the wheel spins.
- Wheel power: x3 while running, x0.1 while napping.
- Squeek fever (x2 for 60 seconds, stacks with wheel power): the hamster crosses a 50 m mark of total distance, or beats the fastest speed seen during your visit.
- If the API can't be reached, the page says so and the wheel counts as napping.

The browser calls the API directly, so the API must allow cross-origin requests from your host. If it doesn't, add a `vercel.json` rewrite and set `VITE_SQUEEK_API_URL` to `/api`:

```json
{ "rewrites": [{ "source": "/api/:path*", "destination": "https://api.squeekchain.com/:path*" }] }
```

## How it plays

- Forage (button or space) gives seeds by hand. Cheek pouches make each forage bigger.
- Five chambers, each unlocked by buying the one before it. Costs grow 15% per purchase.
- Away time earns at base speed, up to 8 hours. The wheel bonus only applies while you watch.
- Hibernate after 50,000 seeds in one run: start over and keep +10% production per dream seed.
- Download a share card (PNG) of your progress.
- Progress is saved in your browser (localStorage). There is no wallet and no server.

## Structure

```
src/core/
  economy.ts     costs, production, offline gain, hibernate, save validation
  feed.ts        live and demo wheel feeds, fever detection
  sprites.ts     original pixel hamster maps
  shareCard.ts   canvas share image
src/hooks/       useGame (loop and saving), useWheel (feed and fever)
src/components/  Hero, Burrow, Tools, Footer, Sprite
```

## Ideas for later

- Use the `/v1/events` feed for fever triggers (needs the real event payload).
- Shared leaderboard (needs a small backend).
- Optional wallet sign-in to name leaderboard entries.

## Sound, achievements and extras

- **Sound**: everything is synthesized with the Web Audio API, so there are no audio files. Use the Sound button in the header to toggle Effects, Wheel ticks (a soft tick that follows the real wheel rpm) and Music (a small chiptune loop, off by default), and to set the volume. Settings are saved in localStorage. Browsers only allow audio after a first click or key press.
- **Achievements**: 13 of them, each adds +1% to all production.
- **Golden seed**: now and then a golden seed floats across the sky. Catch it for about 45 seconds of production. Add `?golden` to the URL to make one appear after 1.5 seconds when testing.
- **Buy amount**: buy chambers x1, x10 or Max.
- **Sleep and fever visuals**: the sky darkens with floating "z z z" when the hamster naps, and the wheel glows gold during Squeek fever.
- **Post on X**: share your seed count from the Tools section.

## Wheel quests (live data only)

- **Community goal**: every 250 units of the wheel's `cumulativeWorkUnits` counter is one goal. The counter comes from the same API for everyone, so all players watch the same progress with no server. If you are on the page when a goal is passed you get seeds. The first visit only sets a baseline, so old goals never pay out.
- **Hamster forecast**: guess whether the hamster will be running or napping in 5 minutes. A correct guess pays seeds, double if you called a change, plus a streak bonus up to 5. It is judged on the first live reading after the time is up. If you were away for more than 90 seconds past that, the forecast is cancelled with no win or loss.
- Both quests are paused on the demo wheel or when the API cannot be reached. Quest progress is stored in localStorage (`squeek-burrow-quests-v1`).
- The size of a work unit (how long a goal takes) is not documented by the API. If goals feel too fast or slow, change `GOAL_UNITS` in `src/core/quests.ts`.
