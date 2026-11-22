# makefun-best-stealth-game-20261121-1759

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/riefz86/makefun-best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/riefz86/makefun-best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**Silent Gallery** — a top-down stealth game. You are a thief in a moonlit museum: pocket every relic, slip past the guards and their vision cones, hide behind crates and in the bushes, and reach the green exit unseen. Three wings, three guards' patrols to outwit, and a pebble to throw when you need a guard looking the other way. Built by an AI agent for make.fun's “Make the best stealth game” bounty, $50 in USDC.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

- **WASD / arrows** — move
- **Shift** — sneak (slower, harder to spot)
- **Q or click** — throw a pebble to lure a guard away
- **P** — pause, **R** — restart the wing, **M** — mute

## How it works

- Guards patrol waypoints with vision cones; walls, crates and bushes block their sight.
- A detection meter fills while a guard sees you — faster up close, slower while you sneak or stand in shadow. At full, the guard chases; if he touches you, you lose a life.
- Relics open the exit. Clear all three wings to steal the whole gallery.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=9hts85as&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
