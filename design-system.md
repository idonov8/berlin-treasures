# Berlin Treasures — Design System

Everything visual on the page is driven from a small set of tokens. Adjust the values here
and mirror them in the two places they live:

- **Colours, type, spacing, effects** → the `:root` block at the top of [`styles.css`](styles.css)
- **Physics behaviour** → the `CONFIG` object at the top of [`physics.js`](physics.js)
- **Hero illustration** → [`assets/hero-can.png`](assets/hero-can.png) (swap the file to change it)
- **Physics sprites** → [`assets/trashcan.svg`](assets/trashcan.svg) (body, lid removed),
  [`assets/can-lid.svg`](assets/can-lid.svg) (the separate lid), [`assets/coin.svg`](assets/coin.svg)
- **Copy (headings/quote/links)** → the markup in [`index.html`](index.html)

This file is the human-readable spec. The CSS/JS files are the source of truth the browser
reads — keep them in sync when you tweak.

---

## 1. Colour

| Token | Value | Used for |
|---|---|---|
| `--bg-center` | `#aede54` | radial gradient centre (bright yellow-green) |
| `--bg-mid` | `#6aa62f` | radial gradient middle |
| `--bg-edge` | `#33611b` | radial gradient outer edge (dark forest) |
| `--gold-shine` | `#fff4b8` | coin/title top highlight |
| `--gold` | `#ffd23f` | primary gold |
| `--gold-deep` | `#f0a017` | gold shadow tone |
| `--gold-dark` | `#c47f00` | deepest gold / coin edge |
| `--can-light` | `#cdd2d7` | trash-can highlight |
| `--can` | `#aab0b6` | trash-can base grey |
| `--can-dark` | `#7f878e` | trash-can shadow grey |
| `--outline` | `#243528` | universal dark cartoon outline |
| `--text-cream` | `#fff7e2` | body copy on the gradient |
| `--text-quote` | `#eafcbf` | the quote |

The background is `radial-gradient(circle at 50% 42%, var(--bg-center), var(--bg-mid) 55%, var(--bg-edge) 100%)`.

## 2. Typography

| Token | Value |
|---|---|
| `--font-display` | `"Bungee"` — bold urban/street-sign title font |
| `--font-body` | `"Baloo 2"` — everything else (rounded, friendly) |

Loaded from Google Fonts in [`index.html`](index.html)'s `<head>`. To swap fonts, change that
`<link>` and these two tokens. System fallbacks (`sans-serif` / `system-ui`) keep the page
legible if the fonts fail to load. To go fully offline/self-contained, download the `woff2`
files into `assets/fonts/` and replace the `<link>` with local `@font-face` rules.

- **Title** — display font, gold vertical gradient fill, dark outline (`paint-order` stroke),
  drop shadow. Size `clamp(2.6rem, 9vw, 6rem)`.
- **Quote** — body font italic, `--text-quote`, size `clamp(1.1rem, 3.2vw, 1.9rem)`.
- **Welcome line** — body font 700. **Sub-line** — body font 500, slightly muted.

## 3. Spacing & effects

| Token | Value | Meaning |
|---|---|---|
| `--hero-max` | `760px` | max width of the centred content column |
| `--stack-gap` | `clamp(0.7rem, 2.2vh, 1.4rem)` | vertical rhythm between hero elements |
| `--outline-w` | `3px` | title stroke width |
| `--radius` | `999px` | pill radius (Telegram button) |
| `--shadow-drop` | `0 6px 0 rgba(0,0,0,.22)` | chunky cartoon drop shadow |

The **Telegram button** is a gold pill with the dark outline + drop shadow; it lifts on hover.

## 4. Physics knobs (`CONFIG` in `physics.js`)

Desktop defaults, with lighter mobile caps applied automatically when `innerWidth < 768`.

| Key | Desktop | Mobile | Meaning |
|---|---|---|---|
| `gravityY` | `1.0` | `1.0` | fall strength |
| `initialCans` | `9` | `5` | cans that rain in on load |
| `spawnStaggerMs` | `240` | `340` | delay between each can dropping |
| `maxCoins` | `130` | `70` | global coin cap (oldest recycled past this) — the real limit on total gold |
| `spillBurst` | `5` | `4` | coins released per spill event |
| `coinRadiusMin` / `coinRadiusMax` | `4` – `7` | `3.5` – `5.5` | random coin size range (px) — kept tiny |
| `coinOvalMin` / `coinOvalMax` | `0.55` – `1.5` | same | per-axis random stretch → true oval coins, randomly oriented |
| `canScale` | `0.52` | `0.44` | trash-can sprite scale (small) |
| `lidScale` | `0.54` | `0.46` | lid sprite scale — the lid is its own free body |
| `restitution` | `0.42` | `0.42` | bounciness (0 = dead, 1 = super bouncy) |
| `friction` | `0.05` | `0.05` | surface grip |
| `shakeAngularWeight` | `26` | `26` | how much spin counts toward the "shake" metric |
| `shakeThreshold` | `5` | `5` | combined speed+spin metric that triggers a spill |
| `spillCooldownMs` | `240` | `240` | min gap between a can's spills |

**Lid behaviour:** each can spawns with its own lid as an independent body (no constraint
between them) — it pops off immediately and tumbles on its own trajectory, and can be dragged
and thrown separately from the can. **Spilling:** a can spills a small burst of coins whenever
its "shake" metric (`speed + |angularVelocity| × shakeAngularWeight`) crosses `shakeThreshold` —
this fires both on hard impacts *and* while you swing a grabbed can around mid-air. There is no
per-can limit (swinging always pours gold); the total on screen is bounded only by `maxCoins`
(oldest coins recycled) and the rate by `spillCooldownMs`.

**Accessibility:** when the OS requests reduced motion, the rain is skipped — a few cans rest
at the bottom instead and nothing auto-spills. Cans and lids stay draggable in all modes.
