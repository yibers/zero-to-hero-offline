# Zero to Hero — Client-Side Edition

A fully client-side reimplementation of [Zero to Hero](https://zerotohero.fly.dev), a Haskell type puzzle game where you implement a `zeroToHero` function to convert between types using only the provided functions.

## What is this?

The original **Zero to Hero** is a research project from [Monash University](https://www.monash.edu/) studying how programmers understand polymorphic types in Haskell. It was created by:

- **Shuai Fu** — Ph.D. student, Dept. of Human Centred Computing
- **Prof. Tim Dwyer** — Dept. of Human Centred Computing
- **Prof. Peter J. Stuckey** — Dept. of Data Science and AI

The original game also features **GeckoGraph**, a visual notation for polymorphic types. Their research paper is available at [arXiv:2405.12699](https://arxiv.org/abs/2405.12699).

## What we did here

This reimplements the game with no server dependencies:

- **Client-side type checker** — Hindley-Milner type inference engine written in JavaScript, replacing the original's server-side GHC calls
- **15 levels** — 10 original levels plus 5 monad levels (Functor, Applicative, Monad, MonadFish, MonadJoin)
- **GeckoGraph rendering** — SVG-based gecko graph visualization running entirely in the browser
- **Self-hosted fonts** — Fira Code, Exo, and Orbitron in `fonts/` (OFL licensed)
- **Offline-capable** — Works by opening `index.html` directly, no web server needed

### File structure

```
index.html      — Main app (~50KB)
levels.js       — 15 puzzle definitions
fonts/          — Exo, Fira Code, Orbitron (.ttf)
fonts/LICENSE   — SIL Open Font License
tests/          — Playwright + unit tests
```

### Features matching the original

- Live type inference as you type
- GeckoGraph toggle for visual type display
- Prev / Attempt / Bypass / Next navigation
- Bypass points earned by solving levels
- Intro dialog and level completion dialogs
- Solved (✓) and Optimal (★) indicators per level

### Additional features

- Editor contents persisted in localStorage
- "Show optimal solution" link on non-optimal completion
- "Try again" option to improve your solution

## Running

Open `index.html` in a browser. That's it.

## Testing

```bash
npx playwright test
```

Runs 15 Playwright end-to-end tests covering UI rendering, type inference, level completion flow, and gecko graph display.

## Attribution

All game design, puzzle design, and GeckoGraph notation credit belongs to the original authors at Monash University. This was built as a learning exercise and for offline use. The original game is at [zerotohero.fly.dev](https://zerotohero.fly.dev).
