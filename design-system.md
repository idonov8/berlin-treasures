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

A printed-poster green rather than a candy/game green — darker, less neon, so gold and paper
elements pop instead of everything competing at the same brightness.

| Token | Value | Used for |
|---|---|---|
| `--bg-center` | `#bfdf70` | radial gradient centre (kept small — see §3 vignette) |
| `--bg-mid` | `#5c8c34` | radial gradient middle |
| `--bg-edge` | `#16300f` | radial gradient outer edge (deep pine) |
| `--gold` | `#ffd23f` | primary gold |
| `--gold-shine` | `#fff4b8` | coin highlight (coins only — kept off the title, see §2) |
| `--gold-deep` | `#f0a017` | gold shadow tone / title gradient base |
| `--gold-dark` | `#c47f00` | deepest gold / coin edge / button border |
| `--can-light` | `#cdd2d7` | trash-can highlight |
| `--can` | `#aab0b6` | trash-can base grey |
| `--can-dark` | `#7f878e` | trash-can shadow grey |
| `--outline` | `#243528` | deep ink — borders/text *on paper*, used sparingly (not a cartoon stroke) |
| `--riso-shadow` | `#0f2b19` | duotone offset behind the title, like mis-registered print |
| `--text-cream` | `#fff7e2` | body copy on the gradient |
| `--paper` | `#f3e6c8` | kraft-tag / quote-card background |
| `--paper-edge` | `#d9c194` | paper shadow/edge tone |

The background layers a bottom vignette (grounds the can pile in shadow) over the radial
gradient, centred high (`18%` from the top) so the brightest zone stays around the hero can
and the title/quote sit in the darker mid-tone where gold and paper actually contrast:
`radial-gradient(120% 70% at 50% 108%, rgba(0,0,0,.4), transparent 62%), radial-gradient(circle at 50% 18%, var(--bg-center) 0%, var(--bg-mid) 42%, var(--bg-edge) 100%)`.
A faint SVG-noise grain (`.grain`, ~5% opacity, `mix-blend-mode: overlay`) sits above the
canvas to unify the flat gradient and the sprites into one surface — it's `pointer-events:none`
so it never blocks dragging.

## 2. Typography

| Token | Value |
|---|---|
| `--font-display` | `"Cal Sans"` — bold geometric sans title font |
| `--font-body` | `"Baloo 2"` — everything else (rounded, friendly) |
| `--font-label` | `"Courier Prime"` — typewriter font for the small tag/label accent |

Loaded from Google Fonts in [`index.html`](index.html)'s `<head>`. To swap fonts, change that
`<link>` and these tokens. System fallbacks (`sans-serif` / `system-ui` / `monospace`) keep the
page legible if the fonts fail to load. To go fully offline/self-contained, download the
`woff2` files into `assets/fonts/` and replace the `<link>` with local `@font-face` rules.

- **Title** — always forced onto two lines ("Berlin" / "Treasures", one word per line, via
  child `<span>`s — not just wrapped text) on every viewport, mobile included. A **duotone
  offset-print** treatment rather than a thick cartoon outline: gold vertical gradient fill,
  a *thin* 1.5px ink stroke just for edge definition, plus a hard unblurred
  `text-shadow: 5px 6px 0 var(--riso-shadow)` — like a slightly mis-registered screen print.
  Size `clamp(2.8rem, 12vw, 6rem)`.
- **Quote** — styled as a small rotated paper card (see §3), not text floating on the gradient.
- **Welcome line** — body font 700. **Sub-line** — body font 500, slightly muted.
- **Found tag** — `--font-label`, uppercase, small, on a `--paper` chip near the hero can.

## 3. Spacing & effects

| Token | Value | Meaning |
|---|---|---|
| `--hero-max` | `760px` | max width of the centred content column |
| `--stack-gap` | `clamp(0.7rem, 2.2vh, 1.4rem)` | vertical rhythm between hero elements |
| `--radius` | `999px` | pill radius (Telegram button) |
| `--radius-card` | `14px` | corner radius for the quote/tag paper cards |
| `--shadow-soft` | `0 16px 28px rgba(6,18,9,.38)` | ambient lift (button) |
| `--shadow-card` | `0 10px 18px rgba(6,18,9,.3)` | ambient lift (paper cards) |

The **Telegram button** is a gold pill with a thin `--gold-dark` border and a soft ambient
shadow (no hard cartoon offset) — it lifts smoothly on hover instead of jumping. The **quote**
and **found tag** are `--paper` cards, slightly rotated, like something torn off a market
stall — this is the main device that ties the "flea market find" concept together.

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
