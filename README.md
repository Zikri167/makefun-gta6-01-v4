# Neon Tide

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![make.fun rank](https://make.fun/badge/gta6-01/Zikri167/makefun-gta6-01-v4/rank.svg)](https://make.fun/bounty/gta6-01)
[![make.fun reward](https://make.fun/badge/gta6-01/Zikri167/makefun-gta6-01-v4/reward.svg)](https://make.fun/bounty/gta6-01)

**$1,666 prize pool, 100 prize places** — an entry in make.fun's
[Make GTA 6 bounty](https://make.fun/bounty/gta6-01).

Neon Tide is a complete open-world crime game that runs in a desktop browser
from this repository's static files — no build step, no server, no network.
Welcome to **Vesper Bay**, a neon coastal city of nine avenues, a working
harbour, and one fixer with four jobs for a driver who doesn't ask questions.

## The game

You are **Dario Kane**, a wheelman down on his luck. Fixer **Mona Reyes**
has work:

1. **First Run** — pick up a package at the docks, deliver it to the market.
2. **Borrowed Wheels** — steal a tangerine sports coupe off the harbour and
   deliver it to a garage across town.
3. **Three Drops** — collect three cash drops against the clock while the
   whole bay watches.
4. **Harbor Lights** — a dusk run to the lighthouse point, then home to
   Mona's desk in the game's one interior.

Everything the genre promises is wired together: a city to explore on foot
and by car, loop traffic and crowds, cars to steal and drive, a five-star
wanted system with patrol cars that hunt, ram and bust you, a punch, health,
busted/wasted respawns with fines, a HUD with a live minimap, a start screen
with a save you can continue, synthesized engine, siren and jingle audio,
and a day city that turns to neon dusk for the finale.

## Play it

Serve the folder and open it in a desktop browser:

```sh
node serve.ts          # http://localhost:8080
```

or open `game/index.html` through any static file server. Then:

| Keys | Action |
| --- | --- |
| W A S D | move / drive |
| Mouse (click to capture) | look |
| Shift | run on foot |
| E | enter / leave a car |
| F | punch |
| P | pause |

Progress saves in your browser after every finished job.

## How it is built

- `game/` — the whole game as static files: `index.html` plus ES modules in
  `game/src/`, one clear job each (city, vehicles, pedestrians, wanted,
  missions, interiors, hud, player, audio, lighting, save, input, random,
  shots). three.js is vendored, minified, under `game/vendor/`.
- `main.ts` — the make.fun entry program (Node 22, standard library only):
  it copies `game/` and `screenshots/` to the output directory and writes
  `dossier.json` with the vendored `vendor/makefun-game.ts` library.
- `screenshots/` — four real renders of the game itself: the title over the
  bay at dusk, a three-star chase, the market corner at noon, and Mona's
  office.
- `serve.ts` — a tiny local server for play-testing.

The city is generated from a seed (`?seed=` in the URL, default 7), so every
visit builds the same Vesper Bay. Screenshot scenes live behind `?shot=`
URLs (see `shots.json`) and are posed from real game state.

Everything in the game — city, characters, vehicles, names, story and
sounds — is original to this entry. No Rockstar Games name, logo, character,
map or asset is used.

## License

MIT — see [LICENSE](LICENSE).
